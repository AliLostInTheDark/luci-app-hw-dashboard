# Exhaustive Changelog: `luci-app-hw-dashboard` (v1.2.3 Series)

This document contains a complete, itemized record of **every single change, bug fix, backend refactor, code optimization, UI adjustment, and packaging step** performed on `luci-app-hw-dashboard` up to **release `1.2.3-r22`**.

---

## 0. `1.2.3-r1` — collector hardening, DNS bypass, full ISP names

Follow-up review of the r22 collector, verified by running it against a live
5-WAN router (`wan`/`wan6`/`wanb`/`wanb6`/`wanc`, Jio + Airtel).

* **A dead probe target took every WAN down, not just its own.** BusyBox `ping`
  does not honour `-w` as a real deadline: against a silently blackholed
  address, `ping -c 2 -w 2` ran for **11 s**, not 2. That overran the loop's
  `LOOP_DEADLINE=20`, so `kill -9 $_pids` fired every tick and destroyed
  *every* interface's subshell — including healthy ones that had already
  finished probing. Measured effect: v4 interfaces never wrote a sample at
  all, and healthy v6 interfaces dropped from one sample per 2 s to one per
  20 s. Fixed with `-W 1` (measured: 11 s → 2 s) plus a `run_capped` bound so
  nothing depends on ping choosing to exit.
* **`run_capped()` had been reduced to a no-op** — it accepted a cap and
  ignored it, leaving `PING_CAP` dead and both `nslookup` calls unbounded. The
  outer `LOOP_DEADLINE` is not a substitute: it `kill -9`s the per-interface
  subshell, which does not reach a grandchild, so a wedged probe was orphaned
  and outlived the collector (confirmed: 3 stray `ping` processes survived).
  Restored as a real watchdog; stray count now 0.
* **The deadline loop busy-spun.** Its `sleep 0.2` is rejected outright by
  BusyBox (`sleep: invalid number '0.2'`), so the poll ran with no delay,
  burning CPU on every tick. Replaced with a watchdog + plain `wait`.
* **Custom ping targets never reached the running collector.** `load_targets()`
  ran once at startup, while `_sync_wan_targets()` wrote `ANCHOR4`/`ANCHOR6` —
  names the new hash-based selector no longer reads (the only reference left
  was unreachable dead code). A target change in Settings did nothing until
  restart. `.wan_targets` now carries the raw values under a version-gated
  format and is re-applied live.
* **Fabricated latency.** `lastgood_ms` was seeded to `"45"`, so an interface
  that had never answered still reported *up, 45 ms* — indistinguishable on
  the card from a measurement. Seeded to "never measured" instead, and the
  `MISS_THRESHOLD` grace now requires status `up` (a link in `unknown` has no
  measurement to carry forward). Debounce behaviour is otherwise unchanged.
* **Torn reads.** The collector rewrites its stats files in place every 2 s
  while rpcd polls every 1 s; a read landing in that window blanked the
  variables and flickered the card to `unknown`/0 %. rpcd retries once and
  validates every field feeding arithmetic, rather than making the collector
  pay for an atomic rename per tick. Non-integer history tokens now emit
  `null` instead of being pasted into the JSON array verbatim.
* **Shell injection.** `_sync_wan_targets()` wrote user-supplied targets into a
  file the collector `.`-sources as root; now restricted to address/hostname
  characters.
* **Single-target failover.** One custom target left primary == backup, so the
  "backup" probe re-asked the same dead address. Falls back to a built-in, and
  handles the user picking a built-in as their target.
* **Per-tick work removed.** Probe targets depend only on the interface name
  and the target list — both fixed between discoveries — so they are resolved
  once in `discover_ifaces` and cached in `IFACE_LIST` instead of recomputed
  through two `od` pipelines every 2 s. `resolve_isp` reuses the loop's `_now`
  instead of re-reading `/proc/uptime` twice; `do_ping` flattens output with
  one `tr` instead of a `printf | tr` pair; rpcd reads `/proc/uptime` once per
  call instead of once per interface.

### Additional in this release

* **Full ISP names.** The card trimmed the registry name at the first comma,
  turning `Bharti Airtel Ltd., Telemedia Services, IN` into `Bharti Airtel
  Ltd.`. It now shows the operator name exactly as the ASN registry returns
  it, dropping only the routing-registry handle before the ` - `. A pinned
  `ISP_BY_ASN` entry still supplies branding (colour, short label, bundled
  logo) but no longer overrides the name.
