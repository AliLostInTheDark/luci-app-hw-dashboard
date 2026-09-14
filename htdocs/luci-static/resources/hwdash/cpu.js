'use strict';
'require baseclass';
'require hwdash.ui as ui';

// The CPU dial, the detailed load breakdown and the per-core card. All three
// come from the same /proc/stat counters, taken as deltas between polls.

function parseStat(line) {
	var p = line.trim().split(/\s+/).map(function(v, i) { return i ? parseInt(v, 10) || 0 : v; });
	var s = { name: p[0], user: p[1], nice: p[2], sys: p[3], idle: p[4], iowait: p[5], irq: p[6], softirq: p[7] };
	s.idleAll = s.idle + s.iowait;
	s.total = s.user + s.nice + s.sys + s.irq + s.softirq + s.idleAll;
	return s;
}

function fmtUptime(secs) {
	var d = Math.floor(secs / 86400), h = Math.floor(secs % 86400 / 3600), m = Math.floor(secs % 3600 / 60);
	return (d > 0 ? d + 'd ' : '') + (d > 0 || h > 0 ? h + 'h ' : '') + m + 'm';
}

function statRows(box, cache, rows, cls) {
	ui.syncRows(box, cache, rows, function(r) { return r.key; }, function(r) {
		var val = E('span', { class: 'hw-stat-value' });
		return { el: E('div', { class: 'hw-stat-row' + (cls ? ' ' + cls : '') }, [E('span', { class: 'hw-stat-label' }, [r.label]), val]), val: val };
	}, function(row, r) {
		ui.setText(row.val, r.val);
		row.val.style.color = r.color || '';
		row.val.style.textTransform = r.upper ? 'uppercase' : '';
	});
}

function barItem(label, cls) {
	var val = E('span', { class: 'hw-stat-value' });
	var fill = E('div', { class: 'hw-bar-fill' });
	return {
		el: E('div', { class: 'hw-progress-item' + (cls ? ' ' + cls : '') }, [
			E('div', { class: 'hw-progress-header' }, [E('span', { class: 'hw-stat-label' }, [label]), val]),
			E('div', { class: 'hw-bar-bg' }, [fill])
		]),
		val: val,
		fill: fill
	};
}

function setBar(item, pct, text, color) {
	ui.setText(item.val, text);
	item.val.style.color = color || '';
	item.fill.style.width = pct + '%';
	if (color) item.fill.style.background = color;
}

