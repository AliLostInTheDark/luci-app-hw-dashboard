# Shared helpers for the luci.hwdash* rpcd objects.
#
# rpcd's shell plugin re-execs and re-parses the whole script on every
# call, so the dashboard was paying to parse all 4161 lines of a single
# object 46 times per 30s. The methods now live in separate objects and
# this carries what more than one of them needs.

# Escape a string for embedding in JSON. Sysfs/proc values almost never
# contain characters that need escaping, so the common case returns via the
# printf builtin with zero exec()s; the sed pipeline (2 extra processes per
# call, dozens of calls per poll) only runs for a string that actually
# contains a quote, backslash or control character.
# json_esc sets JSV to the escaped value with zero forks in the common case
# — even a builtin-only $(json_str ...) still costs a subshell fork per call,
# which adds up in the per-poll loops. json_str stays as a thin wrapper for
# call sites inside TTL-cached blocks where the fork happens rarely.
json_esc() {
	case "$1" in
		*[\"\\]*|*[[:cntrl:]]*)
			JSV=$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/[[:cntrl:]]//g') ;;
		*)
			JSV=$1 ;;
	esac
}
json_str() { json_esc "$1"; printf '%s' "$JSV"; }

read_file() {
	# Reads the first line of $2 into the variable named $1 (default $3).
	# Uses a local for the value + a literal assignment instead of the old
	# $(eval echo ...) — that forked a subshell on every call (dozens per
	# poll) and would execute command substitutions embedded in a hostile
	# sysfs value (e.g. a crafted USB device model). RHS parameter expansion
	# is not re-evaluated, so this is both faster and injection-safe.
	local __var=$1 __file=$2 __default=$3 __val=""
	[ -f "$__file" ] && read -r __val 2>/dev/null < "$__file"
	[ -n "$__val" ] || __val=$__default
	eval "$__var=\$__val"
}

# TTL caches skip recomputing static/slow-changing data (wifi, storage
# inventory, fs types) on every poll — the dominant CPU cost was forking
# dozens of iwinfo/iw/uci/awk subprocesses every 3s for data that rarely
# changes. Cache file format: line 1 = absolute expiry epoch, line 2 =
# single-line payload. Freshness is a builtin read + compare against
# HWDASH_NOW (resolved once per invocation) — zero forks per check,
# unlike the old mtime scheme which forked date -r on every check.
_cache_read() {
	# Sets C_VAL to the payload and returns 0 if cache file $1 is fresh.
	C_VAL=""
	[ -f "$1" ] || return 1
	case "$HWDASH_NOW" in ''|*[!0-9]*) return 1 ;; esac
	local _exp=""
	{ read -r _exp && read -r C_VAL; } < "$1" 2>/dev/null
	case "$_exp" in ''|*[!0-9]*) return 1 ;; esac
	[ "$HWDASH_NOW" -lt "$_exp" ]
}
_cache_write() {
	# $1=file $2=TTL seconds $3=single-line payload
	printf '%s\n%s\n' "$((HWDASH_NOW + $2))" "$3" > "$1.$$" 2>/dev/null && \
		mv "$1.$$" "$1" 2>/dev/null
}

# Same mount-safety check as the collector's own copy (see its longer
# comment): a plain directory that merely looks like a USB mountpoint is the
# dangerous case, since after the drive is unplugged the old mountpoint is
# still an ordinary, silently-writable directory on internal flash. The two
# scripts do not share a library, so this is duplicated rather than sourced.
_persist_mount_ok() {
	_pm_dir=$1
	[ -d "$_pm_dir" ] || return 1
	_pm_best=""
	while read -r _pm_dev _pm_mp _pm_fs _pm_rest; do
		case "$_pm_mp" in
			/|/overlay|/rom|/tmp|/dev|/proc|/sys) continue ;;
		esac
		case "$_pm_dir" in
			"$_pm_mp"|"$_pm_mp"/*)
				[ ${#_pm_mp} -gt ${#_pm_best} ] && _pm_best=$_pm_mp
				;;
		esac
	done < /proc/mounts
	[ -n "$_pm_best" ]
}
NAT_CACHE_DIR=/tmp/hwdash

_has_stunclient() {
	[ -x /usr/bin/stunclient ] || [ -x /usr/sbin/stunclient ] || [ -x /bin/stunclient ] || command -v stunclient >/dev/null 2>&1 || which stunclient >/dev/null 2>&1
}
