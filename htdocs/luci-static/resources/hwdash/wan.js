'use strict';
'require baseclass';
'require rpc';
'require hwdash.ui as ui';
'require hwdash.isp as isp';

// WAN Uptime Status, and the AP Mode card that replaces it on an access
// point, where the only "WAN" is the LAN uplink.

var callWanQuality = rpc.declare({
	object: 'luci.hwdash.wan',
	method: 'wan_quality',
	expect: {}
});

var callApStats = rpc.declare({
	object: 'luci.hwdash.wan',
	method: 'ap_stats',
	expect: {}
});

function statusColor(s) {
	return s === 'up' ? '#4caf50' : s === 'down' ? '#f44336' : '#9e9e9e';
}

function latencyColor(ms) {
	if (ms == null) return '#4caf50';
	return ms > 250 ? '#f44336' : ms > 150 ? '#ff9800' : ms > 100 ? '#ffb300' : ms > 50 ? '#8bc34a' : '#4caf50';
}

function uptimeColor(p) {
	return p >= 99.9 ? '#4caf50' : p >= 99 ? '#8bc34a' : p >= 95 ? '#ffb300' : '#f44336';
}

function downtimeColor(p) {
	return p > 5 ? '#f44336' : p > 1 ? '#ff9800' : p > 0 ? '#ffb300' : '#4caf50';
}

// A row from an older collector without these fields must not throw: that
// would abort the row sync and freeze every row below it.
function percent(v) {
	return typeof v === 'number' && isFinite(v) ? Math.min(100, Math.max(0, v)) : null;
}

// One column of the metric grid: a value over a small caption.
function metric(label, tip) {
	var val = E('span', { class: 'hw-metric-val' });
	return { el: E('div', { class: 'hw-metric' }, [E('div', { class: 'hw-metric-top' }, [val]), E('span', { class: 'hw-metric-lbl', title: tip || null }, [label])]), val: val };
}

function statusMetric() {
	var m = { dot: E('span', { class: 'hw-status-dot' }), val: E('span', { class: 'hw-metric-val hw-metric-status' }), since: E('span', { class: 'hw-metric-lbl hw-metric-since' }) };
	m.el = E('div', { class: 'hw-metric' }, [E('div', { class: 'hw-metric-top' }, [m.dot, m.val]), m.since]);
	return m;
}

function setStatus(m, r) {
	var color = statusColor(r.status), since = ui.fmtDurationFull(r.since_change_s);
	m.dot.style.background = color;
	m.val.style.color = color;
	ui.setText(m.val, r.status === 'up' ? _('Active') : r.status === 'down' ? _('Offline') : _('Unknown'));
	ui.setText(m.since, r.status === 'down' ? _('Down %s').format(since) : since);
}

function setPercents(up, down, r) {
	var u = percent(r.uptime_pct), d = percent(r.downtime_pct);
	ui.setText(up.val, u === null ? '—' : u.toFixed(2) + '%');
	up.val.style.color = u === null ? '' : uptimeColor(u);
	ui.setText(down.val, d === null ? '—' : d.toFixed(2) + '%');
	down.val.style.color = d === null ? '' : downtimeColor(d);
}

// Why a link is down, on its own line: the status column only has room for a word.
function setReason(el, r) {
	var why = r.status === 'down' && r.down_reason ? r.down_reason.charAt(0).toUpperCase() + r.down_reason.slice(1) : '';
	ui.setText(el, why);
	el.style.display = why ? '' : 'none';
	el.style.color = why ? statusColor(r.status) : '';
}

function ispHead() {
	var h = { badge: isp.badge(), name: E('span', { class: 'hw-isp-name' }), sub: E('span', { class: 'hw-isp-sub' }) };
	h.el = E('div', { class: 'hw-isp' }, [h.badge.el, E('div', { class: 'hw-isp-text' }, [h.name, h.sub])]);
	return h;
}

function setIsp(h, r, role) {
	var id = isp.identify(r.isp, r.iface);
	ui.setText(h.name, id.name);
	h.name.title = id.full;
	h.badge.set(id);
	ui.setText(h.sub, r.iface.toUpperCase() + ' • ' + (role || id.asn || _('WAN Link')));
}

function wanRow() {
	var e = {
		head: ispHead(),
		status: statusMetric(),
		latency: metric(_('Latency'), _('Round-trip delay of the most recent successful probe (RFC 2681). While a link is failing but not yet declared down, this remains the last good measurement.')),
		rate: metric(_('Down / Up Rate')),
		up: metric(_('Uptime 24h')),
		down: metric(_('Down 24h')),
		reason: E('div', { class: 'hw-wan-reason', style: 'display:none' })
	};
	e.rate.val.classList.add('hw-metric-rate');
	e.el = E('div', { class: 'hw-wan' }, [
		E('div', { class: 'hw-wan-main' }, [e.head.el, E('div', { class: 'hw-wanq-metrics' }, [e.status.el, e.latency.el, e.rate.el, e.up.el, e.down.el])]),
		e.reason
	]);
	return e;
}

