'use strict';
'require baseclass';
'require hwdash.ui as ui';

// What each radio's PHY can do and what it is doing: modes, streams, width,
// channel, regulatory limits, and live airtime and noise from the survey.

var UNII_5GHZ = [
	['U-NII-1', 36, 48, false],
	['U-NII-2A', 52, 68, true],
	['U-NII-2C', 96, 144, true],
	['U-NII-3', 149, 165, false],
	['U-NII-4', 169, 181, false]
];
var UNII_6GHZ = [
	['U-NII-5', 1, 93, false],
	['U-NII-6', 97, 113, false],
	['U-NII-7', 117, 185, false],
	['U-NII-8', 189, 233, false]
];
var BANDS = ['2.4 GHz', '5 GHz', '6 GHz'];

function chanFreq(band, ch) {
	if (band.indexOf('2.4') !== -1) return ch === 14 ? 2484 : 2412 + (ch - 1) * 5;
	if (band.indexOf('6') !== -1) return 5950 + ch * 5;
	return 5000 + ch * 5;
}

// "U-NII-1 36-48 (5180-5240 MHz), U-NII-2A 52-64 (..., DFS)".
function groupChannels(band, channels) {
	var chs = channels.map(function(c) { return parseInt(c, 10); }).filter(function(c) { return !isNaN(c); })
		.sort(function(a, b) { return a - b; }).filter(function(c, i, all) { return i === 0 || c !== all[i - 1]; });
	if (!chs.length)
		return '';
	var span = function(lo, hi, dfs) {
		var fl = chanFreq(band, lo), fh = chanFreq(band, hi);
		return (lo === hi ? lo : lo + '-' + hi) + ' (' + (fl === fh ? fl : fl + '-' + fh) + ' MHz' + (dfs ? ', DFS' : '') + ')';
	};
	if (band.indexOf('2.4') !== -1)
		return span(chs[0], chs[chs.length - 1], false);
	var table = band.indexOf('6') !== -1 ? UNII_6GHZ : UNII_5GHZ, out = [];
	table.forEach(function(b) {
		var inBand = chs.filter(function(c) { return c >= b[1] && c <= b[2]; });
		if (inBand.length) out.push(b[0] + ' ' + span(inBand[0], inBand[inBand.length - 1], b[3]));
	});
	var other = chs.filter(function(c) { return !table.some(function(b) { return c >= b[1] && c <= b[2]; }); });
	if (other.length) out.push(other.join(', '));
	return out.join(', ');
}

// Top PHY rate per spatial stream at the widest channel, times the streams.
function maxRate(hwmode, width, streams) {
	if (!hwmode || !width || !streams)
		return null;
	var mode = hwmode.toLowerCase();
	var cw = typeof width === 'string' ? parseInt(width.replace(/[^0-9]/g, ''), 10) || 20 : width;
	var perStream = 54;
	if (mode.indexOf('be') !== -1) perStream = cw >= 320 ? 2882 : cw >= 160 ? 1441 : cw >= 80 ? 688 : cw >= 40 ? 344 : 137;
	else if (mode.indexOf('ax') !== -1) perStream = cw >= 160 ? 1201 : cw >= 80 ? 600 : cw >= 40 ? 287 : 143;
	else if (mode.indexOf('ac') !== -1) perStream = cw >= 160 ? 867 : cw >= 80 ? 433 : cw >= 40 ? 200 : 86;
	else if (mode.indexOf('n') !== -1) perStream = cw >= 40 ? 150 : 72;
	return perStream * (parseInt(streams, 10) || 1) + ' Mbps';
}

