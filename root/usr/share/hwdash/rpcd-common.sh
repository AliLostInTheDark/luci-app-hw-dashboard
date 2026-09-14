# Shared helpers for the luci.hwdash* rpcd objects. rpcd re-parses a plugin on
# every call, so keep this to what more than one object needs.

# Sets JSV to $1 escaped for a JSON string. Builtins only unless the value holds
# a quote, backslash or control character: this runs dozens of times per poll,
# and even a builtin-only $(json_str ...) costs a subshell fork.
json_esc() {
	case "$1" in
		*[\"\\]*|*[[:cntrl:]]*)
			JSV=$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/[[:cntrl:]]//g') ;;
		*)
			JSV=$1 ;;
	esac
}
json_str() { json_esc "$1"; printf '%s' "$JSV"; }

# read_file VAR FILE DEFAULT: first line of FILE into VAR. The literal assignment
# never re-evaluates the value, so a hostile sysfs string cannot run a command.
read_file() {
	local __var=$1 __file=$2 __default=$3 __val=""
	[ -f "$__file" ] && read -r __val 2>/dev/null < "$__file"
	[ -n "$__val" ] || __val=$__default
	eval "$__var=\$__val"
}

# TTL cache file: line 1 is the expiry epoch, line 2 a one-line payload. Checked
# against HWDASH_NOW (set once per call) with builtins, so a hit costs no fork.
# _cache_read FILE sets C_VAL and returns 0 while FILE is fresh.
_cache_read() {
	C_VAL=""
	[ -f "$1" ] || return 1
	case "$HWDASH_NOW" in ''|*[!0-9]*) return 1 ;; esac
	local _exp=""
	{ read -r _exp && read -r C_VAL; } < "$1" 2>/dev/null
	case "$_exp" in ''|*[!0-9]*) return 1 ;; esac
	[ "$HWDASH_NOW" -lt "$_exp" ]
}
# _cache_write FILE TTL PAYLOAD
_cache_write() {
	printf '%s\n%s\n' "$((HWDASH_NOW + $2))" "$3" > "$1.$$" 2>/dev/null && \
		mv "$1.$$" "$1" 2>/dev/null
}

# 0 when $1 lies under a real mount other than a system one. An unplugged USB
# drive leaves its mountpoint behind as a plain, writable directory on internal
# flash, so the directory existing proves nothing. Mirrors hwdash-wanmon's copy.
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
	[ -x /usr/bin/stunclient ] || [ -x /usr/sbin/stunclient ] || [ -x /bin/stunclient ] ||
		command -v stunclient >/dev/null 2>&1 || which stunclient >/dev/null 2>&1
}
