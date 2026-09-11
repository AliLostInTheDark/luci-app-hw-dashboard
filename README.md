<div align="center">

# luci-app-hw-dashboard
## Made with Claude Code as a personal fun project, expect bugs.

A real-time hardware & network monitoring dashboard for OpenWrt LuCI, built from scratch in vanilla JavaScript — no external libraries, no frameworks. Every metric is read directly from the kernel and system interfaces, polled live, and rendered without page reloads.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Release](https://img.shields.io/github/v/release/AliLostInTheDark/luci-app-hw-dashboard?label=release)](https://github.com/AliLostInTheDark/luci-app-hw-dashboard/releases)
[![OpenWrt](https://img.shields.io/badge/OpenWrt-any%20target-1f6feb.svg)](https://openwrt.org)

</div>

---

Standard LuCI status pages don't show CPU cache topology, NAND wear, per-radio WiFi PHY capabilities, or which WAN link actually belongs to which ISP. This dashboard does — and it's tuned to spawn as few processes as an embedded router can get away with, so leaving it open costs almost nothing.

## Contents

- [Highlights](#highlights)
- [Installation](#installation)
- [Supported devices](#supported-devices)
- [Dashboard cards](#dashboard-cards)
- [Settings](#settings)
- [How it works](#how-it-works)
- [License](#license)

## Highlights

| | |
|---|---|
| **CPU & Memory** | Per-core load, cache topology (even without kernel support), frequency residency, context switches |
| **Storage** | NAND/UBI wear & ECC trend, SquashFS + overlay breakdown, real disk I/O throughput, NVMe/SATA SMART health |
| **Topology** | Ethernet and USB link state — negotiated speed per port, and the speed range each USB controller supports |
| **WiFi** | Per-band PHY details (channel, TX power, NSS, bitrate, noise floor) straight from `iwinfo`/`iw` |
| **Ping Latency** | Realtime graph with **true packet-level loss and jitter**, not a poll-level guess |
| **WAN Uptime Status** | Per-link uptime/downtime and latency, with the **ISP correctly identified** even behind `mwan3`, carrier-grade NAT, or 464xlat/NAT64 tunnels |
| **NAT Type Test** | On-demand STUN probe (RFC 3489/5780) reporting NAT behavior, filtering, and public egress address — dual-stack, and isolated per protocol family |
| **AP Mode** | Dedicated card for access points behind a router — pings the real upstream gateway rather than assuming a WAN that doesn't exist |
| **Card Layout** | Drag to reorder any card, and cycle its width between Small / Half / Full — saved per device, works on touch as well as mouse |
| **Privacy** | Every background DNS lookup this package makes is automatically kept off a filtering resolver (AdGuard Home, Pi‑hole, Unbound) |
| **Settings** | Persist on-device via UCI — follow the router across browsers, sysupgrades and backups |

## Installation

### One line, key and package together (recommended)

Installs the signing key, then fetches and installs the current release. Nothing to download by hand:

```sh
wget -qO /etc/apk/keys/luci-app-hw-dashboard.pem https://raw.githubusercontent.com/AliLostInTheDark/luci-app-hw-dashboard/main/keys/luci-app-hw-dashboard.pem && wget -qO /tmp/hwdash.apk "$(wget -qO- https://api.github.com/repos/AliLostInTheDark/luci-app-hw-dashboard/releases/latest | sed -n 's/.*"browser_download_url": *"\([^"]*\.apk\)".*/\1/p' | head -1)" && apk add /tmp/hwdash.apk && rm -f /tmp/hwdash.apk
```

Run the same line again whenever you want to upgrade — the version is resolved from the Releases API each time, not baked into the URL, so it does not go stale. Each step is chained with `&&`, so a failed download can never leave you installing a truncated file.

### Manually, or from the LuCI Software page

**Install the signing key first — once per router.** Every release is signed, and with the key in place `apk` accepts the package normally: no `--allow-untrusted`, and uploading the file on LuCI's **System → Software** page just works.

```sh
wget -qO /etc/apk/keys/luci-app-hw-dashboard.pem https://raw.githubusercontent.com/AliLostInTheDark/luci-app-hw-dashboard/main/keys/luci-app-hw-dashboard.pem
```

Then grab the latest `.apk` from the [Releases](https://github.com/AliLostInTheDark/luci-app-hw-dashboard/releases) page and install it — by dropping it on the Software page, or:

```sh
apk add ./luci-app-hw-dashboard-<version>.apk
```

<details>
<summary>What that key is, and what trusting it means</summary>

`keys/luci-app-hw-dashboard.pem` is the **public** half of the EC keypair this project's firmware build signs with; the private half never leaves the build machine. Verify it before trusting it if you like — its SHA-256 is `09069032 22035518 95a5ab10 96e7abee 6a005144 8c423fd4 8315d15f e17b0e0c`.

Installing it into `/etc/apk/keys/` tells `apk` to accept any package signed by that key, which is the same trust model every OpenWrt package feed uses. It does not grant access to anything else, and removing the file revokes it.

Signature checking is genuinely enforced, not decorative: a package with a single flipped byte is rejected with `file integrity error` rather than installed.

If you flashed a firmware image built from the same tree, you already have this key as `/etc/apk/keys/public-key.pem` and can skip this step — a second copy under a different filename is harmless, since `apk` matches on the signature rather than the filename.

Still want the old behaviour? `apk add --allow-untrusted ./luci-app-hw-dashboard-<version>.apk` continues to work and skips verification entirely.
</details>

Depends on `ethtool-full` (pulled in automatically) for per-port PHY details, and `curl`. The post-install script restarts `rpcd` for you — reload LuCI and open **Status → Hardware Dashboard**.

### Optional packages

None of these are required — every card degrades gracefully and says so where data is missing. Each one just adds detail:

| Package | What it adds |
|---|---|
| `stuntman-client` | **NAT Type Test** — the STUN probe behind the TEST NAT TYPE button |
| `ethtool-full` | Per-port negotiated flow control and EEE state in Ports Topology |
| `smartmontools` | NVMe/SATA SMART health: wear, TBW, spare, power-on hours |
| `lscpu` | CPU core name on ARM (e.g. `Cortex-A73`) — the only source for it |
| `dmidecode` | Memory speed in the Memory card — **x86 only** |
| `kmod-hwmon-nct6775` | Motherboard fans, fan duty and voltage rails in Power & Fans — Nuvoton Super I/O, **x86 only** |
| `kmod-hwmon-it87` | The same for ITE Super I/O chips — **x86 only** |

The simplest route is **⚙ Settings → Optional Packages** on the dashboard itself. Each package has its own **Install** button, its name turns green once installed, and a red **Remove** button appears when nothing else on the router depends on it. Only packages that exist for the router's architecture and in its configured feeds are offered, and the affected cards refresh as soon as the job finishes.

From a shell, install the ones available on every target:

```sh
apk add stuntman-client ethtool-full smartmontools lscpu
```

`dmidecode` and the two `kmod-hwmon-*` drivers are deliberately left out of that line: `apk` resolves the whole argument list or nothing, so including a name that doesn't exist for your architecture installs *none* of the others. On x86, add them separately, e.g. `apk add dmidecode kmod-hwmon-nct6775`.


> [!TIP]
> Installing a newer release over an existing one clears all cached hardware data automatically, so stale readings from a previous version are never served.

### From source

```sh
git clone https://github.com/AliLostInTheDark/luci-app-hw-dashboard.git package/luci/luci-app-hw-dashboard
make menuconfig   # LuCI → Applications → luci-app-hw-dashboard
make package/luci/luci-app-hw-dashboard/compile V=s
```

## Supported devices

Runs on any OpenWrt device. Developed and validated against:

| Model | Variants | SoC | Notes |
|---|---|---|---|
| JIDU6J11 | JIDU6111 – JIDU6911 | Qualcomm IPQ9554 | Primary development target |
| JIDU6J01 | JIDU6101 – JIDU6801 | MediaTek MT7986a | Primary development target |
| JIDU6700 | JIDU6700 | MediaTek MT7981BA | WiFi chip temperature sensors are non-functional — calibration data is absent from the factory partition |

On x86/x86_64 and non-Qualcomm ARM targets, Qualcomm-specific fields (SoC family, SoC ID, machine name) are silently omitted. Everything else is platform-independent.

## Dashboard cards

<details>
<summary><b>CPU & Per-Core Usage</b></summary>

Arc dial for aggregate load, plus cores/threads, cache sizes (L0–L4, resolved from CPU identity when the kernel doesn't expose them directly), live/max frequency, load average, governor and uptime. A dedicated grid card breaks per-core load, frequency and utilization out individually. The advanced panel adds a full CPU-time breakdown, context switches, hardware interrupts and active connections vs. the conntrack limit. Cumulative frequency residency since boot sits under the per-core grid, in the same card.
</details>

<details>
<summary><b>Memory</b></summary>

Arc dial plus physical/usable totals, memory speed (via optional `dmidecode`), used/free/cached/buffers, swap, and ZRAM with live compression ratio.
</details>

<details>
<summary><b>System Info</b></summary>

Hostname, distro string, kernel version, CPU model, SoC identity (Qualcomm platforms), and CPU vulnerability mitigation status, color-coded by severity.

Also reports CPU detail: ISA level (`ARMv8-A`, distinct from the `aarch64` uname value), core microarchitecture and stepping, vendor, operating modes, byte order, BogoMIPS, virtualization support, and which hardware accelerators the CPU actually has — `aes`, `pmull`, `sha2`, `crc32`, `avx2` and friends, which is what determines VPN and crypto throughput on a router. Richest with the optional `lscpu` package installed (it is the only source of the core name on ARM, e.g. `Cortex-A73`); without it everything else is still derived from `/proc/cpuinfo` and the card says so rather than going blank.
</details>

<details>
<summary><b>Internal Storage</b></summary>

Root filesystem usage with real read/write throughput (measured against actual elapsed time between polls, not the nominal poll interval), the read-only SquashFS base image shown separately from writable overlay space, and a summary section that adapts to the underlying storage type — NAND/UBI, eMMC, or SSD/NVMe. NAND details include erase-cycle counts, PEB/bad-block status, geometry and ECC strength; NVMe adds identity, TRIM support, and full SMART health (wear, TBW, spare, power-on hours, error counts) via the optional `smartmontools` package.
</details>

<details>
<summary><b>External Storage</b></summary>

USB mass storage devices with format and mount state shown separately (an unformatted partition isn't the same as an unmounted one), sizes scaled to the right unit automatically, and loop-mounted overlay partitions shown with their real backing relationship.
</details>

<details>
<summary><b>Power, Fans & Thermal Sensors</b></summary>

Voltage/current/fan/power rails from `hwmon`, including the duty cycle of PWM fans (shown even when the fan has no speed sensor) and red highlighting of any reading the sensor driver flags as an alarm, plus Intel RAPL package/core/DRAM power on x86. On x86, motherboard fans and voltages need the Super I/O driver — install it from **⚙ Settings → Optional Packages**. All thermal zones are laid out alphabetically with per-sensor sparklines, thresholds taken from the hardware's own trip points where available, and the peak temperature seen since boot.
</details>

<details>
<summary><b>Ports Topology</b></summary>

Per-port Ethernet link speed/duplex, live throughput, error/drop counters and (with `ethtool`) negotiated flow control and EEE state. USB host controllers, one row each (not one per root hub) with the slowest and fastest speed the controller supports, plus any plugged-in peripherals with the speed they negotiated; hubs are left out.
</details>

<details>
<summary><b>Ping Latency</b></summary>

Realtime graph of router-side latency to configurable targets (defaults: `dns.google`, `one.one.one.one`, `google.com`, `youtube.com`), dual-stack by default. A per-target table adds **cur / min / avg / p95 / max / jitter / loss** — loss is counted from individual ICMP packets received, not from polls that came back empty, so a single dropped packet on an otherwise healthy link no longer reads as either "fine" or "down" incorrectly. Round-trip delay follows RFC 2681, packet loss RFC 7680, and the percentile columns use nearest-rank ranking (RFC 2330) rather than interpolation.
</details>

<details>
<summary><b>WAN Uptime Status</b></summary>

One row per internet-facing interface — logo, status, rolling 24-hour uptime/downtime, time in current state, and latency. Works with or without `mwan3`, and picks up any interface with a genuine default route automatically, including VPN tunnels, PPPoE, and 464xlat/NAT64 CLAT interfaces used as a full exit path. The ISP is identified by ASN lookup against the link's real public egress IP (never assumed from the interface address, which can sit inside carrier-NAT space announced by a completely different operator), shown with its full registry name, and resolved for IPv6-only and translated links too. Every row also carries a plain-English reason the moment a link goes down, both here and in Alerts.
</details>

<details>
<summary><b>NAT Type Test</b></summary>

Each WAN row carries a **TEST NAT TYPE** button that runs an on-demand STUN probe (RFC 3489/5780/6598) against dual-stack Google/Xiaomi/Cloudflare servers, isolated strictly per address family so an IPv4 card never shows IPv6 data or vice versa. Reports NAT behavior (endpoint-independent, address/port-restricted, symmetric) and filtering separately, the public egress address as actually seen by the internet, and the private-to-public mapping. Works across DHCP, PPPoE, DHCPv6, 464xlat, 6rd, 6in4, 6to4, MAP-T, MAP-E, DS-Lite, WireGuard and other tunnel protocols, resolving the correct public IPv4 through the parent/alias interface where the tunneling protocol itself doesn't expose one directly. Requires the optional `stuntman-client` package; the card explains this rather than failing silently when it's absent. Results are cached in RAM (never written to flash) and served instantly on next view, with a fresh probe triggered in the background.
</details>

<details>
<summary><b>AP Mode</b></summary>

Appears in place of WAN Uptime Status when the router has no real WAN of its own — an access point bridged behind another router. Pings the actual upstream gateway (not a fabricated "WAN" that doesn't exist on this device) for uptime, downtime and latency, and shows the AP's own management IP and VLAN alongside it.
</details>

<details>
<summary><b>Wi-Fi Clients</b></summary>

One row per associated station — hostname/MAC, signal strength with a live bar, TX/RX rate, cumulative TX/RX data, connection duration, and PHY modulation detail (MCS, spatial streams, channel width) shown under the name it describes rather than as a stray line below the row.
</details>

<details>
<summary><b>Alerts</b></summary>

A single prioritized card surfacing anything that needs attention right now — a WAN down, an unstable link, critical temperatures, NAND wear, ECC errors and similar — so you don't have to scan every card to notice something's wrong.
</details>

<details>
<summary><b>WiFi PHY & Spectrum</b></summary>

One column per band (2.4/5/6 GHz): channel & width, TX power, hardware mode, configured vs. max spatial streams, enabled channel list, current bitrate, client count and noise floor.
</details>

## Settings

Open the gear icon (top right) to show/hide individual cards, show/hide individual WAN row, edit ping targets (each can carry a friendly name, e.g. "Home NAS" instead of a bare IP), or download a full diagnostics snapshot as JSON. A page-level **Save / Revert / Reset** applies to the whole panel — Revert restores the last saved state, Reset returns everything to defaults. Settings persist on the router via UCI (`/etc/config/hwdash`) and survive sysupgrades.

**⇕ Rearrange Cards** (next to the gear icon) turns on drag handles and a size-cycle button on every card — drag to reorder, or click the size button to step through Small → Half → Full width. Works with touch as well as mouse. Layout and sizing are saved the same way as every other setting.

## How it works

**Backend** — POSIX shell `rpcd` call objects: `luci.hwdash` serves the full hardware readout in one round-trip, alongside `luci.hwdash.ping`, `.wan`, `.wanip`, `.wifi` and `.ctl`. They are separate objects because rpcd's shell plugin re-execs and re-parses the whole script on *every* call, so one monolithic object made each of the ~46 calls per 30s pay to parse all 4161 lines — splitting them means a call parses only what it needs. Shared helpers live in `/usr/share/hwdash/`. Slow-changing data (WiFi capabilities, SoC identity, storage layout) is cached with short-lived TTLs so the per-poll process count stays low on embedded hardware. NAT-type results are cached in RAM tmpfs, never written to flash.

**WAN Uptime Status** runs as its own always-on `procd` service (`hwdash-wanmon`) independent of the on-demand `rpcd` calls, since per-link history needs to persist whether or not the dashboard is open. On `mwan3` routers it reuses `mwan3`'s own `LD_PRELOAD` fwmark wrapper to reach the correct WAN; on everything else it binds directly to the right device or address per protocol family.

**DNS privacy** — every lookup this package makes (ASN queries, egress-IP lookups, reverse-DNS, custom domain targets) is automatically routed around the router's own resolver whenever that resolver is a filtering one (AdGuard Home, Pi-hole, Unbound), so a background dashboard never becomes noise in your DNS log. Plain `dnsmasq` is left alone, since it doesn't log per-query.

**Frontend** — a single LuCI view with two independent poll loops (hardware readout, ping probes) that pause entirely while the browser tab is hidden. Every card is a persistent DOM skeleton patched in place each tick rather than rebuilt, so a tab left open indefinitely stays cheap.

The AWK-based WiFi capability parser and the full data-source list (which `/proc`, `/sys` and `hwmon` paths back each card) are documented inline in `root/usr/libexec/rpcd/luci.hwdash`. Per-release changes and fixes are listed on the [Releases](https://github.com/AliLostInTheDark/luci-app-hw-dashboard/releases) page.

## License

Apache License 2.0
