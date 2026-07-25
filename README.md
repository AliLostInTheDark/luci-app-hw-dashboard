<div align="center">

# luci-app-hw-dashboard
## Made with Claude Code as a personal fun project, expect bugs.

A real-time hardware & network monitoring dashboard for OpenWrt LuCI, built from scratch in vanilla JavaScript — no external libraries, no frameworks. Every metric is read directly from the kernel and system interfaces, polled live, and rendered without page reloads.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Release](https://img.shields.io/github/v/release/AliLostInTheDark/luci-app-hw-dashboard?label=release)](https://github.com/AliLostInTheDark/luci-app-hw-dashboard/releases)
[![OpenWrt](https://img.shields.io/badge/OpenWrt-any%20target-1f6feb.svg)](https://openwrt.org)

</div>

---

Standard LuCI status pages don't show CPU cache topology, NAND wear, PCIe negotiated link state, per-radio WiFi PHY capabilities, or which WAN link actually belongs to which ISP. This dashboard does — and it's tuned to spawn as few processes as an embedded router can get away with, so leaving it open costs almost nothing.

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
| **CPU & Memory** | Per-core load, cache topology (even without kernel support), frequency residency, context switches, top IRQs by rate |
| **Storage** | NAND/UBI wear & ECC trend, SquashFS + overlay breakdown, real disk I/O throughput, NVMe/SATA SMART health |
| **Topology** | PCIe, USB and Ethernet link state — negotiated speed/width shown next to the hardware's rated maximum |
| **WiFi** | Per-band PHY details (channel, TX power, NSS, bitrate, noise floor) straight from `iwinfo`/`iw` |
| **Ping Latency** | Realtime graph with **true packet-level loss and jitter**, not a poll-level guess — plus a bufferbloat grade |
| **WAN Quality** | Per-link uptime/downtime and latency, with the **ISP correctly identified** even behind `mwan3` or carrier-grade NAT |
| **Wireless AQL** | Tune airtime queue limits for lower Wi‑Fi latency under load — with presets, save/revert/reset, and persistence across reboots |
| **Privacy** | Every background DNS lookup this package makes is automatically kept off a filtering resolver (AdGuard Home, Pi‑hole, Unbound) |
| **Settings** | Persist on-device via UCI — follow the router across browsers, sysupgrades and backups |

## Installation

### Pre-built package (recommended)

Grab the latest `.apk` from the [Releases](https://github.com/AliLostInTheDark/luci-app-hw-dashboard/releases) page:

```sh
apk add --allow-untrusted luci-app-hw-dashboard-<version>.apk
```

Depends on `ethtool-full` (pulled in automatically) for per-port PHY details, and `curl`. The post-install script restarts `rpcd` for you — reload LuCI and open **Status → Hardware Dashboard**.

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

Arc dial for aggregate load, plus cores/threads, cache sizes (L0–L4, resolved from CPU identity when the kernel doesn't expose them directly), live/max frequency, load average, governor and uptime. A dedicated grid card breaks per-core load, frequency and utilization out individually. The advanced panel adds a full CPU-time breakdown, context switches, hardware interrupts, top IRQ sources by per-core rate, softnet backlog drops, active connections vs. the conntrack limit, and cumulative frequency residency.
</details>

<details>
<summary><b>Memory</b></summary>

Arc dial plus physical/usable totals, memory speed (via optional `dmidecode`), used/free/cached/buffers, swap, ZRAM with live compression ratio, and kernel slab/page-table overhead.
</details>

<details>
<summary><b>System Info</b></summary>

Hostname, distro string, kernel version, CPU model, SoC identity (Qualcomm platforms), and CPU vulnerability mitigation status, color-coded by severity.
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

Voltage/current/fan/power rails from `hwmon`, plus Intel RAPL package/core/DRAM power on x86. All thermal zones are laid out alphabetically with per-sensor sparklines, thresholds taken from the hardware's own trip points where available, and a cooling-device row showing active throttling plus the peak temperature seen since boot.
</details>

<details>
<summary><b>Ports & PCIe Topology</b></summary>

Per-port Ethernet link speed/duplex, live throughput, error/drop counters and (with `ethtool`) negotiated flow control and EEE state. USB host controllers and connected peripherals with real negotiated speed. PCIe devices with negotiated link speed/width shown next to the controller's rated maximum, so a device running below capability is obvious at a glance.
</details>

<details>
<summary><b>Offload Engines</b></summary>

Whether the packet fast path is actually active — nftables flowtable state, hardware/software offload switches, live conntrack-offloaded and PPE-bound flow counts (with since-boot peak), and WED engine presence. Covers both MediaTek (PPE/WED) and Qualcomm (PPE) accelerators. The card hides itself on platforms with no offload at all, and where offload is configured but the kernel exposes no counters for it, it says so instead of showing an “Active” row with nothing under it.
</details>

<details>
<summary><b>Ping Latency</b></summary>

Realtime graph of router-side latency to configurable targets (defaults: `dns.google`, `one.one.one.one`, `google.com`, `youtube.com`), dual-stack by default. A per-target table adds **cur / min / avg / p95 / max / jitter / loss** — loss is counted from individual ICMP packets received, not from polls that came back empty, so a single dropped packet on an otherwise healthy link no longer reads as either "fine" or "down" incorrectly. A bufferbloat grade (A+–F) compares latency under load against idle, reusing the existing WAN throughput samples.
</details>

<details>
<summary><b>WAN Quality</b></summary>

One row per internet-facing interface — logo, status, rolling 24-hour uptime/downtime, time in current state, and latency. Works with or without `mwan3`, and picks up any interface with a genuine default route automatically, including VPN tunnels used as a full exit path. The ISP is identified by ASN lookup against the link's real public egress IP (never assumed from the interface address, which can sit inside carrier-NAT space announced by a completely different operator), shown with its full registry name, and resolved for IPv6-only links too.
</details>

<details>
<summary><b>Wireless AQL</b></summary>

Airtime Queue Limits control how much Wi‑Fi traffic mac80211 will buffer per station. Lowering them trades a little peak throughput for markedly lower latency under load, since a bulk transfer can no longer push everything else behind hundreds of milliseconds of queued frames — the 1500–2500 µs range is the usual sweet spot.

The card shows the live limit, threshold and in-flight airtime per radio. Settings offers latency/balanced/bandwidth presets plus custom values, with **Save / Revert / Reset** — Save applies to every radio and persists, Revert restores the last saved values, Reset returns to the driver defaults. Because these controls live in debugfs and don't survive a reboot, saved values are replayed at boot by a small init service.

Requires `CONFIG_MAC80211_DEBUGFS` and a mounted debugfs; the card hides itself entirely on builds without them. **AQL and WED are mutually exclusive** — WED offloads the Wi‑Fi datapath in hardware and bypasses mac80211's queues, so AQL never sees that traffic. When WED is active the card says so rather than letting you tune a control that does nothing.
</details>

<details>
<summary><b>Hardware Events</b></summary>

A filtered `dmesg` view — thermal, ECC, link-flap, USB, OOM and voltage events with relative timestamps.
</details>

<details>
<summary><b>WiFi PHY & Spectrum</b></summary>

One column per band (2.4/5/6 GHz): channel & width, TX power, hardware mode, configured vs. max spatial streams, enabled channel list, current bitrate, client count and noise floor.
</details>

## Settings

Open the gear icon (top right) to show/hide individual cards, show/hide individual WAN Quality rows, edit ping targets, tune Wireless AQL, adjust CPU governor/frequency limits, or download a full diagnostics snapshot as JSON. A page-level **Save / Revert / Reset** applies to the whole panel — Revert restores the last saved state, Reset returns everything to defaults. Settings persist on the router via UCI (`/etc/config/hwdash`) and survive sysupgrades.

## How it works

**Backend** — a single POSIX shell `rpcd` call object (`luci.hwdash`) serving the full hardware readout in one round-trip, plus dedicated ping and settings methods. Slow-changing data (WiFi capabilities, SoC identity, storage layout) is cached with short-lived TTLs so the per-poll process count stays low on embedded hardware.

**WAN Quality** runs as its own always-on `procd` service (`hwdash-wanmon`) independent of the on-demand `rpcd` calls, since per-link history needs to persist whether or not the dashboard is open. On `mwan3` routers it reuses `mwan3`'s own `LD_PRELOAD` fwmark wrapper to reach the correct WAN; on everything else it binds directly to the right device or address per protocol family.

**DNS privacy** — every lookup this package makes (ASN queries, egress-IP lookups, reverse-DNS, custom domain targets) is automatically routed around the router's own resolver whenever that resolver is a filtering one (AdGuard Home, Pi-hole, Unbound), so a background dashboard never becomes noise in your DNS log. Plain `dnsmasq` is left alone, since it doesn't log per-query.

**Frontend** — a single LuCI view with two independent poll loops (hardware readout, ping probes) that pause entirely while the browser tab is hidden. Every card is a persistent DOM skeleton patched in place each tick rather than rebuilt, so a tab left open indefinitely stays cheap.

The AWK-based WiFi capability parser and the full data-source list (which `/proc`, `/sys` and `hwmon` paths back each card) are documented inline in `root/usr/libexec/rpcd/luci.hwdash`. Per-release changes and fixes are listed on the [Releases](https://github.com/AliLostInTheDark/luci-app-hw-dashboard/releases) page.

## License

Apache License 2.0
