include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-hw-dashboard
LUCI_TITLE:=Hardware Dashboard
LUCI_DEPENDS:=+luci-base +curl
LUCI_PKGARCH:=all
PKG_VERSION:=1.2.5
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_LICENSE_FILES:=LICENSE

include $(TOPDIR)/feeds/luci/luci.mk

define Package/luci-app-hw-dashboard/conffiles
/etc/config/hwdash
endef

# call BuildPackage - OpenWrt buildroot signature

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
	/etc/init.d/rpcd restart 2>/dev/null
	[ -x /etc/init.d/hwdash-wanmon ] && {
		/etc/init.d/hwdash-wanmon enable 2>/dev/null
		/etc/init.d/hwdash-wanmon restart 2>/dev/null
	}
	[ -x /etc/init.d/hwdash-aql ] && {
		/etc/init.d/hwdash-aql enable 2>/dev/null
		/etc/init.d/hwdash-aql start 2>/dev/null
	}
	( sleep 3; ubus call luci.hwdash info >/dev/null 2>&1; ubus call luci.hwdash info >/dev/null 2>&1 ) &
	exit 0
}
endef
