#!/bin/sh

. /usr/share/hwdash/rpcd-common.sh

# Hand the collector the user's raw (unresolved) WAN probe targets. It owns
# hostname resolution and the fallback list; this side deliberately does not
# substitute a default for an empty value -- empty means "use your built-in
# spread", which is not the same as pinning every interface to 1.1.1.1.
#
# WANTGT_V gates the format: the collector ignores a file without it, so an
# rpcd/collector version skew mid-upgrade cannot be misread as "the user
# cleared both targets".
_sync_wan_targets() {
	_raw=$1
	[ -z "$_raw" ] && _raw=$(uci -q get hwdash.main.settings_json 2>/dev/null)
	_t4=""; _t6=""
	if [ -n "$_raw" ] && command -v jsonfilter >/dev/null; then
		eval "$(printf '%s' "$_raw" | jsonfilter -e '_t4=@.wanTarget4' -e '_t6=@.wanTarget6' 2>/dev/null)"
	fi
	# The collector sources this file, so anything that survives into it is
	# evaluated by a root shell. Reduce to the character set an address or
	# hostname can legally use before it gets there.
	_t4=$(printf '%s' "$_t4" | tr -cd 'A-Za-z0-9.:_ -')
	_t6=$(printf '%s' "$_t6" | tr -cd 'A-Za-z0-9.:_ -')
	mkdir -p /tmp/hwdash_wanmon 2>/dev/null
	printf 'WANTGT_V=2\nWANTGT4="%s"\nWANTGT6="%s"\n' "$_t4" "$_t6" \
		> /tmp/hwdash_wanmon/.wan_targets.$$ 2>/dev/null && \
		mv /tmp/hwdash_wanmon/.wan_targets.$$ /tmp/hwdash_wanmon/.wan_targets 2>/dev/null
}

