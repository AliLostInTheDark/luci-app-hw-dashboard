include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-hw-dashboard
LUCI_TITLE:=Hardware Dashboard
LUCI_DEPENDS:=+luci-base +curl
LUCI_PKGARCH:=all
PKG_ARCH:=all
PKG_VERSION:=1.2.7
PKG_RELEASE:=2
PKG_LICENSE:=Apache-2.0
PKG_LICENSE_FILES:=LICENSE

define Package/luci-app-hw-dashboard/conffiles
/etc/config/hwdash
endef

define Package/luci-app-hw-dashboard/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	# Rescue the ECC baseline before the caches go. Older versions kept it
	# in tmpfs alongside them, so wiping first would destroy the recorded
	# NAND history on the very upgrade that gives it a permanent home --
	# the backend's own migration never gets the chance to run.
	[ -f /tmp/hwdash/ecc.baseline ] && [ ! -f /etc/hwdash/ecc.baseline ] && {
		mkdir -p /etc/hwdash
		cat /tmp/hwdash/ecc.baseline > /etc/hwdash/ecc.baseline 2>/dev/null
	}
	rm -rf /tmp/hwdash*
	/etc/init.d/rpcd reload 2>/dev/null
	[ -x /etc/init.d/hwdash-wanmon ] && {
		/etc/init.d/hwdash-wanmon enable 2>/dev/null
		/etc/init.d/hwdash-wanmon restart 2>/dev/null
	}
	# The Wireless AQL card and its boot-time replay service were dropped in
	# 1.2.6. apk does not run the old package's prerm on upgrade, so clear
	# the now-dangling enable links and the saved section here instead.
	rm -f /etc/rc.d/S*hwdash-aql /etc/rc.d/K*hwdash-aql
	uci -q delete hwdash.aql && uci -q commit hwdash
	( sleep 3; ubus call luci.hwdash info >/dev/null 2>&1; ubus call luci.hwdash info >/dev/null 2>&1 ) &
	exit 0
}
endef

define Package/luci-app-hw-dashboard/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/etc/init.d/hwdash-wanmon stop 2>/dev/null
	/etc/init.d/hwdash-wanmon disable 2>/dev/null
	rm -rf /tmp/hwdash*
	exit 0
}
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
