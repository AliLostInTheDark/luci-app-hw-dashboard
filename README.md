# luci-app-hw-dashboard

A real-time hardware monitoring dashboard for OpenWrt LuCI. Built entirely from scratch using vanilla JavaScript and CSS — no external libraries or frameworks. Every metric is sourced directly from the kernel and system interfaces, polled live, and rendered without page reloads.

The dashboard is designed to be genuinely informative rather than decorative. It surfaces data that standard LuCI status pages omit: CPU cache topology, NAND wear levels, SoC identity, PCIe negotiated link state, WiFi PHY capabilities, and more. Layout is fully responsive; all cards collapse correctly on mobile.

## Installation

### From pre-built package (recommended)

Download the latest `.apk` from the [Releases](https://github.com/AliLostInTheDark/luci-app-hw-dashboard/releases) page and install it on your router:

```sh
apk add --allow-untrusted luci-app-hw-dashboard-1.2.0-r1.apk
```

The package depends on `ethtool-full` (pulled in automatically when repository feeds are configured) for per-port PHY details; without it those rows are simply omitted. The post-install script restarts `rpcd` automatically. Reload the LuCI interface and navigate to **Status > Hardware Dashboard**.

### From source

Clone into your OpenWrt build tree and compile:

```sh
git clone https://github.com/AliLostInTheDark/luci-app-hw-dashboard.git package/luci/luci-app-hw-dashboard
make menuconfig   # LuCI -> Applications -> luci-app-hw-dashboard
make package/luci/luci-app-hw-dashboard/compile V=s
```

### Upgrading

Installing a newer release over an existing one automatically clears all persisted hardware caches (`/etc/hwdash/`) and the LuCI module cache, so stale data from a previous version is never served.


## Supported Devices

The dashboard runs on any OpenWrt device. It has been developed and validated on the following JioRouter hardware:

| Model | Variants | SoC | Notes |
|-------|----------|-----|-------|
| JIDU6J11 | JIDU6111 to JIDU6911 | Qualcomm IPQ9554 | Primary development target |
| JIDU6J01 | JIDU6101 to JIDU6801 | MediaTek MT7986a | Primary development target |
| JIDU6700 | JIDU6700 | MediaTek MT7981BA | Primary development tagret {WiFi chip temperatures non-functional — calibration data absent from Factory partition (Jio never bothered to check those and just shipped it in a broken state)} |

On x86/x86\_64 and non-Qualcomm ARM targets, Qualcomm-specific fields (SoC family, SoC ID, machine name) are silently omitted. All other functionality is platform-independent.


## Dashboard Cards

### CPU

An SVG arc dial shows aggregate CPU utilization at a glance. Below it:

- **Cores / Threads** — physical core and logical thread counts
- **Cache** — L0 through L4 sizes read from `/sys/devices/system/cpu/cpu*/cache/`. On kernels without `CONFIG_CPU_CACHE_INFO` (common on QSDK-derived builds), cache sizes are resolved from the ARM CPU implementer and part number in `/proc/cpuinfo` using a built-in lookup table covering Cortex-A5 through Cortex-X4, Falkor, and Neoverse families
- **Current / Max Frequency** — live per-core frequency from `cpufreq`, maximum from `cpuinfo_max_freq`
- **Load Average** — 1 / 5 / 15 minute averages
- **CPU Governor** — active scaling governor
- **Uptime** — formatted as days, hours, minutes

Per-core utilization lives in its own dedicated full-width **Per-Core Usage** card below the CPU/Memory/Detailed-Load row, laid out as a responsive grid of bordered per-core cells (name, live frequency, utilization bar) rather than a single tall list — on low core-count boards it's a short single row, on high thread-count CPUs (e.g. 6C/12T desktop-class x86) it wraps into a clean multi-row grid instead of dwarfing its siblings in height.

The advanced CPU panel (shown alongside) breaks down aggregate time into: Idle, User, Nice, System, I/O Wait, IRQ, Soft IRQ, and tracks Context Switches/s, Hardware Interrupts/s, System Tasks (running / total), and Active Connections against the conntrack limit (with the since-boot peak). It also shows:

- **Top IRQs** — the five hottest interrupt sources by rate with a per-core stacked split, so you can see at a glance which core services the NIC/Wi-Fi interrupts and whether packet steering spreads the load
- **Backlog Drops / Squeezed** — softnet counters; drops mean a CPU could not keep up with packet input
- **Freq Residency** — cumulative time spent at each frequency step since boot (hidden when the kernel lacks `CONFIG_CPU_FREQ_STAT`)

### Memory

An SVG arc dial shows RAM utilization. The stats list includes:

- Physical Total (rounded up to the nearest standard DRAM size: 32 MB through 64 GB)
- Memory Speed (e.g. "DDR4 2133 MT/s") — decoded from SMBIOS via the optional `dmidecode` package. Not installed by default (pointless on embedded boards with no DMI tables at all), so this row is simply absent unless `dmidecode` is installed separately; the value is genuinely static hardware data, cached for a day rather than re-decoded every poll
- Usable Total (as reported by the kernel)
- Used, Free, Cached, Buffers — each with a proportional progress bar
- Swap — shown only when a swap partition or file is active
- ZRAM — compressed RAM block device utilization with the live compression ratio
- Slab Kernel and PageTables — kernel memory overhead

### System Info

Static system identity collected once and persisted:

- Hostname and OpenWrt distribution string
- Kernel version and CPU architecture
- CPU model (from `/proc/cpuinfo` or `/tmp/sysinfo/model` fallback)
- **SoC Family, Machine, SoC ID, SoC Revision, SoC Serial** — read from `/sys/devices/soc0/` (present on Qualcomm platforms; silently absent elsewhere)
- CPU vulnerability mitigations (`/sys/devices/system/cpu/vulnerabilities/`) with color coding: green for mitigated, amber for partially mitigated, red for vulnerable

### Internal Storage

The card leads with the rootfs filesystem as a progress bar showing used vs. usable space, with read/write I/O speed for disk-backed filesystems and percentage utilization for NAND/flash. Additional mounted filesystems appear as separate bars.

Root's I/O speed is read from whichever block device actually backs `/`, resolved server-side — UBI block device or loop device backing `/overlay` on a squashfs+overlay layout, falling back to the mount's own major:minor (cross-referenced against `/proc/diskstats`) when root is a plain writable filesystem with no overlay split at all, e.g. an x86 image installed directly to a NVMe/SSD partition. This matters on layouts where the naming convention differs from the typical embedded assumption.

The reported rate is real bytes/sec — the raw `/proc/diskstats` sector delta between polls divided by the actual measured wall-clock time between them, not just assumed to equal the nominal 3-second poll interval. Poll ticks aren't a precise metronome (browser tab throttling, slower `ubus` round-trips under heavy I/O contention), so a fixed-divisor assumption swings wildly under load — most visibly during sustained sequential transfers, where it could show numbers several times higher than the drive's real throughput.

`/rom` — the read-only squashfs base image every OpenWrt device boots from underneath its writable overlay — gets its own bar, labeled `[SquashFS]`, showing size and percentage used (it's always 100%, being read-only) rather than a meaningless "0 B/s" speed readout, and a static color rather than the usual usage-based red/amber/cyan scale, since "100% used" is normal here, not a warning. It's excluded from the headline Usable Total/Free figures since it isn't extra capacity — it's the static layer the overlay sits on top of, already accounted for via the root mount.

A **SquashFS Root Image** detail section (alongside the UBI/eMMC/NVMe/f2fs ones) shows Compression, Block Size, and Compressed Size, decoded directly from the squashfs superblock — the mount source is a synthetic `/dev/root` node rather than a real block device, so the real backing device is resolved via the kernel's own boot-time mount log line cross-referenced against `/proc/diskstats`. Requires a full `od` (coreutils; not always present on a minimal busybox userland) — silently absent otherwise, same graceful-degradation pattern as Memory Speed.

Below the filesystem bars, a summary section shows hardware-accurate storage sizes. The content is dynamic based on the detected underlying storage type:

| Storage type | Summary rows shown |
|---|---|
| NAND / MTD (UBI) | Physical NAND Total, rootfs Physical Total, Overlay Total / Used / Free, MTD Partitions |
| eMMC | Physical eMMC Total, Usable Total, Usable Free |
| HDD / SSD / NVMe | Physical Disk Total, rootfs Physical Total (if sub-partitioned), Usable Total, Usable Free |

**Physical NAND Total** is computed by summing MTD partition sizes directly from `/sys/class/mtd/`, not from block device enumeration. This ensures that externally connected USB drives never contaminate the reported NAND chip capacity.

**Overlay** data (Total / Used / Free) is sourced from `df /overlay` and reflects the actual writable space on UBI-based routers — the only number relevant to day-to-day flash usage.

**UBI / NAND Flash** sub-section:

- Erase Count — minimum / mean / maximum erase cycle counts read from `/sys/class/ubi/`
- PEB Status — total / available / bad block counts, with bad count shown in amber when non-zero and red when bad blocks exceed the UBI-reserved PEB pool
- NAND Geometry — page size, physical erase block size, OOB size, and ECC strength in bits (when the kernel exposes `/sys/class/mtd/mtdX/ecc_strength`)
- Volumes — per-volume name, type, and size; `rootfs_data` shows JFFS2 overlay used/free from `df /overlay`; each volume with a known capacity shows a proportional fill bar

**MTD Partition Table** — all MTD devices with their sizes and types in a compact table.

**eMMC** and **F2FS** detail sections are rendered conditionally when those storage types are detected.

**NVMe Details** shows identity (model, serial, firmware, transport) from sysfs, plus a full SMART health readout when the optional `smartmontools` package is installed. The box header carries a live temperature badge next to the Healthy/Warning/Critical badge — same styling and threshold-driven color as the Thermal Sensors card, but using the drive's own reported warning/critical temperature thresholds directly rather than a derived heuristic. (The "Critical" health state reflects the drive firmware's own SMART overall-health pass/fail verdict, not a guess.) Below that: Wear (Percentage Used), TBW (Total Bytes Written — the standard SSD endurance/warranty figure, shown next to Wear rather than folded into a generic read+write row), Available Spare and Namespace Utilization bars, Power-On Hours, Power Cycles, Unsafe Shutdowns, Media Errors, Error Log Entries, Data Read, Host Read/Write command counts, and decoded critical-warning flags (spare below threshold, temperature threshold, reliability degraded, media read-only, backup device failed) — parsed from `smartctl -a -j`. `smartmontools` isn't installed by default (there's nothing to read it on boards without an NVMe drive), so all of these fields are simply absent without it; identity still shows from sysfs alone. Chosen over `nvme-cli` deliberately: `smartctl` is protocol-universal (SATA/SCSI/NVMe), so the same tool and JSON shape can extend to SATA SSD/HDD SMART data later without a rewrite. Cached for 30 seconds since SMART counters change slowly. All sizes dashboard-wide, including these, scale to TB above 1024GB.

