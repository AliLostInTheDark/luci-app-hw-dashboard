'use strict';
'require baseclass';
'require hwdash.ui as ui';
'require hwdash.graph as graph';

var COLORS = ['#00bcd4', '#ffb300', '#e91e63', '#8bc34a', '#b388ff', '#ff7043', '#4dd0e1', '#f06292', '#ffd54f'];
var RAW_KEEP = 200, BUCKETS_KEEP = 360;

// One sample per info poll (3 s); buckets hold ten.
var VIEWS = graph.spanViews([
	{ raw: true, pts: 40, perPoint: 1 },
	{ raw: true, pts: 100, perPoint: 1 },
	{ raw: true, pts: 200, perPoint: 1 },
	{ group: 1, pts: 120, perPoint: 10 },
	{ group: 3, pts: 120, perPoint: 30 }
], 3);

// Trip points come in millidegrees or degrees.
function degrees(v) {
	v = v && v !== 'null' ? parseInt(v, 10) : null;
	return v > 1000 ? v / 1000 : v;
}

// Channels that report a number without measuring anything: an unwired input
// reading exactly 0 °C with no limits, and NVMe "Sensor N" slots that some
// firmware fills with a staircase of 1 °C steps (50, 51, 52 …).
function placeholders(list) {
	var skip = {}, slots = {};
	list.forEach(function(t) {
		if (!t.temp && degrees(t.crit) === null && degrees(t.pass) === null)
			skip[t.type] = true;
		var m = /^(.*) \(Sensor (\d+)\)(.*)$/.exec(t.type);
		if (m)
			(slots[m[1] + m[3]] = slots[m[1] + m[3]] || []).push({ n: +m[2], t: t });
	});
	Object.keys(slots).forEach(function(k) {
		var s = slots[k].sort(function(a, b) { return a.n - b.n; });
		if (s.length >= 3 && s.every(function(x, i) { return !i || x.t.temp - s[i - 1].t.temp === 1000; }))
			s.forEach(function(x) { skip[x.t.type] = true; });
	});
	return skip;
}

function sensorRow() {
	var r = {
		dot: E('span', { class: 'hw-dot hw-dot-sm' }),
		name: E('span'),
		temp: E('span', { class: 'hw-temp-badge' }),
		pass: E('span', { class: 'hw-trip hw-trip-pass' }),
		crit: E('span', { class: 'hw-trip hw-trip-crit' })
	};
	r.trips = E('div', { class: 'hw-trips' }, [r.pass, r.crit]);
	r.el = E('div', { class: 'hw-sensor' }, [
		E('div', { class: 'hw-stat-row' }, [E('span', { class: 'hw-stat-label hw-sensor-name' }, [r.dot, r.name]), r.temp]),
		r.trips
	]);
	return r;
}

// Amber from the passive trip (or 65% of critical), red from 85% of critical.
function patchRow(r, s) {
	var hot = s.crit ? s.crit * 0.85 : 80;
	var warm = s.pass ? Math.min(s.pass, hot - 5) : (s.crit ? s.crit * 0.65 : 60);
	var color = s.temp >= hot ? '#ff1744' : s.temp > warm ? '#ffb300' : '#00bcd4';
	r.dot.style.background = s.color;
	ui.setText(r.name, s.name);
	r.temp.className = 'hw-temp-badge' + (s.temp >= hot ? ' hw-temp-crit' : '');
	r.temp.style.color = color;
	r.temp.style.background = color + (s.temp > warm ? '33' : '24');
	ui.setText(r.temp, s.temp.toFixed(1) + ' °C' + (s.temp >= (s.crit || 90) ? ' ⚠️' : ''));
	r.trips.style.display = s.pass || s.crit ? 'flex' : 'none';
	r.pass.style.display = s.pass ? '' : 'none';
	r.crit.style.display = s.crit ? '' : 'none';
	if (s.pass) ui.setText(r.pass, _('PASS %d°').format(Math.round(s.pass)));
	if (s.crit) ui.setText(r.crit, _('CRIT %d°').format(Math.round(s.crit)));
}

function exportCsv(state) {
	var vw = VIEWS[state.view];
	var cols = state.keys.map(function(k) { return state.series[k]; });
	var len = Math.max.apply(null, cols.map(function(c) { return c.length; }).concat([0]));
	var lines = [['offset_s'].concat(state.keys.map(function(k) { return '"' + state.hist[k].label + '"'; })).join(',')];
	for (var r = 0; r < len; r++) {
		var row = [String(-(len - 1 - r) * vw.step)];
		cols.forEach(function(c) {
			var p = c[r - (len - c.length)];
			row.push(p && p.v !== null ? p.v.toFixed(1) : '');
		});
		lines.push(row.join(','));
	}
	ui.download('temps-' + state.view, 'csv', lines.join('\n'), 'text/csv');
}

