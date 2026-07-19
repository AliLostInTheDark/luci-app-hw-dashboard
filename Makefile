include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-hw-dashboard
LUCI_TITLE:=Hardware Dashboard
LUCI_DEPENDS:=+luci-base +ethtool-full
LUCI_PKGARCH:=all
PKG_VERSION:=1.2.1
PKG_RELEASE:=5
PKG_LICENSE:=Apache-2.0

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature

define Package/luci-app-hw-dashboard/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	rm -f /tmp/hwdash_*
	rm -rf /etc/hwdash
	/etc/init.d/rpcd restart 2>/dev/null
	( sleep 3; ubus call luci.hwdash info >/dev/null 2>&1; ubus call luci.hwdash info >/dev/null 2>&1 ) &
	exit 0
}
endef