### External Storage

USB mass storage devices are detected by scanning block devices for the `removable` flag. Each partition shows its **Format** (detected filesystem type, or `—` when none is detected) and **Mounted** state (the mountpoint, or `No`) as two separate rows — a partition with no recognized filesystem is not the same thing as one that's unmounted, and the two used to be conflated into a single misleading "Unmounted" label.

Sizes are formatted dynamically (B / KB / MB / GB) based on magnitude rather than always rendering in GB, so a small partition doesn't show a meaningless "0.00 GB".

Some platforms carve out a raw partition purely as a loop device's backing store — e.g. x86 images that loop-mount a partition directly to host the f2fs `/overlay`, so the partition itself never has a filesystem of its own. The backend correlates this via `/sys/class/block/loopN/loop/backing_file`, and the dashboard shows the real relationship ("f2fs (via loop0)" / "/overlay (via loop0)") instead of a bare, unexplained dash.

### Power & Fans

Voltage, current, fan and power rails from generic `hwmon` channels (present on boards with a PMIC or Super I/O chip) are shown here when available. On x86 targets with an Intel CPU, package/core/DRAM power draw is additionally read from `/sys/class/powercap/intel-rapl*` (RAPL) — the backend reports the raw cumulative energy counter each poll, and the frontend derives instantaneous Watts from the delta between polls, the same client-side pattern used for disk I/O speed. The card is hidden entirely when neither source has anything to report (most embedded routers have no fan or power telemetry at all).