# Same relay as _sync_wan_targets above, for the optional external
# persist_dir (Settings -> Persistent Storage Directory): the collector is a
# separate long-running daemon and does not read UCI on every tick, so the
# value crosses process boundaries through a file it sources.
_sync_persist_dir() {
	_raw=$1
	[ -z "$_raw" ] && _raw=$(uci -q get hwdash.main.settings_json 2>/dev/null)
	_pd=""
	if [ -n "$_raw" ] && command -v jsonfilter >/dev/null; then
		eval "$(printf '%s' "$_raw" | jsonfilter -e '_pd=@.persistDir' 2>/dev/null)"
	fi
	# Sourced by a root shell on the far end (both the collector's main loop
	# and this script's own "info" handler), so reduced to the character set
	# a real mount path can legally use before it goes anywhere near that --
	# no quotes, no $, no backticks.
	_pd=$(printf '%s' "$_pd" | tr -cd 'A-Za-z0-9/_.-')
	case "$_pd" in /*) ;; *) _pd="" ;; esac
	mkdir -p /tmp/hwdash_wanmon 2>/dev/null
	printf 'PERSISTDIR_V=1\nPERSISTDIR="%s"\n' "$_pd" \
		> /tmp/hwdash_wanmon/.persist_dir.$$ 2>/dev/null && \
		mv /tmp/hwdash_wanmon/.persist_dir.$$ /tmp/hwdash_wanmon/.persist_dir 2>/dev/null
}

# NAT behaviour discovery is deliberately an explicit, on-demand operation.
# A full RFC 5780 probe can take several seconds and sends packets to alternate
# STUN server addresses, so it must never run as part of the dashboard poll.
# It is available only when the optional stuntman-client package is installed.
# The server list is not configurable here -- _nat_probe carries its own,
# per family, because the two families need different ones.

_nat_code() {
	case "$1" in
		"Direct Mapping") printf '%s' direct ;;
		"Endpoint Independent Mapping"|"Endpoint Independent Filtering") printf '%s' endpoint_independent ;;
		"Address Dependent Mapping"|"Address Dependent Filtering") printf '%s' address_dependent ;;
		"Address and Port Dependent Mapping"|"Address and Port Dependent Filtering") printf '%s' address_port_dependent ;;
		*) printf '%s' unknown ;;
	esac
}

_nat_level() {
	# A mapping is the key console-style distinction. Filtering refines an
	# endpoint-independent mapping into full-, restricted-, or port-restricted
	# cone; address-and-port-dependent mappings are symmetric NAT.
	case "$1" in
		direct) printf '%s' open ;;
		endpoint_independent)
			case "$2" in
				direct|endpoint_independent) printf '%s' open ;;
				address_dependent|address_port_dependent) printf '%s' moderate ;;
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

_nat_probe() {
	_nat_family=$1; _nat_bind=$2; _nat_tmp=$3; _nat_dev=$4
	_nat_bin=$(_get_stunclient)
	if [ "$_nat_family" = "6" ]; then
		# IPv6: Fast native reachability check via STUN binding test (--mode basic, 0.06s)
		_nat_servers="stun.cloudflare.com:3478 stun.l.google.com:19302"
		for _nat_se in $_nat_servers; do
			_nat_srv="${_nat_se%%:*}"; _nat_prt="${_nat_se##*:}"
			> "$_nat_tmp"
			[ -n "$_nat_bind" ] && $_nat_bin --mode basic --family 6 --protocol udp --localaddr "$_nat_bind" "$_nat_srv" "$_nat_prt" > "$_nat_tmp" 2>/dev/null
			grep -qi 'Binding test: success' "$_nat_tmp" 2>/dev/null && return 0
			$_nat_bin --mode basic --family 6 --protocol udp "$_nat_srv" "$_nat_prt" > "$_nat_tmp" 2>/dev/null
			grep -qi 'Binding test: success' "$_nat_tmp" 2>/dev/null && return 0
		done
	else
		# IPv4: Full RFC 5780 NAT mapping and filtering discovery (--mode full)
		_nat_servers="stun.miwifi.com:3478 stun.cloudflare.com:3478"
		for _nat_se in $_nat_servers; do
			_nat_srv="${_nat_se%%:*}"; _nat_prt="${_nat_se##*:}"
			> "$_nat_tmp"
			[ -n "$_nat_bind" ] && $_nat_bin --mode full --family 4 --protocol udp --localaddr "$_nat_bind" "$_nat_srv" "$_nat_prt" > "$_nat_tmp" 2>/dev/null
			if grep -qi 'Nat behavior:' "$_nat_tmp" 2>/dev/null || grep -qi 'Binding test: success' "$_nat_tmp" 2>/dev/null; then
				return 0
			fi
			$_nat_bin --mode full --family 4 --protocol udp "$_nat_srv" "$_nat_prt" > "$_nat_tmp" 2>/dev/null
			if grep -qi 'Nat behavior:' "$_nat_tmp" 2>/dev/null || grep -qi 'Binding test: success' "$_nat_tmp" 2>/dev/null; then
				return 0
			fi
		done
	fi
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


_nat_parse_out() {
	_p_file=$1; _p_fam=$2
	_p_map=$(sed -n 's/^[Nn]at behavior:[[:space:]]*//p' "$_p_file" 2>/dev/null | head -1)
	_p_filter=$(sed -n 's/^[Nn]at filtering:[[:space:]]*//p' "$_p_file" 2>/dev/null | head -1)
	# Strip the PORT, not "everything after the first colon".
	#
	# stunclient separates the port differently per family -- verified against
	# the real binary on an OpenWrt target:
	#   IPv4: Mapped address: 49.47.140.221:45087
	#   IPv6: Mapped address: 2405:201:ac00:2000:a412:4d5a:4ad6:cea2.37018
	# so IPv6 uses a DOT, and the address itself is full of colons. The old
	# \([^:]*\): form kept only the text before the first colon and reported a
	# real IPv6 egress as the string "2405". Matching a trailing [.:]<digits>
	# covers both separators and leaves the address intact either way.
	_p_mapped=$(sed -n 's/^[Mm]apped address:[[:space:]]*\(.*\)[.:][0-9][0-9]*[[:space:]]*$/\1/p' "$_p_file" 2>/dev/null | head -1)
	_p_m=$(_nat_code "$_p_map"); _p_f=$(_nat_code "$_p_filter")
	_p_s="unavailable"
	if [ "$_p_fam" = "6" ]; then
		grep -qi 'Binding test: success' "$_p_file" 2>/dev/null && { _p_s="open"; _p_m="direct"; _p_f="endpoint_independent"; }
	else
		grep -qi 'Binding test: success' "$_p_file" 2>/dev/null && _p_s=$(_nat_level "$_p_m" "$_p_f")
	fi
	echo "$_p_s $_p_m $_p_f ${_p_mapped:-—}"
}