// Everything shown for one radio except the live survey figures.
function describe(w) {
	var cap = w.phycap && w.phycap.bands ? w.phycap.bands[w.band.replace(' GHz', 'GHz')] : null;
	var capStreams = w.phycap ? parseInt(w.phycap.max_spatial, 10) : 0;
	var streams = capStreams > 1 ? capStreams : (parseInt(w.hw_nss, 10) > 1 ? parseInt(w.hw_nss, 10) : 0);
	var width = w.phycap && parseInt(w.phycap.max_cw, 10) >= 20 ? w.phycap.max_cw : null;
	var widthNum = width ? parseInt(width.replace(/[^0-9]/g, ''), 10) || 0 : 0;
	var curWidth = parseInt(w.curr_width, 10) || 0;
	var chipMax = streams > 0 && width && w.hwmode ? maxRate(w.hwmode, width, streams) : null;
	var cfgMax = null;
	if (chipMax) {
		var cfgStreams = parseInt(w.cfg_nss, 10) || streams;
		if (cfgStreams !== streams || (curWidth || widthNum) !== widthNum) {
			var cfgWidth = curWidth ? curWidth + ' MHz' : width;
			cfgMax = _('%s (%dx%d MIMO @ %s)').format(maxRate(w.hwmode, cfgWidth, cfgStreams), cfgStreams, cfgStreams, cfgWidth);
		}
	}
	var mimo = w.wcd_mimo && w.wcd_mimo !== 'unknown' ? w.wcd_mimo : (streams > 0 ? streams + 'x' + streams : null);
	var theoretical = w.wcd_maxmbps && w.wcd_maxmbps !== 'unknown' ? w.wcd_maxmbps + ' Mbps' : chipMax;
	var channel = w.channel && !/^(unknown|0)$/i.test(w.channel) ? w.channel : null;
	var region = w.country === '00' ? '00 · World' : (w.country ? w.country + (w.dfs_region ? ' · ' + w.dfs_region : '') : '');
	var channels = w.channels ? w.channels.split(',') : (cap ? cap.enabled : []);

	var rows = [];
	if (mimo) rows.push([_('MIMO / Antennas'), mimo]);
	if (theoretical) rows.push([_('Theoretical Max'), theoretical]);
	if (w.hwmode && w.hwmode !== 'Unknown') rows.push([_('HW Mode(s)'), w.hwmode]);
	if (chipMax && chipMax !== theoretical) rows.push([_('Chip HW Max'), chipMax + ' (' + streams + 'x' + streams + ' @ ' + width + ')']);
	if (cfgMax) rows.push([_('Config Max'), cfgMax, 'hw-accent']);
	if (channel) rows.push([_('Current Channel'), channel]);

	var tail = [];
	if (width) tail.push([_('Max Channel Width'), width]);
	if (w.txpower && w.txpower !== 'Unknown') tail.push([_('Max TX Power'), w.txpower]);
	if (region) tail.push([_('Regulatory Domain'), region]);

	return {
		iface: w.iface,
		band: BANDS.indexOf(w.band) !== -1 ? w.band : 'Other',
		title: w.iface.toUpperCase() + ' (' + w.band + ')',
		gen: w.wcd_gen && w.wcd_gen !== 'unknown' ? w.wcd_gen : '',
		hardware: w.hardware ? w.hardware.replace(/^.*\[/, '').replace(/\]$/, '') : '',
		rows: rows,
		tail: tail,
		channels: channels.length ? groupChannels(w.band, channels) : '',
		disabled: cap && cap.disabled && cap.disabled.length ? cap.disabled.join(', ') : '',
		dfs: cap && cap.exceptions && cap.exceptions.length ? cap.exceptions.join(', ') : ''
	};
}

function wfRow(label, value, cls) {
	return E('div', { class: 'hw-wf-row' }, [E('span', { class: 'hw-wf-label' }, [label]), E('span', { class: 'hw-wf-value' + (cls ? ' ' + cls : '') }, [value])]);
}

