include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-hw-dashboard
LUCI_TITLE:=Hardware Dashboard
LUCI_DEPENDS:=+luci-base +ethtool-full
LUCI_PKGARCH:=all
PKG_VERSION:=1.3.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature

define Package/luci-app-hw-dashboard/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	rm -rf /tmp/hwdash_*
	rm -rf /etc/hwdash
	/etc/init.d/rpcd restart 2>/dev/null
	[ -x /etc/init.d/hwdash-wanmon ] && {
		/etc/init.d/hwdash-wanmon enable 2>/dev/null
		/etc/init.d/hwdash-wanmon restart 2>/dev/null
	}
	( sleep 3; ubus call luci.hwdash info >/dev/null 2>&1; ubus call luci.hwdash info >/dev/null 2>&1 ) &
	exit 0
}
endef