### Thermal Sensors

All thermal zones from `/sys/class/thermal/` and `hwmon` inputs are collected, de-duplicated and laid out alphabetically across up to three columns — no artificial CPU/WiFi/Misc grouping. When a platform exposes more than 12 sensors, additional thermal cards are appended automatically. Each reading is displayed as a color-coded badge whose warning/critical thresholds come from the sensor's own trip points when the hardware exposes them (falling back to 60/80 °C otherwise), so the coloring adapts to each architecture rather than using a single fixed scale. Critical readings get a pulsing glow.

Each sensor row carries an inline sparkline of the last ~60 samples, kept client-side at zero backend cost. Below the sensors, a chip row shows every cooling device (`/sys/class/thermal/cooling_device*`) — cyan when idle, amber with `cur/max` while the kernel is actively throttling, red when saturated — and the peak temperature seen since boot with the sensor name and when it happened.

### Ports Topology

Ethernet and USB share one card. Each physical ethernet interface shows link speed and duplex, live throughput from byte-counter deltas, RX/TX error and drop counters, MAC address, MTU, and the carrier-change counter (highlighted amber when the port flapped after its initial link-up). When `ethtool` is installed, a PHY row adds auto-negotiation state, the **negotiated** flow-control result (often different from the configured one), and EEE status — amber when EEE is actively idling the link, since that causes latency on some PHYs.

