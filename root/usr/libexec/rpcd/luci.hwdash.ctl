#!/bin/sh

. /usr/share/hwdash/rpcd-common.sh

# The only packages the Settings panel can install or remove. The page sends one
# of these names, never a command line, and nothing else ever reaches apk.
PKG_OPTIONAL="stuntman-client ethtool-full smartmontools lscpu dmidecode kmod-hwmon-nct6775 kmod-hwmon-it87"
PKG_JOB=/tmp/hwdash-pkg.job
PKG_LOG=/tmp/hwdash-pkg.log

# Settings live in UCI so that sysupgrade and backups keep them.
_settings_save() {
	uci -q set hwdash.main=settings
	uci -q set hwdash.main.settings_json="$1"
	uci -q commit hwdash
}

# Moves settings out of the pre-UCI /etc/hwdash-settings.json.
_settings_migrate() {
	[ -f /etc/hwdash-settings.json ] || return
	_leg=$(cat /etc/hwdash-settings.json 2>/dev/null)
	[ -n "$_leg" ] && _settings_save "$_leg"
	rm -f /etc/hwdash-settings.json
}

# Relays the raw WAN probe targets to the collector, which owns resolution and
# the fallbacks: empty means "use your built-in spread", not a default target.
# WANTGT_V lets it ignore a file from a mismatched version mid-upgrade.
_sync_wan_targets() {
	_raw=$1
	[ -z "$_raw" ] && _raw=$(uci -q get hwdash.main.settings_json 2>/dev/null)
	_t4=""; _t6=""
	if [ -n "$_raw" ] && command -v jsonfilter >/dev/null; then
		eval "$(printf '%s' "$_raw" | jsonfilter -e '_t4=@.wanTarget4' -e '_t6=@.wanTarget6' 2>/dev/null)"
	fi
	# The collector sources this file as root: keep only address characters.
	_t4=$(printf '%s' "$_t4" | tr -cd 'A-Za-z0-9.:_ -')
	_t6=$(printf '%s' "$_t6" | tr -cd 'A-Za-z0-9.:_ -')
	mkdir -p /tmp/hwdash_wanmon 2>/dev/null
	printf 'WANTGT_V=2\nWANTGT4="%s"\nWANTGT6="%s"\n' "$_t4" "$_t6" \
		> /tmp/hwdash_wanmon/.wan_targets.$$ 2>/dev/null && \
		mv /tmp/hwdash_wanmon/.wan_targets.$$ /tmp/hwdash_wanmon/.wan_targets 2>/dev/null
}

