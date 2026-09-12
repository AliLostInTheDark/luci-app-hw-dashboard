'use strict';
'require baseclass';
'require rpc';
'require hwdash.ui as ui';
'require hwdash.graph as graph';

var callPing = rpc.declare({
	object: 'luci.hwdash.ping',
	method: 'ping',
	params: ['targets'],
	expect: {}
});

var COLORS = ['#00bcd4', '#ffb300', '#e91e63', '#8bc34a', '#b388ff', '#ff7043', '#4dd0e1', '#f06292', '#ffd54f'];
var RAW_KEEP = 120, BUCKETS_KEEP = 1080, ALL_KEEP = 10800;

// One sample every 2 s: the dispatcher runs ping on every other 1 s tick.
var TICK_SECS = 2;
var VIEWS = graph.spanViews([
	{ raw: true, pts: 120, perPoint: 1 },
	{ group: 1, pts: 30, perPoint: 10 },
	{ group: 1, pts: 60, perPoint: 10 },
	{ group: 1, pts: 90, perPoint: 10 },
	{ group: 3, pts: 120, perPoint: 30 },
	{ group: 9, pts: 120, perPoint: 90 }
], TICK_SECS);

var DEFAULT_TARGETS = [
	{ host: 'dns.google', fam: 4 }, { host: 'dns.google', fam: 6 },
	{ host: 'google.com', fam: 4 }, { host: 'google.com', fam: 6 },
	{ host: 'one.one.one.one', fam: 4 }, { host: 'one.one.one.one', fam: 6 },
	{ host: 'youtube.com', fam: 4 }, { host: 'youtube.com', fam: 6 }
];

function expandFams(t) {
	return String(t.fam) === 'both' ? [4, 6] : [parseInt(t.fam, 10) === 6 ? 6 : 4];
}

// A family switch sits above the per-target choices and is kept apart from
// them, so turning a family back on restores exactly what was on before.
function famOff(dash, fam) {
	fam = parseInt(fam, 10);
	return (dash.disabledFams || []).some(function(f) { return parseInt(f, 10) === fam; });
}

function targetOff(dash, host, fam) {
	return famOff(dash, fam) || dash.disabledPings.indexOf(host + '|' + fam) !== -1;
}

function gatewayOff(dash, fam) {
	return targetOff(dash, '__gateway', fam);
}

// A custom target's name exists only in settings; the RPC never sees it.
function customName(dash, host) {
	for (var i = 0; i < dash.pingTargets.length; i++)
		if (dash.pingTargets[i].host === host)
			return dash.pingTargets[i].name || '';
	return '';
}

// "host fam" pairs for the RPC, enabled ones only.
function pairs(dash) {
	var seen = {}, out = [];
	DEFAULT_TARGETS.concat(dash.pingTargets).forEach(function(t) {
		expandFams(t).forEach(function(fam) {
			var key = t.host + '|' + fam;
			if (seen[key] || targetOff(dash, t.host, fam))
				return;
			seen[key] = true;
			out.push({ host: t.host, fam: fam });
		});
	});
	out.sort(function(a, b) { return a.host.localeCompare(b.host, undefined, { sensitivity: 'base' }) || a.fam - b.fam; });
	return out.map(function(t) { return t.host + ' ' + t.fam; });
}

// Gateways first (v4, then v6), then targets by host and family.
function order(hist) {
	return Object.keys(hist).sort(function(ka, kb) {
		var a = hist[ka], b = hist[kb];
		if (!!a.gw !== !!b.gw) return a.gw ? -1 : 1;
		if (a.gw) return (a.fam || 4) - (b.fam || 4);
		return (a.host || '').localeCompare(b.host || '', undefined, { sensitivity: 'base' }) || (a.fam || 4) - (b.fam || 4);
	});
}

function latencyColor(ms) {
	if (ms === null || ms === undefined) return '';
	return ms <= 5 ? '#00e676' : ms <= 15 ? '#69f0ae' : ms <= 30 ? '#b2ff59' : ms <= 50 ? '#ffee58' : ms <= 100 ? '#ffb300' : ms <= 200 ? '#ff7043' : '#ff1744';
}

function newSeries(props, color) {
	var s = { color: color, hidden: false, data: [], allData: [], pdata: [], agg: [], acc: { sum: 0, n: 0, loss: 0, cnt: 0, ps: 0, pr: 0 } };
	for (var k in props) s[k] = props[k];
	return s;
}

