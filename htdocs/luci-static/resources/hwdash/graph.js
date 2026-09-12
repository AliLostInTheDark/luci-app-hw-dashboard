'use strict';
'require baseclass';
'require hwdash.ui as ui';

// The line graph shared by Ping Latency and Thermal Sensors. Every series keeps
// its raw samples plus 10-sample buckets, and the selected view reads one of
// the two.

var MIN_RANK_SAMPLES = 20;

// Nearest-rank percentile (RFC 2330 §11): index ceil(n*p)-1. With too few
// samples to rank there is no answer, rather than one that is really the max.
function percentile(sorted, p) {
	if (sorted.length < MIN_RANK_SAMPLES)
		return null;
	return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
}

// Views over a series sampled every `tickSecs`, keyed "10m", "2h" and so on.
// Spans come from the cadence, so a button can never claim a range it lacks.
function spanViews(defs, tickSecs) {
	var out = {};
	defs.forEach(function(d) {
		var step = d.perPoint * tickSecs, secs = d.pts * step;
		var mins = Math.round(secs / 60), hours = Math.round(secs / 360) / 10;
		var v = { pts: d.pts, step: step, label: '−' + (mins < 60 ? mins + ' min' : hours + ' h') };
		if (d.raw) v.raw = true;
		else v.group = d.group;
		out[mins < 60 ? mins + 'm' : hours + 'h'] = v;
	});
	return out;
}

// The points of series `t` for view `vw`. Loss rides along twice: lostN/cnt
// count polls that got no answer, psent/plost count real ICMP packets.
function buildSeries(t, vw) {
	var pd = t.pdata || [];
	if (vw.raw) {
		var off = Math.max(0, t.data.length - vw.pts);
		return t.data.slice(-vw.pts).map(function(v, i) {
			var p = pd[off + i] || { s: 0, r: 0 };
			return { v: v, loss: v === null, lostN: v === null ? 1 : 0, cnt: 1, psent: p.s, plost: p.s - p.r };
		});
	}
	var per = vw.group, src = t.agg.slice(-(vw.pts * per)), out = [];
	for (var i = 0; i < src.length; i += per) {
		var sum = 0, n = 0, loss = 0, sent = 0, recv = 0;
		for (var k = i; k < Math.min(i + per, src.length); k++) {
			var b = src[k];
			if (b.a !== null) { sum += b.a * b.n; n += b.n; }
			loss += b.loss;
			sent += b.ps || 0;
			recv += b.pr || 0;
		}
		var cnt = n + loss;
		out.push({ v: n > 0 ? sum / n : null, loss: loss > 0 && loss / cnt >= 0.02, lostN: loss, cnt: cnt, psent: sent, plost: sent - recv });
	}
	return out;
}