# Relays the optional persist_dir the same way, since the collector does not
# read UCI on every tick.
_sync_persist_dir() {
	_raw=$1
	[ -z "$_raw" ] && _raw=$(uci -q get hwdash.main.settings_json 2>/dev/null)
	_pd=""
	if [ -n "$_raw" ] && command -v jsonfilter >/dev/null; then
		eval "$(printf '%s' "$_raw" | jsonfilter -e '_pd=@.persistDir' 2>/dev/null)"
	fi
	# Sourced as root at the far end: keep only path characters, so no quotes,
	# $ or backticks.
	_pd=$(printf '%s' "$_pd" | tr -cd 'A-Za-z0-9/_.-')
	case "$_pd" in /*) ;; *) _pd="" ;; esac
	mkdir -p /tmp/hwdash_wanmon 2>/dev/null
	printf 'PERSISTDIR_V=1\nPERSISTDIR="%s"\n' "$_pd" \
		> /tmp/hwdash_wanmon/.persist_dir.$$ 2>/dev/null && \
		mv /tmp/hwdash_wanmon/.persist_dir.$$ /tmp/hwdash_wanmon/.persist_dir 2>/dev/null
}

_get_config() {
	_settings_migrate
	_res=$(uci -q get hwdash.main.settings_json 2>/dev/null)
	[ -n "$_res" ] && echo "$_res" || echo '{}'
	_sync_wan_targets "$_res"
	_sync_persist_dir "$_res"
}

_set_config() {
	_IN=""
	IFS= read -r _IN 2>/dev/null
	_CFG=""
	if [ -n "$_IN" ] && command -v jsonfilter >/dev/null; then
		_CFG=$(printf '%s' "$_IN" | head -c 16384 | jsonfilter -e '@.params[0]' -e '@.config' 2>/dev/null)
	fi
	if [ -z "$_CFG" ]; then
		echo '{"result":"invalid"}'
		return
	fi
	_settings_save "$_CFG"
	_sync_wan_targets "$_CFG"
	_sync_persist_dir "$_CFG"
	echo '{"result":"ok"}'
}

_pkg_known() {
	case "$1" in ''|*[!a-z0-9-]*) return 1 ;; esac
	case " $PKG_OPTIONAL " in *" $1 "*) return 0 ;; esac
	return 1
}

_pkg_arch() {
	PKG_ARCH=$(apk --print-arch 2>/dev/null)
	[ -z "$PKG_ARCH" ] && [ -f /etc/apk/arch ] && read -r PKG_ARCH < /etc/apk/arch
}

# dmidecode and the Super I/O kmods are x86-only.
_pkg_arch_ok() {
	case "$1" in
		dmidecode|kmod-hwmon-*)
			case "$PKG_ARCH" in x86_64|x86|i386|i486|i586|i686) return 0 ;; esac
			return 1 ;;
	esac
	return 0
}

# 0 when what the package provides is already on the router without apk: a
# hand-copied binary, or a built-in or hand-loaded driver. Such a package is
# never installed: apk would take the file over, and Remove would delete it.
_pkg_present() {
	case "$1" in
		stuntman-client) _has_stunclient ;;
		smartmontools) command -v smartctl >/dev/null 2>&1 ;;
		lscpu|dmidecode) command -v "$1" >/dev/null 2>&1 ;;
		kmod-hwmon-*) [ -d "/sys/module/${1#kmod-hwmon-}" ] ;;
		*) return 1 ;;
	esac
}

# Installed packages that depend on $1, as bare names, into PKG_REQ. Remove is
# offered only when this is empty, since apk would refuse anyway.
_pkg_required_by() {
	local _l
	PKG_REQ=""
	while IFS= read -r _l; do
		[ -n "$_l" ] || continue
		case "$_l" in *" is required by:"*) continue ;; esac
		PKG_REQ="${PKG_REQ:+$PKG_REQ, }${_l%%-[0-9]*}"
	done <<EOF
$(apk info -r "$1" 2>/dev/null)
EOF
}

# 0 while a job is running. One older than ten minutes is taken as dead (apk
# killed mid-way), so it cannot wedge the panel.
_pkg_busy() {
	local _id _op _pk _st _rc
	[ -f "$PKG_JOB" ] || return 1
	read -r _id _op _pk _st _rc < "$PKG_JOB"
	[ "$_st" = "running" ] || return 1
	case "$_id" in ''|*[!0-9]*) return 1 ;; esac
	[ $(($(date +%s) - _id)) -lt 600 ]
}

# Runs detached, since apk update + add can outlast rpcd's 30 s call timeout.
# The dashboard's caches for the package are dropped afterwards, so the next
# poll shows the change.
_pkg_run() {
	local _op=$1 _pk=$2 _id=$3 _rc
	if [ "$_op" = "add" ]; then
		apk update > "$PKG_LOG" 2>&1
		apk add "$_pk" >> "$PKG_LOG" 2>&1; _rc=$?
	else
		apk del "$_pk" > "$PKG_LOG" 2>&1; _rc=$?
	fi
	case "$_pk" in
		ethtool-full) rm -f /tmp/hwdash_ethtool.cache /tmp/hwdash_ethtool.cache.lock ;;
		smartmontools) rm -f /tmp/hwdash_nvme_smart_* ;;
		lscpu) rm -f /tmp/hwdash/sys_static_v2.frag ;;
		dmidecode) rm -f /tmp/hwdash_ddr_speed ;;
		kmod-hwmon-*)
			# Load or unload the driver now, not at the next reboot.
			if [ $_rc -eq 0 ]; then
				if [ "$_op" = "add" ]; then modprobe "${_pk#kmod-hwmon-}" >/dev/null 2>&1
				else rmmod "${_pk#kmod-hwmon-}" >/dev/null 2>&1; fi
			fi ;;
	esac
	printf '%s %s %s done %s\n' "$_id" "$_op" "$_pk" "$_rc" > "$PKG_JOB"
}

_pkg_start() {
	local _jid
	_jid=$(date +%s)
	printf '%s %s %s running -\n' "$_jid" "$1" "$2" > "$PKG_JOB"
	: > "$PKG_LOG"
	_pkg_run "$1" "$2" "$_jid" </dev/null >/dev/null 2>&1 &
	echo "{\"result\":\"started\",\"id\":\"$_jid\"}"
}

# The pkg_status row for package $1 into PKG_ROW, from _idx, _avail and _inst.
_pkg_row() {
	local _i=0 _a=-1 _ok=1 _x=0
	case "$_inst" in *" $1 "*) _i=1 ;; esac
	if [ $_idx -eq 1 ]; then
		_a=0; case "$_avail" in *" $1-"[0-9]*) _a=1 ;; esac
	fi
	_pkg_arch_ok "$1" || _ok=0
	[ $_i -eq 0 ] && _pkg_present "$1" && _x=1
	PKG_REQ=""; [ $_i -eq 1 ] && _pkg_required_by "$1"
	json_esc "$PKG_REQ"
	PKG_ROW="{\"name\":\"$1\",\"installed\":$_i,\"available\":$_a,\"arch_ok\":$_ok,\"external\":$_x,\"required_by\":\"$JSV\"}"
}

# The last job into PKG_JOB_JSON, or null. A job left "running" by a dead apk
# reads as done with rc -1; msg is apk's ERROR line if any, else its last line.
_pkg_job_json() {
	local _jid _jop _jpk _jst _jrc _jmsg="" _jerr="" _l
	PKG_JOB_JSON="null"
	[ -f "$PKG_JOB" ] || return
	read -r _jid _jop _jpk _jst _jrc < "$PKG_JOB"
	case "$_jrc" in ''|*[!0-9]*) _jrc=-1 ;; esac
	[ "$_jst" = "running" ] && ! _pkg_busy && { _jst="done"; _jrc=-1; }
	if [ -f "$PKG_LOG" ]; then
		while IFS= read -r _l; do
			[ -n "$_l" ] || continue
			_jmsg=$_l
			case "$_l" in ERROR*) [ -z "$_jerr" ] && _jerr=$_l ;; esac
		done < "$PKG_LOG"
	fi
	json_esc "${_jerr:-$_jmsg}"
	PKG_JOB_JSON="{\"id\":\"$_jid\",\"op\":\"$_jop\",\"pkg\":\"$_jpk\",\"state\":\"$_jst\",\"rc\":$_jrc,\"msg\":\"$JSV\"}"
}

# Availability comes from the cached apk index alone, never the network. With
# no index yet (fresh boot) it is unknown (-1), not missing; Install fetches it.
_pkg_status() {
	_pkg_arch
	_idx=0
	for _f in /var/cache/apk/APKINDEX.* /etc/apk/cache/APKINDEX.*; do
		[ -f "$_f" ] && { _idx=1; break; }
	done
	_avail=" "
	[ $_idx -eq 1 ] && _avail=" $(apk search --exact $PKG_OPTIONAL 2>/dev/null | tr '\n' ' ') "
	_inst=" $(sed -n 's/^P://p' /lib/apk/db/installed 2>/dev/null | tr '\n' ' ') "
	_out=""
	for _p in $PKG_OPTIONAL; do
		_pkg_row "$_p"
		_out="$_out${_out:+,}$PKG_ROW"
	done
	_pkg_job_json
	json_esc "$PKG_ARCH"
	echo "{\"arch\":\"$JSV\",\"index\":$_idx,\"job\":$PKG_JOB_JSON,\"pkgs\":[$_out]}"
}

_pkg_action() {
	_IN=""
	IFS= read -r _IN 2>/dev/null
	_PK=""; _PO=""
	if [ -n "$_IN" ] && command -v jsonfilter >/dev/null; then
		eval "$(printf '%s' "$_IN" | head -c 512 | jsonfilter -e '_PK=@.pkg' -e '_PO=@.op' 2>/dev/null)"
	fi
	_pkg_arch
	if ! _pkg_known "$_PK" || { [ "$_PO" != "add" ] && [ "$_PO" != "del" ]; }; then
		echo '{"result":"invalid"}'
	elif ! _pkg_arch_ok "$_PK"; then
		echo '{"result":"unavailable"}'
	elif _pkg_busy; then
		echo '{"result":"busy"}'
	elif [ "$_PO" = "add" ] && ! grep -qx "P:$_PK" /lib/apk/db/installed && _pkg_present "$_PK"; then
		echo '{"result":"present"}'
	else
		PKG_REQ=""; [ "$_PO" = "del" ] && _pkg_required_by "$_PK"
		if [ -n "$PKG_REQ" ]; then
			json_esc "$PKG_REQ"
			echo "{\"result\":\"required\",\"required_by\":\"$JSV\"}"
		else
			_pkg_start "$_PO" "$_PK"
		fi
	fi
}

# NAT discovery only runs on request: a full RFC 5780 probe takes seconds and
# sends to alternate STUN server addresses, so it must stay out of the poll.

_nat_code() {
	case "$1" in
		"Direct Mapping") printf '%s' direct ;;
		"Endpoint Independent Mapping"|"Endpoint Independent Filtering") printf '%s' endpoint_independent ;;
		"Address Dependent Mapping"|"Address Dependent Filtering") printf '%s' address_dependent ;;
		"Address and Port Dependent Mapping"|"Address and Port Dependent Filtering") printf '%s' address_port_dependent ;;
		*) printf '%s' unknown ;;
	esac
}

# The mapping sets the console-style level. Filtering only splits an endpoint-
# independent mapping into cone types; dependent mappings are symmetric NAT.
_nat_level() {
	case "$1" in
		direct) printf '%s' open ;;
		endpoint_independent)
			case "$2" in
				direct|endpoint_independent) printf '%s' open ;;
				*) printf '%s' moderate ;;
			esac
			;;
		address_dependent|address_port_dependent) printf '%s' strict ;;
		*) printf '%s' unknown ;;
	esac
}

_get_stunclient() {
	if [ -x /usr/bin/stunclient ]; then echo "/usr/bin/stunclient"
	elif [ -x /usr/sbin/stunclient ]; then echo "/usr/sbin/stunclient"
	elif [ -x /bin/stunclient ]; then echo "/bin/stunclient"
	else command -v stunclient 2>/dev/null || echo "stunclient"
	fi
}

# One stunclient run into $_nat_tmp; 0 if it produced an answer.
_nat_try() {
	$_nat_bin --mode full --family 4 --protocol udp "$@" > "$_nat_tmp" 2>/dev/null
	grep -qi -e 'Nat behavior:' -e 'Binding test: success' "$_nat_tmp" 2>/dev/null
}

# Probes from IPv4 address $1 into file $2, per server first bound to that
# address, then unbound.
_nat_probe() {
	_nat_bind=$1; _nat_tmp=$2
	_nat_bin=$(_get_stunclient)
	for _nat_se in stun.miwifi.com:3478 stun.cloudflare.com:3478; do
		_nat_srv=${_nat_se%%:*}; _nat_prt=${_nat_se##*:}
		[ -n "$_nat_bind" ] && _nat_try --localaddr "$_nat_bind" "$_nat_srv" "$_nat_prt" && return 0
		_nat_try "$_nat_srv" "$_nat_prt" && return 0
	done
}

_nat_json() {
	_nat_jfamily=$1; _nat_jaddr=$2; _nat_jstate=$3; _nat_jmap=$4; _nat_jfilter=$5; _nat_jpub=$6
	[ -n "$_nat_jpub" ] || _nat_jpub="—"
	json_esc "$_nat_jaddr"; _nat_jaddr=$JSV
	json_esc "$_nat_jpub"; _nat_jpub=$JSV
	json_esc "$_nat_jstate"; _nat_jstate=$JSV
	json_esc "$_nat_jmap"; _nat_jmap=$JSV
	json_esc "$_nat_jfilter"; _nat_jfilter=$JSV
	printf '{"family":"%s","address":"%s","pub":"%s","state":"%s","mapping":"%s","filtering":"%s"}' \
		"$_nat_jfamily" "$_nat_jaddr" "$_nat_jpub" "$_nat_jstate" "$_nat_jmap" "$_nat_jfilter"
}

# Prints "<state> <mapping> <filtering> <public address>" from stunclient
# output file $1.
_nat_parse_out() {
	_p_file=$1
	_p_map=$(sed -n 's/^[Nn]at behavior:[[:space:]]*//p' "$_p_file" 2>/dev/null | head -1)
	_p_filter=$(sed -n 's/^[Nn]at filtering:[[:space:]]*//p' "$_p_file" 2>/dev/null | head -1)
	# Strip only a trailing port: stunclient puts it after ':' for IPv4 but '.'
	# for IPv6, whose address is itself full of colons.
	_p_mapped=$(sed -n 's/^[Mm]apped address:[[:space:]]*\(.*\)[.:][0-9][0-9]*[[:space:]]*$/\1/p' "$_p_file" 2>/dev/null | head -1)
	_p_m=$(_nat_code "$_p_map"); _p_f=$(_nat_code "$_p_filter")
	_p_s="unavailable"
	grep -qi 'Binding test: success' "$_p_file" 2>/dev/null && _p_s=$(_nat_level "$_p_m" "$_p_f")
	echo "$_p_s $_p_m $_p_f ${_p_mapped:-—}"
}