The USB section lists host controllers (root hubs, e.g. "xHCI Host Controller") together with connected peripheral devices, each by name, negotiated speed (USB 2.0 / 3.0 / 3.2) and protocol version — both come straight from a live `/sys/bus/usb/devices/` scan, not a hardcoded per-board guess, so the section reflects exactly what the kernel currently sees and is empty (rather than showing a stale claim) on boards with no USB sysfs entries at all.

### PCI-e Topology

PCIe devices are enumerated from `/sys/bus/pci/devices/` in their own card, hidden entirely when there is nothing meaningful to show. Each device shows the negotiated link speed and width alongside the controller maximum, making it immediately visible if a device is running below its rated capability.

### Offload Engines

Shows whether the packet fast path is actually working, not just configured: nftables flowtable state, the software/hardware offload switches from the firewall config, the live count of conntrack-offloaded flows, the number of flows currently **bound to the MTK PPE** (routed fully in hardware, never touching the CPU — with the since-boot peak), and WED (Wireless Ethernet Dispatch) engine presence. Hidden on platforms with none of it.

### Ping Latency

A full-width realtime graph (1-second cadence, 120-sample window) of router-side ping latency to dns.google, one.one.one.one, google.com and youtube.com — all dual-stack v4+v6 by default. All probes run in parallel with a 1s timeout, so the RPC returns in roughly the RTT of the slowest target. Timeouts spike to the top of the plot (no gaps) and the legend shows current latency, window average and packet-loss percentage per target; a target with no successful reply at all (e.g. IPv6 without a v6 uplink) draws no line and shows N/A. A bufferbloat grade (A+ through F) compares median latency under sustained WAN load against idle, reusing the live WAN throughput — zero extra probes.

Custom targets can be added from the settings panel with an IPv4 / IPv6 / both selector (duplicates are rejected), or via `/etc/hwdash-ping.targets` on the router (one `host 4|6` per line).

### Hardware Events

A filtered `dmesg` view (10-second TTL) showing thermal, ECC, link-flap, USB, OOM and voltage events with relative timestamps — the dashboard's "what happened while you weren't looking" card. Hidden when there is nothing to report.

### Settings

The gear button (top right) opens a panel styled with standard LuCI `cbi` classes and row structure (`cbi-value` / `cbi-value-title` / `cbi-value-field`): per-card show/hide checkboxes, the ping-target editor, CPU Performance controls, and a diagnostics snapshot button that downloads the latest full hardware readout as JSON. Settings persist **on the router** in the standard UCI configuration `/etc/config/hwdash` via dedicated `get_config`/`set_config` rpcd methods, so they follow the device across browsers and survive sysupgrades and backups.

