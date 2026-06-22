# LuCI Hardware Dashboard (Highly Optimized for JioRouter Devices)

A beautiful, responsive, and fully dynamic hardware dashboard for OpenWrt LuCI, built completely from scratch using Vanilla CSS Flexbox. It replaces standard tables with stunning visual gauges, progress bars, and real-time updating columns.

This hardware dashboard has been meticulously crafted and **highly optimized for JioRouter Devices**. It seamlessly adapts to both desktop and mobile views, delivering a premium "Glassmorphism" aesthetic without the overhead of heavy frameworks.

## Supported & Optimized Devices

While this dashboard works on any modern OpenWrt build, it is highly optimized for the following JioRouter models:
- **JIDU6101**
- **JIDU6J01**
- **JIDU6J11**
- **JIDU6700**

> [!WARNING] 
> **Wireless Chip Temperatures:** Temperature readings for the Wi-Fi chips on the **JioRouter JIDU6700** are currently *non-functional*. This is because the necessary calibration values and chip-specific tunings are entirely missing from the device's *Factory* partition.

## Features

- **Real-Time CPU & Memory Tracking:** Instantly view active processor load across all cores, alongside highly detailed memory and swap utilization metrics via beautiful SVG dials.
- **Dynamic Hardware Discovery:** The dashboard actively senses your hardware capabilities, intelligently rendering or hiding cards (like Thermal Sensors, PCI-e, and USB Busses) so you never see empty sections.
- **PCI-e & USB Topology Maps:** Automatically maps connected PCI-e devices and USB hosts, comparing their current negotiated speeds against the maximum supported controller speeds.
- **Ethernet Switch State:** Live, color-coded visual topology of your router's physical WAN and LAN ports, displaying current connection states, negotiated link speeds, and live RX/TX error rates.
- **Wi-Fi PHY & Spectrum Analyzer:** Actively queries the Wi-Fi physical layer (PHY) to display active noise floors, TX power, client connection counts, and live bitrates across all wireless bands.
- **Advanced Storage Metrics:** Instantly detects all internal and external (USB) storage partitions—even unmounted drives—reporting their exact format types and real-time Read/Write I/O speeds.
- **Thermal Sensors Grid:** Dynamically scales thermal outputs into responsive columns (CPU, Wi-Fi, Miscellaneous) and intelligently flags temperatures approaching critical thresholds.

## Installation

If you are compiling your own OpenWrt firmware for the supported JioRouter boards, you can simply clone this repository into your package feeds or directly into `package/luci/`:

```bash
git clone https://github.com/AliLostInTheDark/luci-app-hw-dashboard.git package/luci/luci-app-hardware-dashboard
```

Run `make menuconfig`, navigate to **LuCI -> Applications**, select `luci-app-hardware-dashboard`, and compile your firmware!

## Screenshots
*(Coming soon)*
