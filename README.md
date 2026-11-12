# aurora-glass

Glass-style (Aero) variant of the **Aurora** theme for LuCI (OpenWrt), with light and dark modes, port cards that flip to show details, and real-time traffic per device.

> **Unofficial** project. Not affiliated with the authors of the original Aurora theme, which this work is based on: [eamonxg/luci-theme-aurora](https://github.com/eamonxg/luci-theme-aurora). Full credit in the [NOTICE](NOTICE) file.

Current version: **1.0** (see [VERSION](VERSION)).

## Features

- **Theme:** glass style over Aurora, light and dark modes, revised contrast (WCAG AA), tooltips with neon border.
- **Ports and interfaces:** cards that flip to show details; blue for connected, grey for no link.
- **Traffic per device:** real-time download and upload speed, plus accumulated total.
  - Wi-Fi: exact station counters (`iw`).
  - Wired: counters of the physical port where the device is connected. The port is found automatically from the bridge table, so no setup is needed, even if the device changes port.
- **Device name:** from DHCP, from a cache of names seen before, or from DHCPv6, in that order.
- **Vendor:** IEEE list, downloaded during installation.
- **Login:** shows the router model name and the device image.

## Compatibility

- **OpenWrt:** 25.12 or newer, with LuCI.
- **Tested on:** Xiaomi AX3000T (OpenWrt 25.12.6) and Xiaomi AX6000 (LuCI master, OpenWrt snapshot).
- **Other routers:** should work, but are not tested. The router image uses a generic icon unless you add a photo.
- **Languages:** the page text follows the LuCI language. The card parser reads LuCI labels in English and Portuguese, so other languages may show incomplete card data. Tested only with English and Portuguese.

## Requirements

- OpenWrt 25.12 or newer, with LuCI.
- SSH access as `root`.
- Tools that come with OpenWrt: `iw`, `hexdump`, `jsonfilter`, `awk`, and `uclient-fetch`.
- Internet access during installation, to download the original theme and the vendor list.

## Install

Tested on the **Xiaomi AX3000T** with OpenWrt 25.12.6. On other OpenWrt routers, the router image uses the generic one unless you add your own photo.

Open any terminal (PowerShell, cmd, Git Bash, Linux or macOS Terminal) and run this, replacing `ROUTER_IP` with the router's IP (usually `192.168.1.1` on OpenWrt):

```bash
ssh root@ROUTER_IP "uclient-fetch -q -T 60 -O - https://codeload.github.com/craniusfawkes/aurora-glass/tar.gz/refs/tags/v1.0 | tar -xz -C /tmp && sh /tmp/aurora-glass-1.0/install.sh /tmp/aurora-glass-1.0"
```

SSH asks for the router's root password, the same one as the LuCI panel. The command downloads version 1.0 directly from GitHub, so you don't need to copy anything from your computer. When it finishes, refresh the LuCI page with Ctrl+F5.

The script can be run again without problems. It does not change the firewall or the network.

## Uninstall

One command, on your computer:

```bash
ssh root@ROUTER_IP "uclient-fetch -q -T 60 -O - https://codeload.github.com/craniusfawkes/aurora-glass/tar.gz/refs/tags/v1.0 | tar -xz -C /tmp && sh /tmp/aurora-glass-1.0/uninstall.sh"
```

Confirm with `y`. It removes aurora-glass and Aurora, and switches the router back to the default theme (Bootstrap). Then refresh the page with Ctrl+F5.

## Router image

The theme looks for `modelos/<id>.png`, where `<id>` is the model ID in OpenWrt (e.g. `xiaomi_mi-router-ax3000t.png`). See [modelos/LEIA-ME.md](modelos/LEIA-ME.md). Only use images you have the right to use.

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