return baseclass.extend({
	create: function(dash) {
		var toggle = E('button', { type: 'button', class: 'hw-graph-toggle', click: function() { dash.toggleView('therm_graph'); } });
		var panel = graph.panel({ views: VIEWS, defaultView: '10m', unit: ' °C', height: 170, autoRange: true, csv: exportCsv });
		var graphBox = E('div', { class: 'hw-therm-graph' }, [panel.el]);
		var cols = E('div', { class: 'hw-cols hw-sensor-cols' });
		var throttleList = E('div', { class: 'hw-stats-list' });
		var throttleBox = E('div', { class: 'hw-throttle', style: 'display:none' }, [ui.divider(), E('h4', { class: 'hw-subhead' }, _('Throttling')), throttleList]);
		var node = E('div', { class: 'hw-card wide' }, [ui.cardHead(_('Thermal Sensors'), [toggle]), graphBox, cols, throttleBox]);
		var hist = {}, rows = {}, throttleRows = {}, layout = null;

		node.style.display = 'none';

		// Shown only while something has throttled: x86 counts since boot, and
		// cooling devices holding a CPU or radio back right now. Devices of one
		// type (x86 has one per CPU) share a row showing the deepest step.
		function updateThrottle(th) {
			var list = [];
			if (th && (th.core > 0 || th.pkg > 0))
				list.push({ key: 'cpu', label: _('CPU'), val: _('%d core / %d package events since boot, %s in total')
					.format(th.core, th.pkg, th.ms < 1000 ? th.ms + ' ms' : ui.fmtDurationFull(th.ms / 1000)) });
			var byType = {};
			((th && th.cooling) || []).forEach(function(c) {
				var g = byType[c.type] || (byType[c.type] = { n: 0, cur: 0, max: c.max });
				g.n++;
				g.cur = Math.max(g.cur, c.cur);
			});
			Object.keys(byType).forEach(function(type) {
				var g = byType[type];
				list.push({ key: type, label: g.n > 1 ? type + ' ×' + g.n : type, val: _('Held at cooling step %d of %d').format(g.cur, g.max) });
			});
			throttleBox.style.display = list.length ? '' : 'none';
			ui.syncRows(throttleList, throttleRows, list, function(r) { return r.key; }, function() {
				var label = E('span', { class: 'hw-stat-label' }), val = E('span', { class: 'hw-stat-value', style: 'color:#ffb300' });
				return { el: E('div', { class: 'hw-stat-row hw-row-sm hw-row-wrap' }, [label, val]), label: label, val: val };
			}, function(e, r) {
				ui.setText(e.label, r.label);
				ui.setText(e.val, r.val);
			});
		}

		return {
			cards: { thermal: node },
			views: { therm_graph: { node: graphBox, button: toggle } },
			update: function(info) {
				var sensors = [], seen = {}, skip = placeholders(info.thermals || []);
				(info.thermals || []).slice().sort(function(a, b) { return a.type.localeCompare(b.type); }).forEach(function(t) {
					var name = t.type.replace(/_/g, '-').toUpperCase();
					if (seen[name] || skip[t.type])
						return;
					seen[name] = true;
					var temp = t.temp > 1000 ? t.temp / 1000 : t.temp;
					var crit = degrees(t.crit), pass = degrees(t.pass);
					// Trips outside a plausible range are placeholders.
					if (crit !== null && (crit < 40 || crit > 150)) crit = null;
					if (pass !== null && (pass <= 0 || pass > 150 || (crit !== null && pass >= crit))) pass = null;
					var h = hist[name];
					if (!h) h = hist[name] = { label: name, color: COLORS[Object.keys(hist).length % COLORS.length], data: [], agg: [], acc: { sum: 0, n: 0 } };
					h.data.push(temp);
					if (h.data.length > RAW_KEEP) h.data.shift();
					h.acc.sum += temp;
					if (++h.acc.n >= 10) {
						h.agg.push({ a: h.acc.sum / h.acc.n, n: h.acc.n, loss: 0 });
						if (h.agg.length > BUCKETS_KEEP) h.agg.shift();
						h.acc = { sum: 0, n: 0 };
					}
					sensors.push({ name: name, temp: temp, crit: crit, pass: pass, color: h.color });
				});

				node.style.display = sensors.length ? 'flex' : 'none';
				if (!sensors.length)
					return;

				// Up to three columns, filled across.
				var sig = sensors.map(function(s) { return s.name; }).join('|');
				if (sig !== layout) {
					layout = sig;
					cols.textContent = '';
					rows = {};
					var n = Math.min(3, sensors.length), lists = [];
					for (var i = 0; i < n; i++)
						lists.push(cols.appendChild(E('div', { class: 'hw-col' }, [E('div', { class: 'hw-stats-list hw-sensor-list' })])).firstChild);
					sensors.forEach(function(s, i) { lists[i % n].appendChild((rows[s.name] = sensorRow()).el); });
				}
				sensors.forEach(function(s) { patchRow(rows[s.name], s); });
				updateThrottle(info.throttle);

				var plotted = {};
				sensors.forEach(function(s) { if (hist[s.name].data.length >= 2) plotted[s.name] = hist[s.name]; });
				toggle.style.visibility = Object.keys(plotted).length ? '' : 'hidden';
				if (Object.keys(plotted).length)
					panel.update(plotted);
			}
		};
	}
});