**CPU Performance** — reads and writes the live `cpufreq` policy (governor, min/max frequency, turbo/boost) directly via `/sys`, the same interface `luci-app-cpu-perf` uses. The governor dropdown and frequency range are populated from the hardware's own reported bounds and available governors, so the same UI works whether the box exposes `performance`/`powersave` (Intel `intel_pstate`) or the full `ondemand`/`schedutil`/`conservative` set (generic `cpufreq-dt`). Changes apply immediately via an explicit **Apply** button (never automatically on every keystroke, since this is a live production setting) and are additionally synced into `/etc/config/cpu-perf` when that file already exists on the router, so a reboot doesn't silently revert what was just set — but the file is never created by the dashboard itself, since that package owns its own defaults.

### WiFi PHY & Spectrum

A full-width card with one labeled column per band (2.4 / 5 / 6 GHz) — radios of the same band stack vertically at equal heights, and bands the hardware doesn't have are hidden. Each radio is queried via `iwinfo` and `iw`; per-radio data includes:

- Band and channel (with width)
- TX power
- Hardware mode (802.11ac / ax / be)
- Configured and hardware-maximum NSS (spatial streams)
- Enabled channel list
- Current bitrate and associated client count
- Noise floor

WiFi hardware capabilities (`iw list`) are parsed by an AWK script and persisted to `/etc/hwdash/wifi_cap_v4.json` on first run, since `iw list` is expensive and the PHY capabilities never change at runtime.


## Caching Architecture

The dashboard is deliberately conservative about process spawning. Shell forks and `awk`/`iw` invocations account for significant CPU time on embedded platforms. Two tiers of caching are used:

**Persistent cache** (`/etc/hwdash/`) — survives reboots; represents data that is physically impossible to change without replacing hardware:

| File | Content | Invalidated |
|------|---------|-------------|
| `wifi_cap_v4.json` | WiFi PHY hardware capabilities from `iw list` | On package upgrade |
| `sys_static_v2.frag` | CPU cache sizes, SoC identity, kernel version, vulnerability status | On package upgrade |
| `hw_identity_v1.sh` | Board name, CPU model, core/thread counts, max frequency | On package upgrade |

Two files/configs live outside `/etc/hwdash/` so they survive package upgrades: `/etc/config/hwdash` (dashboard settings stored via UCI) and `/etc/hwdash-ecc.baseline` (the first-seen NAND ECC counter snapshot that powers the "+N since date" wear trend; auto-rebuilt if the counters reset after a reflash).

**Volatile cache** (`/tmp/`) — cleared on reboot; represents live data with a short TTL:

| File | Content | TTL |
|------|---------|-----|
| `hwdash_wifi_radios_v2.cache` | Live WiFi radio state (channel, bitrate, txpower, noise) | 20 seconds |
| `hwdash_storage_inv_v2.sh` | MTD partition table + UBI device tree (layout fixed at flash time; wear/ECC move slowly) | 30 seconds |
| `hwdash_offload.cache` | Flowtable / firewall offload configuration (nft + uci) | 30 seconds |
| `hwdash_ethtool.cache` | Per-port autoneg / flow control / EEE from ethtool | 30 seconds |
| `hwdash_events.cache` | Filtered dmesg hardware events | 10 seconds |
| `hwdash_fstype_*` | fs type of unmounted block devices (`block info`) | 10 minutes |
| `hwdash_realdev_*` | `/dev/root` → physical device mapping | per boot |
| `hwdash_peaks.sh` | Since-boot watermarks (peak temperature, conntrack, PPE flows) | per boot, rewritten only on a new record |

Cache freshness is checked with an expiry epoch embedded in each file — a builtin read plus an integer compare, with no `date -r` or `stat` fork per check.

On package upgrade or reinstall, all caches are cleared by the postinst script so that updated parsing logic always runs against fresh data.


## Backend