function push(list, v, keep) {
	list.push(v);
	if (list.length > keep) list.shift();
}

// Every sample of every target, then per-target and overall packet totals.
// Loss uses the ICMP packet counts, exactly as the table does.
function exportCsv(state) {
	var hist = state.hist, keys = state.keys;
	var cols = keys.map(function(k) { return hist[k].allData; });
	var len = Math.max.apply(null, cols.map(function(c) { return c.length; }).concat([0]));
	var lines = [['sample_idx'].concat(keys.map(function(k) { return '"' + hist[k].label + '"'; })).join(',')];
	for (var r = 0; r < len; r++) {
		var row = [String(r + 1)];
		cols.forEach(function(c) {
			var v = c[r - (len - c.length)];
			row.push(v !== null && v !== undefined ? v.toFixed(1) : (v === null ? 'Timeout' : ''));
		});
		lines.push(row.join(','));
	}
	lines.push('', '---', 'Ping Statistics Summary', 'Target,Sent,Received,Timeouts,% Loss,Min,Max,Avg');
	var total = { sent: 0, recv: 0, lost: 0, sum: 0, min: null, max: null };
	keys.forEach(function(k) {
		var t = hist[k], ok = 0, sum = 0, min = null, max = null;
		t.allData.forEach(function(v) {
			if (v === null || v === undefined) return;
			ok++;
			sum += v;
			if (min === null || v < min) min = v;
			if (max === null || v > max) max = v;
		});
		var sent = t.totSent || t.allData.length, recv = t.totSent ? t.totRecv || 0 : ok, lost = Math.max(0, sent - recv);
		lines.push(['"' + t.label + '"', sent, recv, lost, (sent > 0 ? (lost / sent * 100).toFixed(1) : '0.0') + '%',
			min !== null ? min.toFixed(1) : '', max !== null ? max.toFixed(1) : '', ok > 0 ? (sum / ok).toFixed(1) : ''].join(','));
		total.sent += sent; total.recv += recv; total.lost += lost; total.sum += sum;
		if (min !== null && (total.min === null || min < total.min)) total.min = min;
		if (max !== null && (total.max === null || max > total.max)) total.max = max;
	});
	lines.push('', 'Overall (All Targets Combined)', 'Total Sent,Total Received,Total Timeouts,Overall % Loss,Overall Min,Overall Max,Overall Avg');
	lines.push([total.sent, total.recv, total.lost, (total.sent > 0 ? (total.lost / total.sent * 100).toFixed(1) : '0.0') + '%',
		total.min !== null ? total.min.toFixed(1) : '', total.max !== null ? total.max.toFixed(1) : '',
		total.recv > 0 ? (total.sum / total.recv).toFixed(1) : ''].join(','));
	ui.download('ping-all', 'csv', lines.join('\n'), 'text/csv');
}

function tableHead() {
	var th = function(label, tip, cls) { return E('th', { class: cls || null, title: tip || null }, [label]); };
	return E('tr', {}, [
		th(_('Family'), _('Internet Protocol version used for this probe'), 'hw-ping-left hw-ping-narrow'),
		th(_('Target'), null, 'hw-ping-left hw-ping-sep'),
		th(_('IP Address'), null, 'hw-ping-left hw-ping-sep'),
		th(_('Current (ms)'), _('Most recent round-trip delay (RFC 2681)')),
		th(_('Minimum (ms)'), _('Lowest round-trip delay observed in the selected range')),
		th(_('Mean (ms)'), _('Arithmetic mean round-trip delay over the selected range')),
		th(_('95th %ile (ms)'), _('95th percentile round-trip delay, nearest-rank (RFC 2330). Requires at least 20 samples.')),
		th(_('Maximum (ms)'), _('Highest round-trip delay observed in the selected range')),
		th(_('Jitter (ms)'), _('Mean absolute difference between consecutive round-trip samples (cf. RFC 3393)')),
		th(_('Packet Loss'), _('Proportion of ICMP echo requests transmitted for which no reply was received (RFC 7680)'))
	]);
}

var STATS = ['cur', 'min', 'avg', 'p95', 'max', 'jit', 'loss'];

function tableRow(t) {
	var c = { fam: E('td', { class: 'hw-ping-left', style: 'color:' + t.color }), target: E('td', { class: 'hw-ping-left hw-ping-sep', style: 'color:' + t.color }),
		ip: E('td', { class: 'hw-ping-left hw-ping-sep hw-ping-ip', style: 'color:' + t.color }) };
	STATS.forEach(function(k) { c[k] = E('td'); });
	c.el = E('tr', {}, [c.fam, c.target, c.ip].concat(STATS.map(function(k) { return c[k]; })));
	return c;
}

