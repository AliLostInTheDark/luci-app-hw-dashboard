'use strict';
'require baseclass';
'require hwdash.ui as ui';

// Wired ports with their negotiated state and traffic, then USB host
// controllers and whatever is plugged into them.

function usbGen(v) {
	return v >= 20000 ? 'USB 3.2 Gen 2×2 (20 Gbps)' : v >= 10000 ? 'USB 3.2 Gen 2 (10 Gbps)'
		: v >= 5000 ? 'USB 3.2 Gen 1 (5 Gbps)' : v >= 480 ? 'USB 2.0 (480 Mbps)'
		: v >= 12 ? 'USB 1.1 (12 Mbps)' : v > 0 ? 'USB 1.0 (1.5 Mbps)' : '';
}

function usbRate(v) {
	return v >= 1000 ? v / 1000 + ' Gbps' : v > 0 ? v + ' Mbps' : '';
}

function usbColor(v) {
	return v >= 5000 ? '#00bcd4' : v >= 480 ? '#ffea00' : '#9e9e9e';
}

function linkColor(speed) {
	var mbps = parseInt(speed, 10) || 0;
	return mbps >= 1000 ? '#00bcd4' : mbps >= 10 ? '#ffea00' : '#9e9e9e';
}

function detail(label, cls) {
	var val = E('span');
	return { el: E('div', { class: 'hw-port-row' + (cls ? ' ' + cls : ''), style: 'display:none' }, [E('span', {}, [label]), val]), val: val };
}

function show(el, on) {
	el.style.display = on ? '' : 'none';
}

function subhead(text) {
	return E('h4', { class: 'hw-list-head', style: 'display:none' }, [text]);
}

function portRow() {
	var e = {
		dot: E('span', { class: 'hw-port-dot' }),
		name: E('span', { class: 'hw-port-name' }),
		uplink: E('span', { class: 'hw-port-tag', style: 'display:none' }, [_('SWITCH UPLINK')]),
		status: E('span'),
		slow: E('div', { class: 'hw-port-slow', style: 'display:none' }),
		note: E('div', { class: 'hw-port-note', style: 'display:none' }, [_('Combined traffic for every port below, not this link alone — packets routed between two ports both cross it.')]),
		through: detail(_('Throughput:'), 'hw-port-through'),
		errors: detail(_('Errors/Drops:')),
		phy: detail(_('PHY:'), 'hw-port-phy'),
		mac: detail(_('MAC / MTU:'), 'hw-port-mac')
	};
	e.throughLabel = e.through.el.firstChild;
	e.el = E('div', { class: 'hw-port' }, [
		E('div', { class: 'hw-port-head' }, [E('div', { class: 'hw-port-id' }, [e.dot, e.name, e.uplink]), e.status]),
		e.slow, e.through.el, e.note, e.errors.el, e.phy.el, e.mac.el
	]);
	return e;
}

function usbRow(speedLabel) {
	return function() {
		var e = { name: E('div', { class: 'hw-usb-name' }), min: detail(_('Min Speed:')), max: detail(speedLabel) };
		e.el = E('div', { class: 'hw-usb' }, [e.name, e.min.el, e.max.el]);
		return e;
	};
}

function patchUsb(e, u) {
	ui.setText(e.name, u.name);
	show(e.min.el, !!u.minLabel);
	ui.setText(e.min.val, u.minLabel || '');
	e.min.val.style.color = usbColor(u.minSpeed);
	show(e.max.el, !!u.label);
	ui.setText(e.max.val, u.label);
	e.max.val.style.color = usbColor(u.speed);
}

