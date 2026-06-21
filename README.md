# LuCI Hardware Dashboard (Highly Optimized for JioRouter Devices)

A beautiful, responsive, and dynamic hardware dashboard for OpenWrt LuCI, built completely from scratch using Vanilla CSS Flexbox. It replaces standard tables with stunning visual gauges, progress bars, and real-time updating columns.

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

- **Real-Time Polling Backend:** A lightweight RPCD C/shell backend (`luci.hwdash`) securely accesses device info using low-level `/sys` and `/proc` hooks.
- **Dynamic External Storage Detection:** Instantly detects inserted USB storage devices—even unmounted ones or exFAT formatted drives—displaying them in separated columns with format and IOPS details.
- **Thermal Sensors Grid:** Dynamically scales thermal outputs into responsive columns (CPU, Wi-Fi, Miscellaneous), adapting automatically to screen width and number of sensors.
- **Micro-Animations:** Fluid CSS transitions on hover events and value updates.
- **Custom RAM & Disk Dials:** Pure HTML/CSS SVG circular dials for an elegant visual representation of storage and memory usage.

## Installation

If you are compiling your own OpenWrt firmware for the supported JioRouter boards, you can simply clone this repository into your package feeds or directly into `package/luci/`:

```bash
git clone https://github.com/AliLostInTheDark/luci-app-hw-dashboard.git package/luci/luci-app-hardware-dashboard
```

Run `make menuconfig`, navigate to **LuCI -> Applications**, select `luci-app-hardware-dashboard`, and compile your firmware!

## 📸 Screenshots
*(Coming soon)*