case "$1" in
	list)
		echo '{ "get_config": { }, "set_config": { "config": {} }, "get_cpu_perf": { }, "set_cpu_perf": { "perf": {} }, "nat_test": { "iface": "" } }'
		;;
	call)
		case "$2" in
			get_config)
				# Dashboard settings (hidden cards, ping targets) persist in /etc/config/hwdash
				# so they are preserved across sysupgrades and backups.
				# Auto-migrate legacy settings if they exist.
				if [ -f /etc/hwdash-settings.json ]; then
					_leg=""
					_leg=$(cat /etc/hwdash-settings.json 2>/dev/null)
					if [ -n "$_leg" ]; then
						uci -q set hwdash.main=settings
						uci -q set hwdash.main.settings_json="$_leg"
						uci -q commit hwdash
					fi
					rm -f /etc/hwdash-settings.json
				fi
				_res=""
				_res=$(uci -q get hwdash.main.settings_json 2>/dev/null)
				[ -n "$_res" ] && echo "$_res" || echo '{}'
				_sync_wan_targets "$_res"
				_sync_persist_dir "$_res"
				;;
			set_config)
				_IN=""
				IFS= read -r _IN 2>/dev/null
				_CFG=""
				if [ -n "$_IN" ] && command -v jsonfilter >/dev/null; then
					_CFG=$(printf '%s' "$_IN" | head -c 16384 | jsonfilter -e '@.params[0]' -e '@.config' 2>/dev/null)
				fi
				if [ -n "$_CFG" ]; then
					uci -q set hwdash.main=settings
					uci -q set hwdash.main.settings_json="$_CFG"
					uci -q commit hwdash
					_sync_wan_targets "$_CFG"
					_sync_persist_dir "$_CFG"
					echo '{"result":"ok"}'
				else
					echo '{"result":"invalid"}'
				fi
				;;
			get_cpu_perf)
				# Reported as a single global "profile" off cpu0's cpufreq
				# policy — every board this package targets so far (Qualcomm
				# ARM, x86 desktop-class) exposes one uniform policy across
				# all cores, so cpu0 is representative. Read straight from
				# /sys each call (cheap, no caching needed) so it never lags
				# behind a change made outside the dashboard.
				_CF=/sys/devices/system/cpu/cpu0/cpufreq
				CPF_GOV="unknown"; CPF_AVAIL=""; CPF_MIN=0; CPF_MAX=0; CPF_IMIN=0; CPF_IMAX=0; CPF_CUR=0
				if [ -d "$_CF" ]; then
					read_file CPF_GOV "$_CF/scaling_governor" "unknown"
					read_file CPF_AVAIL "$_CF/scaling_available_governors" ""
					read_file CPF_MIN "$_CF/scaling_min_freq" 0
					read_file CPF_MAX "$_CF/scaling_max_freq" 0
					read_file CPF_IMIN "$_CF/cpuinfo_min_freq" 0
					read_file CPF_IMAX "$_CF/cpuinfo_max_freq" 0
					read_file CPF_CUR "$_CF/scaling_cur_freq" 0
				fi
				CPF_AVAIL_JSON="["
				_first=1
				for _g in $CPF_AVAIL; do
					[ $_first -eq 0 ] && CPF_AVAIL_JSON="$CPF_AVAIL_JSON,"
					CPF_AVAIL_JSON="$CPF_AVAIL_JSON\"$_g\""
					_first=0
				done
				CPF_AVAIL_JSON="$CPF_AVAIL_JSON]"
				# Turbo/boost lives behind two incompatible sysfs knobs
				# depending on the driver: intel_pstate's "no_turbo" is
				# inverted (0 = turbo on), the generic cpufreq core (e.g.
				# cpufreq-dt) exposes a plain "boost" (1 = on). Normalize
				# both into one boolean for the frontend.
				CPF_TURBO_AVAIL=0; CPF_TURBO_ON=0
				if [ -f /sys/devices/system/cpu/intel_pstate/no_turbo ]; then
					CPF_TURBO_AVAIL=1
					read_file _nt /sys/devices/system/cpu/intel_pstate/no_turbo 1
					[ "$_nt" = "0" ] && CPF_TURBO_ON=1
				elif [ -f /sys/devices/system/cpu/cpufreq/boost ]; then
					# The GLOBAL knob, not the per-policy one. Both exist on
					# cpufreq-dt, but the per-policy cpuN/cpufreq/boost rejects
					# writes (-EINVAL) on this driver while the global one works
					# -- and after toggling the global, per-policy still reads 0,
					# so reading it reported turbo as off right after enabling it.
					CPF_TURBO_AVAIL=1
					read_file _bo /sys/devices/system/cpu/cpufreq/boost 0
					[ "$_bo" = "1" ] && CPF_TURBO_ON=1
				elif [ -f "$_CF/boost" ]; then
					CPF_TURBO_AVAIL=1
					read_file _bo "$_CF/boost" 0
					[ "$_bo" = "1" ] && CPF_TURBO_ON=1
				fi
				CPF_PERSIST=0
				[ -f /etc/config/cpu-perf ] && CPF_PERSIST=1
				# Explicit availability flag. A board with no OPP table has no
				# cpufreq directory at all -- governor reads back as the literal
				# string "unknown", which is truthy in JS, so the UI was building
				# a scaling form with an empty governor list and a 0-0 MHz range
				# instead of saying scaling is unavailable. MediaTek MT7986a is
				# one such board.
				CPF_AVAIL_FLAG=0
				[ -d "$_CF" ] && [ "$CPF_GOV" != "unknown" ] && [ "${CPF_IMAX:-0}" -gt 0 ] && CPF_AVAIL_FLAG=1
				echo "{\"available\":$CPF_AVAIL_FLAG,\"governor\":\"$CPF_GOV\",\"available_governors\":$CPF_AVAIL_JSON,\"min_freq\":$CPF_MIN,\"max_freq\":$CPF_MAX,\"cpuinfo_min_freq\":$CPF_IMIN,\"cpuinfo_max_freq\":$CPF_IMAX,\"cur_freq\":$CPF_CUR,\"turbo_available\":$CPF_TURBO_AVAIL,\"turbo_enabled\":$CPF_TURBO_ON,\"persist_available\":$CPF_PERSIST}"
				;;
			nat_test)
				# Limit the probe to a WAN shown by this dashboard. This prevents a
				# manual RPC call from testing LAN or unrelated tunnel interfaces.
				_nat_in=""; IFS= read -r _nat_in 2>/dev/null
				_nat_if=$(printf '%s' "$_nat_in" | jsonfilter -e '@.iface' -e '@.params[0].iface' 2>/dev/null | head -n 1)
				case "$_nat_if" in ''|*[!A-Za-z0-9_.-]*) echo '{"available":false,"error":"invalid_interface"}'; exit 0 ;; esac
				if ! _has_stunclient; then
					echo '{"available":false,"error":"stunclient_not_installed"}'
					exit 0
				fi
				_nat_tr=""
				[ -f /tmp/hwdash_wanmon/.tracked ] && _nat_tr=$(tr '\n' ' ' < /tmp/hwdash_wanmon/.tracked 2>/dev/null)
				case " $_nat_tr " in *" $_nat_if "*) ;; *) echo '{"available":true,"error":"not_a_tracked_wan"}'; exit 0 ;; esac
				_nat_status=$(ubus call "network.interface.$_nat_if" status 2>/dev/null)
				[ -n "$_nat_status" ] || { echo '{"available":true,"error":"interface_unavailable"}'; exit 0; }
				# IPv4 only. Native/dual-stack IPv6 has no real NAT to report --
				# RFC 4291 end-to-end reachability is the point of the address
				# family -- so a STUN probe there almost always answers "open,
				# direct mapping" regardless of ISP, and occasionally answers
				# nothing at all on a single lost UDP packet with no retry,
				# which read on the card as a fault on a link that was fine.
				# IPv4 is where real CG-NAT lives, including on the tunnel
				# protocols (MAP-E, DS-Lite, 6rd, 464xlat, ...) that exist
				# specifically because an ISP is doing CG-NAT on the v4 side --
				# and that path already resolves the parent's v4 address below
				# for a tunnel interface with none of its own, so testing stays
				# meaningful for exactly the links it used to matter for.
				_nat_dev=""; _nat_v4=""
				eval "$(printf '%s' "$_nat_status" | jsonfilter \
					-e '_nat_dev=@.l3_device' -e '_nat_v4=@["ipv4-address"][0].address' 2>/dev/null)" 2>/dev/null
				if [ -z "$_nat_v4" ]; then
					# ubus status has no "parent interface" field -- .parent is
					# not a real key on any protocol handler -- so the sibling
					# has to be found through uci. Two shapes both occur in
					# the wild and neither alone covers both:
					#
					#   device='@wanb'  -- the formal alias syntax: bind to
					#                      whatever device interface "wanb" is
					#                      using. The referenced name IS an
					#                      interface, always.
					#   device='wan'    -- a literal device name, not the
					#                      alias syntax. Sometimes that literal
					#                      happens to equal a real interface's
					#                      own name too (a WAN device that was
					#                      simply named "wan"), in which case
					#                      it still resolves as one by luck of
					#                      naming, not by declared relationship.
					#
					# Found live: wanb6 (device='@wanb') resolved no IPv4 at
					# all under the old .device-as-interface-name guess, since
					# ubus's own .device field there is the L3 device
					# "pppoe-wanb" -- never a valid network.interface.X path.
					# wan6 (device='wan') is the opposite case: the uci alias
					# pattern does not match a bare name, so that one still
					# needs the ubus-field guess. Tried in this order because
					# the uci form is an explicit, unambiguous declaration;
					# the ubus guess is a coincidence that happens to work
					# whenever it works at all.
					_nat_parent=""
					_nat_uci=$(uci -q show network 2>/dev/null)
					case "$_nat_uci" in
						*"network.$_nat_if.device='@"*)
							_nat_parent=${_nat_uci#*network.$_nat_if.device=\'@}
							_nat_parent=${_nat_parent%%\'*}
							;;
					esac
					if [ -z "$_nat_parent" ]; then
						_nat_parent=$(printf '%s' "$_nat_status" | jsonfilter -e '@.parent' -e '@.device' 2>/dev/null)
					fi
					if [ -n "$_nat_parent" ] && [ "$_nat_parent" != "$_nat_if" ]; then
						_nat_pstatus=$(ubus call "network.interface.$_nat_parent" status 2>/dev/null)
						[ -n "$_nat_pstatus" ] && _nat_v4=$(printf '%s' "$_nat_pstatus" | jsonfilter -e '@["ipv4-address"][0].address' 2>/dev/null)
					fi
				fi
				if [ -z "$_nat_v4" ]; then
					# 464xlat has no parent/alias to inherit an IPv4 from --
					# it's a standalone proto=464xlat interface, the clat
					# device itself, not an alias riding another one -- so
					# neither path above ever finds anything for it. Same
					# fallback as wan_ips: netifd's 464xlat handler already
					# publishes the address the kernel actually SNATs from
					# (RFC 7335's default 192.0.0.1) as firewall data.
					_nat_snat=""; _nat_snattgt=""
					eval "$(printf '%s' "$_nat_status" | jsonfilter \
						-e '_nat_snat=@.data.firewall[0].snat_ip' \
						-e '_nat_snattgt=@.data.firewall[0].target' 2>/dev/null)" 2>/dev/null
					[ "$_nat_snattgt" = "SNAT" ] && [ -n "$_nat_snat" ] && _nat_v4="$_nat_snat"
				fi
				[ -n "$_nat_dev" ] || _nat_dev=$_nat_v4
				_nat_force=$(printf '%s' "$_nat_in" | jsonfilter -e '@.force' -e '@.params[0].force' -e '@.params[1]' 2>/dev/null | head -n 1)
				mkdir -p "$NAT_CACHE_DIR" 2>/dev/null
				_nat_cache="$NAT_CACHE_DIR/nat.$_nat_if"
				# A NAT type test is explicit, user-triggered probing -- not
				# something that silently redetects itself the way a DNS or
				# ethtool cache does -- so the result is worth carrying across
				# a reboot if the user has opted into persist_dir.
				#
				# PERSISTDIR is resolved unconditionally, because it gates the
				# persist WRITES further down as well as the seed read here.
				# It used to be resolved inside the "tmpfs is empty" branch
				# below, which meant it was only ever set on the one call per
				# boot that found no cache file -- so on every other call it
				# was empty and both `[ -n "$PERSISTDIR" ]` write guards
				# silently did nothing. A probe result therefore reached
				# persistent storage only if it happened to run on that first
				# post-boot call, and a re-probe (address changed, or a forced
				# retest) never updated the stored copy at all.
				PERSISTDIR_V=""; PERSISTDIR=""
				[ -f /tmp/hwdash_wanmon/.persist_dir ] && . /tmp/hwdash_wanmon/.persist_dir 2>/dev/null
				[ "$PERSISTDIR_V" != "1" ] && PERSISTDIR=""
				# Seeded only when tmpfs has nothing yet (a fresh boot); every
				# call after that hits the cheap [ -s ] check and moves on.
				if [ ! -s "$_nat_cache" ]; then
					if [ -n "$PERSISTDIR" ] && [ -f "$PERSISTDIR/nat/$_nat_if" ] && _persist_mount_ok "$PERSISTDIR"; then
						cat "$PERSISTDIR/nat/$_nat_if" > "$_nat_cache" 2>/dev/null
					fi
				fi
				# ------------------------------------------------------------------
				# Fast-path: if a valid cache entry exists for the current IPs AND
				# force is not set, serve it immediately and kick background refresh.
				# ------------------------------------------------------------------
				# A stale "6 ..." line from a version that still tested IPv6
				# is simply never matched below -- cf is compared against 4
				# only -- so an old cache file drains itself out on first read
				# without needing a migration step.
				_nat_cached_v4=""; _nat_cached_s4=""; _nat_cached_m4=""; _nat_cached_f4=""; _nat_cached_p4=""
				_nat_cache_hit=0
				if [ -s "$_nat_cache" ]; then
					while IFS=' ' read -r _cf _ca _cs _cm _cfl _ct _cp; do
						case "$_cf" in
							4) if [ "$_ca" = "$_nat_v4" ] && [ "$_cs" != "unavailable" ]; then
								_nat_cached_v4=$_ca; _nat_cached_s4=$_cs; _nat_cached_m4=$_cm; _nat_cached_f4=$_cfl; _nat_cached_p4=$_cp; _nat_cache_hit=1; fi ;;
						esac
					done < "$_nat_cache"
				fi
				if [ "$_nat_force" != "1" ] && [ "$_nat_force" != "true" ] && [ "$_nat_cache_hit" = "1" ]; then
					# Return cached result immediately
					json_esc "$_nat_if"; _nat_ifj=$JSV
					printf '{"available":true,"iface":"%s","cached":true,"v4":' "$_nat_ifj"
					if [ -n "$_nat_cached_v4" ]; then _nat_json 4 "$_nat_cached_v4" "$_nat_cached_s4" "$_nat_cached_m4" "$_nat_cached_f4" "$_nat_cached_p4"; else printf 'null'; fi
					echo '}'
					# Kick background re-probe to refresh cache for next time
					(
						_nat_tmp4="/tmp/hwdash/.nat.${_nat_if}.4.bg"
						_nat_s4="unavailable"; _nat_m4="unknown"; _nat_f4="unknown"; _nat_p4="—"
						[ -n "$_nat_v4" ] && { _nat_probe 4 "$_nat_v4" "$_nat_tmp4" "$_nat_dev" & _p4=$!; }
						[ -n "$_p4" ] && wait "$_p4" 2>/dev/null
						if [ -n "$_nat_v4" ]; then
							read -r _nat_s4 _nat_m4 _nat_f4 _nat_p4 <<EOF
$(_nat_parse_out "$_nat_tmp4" 4)
EOF
						fi
						{
							[ -n "$_nat_v4" ] && printf '4 %s %s %s %s %s %s\n' "$_nat_v4" "$_nat_s4" "$_nat_m4" "$_nat_f4" "$(date +%s 2>/dev/null)" "$_nat_p4"
						} > "$_nat_cache" 2>/dev/null
						if [ -n "$PERSISTDIR" ] && _persist_mount_ok "$PERSISTDIR"; then
							mkdir -p "$PERSISTDIR/nat" 2>/dev/null
							cat "$_nat_cache" > "$PERSISTDIR/nat/$_nat_if" 2>/dev/null
						fi
						rm -f "$_nat_tmp4"
					) &
					exit 0
				fi
				# ------------------------------------------------------------------
				# Cold-path: no valid cache — run a blocking probe.
				# ------------------------------------------------------------------
				_nat_tmp4="/tmp/hwdash/.nat.${_nat_if}.4.$$"
				_nat_s4="unavailable"; _nat_m4="unknown"; _nat_f4="unknown"; _nat_p4="—"
				_p4=""
				[ -n "$_nat_v4" ] && { _nat_probe 4 "$_nat_v4" "$_nat_tmp4" "$_nat_dev" & _p4=$!; }
				[ -n "$_p4" ] && wait "$_p4" 2>/dev/null
				if [ -n "$_nat_v4" ]; then
					read -r _nat_s4 _nat_m4 _nat_f4 _nat_p4 <<EOF
$(_nat_parse_out "$_nat_tmp4" 4)
EOF
				fi
				rm -f "$_nat_tmp4"
				HWDASH_NOW=$(date +%s 2>/dev/null)
				{
					[ -n "$_nat_v4" ] && printf '4 %s %s %s %s %s %s\n' "$_nat_v4" "$_nat_s4" "$_nat_m4" "$_nat_f4" "$HWDASH_NOW" "$_nat_p4"
				} > "$_nat_cache" 2>/dev/null
				if [ -n "$PERSISTDIR" ] && _persist_mount_ok "$PERSISTDIR"; then
					mkdir -p "$PERSISTDIR/nat" 2>/dev/null
					cat "$_nat_cache" > "$PERSISTDIR/nat/$_nat_if" 2>/dev/null
				fi
				json_esc "$_nat_if"; _nat_ifj=$JSV
				printf '{"available":true,"iface":"%s","v4":' "$_nat_ifj"
				if [ -n "$_nat_v4" ]; then _nat_json 4 "$_nat_v4" "$_nat_s4" "$_nat_m4" "$_nat_f4" "$_nat_p4"; else printf 'null'; fi
				echo '}'
				;;
			set_cpu_perf)
				_IN=""
				IFS= read -r _IN 2>/dev/null
				_GOV=""; _MIN=""; _MAX=""; _TURBO=""
				if [ -n "$_IN" ] && command -v jsonfilter >/dev/null; then
					eval "$(printf '%s' "$_IN" | head -c 2048 | jsonfilter -e '_GOV=@.perf.governor' -e '_MIN=@.perf.min_freq' -e '_MAX=@.perf.max_freq' -e '_TURBO=@.perf.turbo_enabled' 2>/dev/null)"
				fi
				_CF=/sys/devices/system/cpu/cpu0/cpufreq
				_OK=1
				[ -d "$_CF" ] || _OK=0
				if [ $_OK -eq 1 ] && [ -n "$_GOV" ]; then
					read_file _AVAIL "$_CF/scaling_available_governors" ""
					case " $_AVAIL " in
						*" $_GOV "*) ;;
						*) _OK=0 ;;
					esac
				fi
				case "$_MIN" in ''|*[!0-9]*) _OK=0 ;; esac
				case "$_MAX" in ''|*[!0-9]*) _OK=0 ;; esac
				if [ $_OK -eq 1 ]; then
					read_file _IMIN "$_CF/cpuinfo_min_freq" 0
					read_file _IMAX "$_CF/cpuinfo_max_freq" 0
					if [ "$_MIN" -lt "$_IMIN" ] || [ "$_MAX" -gt "$_IMAX" ] || [ "$_MIN" -gt "$_MAX" ]; then
						_OK=0
					fi
				fi
				if [ $_OK -eq 1 ]; then
					for _pf in /sys/devices/system/cpu/cpu[0-9]*/cpufreq; do
						[ -d "$_pf" ] || continue
						[ -w "$_pf/scaling_governor" ] && echo "$_GOV" > "$_pf/scaling_governor" 2>/dev/null
						[ -w "$_pf/scaling_min_freq" ] && echo "$_MIN" > "$_pf/scaling_min_freq" 2>/dev/null
						[ -w "$_pf/scaling_max_freq" ] && echo "$_MAX" > "$_pf/scaling_max_freq" 2>/dev/null
					done
					case "$_TURBO" in
						true|1) _TWANT=on ;;
						false|0) _TWANT=off ;;
						*) _TWANT="" ;;
					esac
					if [ -n "$_TWANT" ]; then
						_TBOOST=""
						if [ -f /sys/devices/system/cpu/intel_pstate/no_turbo ]; then
							[ "$_TWANT" = on ] && echo 0 > /sys/devices/system/cpu/intel_pstate/no_turbo 2>/dev/null
							[ "$_TWANT" = off ] && echo 1 > /sys/devices/system/cpu/intel_pstate/no_turbo 2>/dev/null
						elif [ -f /sys/devices/system/cpu/cpufreq/boost ]; then
							_TBOOST=/sys/devices/system/cpu/cpufreq/boost
						elif [ -f "$_CF/boost" ]; then
							_TBOOST="$_CF/boost"
						fi
						if [ -n "$_TBOOST" ]; then
							[ "$_TWANT" = on ] && echo 1 > "$_TBOOST" 2>/dev/null
							[ "$_TWANT" = off ] && echo 0 > "$_TBOOST" 2>/dev/null
							# Verify rather than assume: the per-policy knob
							# accepts the open() and then rejects the write, so a
							# silent failure here used to look like success.
							read_file _tnow "$_TBOOST" ""
							case "$_TWANT" in
								on)  [ "$_tnow" = "1" ] || _TURBO_FAIL=1 ;;
								off) [ "$_tnow" = "0" ] || _TURBO_FAIL=1 ;;
							esac
						fi
					fi
					# Best-effort persistence: only touch /etc/config/cpu-perf if
					# it's already there (that package owns its own defaults and
					# init script; we just keep it in sync so a reboot doesn't
					# silently revert what was just applied here). Never create
					# the file — that's the package's job if the user installs it.
					if [ -f /etc/config/cpu-perf ]; then
						uci -q show cpu-perf 2>/dev/null | grep '=cpu_freq_policy$' | cut -d. -f2 | cut -d= -f1 |
						while read -r _sec; do
							[ -z "$_sec" ] && continue
							uci -q set cpu-perf."$_sec".scaling_governor="$_GOV"
							uci -q set cpu-perf."$_sec".scaling_min_freq="$_MIN"
							uci -q set cpu-perf."$_sec".scaling_max_freq="$_MAX"
						done
						uci -q commit cpu-perf
					fi
					if [ "${_TURBO_FAIL:-0}" = "1" ]; then
						echo '{"result":"ok","turbo":"unsupported"}'
					else
						echo '{"result":"ok"}'
					fi
				else
					echo '{"result":"invalid"}'
				fi
				;;
		esac
		;;
esac