return baseclass.extend({
	create: function() {
		var ethHead = subhead(_('Ethernet')), ethList = E('div');
		var usbHead = subhead(_('USB Host Controllers')), usbList = E('div');
		var devHead = subhead(_('USB Devices')), devList = E('div');
		var node = ui.card(_('Ports Topology'), [E('div', { class: 'hw-ports' }, [ethHead, ethList, usbHead, usbList, devHead, devList])]);
		var cache = { eth: {}, usb: {}, dev: {} }, lastBytes = {};

		node.style.display = 'none';

		function patchPort(e, l, info) {
			var down = l.speed === 'Down', mbps = parseInt(l.speed, 10) || 0, color = linkColor(l.speed);
			var et = info.ethtool && info.ethtool[l.iface];
			ui.setText(e.name, l.iface.toUpperCase());
			e.el.style.borderLeftColor = color;
			e.dot.style.background = color;
			e.dot.style.boxShadow = '0 0 5px ' + color;
			e.status.style.color = color;
			ui.setText(e.status, down ? _('Disconnected') : _('%s Mbps (%s)').format(l.speed, l.duplex));
			show(e.uplink, !!l.conduit);

			// Both ends offer more than they settled on: the link fell back,
			// which is nearly always a damaged or two-pair cable.
			var both = et ? Math.min(et.adv_max || 0, et.lp_max || 0) : 0;
			var slow = !down && mbps > 0 && both > mbps;
			show(e.slow, slow);
			if (slow)
				ui.setText(e.slow, _('Linked at %d Mb/s, but both ends support %d Mb/s — usually a damaged or two-pair cable.').format(mbps, both));

			var rx = parseInt(l.rx_bytes, 10) || 0, tx = parseInt(l.tx_bytes, 10) || 0, now = Date.now();
			var prev = lastBytes[l.iface], rate = null;
			if (prev && now > prev.t && rx >= prev.rx && tx >= prev.tx) {
				var dt = (now - prev.t) / 1000;
				rate = [(rx - prev.rx) * 8 / 1e6 / dt, (tx - prev.tx) * 8 / 1e6 / dt];
			}
			lastBytes[l.iface] = { rx: rx, tx: tx, t: now };

			show(e.through.el, !down && rate !== null);
			// A DSA conduit carries the whole switch's traffic, twice for
			// anything routed between two ports.
			show(e.note, !down && rate !== null && !!l.conduit);
			if (rate) {
				ui.setText(e.throughLabel, l.conduit ? _('Combined Throughput:') : _('Throughput:'));
				ui.setText(e.through.val, '↓ ' + ui.fmtMbps(rate[0]) + '   ↑ ' + ui.fmtMbps(rate[1]));
			}

			var rxErr = parseInt(l.rx_err, 10) || 0, txErr = parseInt(l.tx_err, 10) || 0;
			var rxDrop = parseInt(l.rx_drop, 10) || 0, txDrop = parseInt(l.tx_drop, 10) || 0;
			show(e.errors.el, !down);
			ui.setText(e.errors.val, _('Rx: %d/%d | Tx: %d/%d').format(rxErr, rxDrop, txErr, txDrop));
			e.errors.val.style.color = rxErr || txErr || rxDrop || txDrop ? '#ff5252' : '';

			show(e.phy.el, !down && !!et);
			if (et) {
				var phy = _('autoneg %s · pause %s').format(et.an, et.pause);
				if (et.eee !== 'n/a') phy += ' · ' + _('EEE %s').format(et.eee);
				if (et.drv) phy += ' · ' + et.drv + (et.fw && et.fw !== 'N/A' ? ' fw ' + et.fw : '');
				ui.setText(e.phy.val, phy);
				e.phy.val.style.color = et.eee === 'active' ? '#ffb300' : '';
			}

			show(e.mac.el, !!l.mac);
			if (l.mac) {
				var flaps = parseInt(l.carrier_changes, 10) || 0;
				ui.setText(e.mac.val, l.mac.toUpperCase() + ' · ' + l.mtu + (flaps > 2 ? ' · ' + _('%d link flaps').format(flaps) : ''));
				e.mac.val.style.color = flaps > 2 ? '#ffb300' : '';
			}
		}

		return {
			cards: { ports: node },
			update: function(info) {
				var links = info.eth_links || [];
				var ctlRaw = info.usb_ports || [], nameCount = {};
				ctlRaw.forEach(function(c) { var n = c.product || _('USB Host Controller'); nameCount[n] = (nameCount[n] || 0) + 1; });
				// The backend folds an xHCI's USB 2 and USB 3 root hubs into one
				// controller; identical pairs are told apart by device node.
				var ctls = ctlRaw.map(function(c, i) {
					var n = c.product || _('USB Host Controller'), max = parseFloat(c.speed) || 0, min = parseFloat(c.min) || 0;
					return { key: c.ctl || n + '|' + i, name: nameCount[n] > 1 && c.ctl ? n + ' (' + c.ctl + ')' : n,
						speed: max, label: usbGen(max), minSpeed: min, minLabel: min > 0 && min < max ? usbGen(min) : '' };
				});
				var devs = (info.usb_devs || []).filter(function(u) {
					var n = (u.name || '').trim();
					return n && n !== 'Unknown' && n !== 'Unknown Device';
				}).map(function(u, i) {
					var v = parseFloat(u.speed) || 0;
					return { key: u.name + '|' + i, name: u.name, speed: v, label: usbRate(v) };
				});

				show(node, links.length || ctls.length || devs.length);
				show(ethHead, links.length);
				show(usbHead, ctls.length);
				usbHead.classList.toggle('hw-list-head-gap', links.length > 0);
				show(devHead, devs.length);
				ui.syncRows(ethList, cache.eth, links, function(l) { return l.iface; }, portRow, function(e, l) { patchPort(e, l, info); });
				ui.syncRows(usbList, cache.usb, ctls, function(u) { return u.key; }, usbRow(_('Max Speed:')), patchUsb);
				ui.syncRows(devList, cache.dev, devs, function(u) { return u.key; }, usbRow(_('Speed:')), patchUsb);
			}
		};
	}
});
