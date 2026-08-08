# Wireless AQL helpers shared by the info and ctl rpcd objects.


# --- Wireless AQL (Airtime Queue Limits) ----------------------------------
#
# mac80211 exposes per-PHY airtime queue limits under debugfs. Lowering them
# trades peak throughput for latency under load: the driver stops buffering
# several hundred ms of frames per station, so a bulk transfer can no longer
# push everything else behind it. Values in the 1500-2500 range give the
# lowest latency; the mac80211 defaults below are tuned for throughput.
#
# Every field is optional. The controls only exist when the kernel was built
# with CONFIG_MAC80211_DEBUGFS *and* debugfs is mounted, and plenty of custom
# or size-trimmed builds drop one or both -- the card hides itself entirely
# rather than showing an inert panel.
#
# WED (MediaTek Wireless Ethernet Dispatch) offloads the WiFi datapath into
# hardware and bypasses mac80211's software queues, so AQL never accounts for
# that traffic and tuning it changes nothing. The two are mutually exclusive
# by design, which is why WED is detected and surfaced rather than silently
# letting someone tune a knob that does nothing.
AQL_DEF_LOW=5000
AQL_DEF_HIGH=12000
AQL_DEF_THRESHOLD=24000
AQL_DIR=/sys/kernel/debug/ieee80211

# Sets AQL_WED (1 = hardware offload is live and bypassing AQL) and
# AQL_WED_DEVS. A non-empty txinfo means the block is attached and clocking
# counters; the module parameter alone only says it was *requested*.
_aql_wed_state() {
	AQL_WED=0; AQL_WED_DEVS=""; AQL_WED_PARAM=0
	for _aw in /sys/kernel/debug/wed*; do
		[ -d "$_aw" ] || continue
		# Read it, don't stat it: debugfs files report size 0 even when a read
		# returns plenty, so [ -s ] is always false here. An attached-but-idle
		# block still prints its register dump; a detached one prints nothing.
		_av=""
		read -r _av 2>/dev/null < "$_aw/txinfo"
		if [ -n "$_av" ]; then
			AQL_WED=1
			AQL_WED_DEVS="${AQL_WED_DEVS:+$AQL_WED_DEVS,}${_aw##*/}"
		fi
	done
	for _am in /sys/module/*/parameters/wed_enable; do
		[ -f "$_am" ] || continue
		read -r _av 2>/dev/null < "$_am"
		case "$_av" in Y|y|1) AQL_WED_PARAM=1 ;; esac
	done
}

# Per-PHY live state as a JSON array, into AQL_PHYS. Also sets AQL_AVAIL.
_aql_scan() {
	AQL_AVAIL=0; AQL_PHYS=""
	# 0 = debugfs not mounted at all, 1 = mounted. Reported separately from
	# AQL_AVAIL so the UI can say *which* piece is missing instead of one
	# vague "not supported": a kernel without CONFIG_DEBUG_FS and one built
	# without CONFIG_MAC80211_DEBUGFS need different answers.
	AQL_DEBUGFS=0
	[ -d /sys/kernel/debug ] && AQL_DEBUGFS=1
	local _first=1
	[ -d "$AQL_DIR" ] || return
	for _ap in "$AQL_DIR"/phy*; do
		[ -f "$_ap/aql_txq_limit" ] || continue
		AQL_AVAIL=1
		local _name=${_ap##*/} _en="" _th="" _lim="" _lf=1 _bcmc=0 _pend=0
		read_file _en "$_ap/aql_enable" ""
		read_file _th "$_ap/aql_threshold" ""
		case "$_en" in ''|*[!0-9]*) _en=-1 ;; esac
		case "$_th" in ''|*[!0-9]*) _th=0 ;; esac
		# "AC <low> <high>" per access class, then a single-column BC/MC row.
		while read -r _c1 _c2 _c3; do
			case "$_c1" in ''|AC) continue ;; esac
			if [ "$_c1" = "BC/MC" ]; then
				case "$_c2" in ''|*[!0-9]*) ;; *) _bcmc=$_c2 ;; esac
				continue
			fi
			case "$_c2" in ''|*[!0-9]*) continue ;; esac
			case "$_c3" in ''|*[!0-9]*) continue ;; esac
			[ $_lf -eq 0 ] && _lim="$_lim,"
			_lim="$_lim{\"ac\":\"$_c1\",\"low\":$_c2,\"high\":$_c3}"
			_lf=0
		done < "$_ap/aql_txq_limit"
		# Live in-flight airtime, the "is this actually doing anything" signal.
		if [ -f "$_ap/aql_pending" ]; then
			while read -r _c1 _c2 _c3; do
				[ "$_c1" = "total" ] || continue
				case "$_c2" in ''|*[!0-9]*) ;; *) _pend=$_c2 ;; esac
			done < "$_ap/aql_pending"
		fi
		[ $_first -eq 0 ] && AQL_PHYS="$AQL_PHYS,"
		AQL_PHYS="$AQL_PHYS{\"phy\":\"$_name\",\"enable\":$_en,\"threshold\":$_th,\"bcmc\":$_bcmc,\"pending_us\":$_pend,\"limits\":[$_lim]}"
		_first=0
	done
}