return baseclass.extend({
	create: function() {
		var body = E('div', { class: 'hw-wifi' });
		var node = ui.card(_('Wi-Fi PHY & Spectrum'), [body], 'wide');
		var lastSurvey = {}, live = {}, shown = null;

		node.style.display = 'none';

		// Airtime since the previous distinct survey. The backend holds a
		// survey for 9 s, so an unchanged sample repeats the last live figure;
		// the since-boot average is only for drivers whose counters never move.
		function load(iface, sv) {
			if (!sv)
				return null;
			var p = lastSurvey[iface];
			var cur = [parseInt(sv.active, 10) || 0, parseInt(sv.busy, 10) || 0, parseInt(sv.tx, 10) || 0, parseInt(sv.rx, 10) || 0];
			var d = null;
			if (cur[0] > 0 && p && cur[0] > p.cur[0])
				d = cur.map(function(v, i) { return v - p.cur[i]; });
			else if (cur[0] > 0 && p && cur[0] === p.cur[0])
				d = p.delta || cur;
			lastSurvey[iface] = { cur: cur, delta: p && cur[0] > p.cur[0] ? d : (p && p.delta) || null };
			if (!d || !(d[0] > 0))
				return null;
			var pct = function(v) { return Math.max(0, Math.min(100, Math.round(v / d[0] * 100))); };
			return { busy: pct(d[1]), text: _('%d%% busy (%d%% tx / %d%% rx)').format(pct(d[1]), pct(d[2]), pct(d[3])) };
		}

		function radioBox(r, hasSurvey) {
			var kids = [];
			if (r.hardware && r.hardware !== 'Unknown')
				kids.push(E('div', { class: 'hw-radio-hw' }, [r.hardware]));
			r.rows.forEach(function(x) { kids.push(wfRow(x[0], x[1], x[2])); });
			var refs = {};
			if (hasSurvey) {
				refs.load = E('span', {}, ['—']);
				refs.noise = E('span', {}, ['—']);
				kids.push(wfRow(_('Channel Load'), refs.load));
				kids.push(wfRow(_('Noise Floor'), refs.noise));
			}
			r.tail.forEach(function(x) { kids.push(wfRow(x[0], x[1], x[2])); });
			if (r.channels)
				kids.push(E('div', { class: 'hw-wf-channels' }, [E('div', { class: 'hw-wf-label' }, [_('Supported Channels:')]), E('div', {}, [r.channels])]));
			if (r.disabled)
				kids.push(E('div', { class: 'hw-wf-warn hw-bad' }, [_('Disabled (Regdomain): %s').format(r.disabled)]));
			if (r.dfs)
				kids.push(E('div', { class: 'hw-wf-warn hw-dfs' }, [_('Radar Detection (DFS): %s').format(r.dfs)]));
			live[r.iface] = refs;
			return E('div', { class: 'hw-radio' }, [
				E('div', { class: 'hw-radio-head' }, [E('span', { class: 'hw-radio-title' }, [r.title]), r.gen ? E('span', { class: 'hw-radio-gen' }, [r.gen]) : '']),
				E('div', { class: 'hw-wifi-body' }, kids)
			]);
		}

		return {
			cards: { wifi: node },
			update: function(info) {
				var survey = info.wifi_survey || {};
				var radios = (info.wifi_radios || []).filter(function(w) {
					return !((!w.band || w.band === 'Unknown') && (!w.hwmode || w.hwmode === 'Unknown'));
				});
				var loads = {};
				radios.forEach(function(w) { loads[w.iface] = load(w.iface, survey[w.iface]); });

				node.style.display = radios.length ? 'flex' : 'none';
				var described = radios.map(describe);
				var sig = JSON.stringify(described) + Object.keys(survey).join(',');
				if (sig !== shown) {
					shown = sig;
					body.textContent = '';
					live = {};
					var cols = E('div', { class: 'hw-cols' });
					BANDS.concat(['Other']).forEach(function(band) {
						var inBand = described.filter(function(r) { return r.band === band; });
						if (!inBand.length)
							return;
						cols.appendChild(E('div', { class: 'hw-col hw-wifi-col' }, [E('div', { class: 'hw-col-title' }, [band === 'Other' ? _('Other') : band])]
							.concat(inBand.map(function(r) { return radioBox(r, !!survey[r.iface]); }))));
					});
					body.appendChild(cols);
				}

				radios.forEach(function(w) {
					var refs = live[w.iface], l = loads[w.iface], sv = survey[w.iface];
					if (!refs || !refs.load)
						return;
					ui.setText(refs.load, l ? l.text : '—');
					refs.load.style.color = l ? ui.loadColor(l.busy) : '';
					var noise = sv ? parseInt(sv.noise, 10) || 0 : 0;
					ui.setText(refs.noise, noise < 0 ? noise + ' dBm' : '—');
				});
			}
		};
	}
});