function patchWan(e, r, rateOwner) {
	setStatus(e.status, r);
	setIsp(e.head, r);
	setPercents(e.up, e.down, r);
	setReason(e.reason, r);
	e.latency.val.style.color = latencyColor(r.cur_ms);
	ui.setText(e.latency.val, r.status === 'up' && r.cur_ms != null ? r.cur_ms + ' ms' : '—');

	var rx = r.rx_bps || 0, tx = r.tx_bps || 0, owner = r.rate_dev ? rateOwner[r.rate_dev] : null;
	if (owner && owner !== r.iface) {
		ui.setText(e.rate.val, _('shared') + '\n' + owner.toUpperCase());
		e.rate.val.title = _('This interface shares device %s with %s; the traffic is counted there.').format(r.rate_dev, owner.toUpperCase());
		e.rate.val.style.opacity = '0.5';
	}
	else {
		ui.setText(e.rate.val, ui.fmtRate(rx) + '\n' + ui.fmtRate(tx));
		e.rate.val.title = r.rate_dev ? _('On %s').format(r.rate_dev) : '';
		e.rate.val.style.opacity = rx || tx ? '1' : '0.45';
	}
}

function apRow() {
	var e = {
		head: ispHead(),
		status: statusMetric(),
		gw: metric(_('Gateway Ping')),
		rate: metric(_('Down / Up Rate')),
		up: metric(_('Uptime 24h')),
		down: metric(_('Down 24h')),
		gwChip: E('span', { class: 'hw-ap-chip' }),
		mgmtChip: E('span', { class: 'hw-ap-chip' }),
		vlanChip: E('span', { class: 'hw-ap-chip' }),
		inetChip: E('span', { class: 'hw-ap-chip hw-ap-chip-dim' }),
		reason: E('div', { class: 'hw-wan-reason', style: 'display:none' })
	};
	e.rate.val.classList.add('hw-metric-rate');
	e.el = E('div', { class: 'hw-wan' }, [
		E('div', { class: 'hw-wan-main' }, [e.head.el, E('div', { class: 'hw-wanq-metrics' }, [e.status.el, e.gw.el, e.rate.el, e.up.el, e.down.el])]),
		E('div', { class: 'hw-chip-row hw-ap-chips' }, [e.gwChip, e.mgmtChip, e.vlanChip, e.inetChip]),
		e.reason
	]);
	return e;
}

function patchAp(e, r) {
	setStatus(e.status, r);
	setIsp(e.head, r, _('AP Uplink'));
	setPercents(e.up, e.down, r);
	setReason(e.reason, r);
	e.gw.val.style.color = latencyColor(r.gw_ms);
	ui.setText(e.gw.val, r.status === 'up' && r.gw_ms != null ? r.gw_ms + ' ms' : '—');
	ui.setText(e.rate.val, ui.fmtRate(r.rx_bps || 0) + '\n' + ui.fmtRate(r.tx_bps || 0));
	ui.setText(e.gwChip, _('GW %s').format(r.gateway || '—'));
	ui.setText(e.mgmtChip, _('MGMT %s').format(r.management_ip || '—'));
	ui.setText(e.vlanChip, _('VLAN %s').format(r.vlan ? r.vlan.split(' ').join(', ') : _('None')));
	// Informational: an outage past the gateway is nothing an AP can fix.
	ui.setText(e.inetChip, _('INET %s').format(r.inet_status === 'up' && r.inet_ms != null ? r.inet_ms + ' ms' : '—'));
}

return baseclass.extend({
	create: function(dash) {
		var wanList = E('div', { class: 'hw-wan-list' });
		var apList = E('div', { class: 'hw-wan-list' });
		var wanCard = ui.card(_('WAN Uptime Status'), [wanList], 'wide');
		var apCard = ui.card(_('AP Mode'), [apList], 'wide');
		var rows = { wan: {}, ap: {} };

		wanCard.style.display = 'none';
		apCard.style.display = 'none';

		function renderAp(res) {
			var list = (res && res.ap_stats) || [];
			if (dash.isHidden('ap_stats'))
				return;
			apCard.style.display = list.length ? 'flex' : 'none';
			ui.syncRows(apList, rows.ap, list, function(r) { return r.iface; }, apRow, patchAp);
		}

		var apTick = ui.single(function() { return callApStats().then(renderAp); });

		function render(res) {
			var all = ((res && res.wan_quality) || []).slice().sort(function(a, b) { return ui.byName(a.iface, b.iface); });
			var ap = !!(res && res.ap_mode);
			// On an access point the list is only the promoted LAN link, which
			// AP Mode covers; it must not raise WAN alerts.
			dash.lastWq = ap ? [] : all;
			if (ap) apTick();
			else apCard.style.display = 'none';
			dash.renderAlerts();
			dash.settings.syncWanIfaces(ap ? [] : all);
			wanCard.style.display = all.length && !ap ? 'flex' : 'none';
			if (ap)
				return;

			var shown = all.filter(function(r) { return !dash.isIfaceHidden(r.iface, r.alias_of); });
			// The first row on a device owns its traffic counters.
			var owner = {};
			shown.forEach(function(r) { if (r.rate_dev && !owner[r.rate_dev]) owner[r.rate_dev] = r.iface; });
			ui.syncRows(wanList, rows.wan, shown, function(r) { return r.iface; }, wanRow, function(e, r) { patchWan(e, r, owner); });
		}

		return {
			cards: { wan_quality: wanCard, ap_stats: apCard },
			// Offset from the info poll so two shell calls never fork together.
			tick: ui.single(function() {
				return ui.delay(150).then(function() { return callWanQuality(); }).then(render);
			})
		};
	}
});