# Only a WAN this dashboard tracks may be probed, so a hand-made RPC cannot
# test LAN or unrelated tunnel interfaces.
_nat_tracked() {
	local _tr=""
	[ -f /tmp/hwdash_wanmon/.tracked ] && _tr=$(tr '\n' ' ' < /tmp/hwdash_wanmon/.tracked 2>/dev/null)
	case " $_tr " in *" $1 "*) return 0 ;; esac
	return 1
}

# ubus has no parent field, so the parent comes from uci's device='@wanb' alias
# form; failing that, from ubus's .device, which only works when a literal
# device name happens to equal an interface name (device='wan').
_nat_parent_v4() {
	local _parent="" _uci _pstatus
	_uci=$(uci -q show network 2>/dev/null)
	case "$_uci" in
		*"network.$_nat_if.device='@"*)
			_parent=${_uci#*network.$_nat_if.device=\'@}
			_parent=${_parent%%\'*}
			;;
	esac
	[ -n "$_parent" ] || _parent=$(printf '%s' "$_nat_status" | jsonfilter -e '@.parent' -e '@.device' 2>/dev/null)
	if [ -n "$_parent" ] && [ "$_parent" != "$_nat_if" ]; then
		_pstatus=$(ubus call "network.interface.$_parent" status 2>/dev/null)
		[ -n "$_pstatus" ] && _nat_v4=$(printf '%s' "$_pstatus" | jsonfilter -e '@["ipv4-address"][0].address' 2>/dev/null)
	fi
}

# 464xlat is standalone, with no parent to borrow from, but netifd publishes the
# address the kernel SNATs from (RFC 7335's 192.0.0.1) as firewall data.
_nat_snat_v4() {
	_nat_snat=""; _nat_snattgt=""
	eval "$(printf '%s' "$_nat_status" | jsonfilter \
		-e '_nat_snat=@.data.firewall[0].snat_ip' \
		-e '_nat_snattgt=@.data.firewall[0].target' 2>/dev/null)" 2>/dev/null
	[ "$_nat_snattgt" = "SNAT" ] && [ -n "$_nat_snat" ] && _nat_v4="$_nat_snat"
}

# The address to probe from, into _nat_v4. IPv4 only: native IPv6 has no NAT,
# so STUN there says "open" whatever the ISP, while real CG-NAT lives on v4,
# including behind MAP-E, DS-Lite, 6rd and 464xlat.
_nat_addr() {
	_nat_v4=$(printf '%s' "$_nat_status" | jsonfilter -e '@["ipv4-address"][0].address' 2>/dev/null)
	[ -n "$_nat_v4" ] || _nat_parent_v4
	[ -n "$_nat_v4" ] || _nat_snat_v4
}

# A NAT result comes from an explicit probe, so it is kept across a reboot when
# persist_dir is set. PERSISTDIR also gates the writes, so it loads every call.
_nat_persist_load() {
	PERSISTDIR_V=""; PERSISTDIR=""
	[ -f /tmp/hwdash_wanmon/.persist_dir ] && . /tmp/hwdash_wanmon/.persist_dir 2>/dev/null
	[ "$PERSISTDIR_V" != "1" ] && PERSISTDIR=""
	if [ ! -s "$_nat_cache" ] && [ -n "$PERSISTDIR" ] && [ -f "$PERSISTDIR/nat/$_nat_if" ] && _persist_mount_ok "$PERSISTDIR"; then
		cat "$PERSISTDIR/nat/$_nat_if" > "$_nat_cache" 2>/dev/null
	fi
}

# Cache lines are "<family> <addr> <state> <mapping> <filtering> <epoch> <pub>".
# Only family 4 matches, so lines left by versions that also tested IPv6 are
# ignored and drop out on the next write.
_nat_cached() {
	local _hit=1 _cf _ca _cs _cm _cfl _ct _cp
	[ -s "$_nat_cache" ] || return 1
	while IFS=' ' read -r _cf _ca _cs _cm _cfl _ct _cp; do
		if [ "$_cf" = 4 ] && [ "$_ca" = "$_nat_v4" ] && [ "$_cs" != "unavailable" ]; then
			_nat_cached_v4=$_ca; _nat_cached_s4=$_cs; _nat_cached_m4=$_cm; _nat_cached_f4=$_cfl; _nat_cached_p4=$_cp
			_hit=0
		fi
	done < "$_nat_cache"
	return $_hit
}

# Probes _nat_v4 via temp file $1 into _nat_s4 _nat_m4 _nat_f4 _nat_p4, then
# rewrites the cache and its persistent copy.
_nat_refresh() {
	_nat_s4="unavailable"; _nat_m4="unknown"; _nat_f4="unknown"; _nat_p4="—"
	if [ -n "$_nat_v4" ]; then
		_nat_probe "$_nat_v4" "$1"
		read -r _nat_s4 _nat_m4 _nat_f4 _nat_p4 <<EOF
$(_nat_parse_out "$1")
EOF
	fi
	rm -f "$1"
	{
		[ -n "$_nat_v4" ] && printf '4 %s %s %s %s %s %s\n' "$_nat_v4" "$_nat_s4" "$_nat_m4" "$_nat_f4" "$(date +%s 2>/dev/null)" "$_nat_p4"
	} > "$_nat_cache" 2>/dev/null
	if [ -n "$PERSISTDIR" ] && _persist_mount_ok "$PERSISTDIR"; then
		mkdir -p "$PERSISTDIR/nat" 2>/dev/null
		cat "$_nat_cache" > "$PERSISTDIR/nat/$_nat_if" 2>/dev/null
	fi
}

# $1 goes in after "iface" ('"cached":true,' or empty); the rest is one result
# for _nat_json, where an empty address prints null.
_nat_reply() {
	json_esc "$_nat_if"
	printf '{"available":true,"iface":"%s",%s"v4":' "$JSV" "$1"
	shift
	if [ -n "$1" ]; then _nat_json 4 "$@"; else printf 'null'; fi
	echo '}'
}

_nat_test() {
	_nat_in=""; IFS= read -r _nat_in 2>/dev/null
	_nat_if=$(printf '%s' "$_nat_in" | jsonfilter -e '@.iface' -e '@.params[0].iface' 2>/dev/null | head -n 1)
	case "$_nat_if" in
		''|*[!A-Za-z0-9_.-]*) echo '{"available":false,"error":"invalid_interface"}'; return ;;
	esac
	if ! _has_stunclient; then
		echo '{"available":false,"error":"stunclient_not_installed"}'
		return
	fi
	if ! _nat_tracked "$_nat_if"; then
		echo '{"available":true,"error":"not_a_tracked_wan"}'
		return
	fi
	_nat_status=$(ubus call "network.interface.$_nat_if" status 2>/dev/null)
	if [ -z "$_nat_status" ]; then
		echo '{"available":true,"error":"interface_unavailable"}'
		return
	fi
	_nat_addr
	_nat_force=$(printf '%s' "$_nat_in" | jsonfilter -e '@.force' -e '@.params[0].force' -e '@.params[1]' 2>/dev/null | head -n 1)
	mkdir -p "$NAT_CACHE_DIR" 2>/dev/null
	_nat_cache="$NAT_CACHE_DIR/nat.$_nat_if"
	_nat_persist_load
	if [ "$_nat_force" != "1" ] && [ "$_nat_force" != "true" ] && _nat_cached; then
		_nat_reply '"cached":true,' "$_nat_cached_v4" "$_nat_cached_s4" "$_nat_cached_m4" "$_nat_cached_f4" "$_nat_cached_p4"
		# Answer from the cache now and refresh it for the next call. The
		# refresh must not hold stdout, or rpcd waits for it before replying.
		_nat_refresh "$NAT_CACHE_DIR/.nat.$_nat_if.4.bg" >/dev/null 2>&1 &
		return
	fi
	_nat_refresh "$NAT_CACHE_DIR/.nat.$_nat_if.4.$$"
	_nat_reply '' "$_nat_v4" "$_nat_s4" "$_nat_m4" "$_nat_f4" "$_nat_p4"
}

case "$1" in
	list)
		echo '{ "get_config": { }, "set_config": { "config": {} }, "nat_test": { "iface": "" }, "pkg_status": { }, "pkg_action": { "pkg": "", "op": "" } }'
		;;
	call)
		case "$2" in
			get_config) _get_config ;;
			set_config) _set_config ;;
			pkg_status) _pkg_status ;;
			pkg_action) _pkg_action ;;
			nat_test) _nat_test ;;
		esac
		;;
esac