return baseclass.extend({
	parseStat: parseStat,

	create: function(dash) {
		var prev = {}, prevCounters = null;
		var cache = { stats: {}, meta: {}, load: {}, freq: {} };
		(dash.statLines || []).forEach(function(line) {
			if (line.indexOf('cpu') === 0) {
				var s = parseStat(line);
				prev[s.name] = s;
			}
		});

		var dial = ui.dialCard(_('CPU'), _('CPU usage'));
		var meta = E('div', { class: 'hw-stats-list' });
		dial.node.appendChild(ui.divider());
		dial.node.appendChild(E('h4', { class: 'hw-subhead' }, _('System Status')));
		dial.node.appendChild(meta);

		var loadList = E('div', { class: 'hw-stats-list' });
		var loadCard = ui.card(_('CPU Detailed Load'), [loadList]);

		var coresBox = E('div', { class: 'hw-core-grid' });
		var freqGrid = E('div', { class: 'hw-freq-grid' });
		// Frequency residency describes the same silicon as the cores, so it
		// shares their card.
		var freqSection = E('div', { class: 'hw-freq', style: 'display:none' }, [
			ui.divider(),
			E('h4', { class: 'hw-subhead' }, _('Frequency Residency (since boot)')),
			freqGrid
		]);
		var coresCard = ui.card(_('Per-Core Usage'), [coresBox, freqSection], 'wide');
		var cores = {}, coreCount = -1, prevRx = null;

		function updateCore(idx, pct, khz, rx) {
			var c = cores[idx];
			if (!c) {
				c = cores[idx] = barItem(_('Core %d').format(idx));
				c.freq = E('div', { class: 'hw-core-freq', title: _('Clock speed, and this core’s share of received-packet processing (NET_RX) since the last update') });
				coresBox.appendChild(E('div', { class: 'hw-core-cell' }, [c.el, c.freq]));
			}
			setBar(c, pct, pct.toFixed(1) + '%', ui.loadColor(pct));
			var text = [khz ? ui.fmtKHz(khz) : '', rx != null ? _('RX %d%%').format(Math.round(rx)) : ''].filter(Boolean).join(' · ');
			ui.setText(c.freq, text);
			c.freq.style.display = text ? '' : 'none';
		}

		function updateInfo(info) {
			var m = info.cpu_meta || {}, si = info.sys_info || {};
			var count = info.cpus.length - 1;
			var caches = [];
			if (si.l0 > 0) caches.push('L0 ' + ui.fmtCache(si.l0));
			if ((si.l1d || 0) + (si.l1i || 0) > 0) caches.push('L1 ' + ui.fmtCache((si.l1d || 0) + (si.l1i || 0)));
			if (si.l2 > 0) caches.push('L2 ' + ui.fmtCache(si.l2));
			if (si.l3 > 0) caches.push('L3 ' + ui.fmtCache(si.l3));
			if (si.l4 > 0) caches.push('L4 ' + ui.fmtCache(si.l4));
			var clocks = (info.freqs || []).filter(function(f) { return f !== null; });

			var rows = [{ key: 'cores', label: _('Cores / Threads'), val: (m.cores || count) + 'C / ' + (m.threads || m.cores || count) + 'T' }];
			rows.push({ key: 'cache', label: _('Cache'), val: caches.length ? caches.join(' + ') : '0 MB' });
			if (clocks.length) rows.push({ key: 'cur', label: _('Current Freq'), val: ui.fmtKHz(Math.max.apply(null, clocks)) });
			if (m.max_freq > 0) rows.push({ key: 'max', label: _('Max Freq'), val: ui.fmtKHz(m.max_freq) });
			if (m.tasks) rows.push({ key: 'tasks', label: _('Tasks (Run/Total)'), val: m.tasks });
			statRows(dial.stats, cache.stats, rows, 'hw-row-tight');

			rows = [{ key: 'load', label: _('Load Average'), val: [m.load_1 || '0', m.load_5 || '0', m.load_15 || '0'].join(', ') }];
			var gov = String(m.governor || '').trim();
			if (gov && gov !== 'null' && gov.toLowerCase() !== 'unknown')
				rows.push({ key: 'gov', label: _('CPU Governor'), val: gov, upper: true });
			rows.push({ key: 'uptime', label: _('Uptime'), val: info.uptime ? fmtUptime(info.uptime) : '' });
			if (m.psi)
				rows.push({ key: 'psi', label: _('Pressure (CPU / IO, 10s)'), val: m.psi.cpu.toFixed(1) + '% / ' + m.psi.io.toFixed(1) + '%',
					color: m.psi.cpu >= 20 || m.psi.io >= 20 ? '#ffb300' : '' });
			statRows(meta, cache.meta, rows);
		}

		function updateLoad(shares, m) {
			var rows = shares.map(function(s) { return { key: s[0], type: 'bar', label: s[1], pct: s[2], invert: s[0] === 'idle' }; });
			var now = Date.now();
			if (m.tasks) {
				rows.push({ key: 'tasks', type: 'text', label: _('System Tasks'), val: m.tasks });
				// Per second over the real interval between polls.
				if (prevCounters && now > prevCounters.t) {
					var dt = (now - prevCounters.t) / 1000;
					rows.push({ key: 'ctxt', type: 'text', label: _('Context Switches / s'), val: Math.round(((m.ctxt || 0) - prevCounters.ctxt) / dt) + ' /s' });
					rows.push({ key: 'intr', type: 'text', label: _('Hardware Interrupts / s'), val: Math.round(((m.intr || 0) - prevCounters.intr) / dt) + ' /s' });
				}
				var connPct = Math.min((m.conntrack || 0) / (m.conntrack_max || 1) * 100, 100);
				rows.push({ key: 'conn', type: 'conn', label: _('Active Connections'), pct: connPct, val: (m.conntrack || 0) + ' / ' + (m.conntrack_max || 1) });
			}
			prevCounters = { ctxt: m.ctxt || 0, intr: m.intr || 0, t: now };

			ui.syncRows(loadList, cache.load, rows, function(r) { return r.key; }, function(r) {
				if (r.type === 'text') {
					var val = E('span', { class: 'hw-stat-value' });
					return { el: E('div', { class: 'hw-progress-item hw-load-text' }, [
						E('div', { class: 'hw-progress-header' }, [E('span', { class: 'hw-stat-label' }, [r.label]), val])
					]), val: val };
				}
				return barItem(r.label, r.type === 'conn' ? 'hw-load-conn' : '');
			}, function(row, r) {
				if (r.type === 'text')
					ui.setText(row.val, String(r.val));
				else
					setBar(row, r.pct, r.type === 'conn' ? r.val : r.pct.toFixed(1) + '%', ui.loadColor(r.pct, r.invert));
			});
		}

		// Share of time at each clock since boot; long tables keep the ten
		// busiest states, in frequency order.
		function updateFreqs(stats) {
			var total = 0;
			(stats || []).forEach(function(p) { total += p[1]; });
			if (!stats || stats.length < 2 || total <= 0) {
				freqSection.style.display = 'none';
				return;
			}
			var list = stats.length > 10
				? stats.slice().sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10).sort(function(a, b) { return a[0] - b[0]; })
				: stats;
			ui.syncRows(freqGrid, cache.freq, list, function(p) { return p[0]; }, function(p) {
				return barItem(ui.fmtKHz(p[0]), 'hw-row-sm');
			}, function(row, p) {
				var pct = p[1] / total * 100;
				setBar(row, pct, pct.toFixed(1) + '%', '#00bcd4');
			});
			freqSection.style.display = '';
		}

		return {
			cards: { cpu: dial.node, load: loadCard, cores: coresCard },
			update: function(info) {
				if (!info.cpus)
					return;
				var count = info.cpus.length - 1;
				if (count !== coreCount) {
					coresBox.textContent = '';
					cores = {};
					coreCount = count;
					// Up to eight cells in a row, otherwise balanced rows (12 -> 6x2).
					coresBox.style.setProperty('--hw-core-cols', String(count <= 8 ? Math.max(1, count) : Math.ceil(count / Math.ceil(count / 8))));
				}
				if (info.model)
					ui.setText(dial.heading, info.model);

				// Each core's share of received-packet processing since the last
				// poll: one core near 100% is carrying all the traffic.
				var rx = info.net_rx || [], rxShare = [];
				if (prevRx && prevRx.length === rx.length && count > 1) {
					var d = rx.map(function(v, i) { return Math.max(0, v - prevRx[i]); });
					var sum = d.reduce(function(a, b) { return a + b; }, 0);
					if (sum > 0)
						rxShare = d.map(function(v) { return v / sum * 100; });
				}
				prevRx = rx;

				info.cpus.forEach(function(line) {
					var s = parseStat(line), p = prev[s.name];
					prev[s.name] = s;
					if (!p)
						return;
					var total = s.total - p.total, idle = s.idleAll - p.idleAll;
					var pct = total > 0 ? Math.max(0, Math.min(100, 100 * (total - idle) / total)) : 0;
					if (s.name !== 'cpu') {
						var idx = parseInt(s.name.slice(3), 10);
						updateCore(idx, pct, info.freqs && info.freqs[idx], rxShare[idx]);
						return;
					}
					dial.set(Math.round(pct), _('%d Cores').format(count));
					var share = function(key) { return total > 0 ? (s[key] - p[key]) / total * 100 : 0; };
					updateLoad([
						['idle', _('Idle'), share('idle')],
						['user', _('User'), share('user')],
						['nice', _('Nice'), share('nice')],
						['sys', _('System'), share('sys')],
						['iowait', _('I/O Wait'), share('iowait')],
						['irq', _('IRQ'), share('irq')],
						['softirq', _('Soft IRQ'), share('softirq')]
					], info.cpu_meta || {});
				});
				updateInfo(info);
				updateFreqs(info.freq_stats);
			}
		};
	}
});