function cellText(td, text, color, tip) {
	ui.setText(td, text);
	td.style.color = color || '';
	td.title = tip || '';
}

return baseclass.extend({
	DEFAULT_TARGETS: DEFAULT_TARGETS,
	expandFams: expandFams,
	famOff: famOff,

	create: function(dash) {
		var toggle = E('button', { type: 'button', class: 'hw-graph-toggle', click: function() { dash.toggleView('ping_graph'); } });
		var panel = graph.panel({
			views: VIEWS,
			defaultView: Object.keys(VIEWS)[0],
			unit: ' ms',
			height: 250,
			spikeNulls: true,
			lossTicks: true,
			yFloor: 20,
			legend: true,
			sort: order,
			csv: exportCsv,
			legendValue: function(t) {
				var last = t.data.length ? t.data[t.data.length - 1] : null;
				var dead = t.data.length >= 3 && t.data.every(function(v) { return v === null; });
				return {
					text: dead ? 'N/A' : last === null ? _('timeout') : last.toFixed(1) + ' ms',
					color: dead ? '#9e9e9e' : last === null ? '#ff5252' : t.color,
					dotColor: dead ? '#9e9e9e' : t.color,
					dim: dead
				};
			}
		});
		var graphBox = E('div', { class: 'hw-ping-graph' }, [panel.el]);
		var tbody = E('tbody');
		var node = E('div', { class: 'hw-card wide' }, [
			ui.cardHead(_('Ping Latency'), [toggle]),
			graphBox,
			E('div', { class: 'hw-ping-table' }, [E('table', {}, [E('thead', {}, [tableHead()]), tbody])]),
			E('div', { class: 'hw-card-note' }, [_('Additional probe targets may be configured under Settings, or in /etc/hwdash-ping.targets on the router.')])
		]);
		var rows = {};

		node.style.display = 'none';

		function record(res) {
			var hist = dash.pingHist;
			res.targets.forEach(function(t) {
				var key = t.host + '/v' + t.fam;
				var gw = res.gateway && t.host === res.gateway ? 4 : res.gateway6 && t.host === res.gateway6 ? 6 : 0;
				if (gw && gatewayOff(dash, gw)) {
					delete hist[key];
					return;
				}
				if (!hist[key])
					hist[key] = newSeries({ gw: gw, host: t.host, fam: t.fam }, COLORS[Object.keys(hist).length % COLORS.length]);
				var h = hist[key];
				// Renamed targets update without a reload.
				h.label = gw ? _('Gateway v%d').format(gw) : _('%s (v%d)').format(customName(dash, t.host) || t.host, t.fam);
				if (t.ip) h.ip = t.ip;
				if (t.rdns) h.rdns = t.rdns;
				// A name that would not resolve put no packet on the wire, so it
				// is reported as such rather than as a timeout.
				h.unresolved = !!t.unresolved;
				var v = typeof t.ms === 'number' ? t.ms : null;
				var sent = typeof t.sent === 'number' ? t.sent : 0, recv = typeof t.recv === 'number' ? t.recv : 0;
				h.totSent = (h.totSent || 0) + sent;
				h.totRecv = (h.totRecv || 0) + recv;
				push(h.data, v, RAW_KEEP);
				push(h.allData, v, ALL_KEEP);
				push(h.pdata, { s: sent, r: recv }, RAW_KEEP);
				h.acc.cnt++;
				h.acc.ps += sent;
				h.acc.pr += recv;
				if (v === null) h.acc.loss++;
				else { h.acc.sum += v; h.acc.n++; }
				if (h.acc.cnt >= 10) {
					push(h.agg, { a: h.acc.n > 0 ? h.acc.sum / h.acc.n : null, n: h.acc.n, loss: h.acc.loss, ps: h.acc.ps, pr: h.acc.pr }, BUCKETS_KEEP);
					h.acc = { sum: 0, n: 0, loss: 0, cnt: 0, ps: 0, pr: 0 };
				}
			});
			// No IPv6 gateway still gets a row, saying so.
			if (!res.gateway6 && !gatewayOff(dash, 6)) {
				if (!hist.__gw6na)
					hist.__gw6na = newSeries({ label: _('Gateway v6'), gw: 6, na: true, host: '', fam: 6 }, '#9e9e9e');
				push(hist.__gw6na.data, null, RAW_KEEP);
				push(hist.__gw6na.allData, null, ALL_KEEP);
			}
			else {
				delete hist.__gw6na;
			}
		}

		// Statistics come from the raw samples spanning the selected range,
		// never the plotted points: above the raw view each point is a mean,
		// and averaging destroys exactly the tail that max and p95 exist to show.
		function renderTable(hist) {
			var view = panel.view(), series = panel.series() || {};
			var span = Math.round(view.pts * view.step / TICK_SECS);
			ui.syncRows(tbody, rows, order(hist), function(k) { return k; }, function(k) { return tableRow(hist[k]); }, function(c, k) {
				var t = hist[k];
				c.el.style.opacity = t.hidden ? '0.35' : '';
				ui.setText(c.fam, 'IPv' + (t.fam || 4));
				if (t.na) {
					cellText(c.target, _('Gateway'));
					cellText(c.ip, 'N/A');
					STATS.forEach(function(s) { cellText(c[s], '—'); });
					return;
				}
				var literal = /^[0-9.]+$/.test(t.host) || t.host.indexOf(':') !== -1;
				// A custom name outranks reverse DNS: it was asked for.
				var name = t.gw ? _('Gateway') + (t.rdns ? ' (' + t.rdns + ')' : '') : (customName(dash, t.host) || (literal ? t.rdns || '—' : t.host));
				var ip = literal ? t.host : t.ip || '—';
				cellText(c.target, name, null, name);
				cellText(c.ip, ip, null, ip);
				if (t.unresolved) {
					cellText(c.cur, 'DNS', '#ff9800', _('The host name could not be resolved; no ICMP packet was transmitted.'));
					STATS.slice(1).forEach(function(s) { cellText(c[s], '—'); });
					return;
				}

				var tail = t.allData.slice(-span), vals = tail.filter(function(v) { return v !== null; }).sort(function(a, b) { return a - b; });
				var sum = vals.reduce(function(a, b) { return a + b; }, 0);
				// Jitter pairs adjacent samples only (cf. RFC 3393); a timeout
				// breaks the chain rather than bridging an outage.
				var jit = 0, pairsN = 0, prev = null;
				tail.forEach(function(v) {
					if (v === null) { prev = null; return; }
					if (prev !== null) { jit += Math.abs(v - prev); pairsN++; }
					prev = v;
				});
				// Loss from the plotted buckets' packet counters, which sum
				// losslessly; the poll-level count only when there are none.
				var lostPolls = 0, polls = 0, lostPkts = 0, sentPkts = 0;
				(series[k] || []).forEach(function(p) { lostPolls += p.lostN; polls += p.cnt; sentPkts += p.psent || 0; lostPkts += p.plost || 0; });
				var loss = sentPkts > 0 ? Math.round(lostPkts / sentPkts * 1000) / 10 : polls > 0 ? Math.round(lostPolls / polls * 1000) / 10 : 0;
				var last = t.data.length ? t.data[t.data.length - 1] : null;
				var fmt = function(v) { return v === null || v === undefined ? '—' : v.toFixed(1); };
				var avg = vals.length ? sum / vals.length : null, p95 = graph.percentile(vals, 0.95), j = pairsN ? jit / pairsN : null;
				cellText(c.cur, last === null ? 'TO' : fmt(last), last === null ? '#ff5252' : latencyColor(last));
				cellText(c.min, fmt(vals[0]), latencyColor(vals[0]));
				cellText(c.avg, fmt(avg), latencyColor(avg));
				cellText(c.p95, fmt(p95), latencyColor(p95));
				cellText(c.max, fmt(vals[vals.length - 1]), latencyColor(vals[vals.length - 1]));
				cellText(c.jit, fmt(j), latencyColor(j));
				cellText(c.loss, loss + '%', loss > 0 ? '#ff5252' : '');
			});
		}

		return {
			cards: { ping: node },
			views: { ping_graph: { node: graphBox, button: toggle } },
			// Offset from the info poll so two shell calls never fork together.
			tick: ui.single(function() {
				return ui.delay(400).then(function() { return callPing(pairs(dash)); }).then(function(res) {
					if (!res || !res.targets || !res.targets.length)
						return;
					record(res);
					panel.update(dash.pingHist);
					renderTable(dash.pingHist);
					node.style.display = 'flex';
				});
			})
		};
	}
});