* **Nothing goes through a filtering resolver.** Every DNS query this package
  makes -- Cymru ASN lookups (v4 and v6), api.ipify.org, and a custom WAN
  target entered as a domain -- is sent straight to a public recursive
  resolver whenever the box's own resolver is anything other than dnsmasq
  (AdGuard Home, Pi-hole, Unbound). Detected once at startup from the
  listener on :53, so there is no per-tick cost. dnsmasq is left on the
  system path since it does not log per-query. Measured on an AdGuard Home
  router with 13 WANs: 6,879 historical `cymru`/`ipify` entries in its query
  log, and zero new ones across a full cold start with all 13 interfaces
  resolving.
* **The Ping Latency card was the biggest offender, and is now covered too.**
  Its default targets are hostnames (`dns.google`, `google.com`,
  `one.one.one.one`, `youtube.com`), and while a 30-minute map means most
  probes ping a cached IP, a cold or expired entry let `ping` resolve the name
  through the local resolver -- as did the reverse-DNS (`PTR`) lookups, which
  called `nslookup` with no server. Measured on one AdGuard Home router:
  **1,426 of the 1,487** logged queries for those targets came from the router
  itself. Both paths now use the same bypass, resolved in parallel inside each
  target's existing subshell so the call does not get slower.
* **IPv6 ISP resolution.** A v6 interface previously only ever inherited its
  v4 sibling's ISP, so a v6-only WAN (or one not named `<v4name>6`) showed
  nothing. It now falls back to a real lookup in Cymru's `origin6` zone. The
  cheap sibling mirror is still tried first.
* **ISP attribution corrected for carrier NAT.** The public IP is always
  requested rather than read off the interface. On an Airtel line PPPoE hands
  out `100.192.35.115`, which Cymru attributes to AS21928 (T-Mobile US,
  `100.128.0.0/9`) because the carrier uses that space internally; the real
  egress is `106.222.224.181` = AS24560 Bharti Airtel. Reading the interface
  address would have labelled an Indian Airtel link "T-Mobile USA".

---

## 1. Custom Ping Target Configuration Alignment

* **Bug Description**:
  - The LuCI frontend (`htdocs/luci-static/resources/view/status/hw_dash.js`) saved custom latency targets into UCI under `hwdash.main.settings_json` using the keys **`wanTarget4`** and **`wanTarget6`**.
  - The backend daemon script (`/usr/libexec/hwdash-wanmon`) was legacy-configured to check `jsonfilter` for `@.targets[*]`.
  - As a result, user-configured custom targets (e.g. `one.one.one.one` or `1.1.1.1`) were silently ignored by the backend, which fell back to a default array of 6 global target IPs (`1.1.1.1`, `8.8.8.8`, `9.9.9.9`, `1.0.0.1`, `8.8.4.4`, `149.112.112.112`).
  - Interface hashing distributed WAN interfaces across these 6 different IPs, causing inconsistent ping latency readings (e.g., 86ms on `wan` vs 33ms on `wanb`).

* **Changes Made in `/usr/libexec/hwdash-wanmon`**:
  - Updated `load_targets()` function:
    - Extracted `@.wanTarget4` and `@.wanTarget6` from `settings_json`.
    - Overrode `TARGETS4_LIST` and `TARGETS6_LIST` when these UCI settings are present.

---

## 2. Dynamic Startup DNS Pre-Resolution & CPU Optimization

* **Bug / Bottleneck Description**:
  - If a user specified a domain target (such as `one.one.one.one` or `dns.google`), executing `ping -4 -c 2 -w 2 "$_anchor"` every 2 seconds caused BusyBox `ping` to invoke `nslookup` / DNS resolution on **every single tick** for **every single WAN interface**.
  - This spawned high subshell overhead, increased CPU consumption on low-power router SOCs, and added artificial DNS lookup delays to the raw ICMP ping latency measurements.

* **Changes Made in `/usr/libexec/hwdash-wanmon`**:
  - Introduced the nested helper function `resolve_target()` inside `load_targets()`:
    - Checks target strings against `*[a-zA-Z]*` regex to detect domain names.
    - Resolves domains to raw IP addresses at startup using `ping -$_fam -c 1 -W 1 "$_t" | awk -F'[()]' '/PING/{print $2}'`.
    - Caches the resolved raw IP (e.g. `1.1.1.1` or `2606:4700:4700::1111`) directly in memory in `TARGETS4_LIST` / `TARGETS6_LIST`.
  - Main loop execution now pings the pre-resolved raw IP directly, completely eliminating per-tick DNS overhead and subshell delays.

---

## 3. Multi-WAN Interface Target Hash Bypass

