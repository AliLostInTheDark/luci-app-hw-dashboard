'use strict';
'require baseclass';
'require hwdash.ui as ui';

// Problems worth noticing, derived from data the other cards already poll, so
// the card costs the router nothing. It stays hidden while all is well: a
// panel that always says "OK" teaches you to stop reading it.

var COLORS = { crit: '#ff5252', warn: '#ffb300' };

function collect(info, wans, isIfaceHidden) {
	var out = [];
	var add = function(sev, title, detail) { out.push({ sev: sev, title: title, detail: detail }); };

	// Only the critical trip counts. The passive trip is where gentle
	// throttling starts, which MT7986 idles above. Zones without a trip report
	// placeholders like -274 °C. One sensor exposed under two spellings
	// (cpu-thermal, cpu_thermal) is one alert.
	var seen = {};
	(info.thermals || []).forEach(function(t) {
		var c = (t.temp || 0) / 1000, crit = (t.crit || 0) / 1000;
		if (!(crit > 0 && crit < 200))
			return;
		var key = String(t.type || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + c.toFixed(1) + '|' + crit;
		if (seen[key])
			return;
		seen[key] = true;
		if (c >= crit)
			add('crit', _('Critical temperature'), _('%s at %.1f °C, trip point %d °C').format(t.type, c, Math.round(crit)));
		else if (c >= crit * 0.9)
			add('warn', _('Temperature approaching limit'), _('%s at %.1f °C, 90%% of the %d °C trip').format(t.type, c, Math.round(crit)));
	});

	// Uncorrectable ECC failures mean corrupted data got through. Corrected
	// bitflips are normal NAND behaviour until they reach the ECC strength.
	(info.mtd_parts || []).forEach(function(m) {
		var failed = (m.ecc_fail || 0) - (m.ecc_fail_base || 0);
		var fixed = (m.ecc_corr || 0) - (m.ecc_corr_base || 0);
		if (failed > 0)
			add('crit', _('Uncorrectable flash errors'), _('mtd%d (%s): %d uncorrectable since baseline').format(m.num, m.name, failed));
		else if (fixed > 0 && m.ecc_strength && fixed >= m.ecc_strength)
			add('warn', _('Flash bitflips accumulating'), _('mtd%d (%s): %d corrected since baseline, ECC strength %d').format(m.num, m.name, fixed, m.ecc_strength));
	});

	// "Present", not "new": flash ships with factory bad blocks.
	var bad = info.ubi_bad_peb || 0;
	if (bad > 0)
		add(bad >= 10 ? 'crit' : 'warn', _('Bad flash blocks present'), N_(bad, '%d bad PEB on UBI', '%d bad PEBs on UBI').format(bad));

	var cm = info.cpu_meta || {};
	if (cm.conntrack_max > 0) {
		var ctPct = cm.conntrack / cm.conntrack_max * 100;
		if (ctPct >= 90)
			add('crit', _('Connection table nearly full'), _('%d of %d (%d%%) — new connections will start being dropped').format(cm.conntrack, cm.conntrack_max, ctPct));
		else if (ctPct >= 80)
			add('warn', _('Connection table filling'), _('%d of %d (%d%%)').format(cm.conntrack, cm.conntrack_max, ctPct));
	}

	// Read-only images such as /rom are full by design.
	(info.df || []).forEach(function(d) {
		var pct = parseInt(d.pct, 10);
		if (d.mount === '/rom' || d.hw_type === 'SquashFS' || !(pct >= 90))
			return;
		add(pct >= 95 ? 'crit' : 'warn', pct >= 95 ? _('Filesystem almost full') : _('Filesystem filling up'),
			_('%s at %d%% (%s free)').format(d.mount, pct, ui.fmtKiB(d.avail)));
	});

	var mem = info.mem || {};
	if (mem.oom_kills > 0)
		add('warn', _('Processes killed for lack of memory'), N_(mem.oom_kills, '%d out-of-memory kill since boot', '%d out-of-memory kills since boot').format(mem.oom_kills));
	if (mem.tmp_total > 0) {
		var tmpPct = mem.tmp_used / mem.tmp_total * 100;
		if (tmpPct >= 90)
			add(tmpPct >= 95 ? 'crit' : 'warn', _('RAM disk filling up'), _('/tmp at %d%% of its %s limit').format(tmpPct, ui.fmtKiB(mem.tmp_total)));
	}

	(info.eth_links || []).forEach(function(l) {
		var et = info.ethtool && info.ethtool[l.iface];
		var speed = parseInt(l.speed, 10) || 0, both = et ? Math.min(et.adv_max || 0, et.lp_max || 0) : 0;
		if (speed > 0 && both > speed)
			add('warn', _('Port running below its rated speed'), _('%s linked at %d Mb/s; both ends support %d Mb/s').format(l.iface, speed, both));
	});

	var si = info.sys_info || {};
	if (si.ntp && !si.ntp.synced)
		add('warn', _('Clock not synchronised'), _('The router clock is not synced to NTP; HTTPS, encrypted DNS and log times depend on it'));
	if (si.crash && si.crash.count > 0)
		add('warn', _('Kernel crash log saved'), _('%s recorded %s — see /sys/fs/pstore').format(si.crash.reason || _('Crash'),
			si.crash.time > 0 ? new Date(si.crash.time * 1000).toLocaleString() : ''));

	(wans || []).forEach(function(w) {
		if (isIfaceHidden(w.iface, w.alias_of))
			return;
		var up = parseFloat(w.uptime_pct);
		if (w.status === 'down') {
			// The cause decides whether you check a cable or wait for the ISP.
			var d = _('%s has been down for %s').format(w.iface.toUpperCase(), ui.fmtDurationFull(w.since_change_s || 0));
			add('crit', _('WAN down'), w.down_reason ? d + ' — ' + w.down_reason : d);
		}
		else if (up >= 0 && up < 99) {
			add('warn', _('WAN unstable'), _('%s at %.2f%% uptime over 24h').format(w.iface.toUpperCase(), up));
		}
	});

	return out.sort(function(a, b) { return a.sev === b.sev ? 0 : a.sev === 'crit' ? -1 : 1; });
}

return baseclass.extend({
	create: function(dash) {
		var box = E('div', { class: 'hw-alerts' });
		var node = ui.card(_('Alerts'), [box], 'wide');
		var rows = {};

		node.style.display = 'none';

		return {
			cards: { alerts: node },
			render: function() {
				if (dash.isHidden('alerts'))
					return;
				var list = dash.lastInfo ? collect(dash.lastInfo, dash.lastWq, dash.isIfaceHidden.bind(dash)) : [];
				node.style.display = list.length ? 'flex' : 'none';
				ui.syncRows(box, rows, list, function(a) { return a.sev + '|' + a.title + '|' + a.detail; }, function(a) {
					var title = E('span', { class: 'hw-alert-title', style: 'color:' + COLORS[a.sev] }, [a.title]);
					return {
						el: E('div', { class: 'hw-alert', style: 'border-left-color:' + COLORS[a.sev] }, [
							E('span', { class: 'hw-dot hw-dot-sm', style: 'background:' + COLORS[a.sev] }),
							title,
							E('span', { class: 'hw-alert-detail' }, [a.detail])
						])
					};
				}, function() {});
			}
		};
	}
});