// opts: views, defaultView, unit, height, autoRange, yFloor, spikeNulls
// (timeouts drawn red), lossTicks, legend + legendValue(series), sort(hist),
// csv(state) to offer a download.
function panel(opts) {
	var VIEWS = opts.views;
	var GW = 600, GH = opts.height || 190, GTOP = 6, GBOT = opts.lossTicks ? 8 : 4;
	var plotH = GH - GTOP - GBOT;
	var GRID = [0.25, 0.5, 0.75];
	var state = { view: opts.defaultView, hist: null, series: null, keys: [], views: VIEWS };
	var hoverFrac = null;

	var buttons = {};
	var controls = E('div', { class: 'hw-graph-ctl' });
	Object.keys(VIEWS).forEach(function(key) {
		buttons[key] = E('button', { type: 'button', class: 'hw-graph-btn', click: function() {
			state.view = key;
			markView();
			if (state.hist) update(state.hist);
		} }, key);
		controls.appendChild(buttons[key]);
	});
	if (opts.csv) {
		controls.appendChild(E('button', { type: 'button', class: 'hw-graph-btn hw-graph-csv', click: function() {
			if (state.series) opts.csv(state);
		} }, '⤓ CSV'));
	}

	var svgBox = E('div', { class: 'hw-graph-clip' });
	var plot = E('div', { class: 'hw-graph-plot' }, [svgBox]);
	var gridLabels = GRID.map(function(g) {
		return plot.appendChild(E('span', { class: 'hw-graph-ylabel', style: 'top:' + ((GTOP + plotH * (1 - g)) / GH * 100).toFixed(1) + '%' }));
	});
	var topLabel = plot.appendChild(E('span', { class: 'hw-graph-top' }));
	var cursor = plot.appendChild(E('div', { class: 'hw-graph-cursor', style: 'display:none' }));
	var tip = plot.appendChild(E('div', { class: 'hw-graph-tip', style: 'display:none' }));
	var axisLabel = E('span');
	var el = E('div', { class: 'hw-graph' }, [controls, plot, E('div', { class: 'hw-graph-axis' }, [axisLabel, E('span', {}, _('now'))])]);
	var legend = opts.legend ? el.appendChild(E('div', { class: 'hw-graph-legend' })) : null;
	var legendRows = {}, legendSig = null;

	function markView() {
		for (var key in buttons)
			buttons[key].classList.toggle('is-active', key === state.view);
		axisLabel.textContent = VIEWS[state.view].label;
	}

	function showHover(frac) {
		var rect = plot.getBoundingClientRect();
		if (!state.series || !rect.width)
			return;
		var vw = VIEWS[state.view];
		var idx = Math.round(frac * (vw.pts - 1));
		var px = idx / (vw.pts - 1) * rect.width;
		tip.textContent = '';
		tip.appendChild(E('div', { class: 'hw-graph-tip-time' }, ['−' + (vw.pts - 1 - idx) * vw.step + ' s']));
		state.keys.forEach(function(k) {
			var t = state.hist[k], sr = state.series[k];
			if (t.hidden)
				return;
			var i = idx - (vw.pts - sr.length);
			var p = i >= 0 && i < sr.length ? sr[i] : null;
			var lost = !!(p && p.v === null && opts.spikeNulls);
			var val = p && p.v !== null ? p.v.toFixed(1) + opts.unit : (lost && !t.na ? _('timeout') : '—');
			tip.appendChild(E('div', { class: 'hw-graph-tip-row' }, [
				E('span', { class: 'hw-dot hw-dot-sm', style: 'background:' + t.color }),
				E('span', { class: 'hw-graph-tip-name' }, [t.label]),
				E('span', { class: 'hw-graph-tip-val', style: 'color:' + (lost ? '#ff5252' : t.color) }, [val])
			]));
		});
		cursor.style.left = px + 'px';
		cursor.style.display = 'block';
		tip.style.display = 'block';
		tip.style.left = (px < rect.width / 2 ? px + 12 : px - tip.offsetWidth - 12) + 'px';
	}

	plot.addEventListener('mousemove', function(ev) {
		var rect = plot.getBoundingClientRect();
		hoverFrac = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
		showHover(hoverFrac);
	});
	plot.addEventListener('mouseleave', function() {
		hoverFrac = null;
		cursor.style.display = 'none';
		tip.style.display = 'none';
	});

	function syncLegend() {
		var sig = state.keys.join('|');
		if (legendSig !== sig) {
			legendSig = sig;
			legend.textContent = '';
			legendRows = {};
			state.keys.forEach(function(k) {
				var row = { dot: E('span', { class: 'hw-dot' }), name: E('span', { class: 'hw-legend-name' }), val: E('span', { class: 'hw-legend-val' }) };
				row.el = E('span', { class: 'hw-legend-item', title: _('Select to show or hide this series'), click: function() {
					var t = state.hist[k];
					if (!t) return;
					t.hidden = !t.hidden;
					update(state.hist);
				} }, [row.dot, row.name, row.val]);
				legend.appendChild(row.el);
				legendRows[k] = row;
			});
		}
		state.keys.forEach(function(k) {
			var t = state.hist[k], row = legendRows[k], lv = opts.legendValue(t);
			ui.setText(row.name, t.label);
			row.el.style.opacity = t.hidden ? '0.35' : lv.dim ? '0.55' : '1';
			row.name.style.textDecoration = t.hidden ? 'line-through' : 'none';
			row.dot.style.background = lv.dotColor || t.color;
			ui.setText(row.val, lv.text);
			row.val.style.color = lv.color;
		});
	}

	function update(hist) {
		state.hist = hist;
		state.keys = opts.sort ? opts.sort(hist) : Object.keys(hist);
		var vw = VIEWS[state.view];
		var series = {};
		state.keys.forEach(function(k) { series[k] = buildSeries(hist[k], vw); });
		state.series = series;

		var step = GW / (vw.pts - 1);
		var all = [];
		state.keys.forEach(function(k) {
			if (!hist[k].hidden)
				series[k].forEach(function(p) { if (p.v !== null) all.push(p.v); });
		});
		var ylo = 0, yhi = opts.yFloor || 20;
		if (all.length) {
			all.sort(function(a, b) { return a - b; });
			if (opts.autoRange) {
				ylo = Math.floor((all[0] - 3) / 5) * 5;
				yhi = Math.ceil((all[all.length - 1] + 3) / 5) * 5;
				if (yhi - ylo < 10) yhi = ylo + 10;
			}
			else {
				yhi = Math.ceil(Math.max(opts.yFloor || 20, all[all.length - 1]) / 10) * 10;
			}
		}
		var yFor = function(v) { return GTOP + plotH * (1 - (Math.min(v, yhi) - ylo) / (yhi - ylo)); };
		// Samples far above the usual level get a marker; the two highest
		// also get a labelled guide line.
		var spikeAt = opts.spikeNulls && all.length >= 5 ? Math.max(percentile(all, 0.9) * 2, 50) : null;

		var svg = '';
		GRID.forEach(function(g) {
			var gy = (GTOP + plotH * (1 - g)).toFixed(1);
			svg += '<line x1="0" y1="' + gy + '" x2="' + GW + '" y2="' + gy + '" stroke="rgba(128,128,128,0.18)" stroke-width="1" stroke-dasharray="3,4" vector-effect="non-scaling-stroke"/>';
		});
		var lossXs = {}, spikes = {};
		state.keys.forEach(function(k) {
			var t = hist[k];
			if (t.hidden)
				return;
			var sr = series[k], n = sr.length, i;
			var xAt = function(i) { return GW - (n - 1 - i) * step; };
			var ys = new Array(n), lost = new Array(n), anyOk = false;
			for (i = 0; i < n; i++) {
				if (opts.lossTicks && sr[i].loss) lossXs[xAt(i).toFixed(1)] = 1;
				if (sr[i].v === null) {
					ys[i] = null;
					lost[i] = !!opts.spikeNulls;
					continue;
				}
				ys[i] = yFor(sr[i].v);
				lost[i] = false;
				anyOk = true;
				if (spikeAt && sr[i].v > spikeAt) {
					var r = Math.round(sr[i].v);
					if (!spikes[r] || sr[i].v > spikes[r].v) spikes[r] = { v: sr[i].v, y: ys[i] };
				}
			}
			// A target that never answered in this window still draws: a
			// dashed line on the floor reads "measured, and dead", not "no data".
			if (!anyOk) {
				if (opts.spikeNulls && n > 1) {
					var deadY = yFor(ylo).toFixed(1);
					svg += '<polyline fill="none" stroke="#ff5252" stroke-width="1.5" stroke-dasharray="4,3" stroke-opacity="0.75" points="' +
						xAt(0).toFixed(1) + ',' + deadY + ' ' + xAt(n - 1).toFixed(1) + ',' + deadY + '"/>';
					svg += '<circle cx="' + xAt(n - 1).toFixed(1) + '" cy="' + deadY + '" r="2.5" fill="#ff5252"/>';
				}
				return;
			}
			// Bridge gaps so the line stays continuous.
			for (i = 0; i < n; i++) {
				if (ys[i] !== null) continue;
				var a = i - 1; while (a >= 0 && ys[a] === null) a--;
				var b = i + 1; while (b < n && ys[b] === null) b++;
				ys[i] = a >= 0 && b < n ? ys[a] + (ys[b] - ys[a]) * (i - a) / (b - a) : (a >= 0 ? ys[a] : ys[b]);
			}
			var pts = [];
			for (i = 0; i < n; i++) pts.push(xAt(i).toFixed(1) + ',' + ys[i].toFixed(1));
			svg += '<polyline fill="none" stroke="' + t.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" points="' + pts.join(' ') + '"/>';
			// Runs of timeouts are overdrawn as red dots.
			var run = null;
			for (i = 0; i <= n; i++) {
				if (i < n && lost[i]) {
					if (run) run.e = i;
					else run = { s: i, e: i };
				}
				else if (run) {
					var seg = [];
					for (var j = Math.max(0, run.s - 1); j <= Math.min(n - 1, run.e + 1); j++)
						seg.push(xAt(j).toFixed(1) + ',' + ys[j].toFixed(1));
					svg += '<polyline fill="none" stroke="#ff5252" stroke-width="2.5" stroke-dasharray="1,4" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity="0.9" points="' + seg.join(' ') + '"/>';
					run = null;
				}
			}
			for (i = 0; i < n; i++) {
				if (lost[i]) {
					if (i !== n - 1)
						svg += '<circle cx="' + xAt(i).toFixed(1) + '" cy="' + ys[i].toFixed(1) + '" r="3" fill="var(--background-color-high, #1b1e23)" stroke="#ff5252" stroke-width="1.6"/>';
				}
				else if (spikeAt && sr[i].v > spikeAt) {
					var sx = xAt(i), sy = ys[i];
					svg += '<polygon points="' + (sx - 4).toFixed(1) + ',' + sy.toFixed(1) + ' ' + (sx + 4).toFixed(1) + ',' + sy.toFixed(1) + ' ' + sx.toFixed(1) + ',' + (sy - 7).toFixed(1) + '" fill="' + t.color + '" opacity="0.85"/>';
				}
			}
			svg += '<circle cx="' + xAt(n - 1).toFixed(1) + '" cy="' + ys[n - 1].toFixed(1) + '" r="3" fill="' + (lost[n - 1] ? '#ff5252' : t.color) + '"/>';
		});
		if (opts.spikeNulls) {
			Object.keys(spikes).sort(function(a, b) { return spikes[b].v - spikes[a].v; }).slice(0, 2).forEach(function(k) {
				var s = spikes[k], y = s.y.toFixed(1);
				svg += '<line x1="0" y1="' + y + '" x2="' + GW + '" y2="' + y + '" stroke="rgba(255,23,68,0.25)" stroke-width="1" stroke-dasharray="4,3" vector-effect="non-scaling-stroke"/>';
				svg += '<text x="' + (GW - 2) + '" y="' + (s.y - 3).toFixed(1) + '" text-anchor="end" fill="rgba(255,23,68,0.6)" font-size="9" font-family="system-ui,sans-serif">' + Math.round(s.v) + opts.unit + '</text>';
			});
		}
		Object.keys(lossXs).forEach(function(x) {
			svg += '<line x1="' + x + '" y1="' + (GH - 6) + '" x2="' + x + '" y2="' + GH + '" stroke="#ff1744" stroke-width="1.5" vector-effect="non-scaling-stroke"/>';
		});
		svgBox.innerHTML = '<svg width="100%" height="' + GH + '" viewBox="0 0 ' + GW + ' ' + GH + '" preserveAspectRatio="none">' + svg + '</svg>';
		GRID.forEach(function(g, i) { gridLabels[i].textContent = Math.round(ylo + (yhi - ylo) * g) + opts.unit; });
		topLabel.textContent = yhi + opts.unit;
		if (legend)
			syncLegend();
		if (hoverFrac !== null)
			requestAnimationFrame(function() { if (hoverFrac !== null) showHover(hoverFrac); });
	}

	markView();

	return {
		el: el,
		update: update,
		series: function() { return state.series; },
		view: function() { return VIEWS[state.view]; }
	};
}

return baseclass.extend({
	percentile: percentile,
	spanViews: spanViews,
	panel: panel
});