* **Refactor Details**:
  - Modified `get_target_for_iface()`:
    - Counts the total number of items in `TARGETS4_LIST` / `TARGETS6_LIST`.
    - When `_num_targets` equals `1` (single custom target provided by user), modulo arithmetic (`_hash % _num_targets`) evaluates to `0` for all interface names.
    - Forces all active WAN interfaces (`wan`, `wanb`, `wanc`, `wand`, `wane`, `wanf`, `wanx`, etc.) to ping the exact same target endpoint.
  - Latencies across all Airtel WAN interfaces unified to a rock-solid, jitter-free ~33ms–38ms range.

---

## 4. Stat Storage & Debouncing Upgrade (6-Field Schema)

* **Refactor Details**:
  - Upgraded interface status tracking files in `/tmp/hwdash_wanmon/*.stats`:
    - Schema expanded to 6 fields:
      ```text
      total success status streak_start lastgood_ms consecutive_misses
      ```
  - `process_iface()` and `process_down_iface()` updated:
    - Implemented consecutive miss debouncing before toggling interface status from `up` to `down`.
    - Eliminates false-positive UI alerts and flickering status icons during temporary single-packet drops.

---

## 5. ISP Resolution Engine & Cache Cleanup

* **Fix Details**:
  - Resolved `resolve_isp()` behavior:
    - For IPv6 interfaces (`*6`), updated `resolve_isp()` to automatically clone the ISP lookup file (`.isp`) from its IPv4 sibling interface if IPv6 DNS lookups fail to resolve `ip-api.com` AAAA records.
  - Cleared stale ring directory files (`/tmp/hwdash_wanmon/*.isp`, `.ispip`, `.stats`) on the router.
  - Verified ISP resolution for all 13 interfaces:
    - `wan`, `wan6`, `wanb`, `wanb6`, `wanc`, `wanc6`, `wand`, `wand6`, `wane`, `wane6`, `wanf`, `wanf6`: **Bharti Airtel Ltd.**
    - `wanx` (`eth3` via `192.168.10.1` gateway): **Reliance Jio Infocomm Limited**.

---

## 6. Diagnosis of `wanx` Latency & Verification

* **Diagnostic Investigation**:
  - Isolated why `wanx` had ~46ms–49ms ping while other interfaces had ~33ms–36ms ping.
  - Ran direct interface-bound traceroutes and pings:
    - **`pppoe-wan` (Airtel)**: Direct PPPoE point-to-point connection (`100.192.35.115`), 36.5ms average ping, TTL 61.
    - **`eth3` (Jio / `wanx`)**: Connected to upstream gateway `192.168.10.1`, passing through 8 internal CGNAT hops (`10.11.56.1` -> `172.16.4.31` -> `192.168.100.114` -> `192.168.232.234`), 47.0ms average ping, TTL 53.
  - Confirmed the ~10ms delta on `wanx` is genuine physical network path routing difference from Reliance Jio's network, confirming code accuracy.

---

## 7. OpenWrt Build System & APK Packaging (`r22`)

* **Build System Fixes**:
  - Fixed `.config` entry: Enabled `CONFIG_PACKAGE_luci-app-hw-dashboard=m` in `/home/ali/openwrt-jidu6j11/.config`.
  - Incremented `PKG_RELEASE:=22` in `package/luci/luci-app-hw-dashboard/Makefile`.
  - Ran full clean build:
    `make package/feeds/luci/luci-app-hw-dashboard/compile V=s`
    `make package/index V=s`
  - Output artifact verified:
    `/home/ali/openwrt-jidu6j11/bin/packages/aarch64_cortex-a53/luci/luci-app-hw-dashboard-1.2.3-r22.apk`
  - Deployed `.apk` over IPv6 to router (`2401:4900:1c3b:a974::1`) and performed clean upgrade (`apk add --allow-untrusted`).

---

## 8. Summary of Files Modified

1. **`package/luci/luci-app-hw-dashboard/root/usr/libexec/hwdash-wanmon`**:
   - Refactored `load_targets()` to parse `wanTarget4` and `wanTarget6`.
   - Added startup domain pre-resolution function `resolve_target()`.
   - Updated `get_target_for_iface()` for single-target hash bypass.
   - Updated `resolve_isp()` for IPv6 sibling cloning.
2. **`package/luci/luci-app-hw-dashboard/Makefile`**:
   - Incremented `PKG_RELEASE` from `21` to `22`.
3. **`/home/ali/openwrt-jidu6j11/.config`**:
   - Set `CONFIG_PACKAGE_luci-app-hw-dashboard=m`.
4. **`package/luci/luci-app-hw-dashboard/CHANGELOG.md`**:
   - Added complete version history documentation.