The backend is a single POSIX shell script registered as an `rpcd` call object at `/usr/libexec/rpcd/luci.hwdash` with six methods: `info` (the full hardware readout in one round-trip), `ping` (parallel latency probes, accepting a target list as arguments with hosts validated against a character whitelist before they reach a command line), `get_config`/`set_config` (router-side settings persistence, size-capped and re-serialized through `jsonfilter` so only valid JSON is ever written), and `get_cpu_perf`/`set_cpu_perf` (reads and writes the live `cpufreq` policy). `set_cpu_perf` validates the requested governor against `scaling_available_governors` and the frequency range against the hardware's own `cpuinfo_min_freq`/`cpuinfo_max_freq` before writing anything to `/sys` — an out-of-range or unrecognized value is rejected outright rather than silently clamped.

Data collection covers: CPU statistics, context switches and interrupts from a single pass over `/proc/stat`, per-IRQ per-core counters from `/proc/interrupts`, softnet backlog from `/proc/net/softnet_stat`, memory from `/proc/meminfo`, disk I/O from `/proc/diskstats`, filesystem usage from `df`, MTD layout and ECC counters from `/sys/class/mtd/`, UBI state from `/sys/class/ubi/`, thermal zones and cooling devices from `/sys/class/thermal/`, temperatures plus voltage/fan/power/current rails from `hwmon`, package/core/DRAM energy counters from `/sys/class/powercap/intel-rapl*` (x86 RAPL), cpufreq residency from `time_in_state`, ethernet link state from sysfs plus `ethtool`, offload state from `nft`/`uci`/PPE debugfs, PCIe topology from `/sys/bus/pci/`, USB topology from `/sys/bus/usb/`, WiFi state from `iwinfo` and `iw` (including per-channel airtime survey), eMMC health from `/sys/block/mmcblk*/`, NVMe identity from `/sys/block/nvme*/` and SMART health via the optional `smartmontools` package, F2FS statistics from `/sys/fs/f2fs/`, and hardware events from `dmesg`.

The script is written to minimize process spawning on embedded hardware: `/proc/stat` is parsed in a single pass for all CPU-tick, context-switch and interrupt counters; per-device `/sys` stat files are read with shell builtins rather than `cat`/`awk` pipelines; and the slow-changing storage inventory is served from cache (see Caching Architecture above) so the per-poll fork count stays low.

The AWK-based WiFi capability parser (`luci.hwdash_wifi_cap.awk`) handles the structured output of `iw list` to extract per-PHY band support, channel lists, NSS capabilities, and hardware mode.


## Frontend

The frontend is a single LuCI JavaScript view (`hw_dash.js`) with two poll loops: the main hardware readout every 3 seconds and the ping probes every second. Both stop entirely while the browser tab is hidden — the router does no collection work for a dashboard nobody is looking at — and resume on return.

Every card is built once as a persistent DOM skeleton and patched in place on each tick rather than torn down and rebuilt — CPU (dials, detailed load, frequency residency), Per-Core Usage (its own dedicated grid card), Memory, Internal/External Storage, Thermal Sensors, Ports Topology, PCI-e, Offload Engines, Interrupts, WiFi PHY, Hardware Events, hwmon/RAPL power, and System Info all update via one of two mechanisms: a keyed row-diff that adds, removes, or reorders only the rows whose underlying item actually appeared, disappeared, or moved (everything else is a `textContent`/style write on an already-attached node), or a content-signature gate that skips the rebuild outright when the section's structural inputs are byte-identical to the previous tick — which is the common case for hardware topology that only changes when something is physically plugged in or unplugged. The net effect is that a dashboard tab left open indefinitely does a few dozen text/style writes per tick instead of thousands of `createElement` calls, which is what was driving rising memory/CPU use and jank the longer the page stayed open.

Dynamic color scaling (`getDynColor`) maps utilization percentages to a green → amber → red gradient without hardcoded thresholds that would be wrong for different metric types. The inversion flag is used for metrics like Free memory and CPU Idle where high values are good.

The layout uses CSS flexbox throughout. Multi-column wide cards (the CPU advanced panel, Thermals, and the UBI/MTD detail row) use a flex-row layout that collapses to a flex-column on viewports below 768px. No media query breakpoints are hardcoded into JavaScript.


## License

Apache License 2.0
