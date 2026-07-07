'use strict';
'require view';
'require poll';
'require rpc';
'require fs';
var callHwInfo = rpc.declare({
    object: 'luci.hwdash',
    method: 'info',
    expect: {}
});
var callHwPing = rpc.declare({
    object: 'luci.hwdash',
    method: 'ping',
    params: ['targets'],
    expect: {}
});
var callHwGetConfig = rpc.declare({
    object: 'luci.hwdash',
    method: 'get_config',
    expect: {}
});
var callHwSetConfig = rpc.declare({
    object: 'luci.hwdash',
    method: 'set_config',
    params: ['config'],
    expect: {}
});
var parseCpu = function(line) {
    var parts = line.trim().split(/\s+/);
    var name = parts[0];
    var user = parseInt(parts[1]) || 0;
    var nice = parseInt(parts[2]) || 0;
    var sys = parseInt(parts[3]) || 0;
    var idle = parseInt(parts[4]) || 0;
    var iowait = parseInt(parts[5]) || 0;
    var irq = parseInt(parts[6]) || 0;
    var softirq = parseInt(parts[7]) || 0;
    var idleAll = idle + iowait;
    var systemAll = sys + irq + softirq;
    var virtAll = 0;
    var total = user + nice + systemAll + idleAll + virtAll;
    return { name: name, total: total, idleAll: idleAll, user: user, nice: nice, sys: sys, idle: idle, iowait: iowait, irq: irq, softirq: softirq };
};
return view.extend({
    prevCpu: {},
    prevDisk: {},
    load: function() {
        var self = this;
        self.prevCpu = {};
        return Promise.all([
            L.resolveDefault(fs.lines('/proc/stat'), []),
            L.resolveDefault(callHwGetConfig(), {})
        ]).then(function(res) {
            res[0].forEach(function(line) {
                if (line.indexOf('cpu') === 0) {
                    var stat = parseCpu(line);
                    self.prevCpu[stat.name] = stat;
                }
            });
            self.savedConfig = res[1] || {};
        });
    },
    render: function() {
        var container = E('div', {
            id: 'hw-dashboard',
            class: 'hw-dashboard'
        });
        var style = E('style', {}, ' .hw-dashboard { display: flex; flex-wrap: wrap; align-items: stretch; gap: 20px; padding: 15px; font-family: system-ui, -apple-system, sans-serif; width: 100%; max-width: 100%; overflow: hidden; } .hw-dashboard * { box-sizing: border-box; } .hw-thermals-container { display: flex; flex-direction: row; width: 100%; height: 100%; } .hw-thermals-col { flex: 1; } .hw-thermals-col-left { padding-right: 15px; } .hw-thermals-col-mid { padding: 0 15px; } .hw-thermals-col-right { padding-left: 15px; } .hw-thermals-title { font-size: 0.85em; opacity: 0.6; margin-bottom: 10px; text-align: center; } .hw-thermals-divider { width: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 10px 15px 30px 15px; } @media (max-width: 768px) { .hw-thermals-container { flex-direction: column; } .hw-thermals-col { padding: 0 !important; } .hw-thermals-divider { width: auto; height: 1px; margin: 25px 0; } } .hw-meta-grid { margin-top: 15px; font-size: 0.8em; color: currentColor; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; opacity: 0.8; width: 75%; margin-left: auto; margin-right: auto; } @media (max-width: 480px) { .hw-meta-grid { width: 100%; font-size: 0.75em; } .hw-dial { transform: scale(0.9); } .hw-card { padding: 15px; } } .hw-card { flex: 1 1 280px; background: var(--background-color-high, rgba(128, 128, 128, 0.05)); border: 1px solid var(--border-color, rgba(128, 128, 128, 0.2)); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-color, inherit); position: relative; box-shadow: 0 4px 10px rgba(0,0,0,0.1); max-width: 100%; overflow: hidden; } .hw-card.wide { flex: 1 1 100%; align-items: stretch; } .hw-card h3 { margin: 0 0 20px 0; font-size: 1.1em; color: var(--text-color, inherit); opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; text-align: center; } .hw-dial { position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center; margin: 0 auto; } .hw-dial svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform: rotate(-90deg); } .hw-dial-bg { fill: none; stroke: rgba(128, 128, 128, 0.2); stroke-width: 10; } .hw-dial-progress { fill: none; stroke-width: 10; stroke-linecap: round; transition: stroke-dasharray 0.5s ease; } .hw-dial-text { font-size: 2.2em; font-weight: 600; z-index: 1; } .hw-dial-subtext { position: absolute; bottom: 25px; font-size: 0.9em; opacity: 0.7; z-index: 1; } .hw-stats-list { width: 100%; display: flex; flex-direction: column; gap: 12px; } .hw-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 30px; width: 100%; } .hw-stat-row { display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 8px; } .hw-stat-label { opacity: 0.8; font-size: 0.95em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex-shrink: 1; margin-right: 10px; } .hw-stat-value { font-weight: bold; font-size: 0.95em; white-space: nowrap; flex-shrink: 0; } .hw-progress-item { display: flex; flex-direction: column; margin-bottom: 15px; width: 100%; } .hw-progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; width: 100%; min-width: 0; } .hw-bar-bg { width: 100%; height: 6px; background: var(--border-color, rgba(128, 128, 128, 0.2)); border-radius: 3px; overflow: hidden; margin-top: 6px; } .hw-bar-fill { height: 100%; transition: width 0.5s ease; } .hw-temp-badge { padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 0.9em; white-space: nowrap; } .hw-temp-crit { animation: hwTempPulse 1.1s ease-in-out infinite; } @keyframes hwTempPulse { 0%, 100% { box-shadow: 0 0 3px rgba(255,23,68,0.5); } 50% { box-shadow: 0 0 14px rgba(255,23,68,0.95); } } #hw-nand-row { align-items: flex-start; } @media (max-width: 768px) { #hw-nand-row { align-items: stretch; } #hw-nand-row > .hw-thermals-col { width: 100%; min-width: 0; } #hw-nand-row > .hw-thermals-divider { margin: 12px 0; } } ');
        var getDynColor = function(pct, invert) {
            if (invert === true) {
                if (pct >= 40) return '#00bcd4';
                if (pct >= 20) return '#ffea00';
                return '#ff1744';
            }
            if (pct < 60) return '#00bcd4';
            if (pct < 80) return '#ffea00';
            return '#ff1744';
        };
        var updateDial = function(id, pct, circ) {
            var dash = (pct / 100) * circ;
            var prog = document.getElementById('dial-prog-' + id);
            if (prog) {
                prog.style.strokeDasharray = dash + ' ' + circ;
                prog.style.stroke = getDynColor(pct);
            }
            var txt = document.getElementById('dial-txt-' + id);
            if (txt) {
                txt.textContent = Math.round(pct) + '%';
                txt.style.fill = getDynColor(pct);
                txt.style.color = getDynColor(pct);
            }
        };
        var createDial = function(id, title) {
            var radius = 70;
            var circumference = 2 * Math.PI * radius;
            var svgContainer = E('div', {
                id: 'dial-svg-' + id,
                style: 'position:absolute; top:0; left:0; width:100%; height:100%; background:transparent !important;'
            });
            svgContainer.innerHTML = '<svg viewBox="0 0 160 160" style="background:transparent !important;"><circle class="hw-dial-bg" cx="80" cy="80" r="' + radius + '"/><circle id="dial-prog-' + id + '" class="hw-dial-progress" cx="80" cy="80" r="' + radius + '" style="stroke: #00bcd4; stroke-dasharray: 0 ' + circumference + ';"/></svg>';
            var card = E('div', {
                class: 'hw-card',
                style: 'justify-content: flex-start;'
            }, [E('h3', {
                id: 'title-' + id
            }, title), E('div', {
                class: 'hw-dial',
                style: 'background:transparent !important;'
            }, [svgContainer, E('div', {
                id: 'dial-txt-' + id,
                class: 'hw-dial-text'
            }, '0%'), E('div', {
                id: 'dial-sub-' + id,
                class: 'hw-dial-subtext'
            }, '')]), E('div', {
                id: 'stats-' + id,
                class: 'hw-stats-list'
            })]);
            return {
                node: card,
                circ: circumference
            };
        };
        // IEEE 802.11 U-NII sub-band classification, per Wikipedia "List of WLAN
        // channels". Ranges span every standardised 20 MHz channel (incl. the rare
        // edge channels: 68 in U-NII-2A, 96 in U-NII-2C, 181 in U-NII-4) purely to
        // group channels into the right band. The channel numbers AND the frequency
        // span shown come from the radio's actually-enabled channels (regulatory-
        // domain filtered in the backend), never the theoretical band edges — so the
        // display reflects this specific router's capability, not the standard.
        // Each row: [name, firstChannel, lastChannel, requiresDFS]
        var UNII_5GHZ = [
            ['U-NII-1',  36,  48,  false],
            ['U-NII-2A', 52,  68,  true ],
            ['U-NII-2C', 96,  144, true ],
            ['U-NII-3',  149, 165, false],
            ['U-NII-4',  169, 181, false]
        ];
        var UNII_6GHZ = [
            ['U-NII-5',  1,   93,  false],
            ['U-NII-6',  97,  113, false],
            ['U-NII-7',  117, 185, false],
            ['U-NII-8',  189, 233, false]
        ];
        // Center frequency (MHz) of a 20 MHz channel within its band.
        var chanFreq = function(band, ch) {
            if (band.indexOf('2.4') !== -1) return ch === 14 ? 2484 : 2412 + (ch - 1) * 5;
            if (band.indexOf('6') !== -1) return 5950 + ch * 5;
            return 5000 + ch * 5; // 5 GHz
        };
        var groupChannels = function(band, channels) {
            if (!channels || channels.length === 0) return '';
            var chs = [];
            for (var i = 0; i < channels.length; i++) {
                var c = parseInt(channels[i]);
                if (!isNaN(c)) chs.push(c);
            }
            if (chs.length === 0) return '';
            chs.sort(function(a, b) { return a - b; });
            chs = chs.filter(function(c, i) { return i === 0 || c !== chs[i - 1]; });
            // Format an enabled span as "lo-hi (freqLo-freqHi MHz)" from the real
            // frequencies of the lowest and highest channel that is actually on.
            var fmt = function(lo, hi, dfs) {
                var fl = chanFreq(band, lo), fh = chanFreq(band, hi);
                var chTxt = lo === hi ? '' + lo : lo + '-' + hi;
                var frTxt = fl === fh ? fl + ' MHz' : fl + '-' + fh + ' MHz';
                return chTxt + ' (' + frTxt + (dfs ? ', DFS' : '') + ')';
            };
            // 2.4 GHz is a single contiguous band.
            if (band.indexOf('2.4') !== -1) {
                return fmt(chs[0], chs[chs.length - 1], false);
            }
            var table = band.indexOf('6') !== -1 ? UNII_6GHZ : UNII_5GHZ;
            var out = [];
            table.forEach(function(b) {
                var inBand = chs.filter(function(c) { return c >= b[1] && c <= b[2]; });
                if (inBand.length === 0) return;
                out.push(b[0] + ' ' + fmt(inBand[0], inBand[inBand.length - 1], b[3]));
            });
            // Any channel outside the known sub-bands is listed verbatim.
            var unknown = chs.filter(function(c) {
                return !table.some(function(b) { return c >= b[1] && c <= b[2]; });
            });
            if (unknown.length > 0) out.push(unknown.join(', '));
            return out.join(', ');
        };

        var calcMaxBitrate = function(hwmode, max_cw, max_spatial) {
            if (!hwmode || !max_cw || !max_spatial) return null;
            var mode = hwmode.toLowerCase();
            var cw = typeof max_cw === 'string' ? parseInt(max_cw.replace(/[^0-9]/g, '')) || 20 : max_cw;
            var streams = parseInt(max_spatial) || 1;
            
            var ratePerStream = 54;
            if (mode.indexOf('be') !== -1) {
                if (cw >= 320) ratePerStream = 2882;
                else if (cw >= 160) ratePerStream = 1441;
                else if (cw >= 80) ratePerStream = 688;
                else if (cw >= 40) ratePerStream = 344;
                else ratePerStream = 137;
            } else if (mode.indexOf('ax') !== -1) {
                if (cw >= 160) ratePerStream = 1201;
                else if (cw >= 80) ratePerStream = 600;
                else if (cw >= 40) ratePerStream = 287;
                else ratePerStream = 143;
            } else if (mode.indexOf('ac') !== -1) {
                if (cw >= 160) ratePerStream = 867;
                else if (cw >= 80) ratePerStream = 433;
                else if (cw >= 40) ratePerStream = 200;
                else ratePerStream = 86;
            } else if (mode.indexOf('n') !== -1) {
                if (cw >= 40) ratePerStream = 150;
                else ratePerStream = 72;
            }
            return (ratePerStream * streams) + ' Mbps';
        };

        // Pure render helpers used inside the 3s poll callback below. Hoisted
        // to render()-scope (created once at view load) instead of being
        // redefined on every poll tick — some (fmtSpeedDf/fmtKb) were
        // previously redefined once PER mounted filesystem, every 3s.
        var fmtCacheBytes = function(b) { return b >= 1048576 ? (b/1048576).toFixed(0)+' MB' : (b/1024).toFixed(0)+' KB'; };
        var getPhysicalRamTotal = function(memTotalKb) {
            var sizesMB = [32, 64, 128, 256, 512, 1024, 1536, 2048, 3072, 4096, 6144, 8192, 12288, 16384, 24576, 32768, 65536];
            var memTotalMB = memTotalKb / 1024;
            for (var i = 0; i < sizesMB.length; i++) {
                if (memTotalMB <= sizesMB[i]) return sizesMB[i] * 1024;
            }
            return memTotalKb;
        };
        // Small filled area graph for usage history (0-100%), fills the
        // idle space at the bottom of the CPU / Memory cards.
        var drawUsageSpark = function(el, data, color) {
            if (!el || data.length < 2) return;
            var W = 300, H = 46, P = 2;
            var pts = data.map(function(v, i) {
                var x = P + i * (W - 2 * P) / (data.length - 1);
                var y = H - P - Math.max(0, Math.min(100, v)) * (H - 2 * P) / 100;
                return x.toFixed(1) + ',' + y.toFixed(1);
            });
            var poly = pts.join(' ');
            var area = (P) + ',' + (H - P) + ' ' + poly + ' ' + (W - P) + ',' + (H - P);
            el.innerHTML = '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
                '<polygon points="' + area + '" fill="' + color + '22"/>' +
                '<polyline fill="none" stroke="' + color + '" stroke-width="1.5" vector-effect="non-scaling-stroke" points="' + poly + '"/></svg>';
        };
        var makeMemBar = function(label, valueMb, totalMb) {
            var pct = totalMb > 0 ? (valueMb / totalMb) * 100 : 0;
            var colorMem = getDynColor(pct, label === 'Free');
            var valStr = label === 'Used' || label === 'Free' || label === 'Cached' || label === 'Buffers' ? valueMb.toFixed(0) + ' MB' : valueMb.toFixed(0) + ' / ' + totalMb.toFixed(0) + ' MB';
            return E('div', {
                class: 'hw-progress-item'
            }, [E('div', {
                class: 'hw-progress-header'
            }, [E('span', {
                class: 'hw-stat-label'
            }, label), E('span', {
                class: 'hw-stat-value'
            }, valStr)]), E('div', {
                class: 'hw-bar-bg'
            }, [E('div', {
                class: 'hw-bar-fill',
                style: 'width: ' + pct + '%; background: ' + colorMem + ';'
            })])]);
        };
        // PING_GRAPH_START (marker used by the test harness)
        var PING_COLORS = ['#00bcd4', '#ffb300', '#e91e63', '#8bc34a', '#b388ff', '#ff7043', '#4dd0e1', '#f06292', '#ffd54f'];
        var PING_WINDOW = 120;      // raw 1s ping samples (2 min)
        var PING_AGG_KEEP = 1080;   // 10s buckets (3 h)
        var PING_VIEWS = {
            '2m':  { raw: true,  pts: 120, label: '−2 min',  step: 1 },
            '5m':  { group: 1,   pts: 30,  label: '−5 min',  step: 10 },
            '10m': { group: 1,   pts: 60,  label: '−10 min', step: 10 },
            '15m': { group: 1,   pts: 90,  label: '−15 min', step: 10 },
            '1h':  { group: 3,   pts: 120, label: '−1 h',    step: 30 },
            '3h':  { group: 9,   pts: 120, label: '−3 h',    step: 90 }
        };
        var TEMP_WINDOW = 200;      // raw 3s temp samples (10 min)
        var TEMP_AGG_KEEP = 360;    // 30s buckets (3 h)
        var TEMP_VIEWS = {
            '2m':  { raw: true, pts: 40,  label: '−2 min',  step: 3 },
            '5m':  { raw: true, pts: 100, label: '−5 min',  step: 3 },
            '10m': { raw: true, pts: 200, label: '−10 min', step: 3 },
            '1h':  { group: 1,  pts: 120, label: '−1 h',    step: 30 },
            '3h':  { group: 3,  pts: 120, label: '−3 h',    step: 90 }
        };
        var pingPct = function(sorted, p) {
            if (!sorted.length) return null;
            return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
        };
        var buildSeriesFrom = function(t, vw) {
            if (vw.raw) {
                return t.data.slice(-vw.pts).map(function(v) { return { v: v, loss: v === null, lostN: v === null ? 1 : 0, cnt: 1 }; });
            }
            var per = vw.group;
            var src = t.agg.slice(-(vw.pts * per));
            var out = [];
            for (var i = 0; i < src.length; i += per) {
                var sum = 0, n = 0, loss = 0;
                for (var k = i; k < Math.min(i + per, src.length); k++) {
                    var b = src[k];
                    if (b.a !== null) { sum += b.a * b.n; n += b.n; }
                    loss += b.loss;
                }
                var cnt = n + loss;
                out.push({ v: n > 0 ? sum / n : null, loss: loss > 0 && cnt > 0 && loss / cnt >= 0.02, lostN: loss, cnt: cnt });
            }
            return out;
        };
        // Persistent realtime graph panel. The skeleton (buttons, plot, axis,
        // tooltip, legend entries) is created ONCE and keeps its DOM identity —
        // poll ticks only repaint the SVG data and update text in place, so
        // hover state and the mouse pointer are never reset by a refresh.
        // Hover position is remembered and re-applied after each repaint.
        var createGraphPanel = function(opts) {
            var VIEWS = opts.views;
            var GW = 600, GH = opts.height || 190, GTOP = 6, GBOT = opts.lossTicks ? 8 : 4;
            var P = { view: opts.defaultView, hoverFrac: null, hist: null, series: null, keys: [] };
            var el = E('div', { style: 'width: 100%;' });
            var btnBase = 'font-size: 0.72em; padding: 2px 9px; border-radius: 4px; cursor: pointer; border: 1px solid var(--border-color, rgba(128,128,128,0.3)); background: transparent; color: inherit;';
            var btns = {};
            var styleBtns = function() {
                Object.keys(btns).forEach(function(vk) {
                    var sel = vk === P.view;
                    btns[vk].style.borderColor = sel ? '#00bcd4' : '';
                    btns[vk].style.background = sel ? 'rgba(0,188,212,0.15)' : 'transparent';
                    btns[vk].style.color = sel ? '#00bcd4' : 'inherit';
                });
            };
            var ctlRow = E('div', { style: 'display: flex; justify-content: flex-end; align-items: center; gap: 4px; margin-bottom: 6px;' });
            Object.keys(VIEWS).forEach(function(vk) {
                var b = E('button', {
                    style: btnBase,
                    click: function() {
                        P.view = vk;
                        styleBtns();
                        axisL.textContent = VIEWS[vk].label;
                        if (P.hist) update(P.hist);
                    }
                }, vk);
                btns[vk] = b;
                ctlRow.appendChild(b);
            });
            if (opts.csvName) {
                ctlRow.appendChild(E('button', {
                    style: btnBase + ' margin-left: 8px;',
                    click: function() {
                        if (!P.series) return;
                        var vw = VIEWS[P.view];
                        var head = ['offset_s'];
                        var cols = [];
                        P.keys.forEach(function(k) { head.push('"' + P.hist[k].label + '"'); cols.push(P.series[k]); });
                        var maxLen = 0;
                        cols.forEach(function(c) { maxLen = Math.max(maxLen, c.length); });
                        var lines = [head.join(',')];
                        for (var r = 0; r < maxLen; r++) {
                            var row = [String(-(maxLen - 1 - r) * vw.step)];
                            cols.forEach(function(c) {
                                var idx = r - (maxLen - c.length);
                                var p = idx >= 0 ? c[idx] : null;
                                row.push(p && p.v !== null ? p.v.toFixed(1) : '');
                            });
                            lines.push(row.join(','));
                        }
                        var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
                        var a = E('a', { href: URL.createObjectURL(blob), download: 'hwdash-' + opts.csvName + '-' + P.view + '-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.csv' });
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        URL.revokeObjectURL(a.href);
                    }
                }, '⤓ CSV'));
            }
            styleBtns();
            el.appendChild(ctlRow);
            // outer holds the crosshair + tooltip UNCLIPPED (so a tall
            // tooltip can extend past the plot instead of truncating); the
            // inner clip keeps the SVG inside the rounded border.
            var plot = E('div', { style: 'position: relative; width: 100%; touch-action: pan-y;' });
            var plotClip = E('div', { style: 'width: 100%; background: rgba(128,128,128,0.04); border: 1px solid var(--border-color, rgba(128,128,128,0.12)); border-radius: 8px; overflow: hidden;' });
            plot.appendChild(plotClip);
            var svgWrap = E('div', { style: 'width: 100%; line-height: 0;' });
            plotClip.appendChild(svgWrap);
            var gridFracs = [0.25, 0.5, 0.75];
            var plotHc = GH - GTOP - GBOT;
            var gridLabels = gridFracs.map(function(g) {
                var topPct = ((GTOP + plotHc * (1 - g)) / GH * 100).toFixed(1);
                var sp = E('span', { style: 'position: absolute; top: ' + topPct + '%; left: 5px; transform: translateY(-100%); font-size: 0.68em; opacity: 0.55; pointer-events: none; z-index: 2;' });
                plot.appendChild(sp);
                return sp;
            });
            var topLabel = E('span', { style: 'position: absolute; top: 2px; left: 5px; font-size: 0.68em; opacity: 0.55; pointer-events: none;' });
            plot.appendChild(topLabel);
            var xline = E('div', { style: 'position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.35); display: none; pointer-events: none;' });
            var tip = E('div', { style: 'position: absolute; top: 6px; font-size: 0.76em; line-height: 1.5; background: rgba(20,22,26,0.95); border: 1px solid rgba(128,128,128,0.35); border-radius: 6px; padding: 7px 10px; display: none; pointer-events: none; z-index: 9; white-space: nowrap;' });
            plot.appendChild(xline);
            plot.appendChild(tip);
            var applyHover = function(frac) {
                if (!P.series) return;
                var rect = plot.getBoundingClientRect();
                if (!rect.width) return;
                var vw = VIEWS[P.view];
                var idx = Math.round(frac * (vw.pts - 1));
                var px = (idx / (vw.pts - 1)) * rect.width;
                xline.style.left = px + 'px';
                xline.style.display = 'block';
                tip.innerHTML = '';
                tip.appendChild(E('div', { style: 'opacity: 0.6; margin-bottom: 3px;' }, '−' + ((vw.pts - 1 - idx) * vw.step) + ' s'));
                P.keys.forEach(function(k) {
                    var t = P.hist[k];
                    if (t.hidden) return;
                    var sr = P.series[k];
                    var si = idx - (vw.pts - sr.length);
                    var p = si >= 0 && si < sr.length ? sr[si] : null;
                    var val = !p || p.v === null ? (p && opts.spikeNulls && !t.na ? 'timeout' : '—') : p.v.toFixed(1) + opts.unit;
                    tip.appendChild(E('div', { style: 'display: flex; align-items: center; gap: 5px;' }, [
                        E('span', { style: 'width: 7px; height: 7px; border-radius: 50%; background: ' + t.color + ';' }),
                        E('span', { style: 'opacity: 0.75;' }, t.label),
                        E('span', { style: 'font-weight: 600; color: ' + (p && p.v === null && opts.spikeNulls ? '#ff5252' : t.color) + '; margin-left: auto; padding-left: 8px;' }, val)
                    ]));
                });
                tip.style.display = 'block';
                tip.style.left = (px < rect.width / 2 ? px + 12 : px - tip.offsetWidth - 12) + 'px';
            };
            plot.addEventListener('mousemove', function(ev) {
                var rect = plot.getBoundingClientRect();
                P.hoverFrac = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                applyHover(P.hoverFrac);
            });
            plot.addEventListener('mouseleave', function() {
                P.hoverFrac = null;
                xline.style.display = 'none';
                tip.style.display = 'none';
            });
            el.appendChild(plot);
            var axisL = E('span', {}, VIEWS[P.view].label);
            el.appendChild(E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.68em; opacity: 0.45; margin-top: 3px;' }, [
                axisL,
                E('span', {}, 'now')
            ]));
            var legendWrap = null;
            var legendEntries = {};
            if (opts.legend) {
                legendWrap = E('div', { style: 'display: flex; flex-wrap: wrap; gap: 6px 16px; justify-content: center; margin-top: 10px;' });
                el.appendChild(legendWrap);
            }
            var syncLegend = function() {
                var sig = P.keys.join('|');
                if (legendWrap.dataset.sig !== sig) {
                    legendWrap.dataset.sig = sig;
                    legendWrap.innerHTML = '';
                    legendEntries = {};
                    P.keys.forEach(function(k) {
                        var t = P.hist[k];
                        var dot = E('span', { style: 'width: 10px; height: 10px; border-radius: 50%; background: ' + t.color + '; flex-shrink: 0;' });
                        var lbl = E('span', { style: 'opacity: 0.8;' }, t.label);
                        var val = E('span', { style: 'font-weight: 600;' });
                        var extra = E('span', { style: 'opacity: 0.5; font-size: 0.9em;' });
                        var root = E('span', {
                            style: 'display: inline-flex; align-items: center; gap: 5px; font-size: 0.82em; cursor: pointer; user-select: none;',
                            title: 'Click to hide/show',
                            click: function() {
                                t.hidden = !t.hidden;
                                if (P.hist) update(P.hist);
                            }
                        }, [dot, lbl, val, extra]);
                        legendWrap.appendChild(root);
                        legendEntries[k] = { root: root, dot: dot, lbl: lbl, val: val, extra: extra };
                    });
                }
                P.keys.forEach(function(k) {
                    var t = P.hist[k];
                    var en = legendEntries[k];
                    if (!en) return;
                    var lv = opts.legendValue(t);
                    en.root.style.opacity = t.hidden ? '0.35' : (lv.dim ? '0.55' : '1');
                    en.lbl.style.textDecoration = t.hidden ? 'line-through' : 'none';
                    en.dot.style.background = lv.dotColor || t.color;
                    en.val.textContent = lv.text;
                    en.val.style.color = lv.color;
                    en.extra.textContent = lv.extra || '';
                });
            };
            var update = function(hist) {
                P.hist = hist;
                P.keys = Object.keys(hist);
                var vw = VIEWS[P.view];
                var series = {};
                P.keys.forEach(function(k) { series[k] = buildSeriesFrom(hist[k], vw); });
                P.series = series;
                var plotH = GH - GTOP - GBOT;
                var step = GW / (vw.pts - 1);
                var all = [];
                P.keys.forEach(function(k) {
                    if (hist[k].hidden) return;
                    series[k].forEach(function(p) { if (p.v !== null) all.push(p.v); });
                });
                var ylo = 0, yhi = opts.yFloor || 20;
                if (all.length) {
                    all.sort(function(a, b) { return a - b; });
                    if (opts.autoRange) {
                        ylo = Math.floor((all[0] - 3) / 5) * 5;
                        yhi = Math.ceil((all[all.length - 1] + 3) / 5) * 5;
                        if (yhi - ylo < 10) yhi = ylo + 10;
                    } else {
                        yhi = Math.max(opts.yFloor || 20, Math.min(all[all.length - 1], pingPct(all, 0.95) * 1.5));
                        yhi = Math.ceil(yhi / 10) * 10;
                    }
                }
                var yFor = function(v) { return GTOP + plotH * (1 - (Math.min(v, yhi) - ylo) / (yhi - ylo)); };
                var svg = '';
                gridFracs.forEach(function(g) {
                    var gy = (GTOP + plotH * (1 - g)).toFixed(1);
                    svg += '<line x1="0" y1="' + gy + '" x2="' + GW + '" y2="' + gy + '" stroke="rgba(128,128,128,0.18)" stroke-width="1" stroke-dasharray="3,4" vector-effect="non-scaling-stroke"/>';
                });
                var lossXs = {};
                P.keys.forEach(function(k) {
                    var t = hist[k];
                    if (t.hidden) return;
                    var sr = series[k];
                    var anyOk = sr.some(function(p) { return p.v !== null; });
                    if (!anyOk) return;
                    var pts = [];
                    var lastPt = null, lastNull = false;
                    for (var i = 0; i < sr.length; i++) {
                        var x = GW - (sr.length - 1 - i) * step;
                        if (opts.lossTicks && sr[i].loss) lossXs[x.toFixed(1)] = 1;
                        var y = sr[i].v === null ? GTOP : yFor(sr[i].v);
                        pts.push(x.toFixed(1) + ',' + y.toFixed(1));
                        lastPt = [x, y];
                        lastNull = (sr[i].v === null);
                    }
                    if (pts.length === 1) {
                        var xy = pts[0].split(',');
                        svg += '<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="2.5" fill="' + t.color + '"/>';
                    } else if (pts.length > 1) {
                        svg += '<polyline fill="none" stroke="' + t.color + '" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke" points="' + pts.join(' ') + '"/>';
                    }
                    if (lastPt) svg += '<circle cx="' + lastPt[0].toFixed(1) + '" cy="' + lastPt[1].toFixed(1) + '" r="3" fill="' + (lastNull && opts.spikeNulls ? '#ff1744' : t.color) + '"/>';
                });
                Object.keys(lossXs).forEach(function(x) {
                    svg += '<line x1="' + x + '" y1="' + (GH - 6) + '" x2="' + x + '" y2="' + GH + '" stroke="#ff1744" stroke-width="1.5" vector-effect="non-scaling-stroke"/>';
                });
                svgWrap.innerHTML = '<svg width="100%" height="' + GH + '" viewBox="0 0 ' + GW + ' ' + GH + '" preserveAspectRatio="none">' + svg + '</svg>';
                gridFracs.forEach(function(g, gi) {
                    gridLabels[gi].textContent = Math.round(ylo + (yhi - ylo) * g) + opts.unit;
                });
                topLabel.textContent = yhi + opts.unit;
                if (opts.legend) syncLegend();
                if (P.hoverFrac != null) {
                    // If the panel is momentarily detached (a parent card being
                    // rebuilt), the rect is 0 — retry on the next frame so the
                    // tooltip keeps tracking live values under a still cursor.
                    if (plot.getBoundingClientRect().width) applyHover(P.hoverFrac);
                    else window.requestAnimationFrame(function() { if (P.hoverFrac != null) applyHover(P.hoverFrac); });
                }
            };
            return { el: el, update: update, currentSeries: function() { return P.series; }, currentView: function() { return P.view; } };
        };
        // PING_GRAPH_END

        var makeSensorRow = function(s) {
            // Color thresholds come from the sensor's own trip points
            // when the hardware exposes them (per-architecture dynamic);
            // the fixed 60/80 °C split is only the fallback.
            var hot = s.crit ? s.crit * 0.85 : 80;
            var warm = s.pass ? Math.min(s.pass, hot - 5) : (s.crit ? s.crit * 0.65 : 60);
            var color = '#00bcd4', bgCol = 'rgba(0,188,212,0.14)';
            var hotCls = '';
            if (s.temp >= hot) {
                color = '#ff1744';
                bgCol = 'rgba(255,23,68,0.22)';
                hotCls = ' hw-temp-crit';
            } else if (s.temp > warm) {
                color = '#ffb300';
                bgCol = 'rgba(255,179,0,0.2)';
            }
            var tempDisplay = s.temp.toFixed(1) + ' °C';
            if (s.temp >= (s.crit || 90)) tempDisplay += ' ⚠️';
            var rowContent = [E('div', {
                class: 'hw-stat-row',
                style: 'border-bottom: none; padding-bottom: 0;'
            }, [E('span', {
                class: 'hw-stat-label',
                style: 'display: inline-flex; align-items: center; gap: 7px;'
            }, [E('span', { style: 'width: 8px; height: 8px; border-radius: 50%; background: ' + (s.color || color) + '; flex-shrink: 0;' }), s.name]), E('span', {
                class: 'hw-temp-badge' + hotCls,
                style: 'color: ' + color + '; background: ' + bgCol + ';'
            }, tempDisplay)])];
            if (s.pass || s.crit) {
                var tripsDiv = E('div', {
                    style: 'display: flex; justify-content: flex-end; gap: 6px; font-size: 0.75em; padding-top: 6px;'
                });
                if (s.pass) {
                    tripsDiv.appendChild(E('span', {
                        style: 'color: #ffb300; background: rgba(255,179,0,0.15); padding: 2px 6px; border-radius: 4px; font-weight: 600; letter-spacing: 0.5px;'
                    }, 'PASS ' + s.pass.toFixed(0) + '°'));
                }
                if (s.crit) {
                    tripsDiv.appendChild(E('span', {
                        style: 'color: #ff1744; background: rgba(255,23,68,0.15); padding: 2px 6px; border-radius: 4px; font-weight: 600; letter-spacing: 0.5px;'
                    }, 'CRIT ' + s.crit.toFixed(0) + '°'));
                }
                rowContent.push(tripsDiv);
            }
            return E('div', {
                style: 'padding: 5px 0; border-bottom: 1px solid var(--border-color, rgba(128,128,128,0.1));'
            }, rowContent);
        };
        var fmtMbps = function(m) { return m >= 1000 ? (m / 1000).toFixed(2) + ' Gbps' : m >= 1 ? m.toFixed(1) + ' Mbps' : (m * 1000).toFixed(0) + ' Kbps'; };
        var fmtSpeedDf = function(bytes) {
            if (bytes < 1024) return bytes + ' B/s';
            if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB/s';
            return (bytes / 1048576).toFixed(1) + ' MB/s';
        };
        var fmtKb = function(kb) { return kb >= 1048576 ? (kb/1048576).toFixed(1)+' GB' : kb >= 1024 ? (kb/1024).toFixed(0)+' MB' : kb+' KB'; };
        var fmtSize = function(kb) {
            if (kb >= 1048576) return (kb / 1048576).toFixed(2) + ' GB';
            return (kb / 1024).toFixed(0) + ' MB';
        };
        var fmtBytesS = function(b) {
            if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
            if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
            if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
            return b + ' B';
        };
        var makeRow = function(label, val, color, wrap) {
            // wrap: let long label/value pairs break onto two lines instead of
            // the default nowrap+ellipsis truncation (needed on mobile widths).
            return E('div', {class: 'hw-stat-row', style: 'margin-bottom: 3px;' + (wrap ? ' flex-wrap: wrap; row-gap: 2px;' : '')}, [
                E('span', {class: 'hw-stat-label', style: 'font-size: 0.9em;' + (wrap ? ' white-space: normal; overflow: visible;' : '')}, label),
                E('span', {class: 'hw-stat-value', style: 'font-size: 0.9em; margin-left: auto;' + (color ? ' color:' + color + ';' : '')}, val)
            ]);
        };
        var makeBar2 = function(label, pct, valStr, color) {
            var c = color || getDynColor(pct);
            return E('div', {class: 'hw-progress-item', style: 'margin-bottom: 8px;'}, [
                E('div', {class: 'hw-progress-header'}, [
                    E('span', {class: 'hw-stat-label', style: 'font-size: 0.9em;'}, label),
                    E('span', {class: 'hw-stat-value', style: 'font-size: 0.9em; color:' + c + ';'}, valStr)
                ]),
                E('div', {class: 'hw-bar-bg'}, [
                    E('div', {class: 'hw-bar-fill', style: 'width:' + Math.min(pct, 100) + '%; background:' + c + ';'})
                ])
            ]);
        };
        var makeDevBox = function(headerLeft, headerRight) {
            var box = E('div', {style: 'background: rgba(128,128,128,0.04); border: 1px solid var(--border-color, rgba(128,128,128,0.1)); border-radius: 8px; padding: 10px; margin-bottom: 10px;'});
            var rightEl = (typeof headerRight === 'string')
                ? E('span', {style: 'font-size: 0.8em; opacity: 0.7;'}, headerRight)
                : headerRight;
            box.appendChild(E('div', {style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border-color, rgba(128,128,128,0.15));'}, [
                E('span', {style: 'font-weight: bold; font-size: 0.95em;'}, headerLeft),
                rightEl
            ]));
            return box;
        };
        var secH = function(title) {
            return E('h4', {style: 'margin: 0 0 10px 0; font-size: 0.8em; opacity: 0.6; text-transform: uppercase; letter-spacing: 1px;'}, title);
        };
        var hRule = function() {
            return E('div', {style: 'width:100%;height:1px;background:var(--border-color,rgba(128,128,128,0.15));margin:12px 0;'});
        };
        var fmtSpeedExt = function(bytesSec) {
            if (bytesSec > 1024 * 1024) return (bytesSec / (1024 * 1024)).toFixed(1) + ' MB/s';
            if (bytesSec > 1024) return (bytesSec / 1024).toFixed(1) + ' KB/s';
            return Math.round(bytesSec) + ' B/s';
        };
        var getStats = function(devObj, now) {
            var devName = devObj.dev;
            var curRead = parseInt(devObj.read) || 0;
            var curWrite = parseInt(devObj.write) || 0;
            var curRIos = parseInt(devObj.read_ios) || 0;
            var curWIos = parseInt(devObj.write_ios) || 0;
            var rSpeed = 0, wSpeed = 0, rIops = 0, wIops = 0;

            if (self.prevDisk[devName]) {
                var prev = self.prevDisk[devName];
                var tDiff = (now - prev.time) / 1000.0;
                if (tDiff > 0) {
                    rSpeed = Math.max(0, (curRead - prev.read) / tDiff);
                    wSpeed = Math.max(0, (curWrite - prev.write) / tDiff);
                    rIops = Math.max(0, (curRIos - prev.rIos) / tDiff);
                    wIops = Math.max(0, (curWIos - prev.wIos) / tDiff);
                }
            }
            self.prevDisk[devName] = {
                read: curRead,
                write: curWrite,
                rIos: curRIos,
                wIos: curWIos,
                time: now
            };
            return {
                rSpeed: rSpeed,
                wSpeed: wSpeed,
                rIops: rIops,
                wIops: wIops
            };
        };

        var cpuCard = createDial('cpu', 'CPU');
        var ramCard = createDial('ram', 'MEMORY');
        ramCard.node.appendChild(E('div', {
            style: 'width: 100%; height: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 15px 0;'
        }));
        ramCard.node.appendChild(E('h4', {
            style: 'text-align: center; font-size: 0.85em; opacity: 0.7; letter-spacing: 1px; margin: 0 0 10px 0; text-transform: uppercase;'
        }, 'USAGE HISTORY (3 MIN)'));
        ramCard.node.appendChild(E('div', { id: 'hw-mem-spark', style: 'width: 100%; line-height: 0;' }));

        var _dskNode = E('div', {class: 'hw-card wide', style: 'justify-content: flex-start; align-items: stretch;'});
        _dskNode.appendChild(E('h3', {}, 'Internal Storage'));
        _dskNode.appendChild(E('div', {id: 'stats-dsk', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0;'}));
        _dskNode.appendChild(E('div', {style: 'width: 100%; height: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 15px 0;'}));
        _dskNode.appendChild(E('div', {id: 'dial-meta-dsk', style: 'display: flex; flex-direction: column; gap: 5px;'}));
        _dskNode.appendChild(E('div', {id: 'hw-dsk-horiz-divider', style: 'width: 100%; height: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 15px 0; display: none;'}));
        _dskNode.appendChild(E('div', {id: 'hw-int-storage-extra', style: 'width: 100%;'}));
        var dskCard = {node: _dskNode};
        var coresNode = E('div', {
            id: 'hw-cores',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0;'
        });
        cpuCard.node.appendChild(E('h4', {
            style: 'text-align: center; font-size: 0.85em; opacity: 0.7; letter-spacing: 1px; margin: 15px 0 10px 0; text-transform: uppercase;'
        }, 'PER-CORE USAGE'));
        cpuCard.node.appendChild(coresNode);
        cpuCard.node.appendChild(E('div', {
            style: 'width: 100%; height: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 15px 0;'
        }));
        cpuCard.node.appendChild(E('h4', {
            style: 'text-align: center; font-size: 0.85em; opacity: 0.7; letter-spacing: 1px; margin: 0 0 10px 0; text-transform: uppercase;'
        }, 'SYSTEM STATUS'));
        var cpuMetaNode = E('div', {
            id: 'hw-cpu-meta',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0;'
        });
        cpuCard.node.appendChild(cpuMetaNode);
        cpuCard.node.appendChild(E('div', {
            style: 'width: 100%; height: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 15px 0;'
        }));
        cpuCard.node.appendChild(E('h4', {
            style: 'text-align: center; font-size: 0.85em; opacity: 0.7; letter-spacing: 1px; margin: 0 0 10px 0; text-transform: uppercase;'
        }, 'USAGE HISTORY (3 MIN)'));
        cpuCard.node.appendChild(E('div', { id: 'hw-cpu-spark', style: 'width: 100%; line-height: 0;' }));
        var advCard = E('div', {
            class: 'hw-card',
            style: 'justify-content: flex-start;'
        }, [E('h3', {}, 'CPU Detailed Load'), E('div', {
            id: 'hw-adv',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0;'
        })]);
        var extCard = E('div', {
            id: 'hw-ext-card',
            class: 'hw-card',
            style: 'display: none;'
        }, [E('h3', {}, 'EXTERNAL STORAGE'), E('div', {
            id: 'hw-ext-list',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0; width: 100%;'
        }), E('div', {
            id: 'hw-ext-meta',
            style: 'width: 100%; margin-top: 20px; display: flex; flex-direction: column; gap: 8px;'
        })]);
        
        
        
        // Thermal cards are built dynamically each poll: sensors are laid out
        // naturally (no CPU/Wi-Fi/Misc grouping) across up to 3 columns, and
        // when the platform exposes more sensors than fit one card, extra
        // cards are appended automatically.
        var thermWrapper = E('div', {
            id: 'hw-therm-wrapper',
            style: 'display: contents;'
        });
        
        
        var ethCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Ports Topology'), E('div', { id: 'hw-eth-links', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0; display: flex; flex-direction: column; gap: 8px;' })]);

        
        
        var pcieCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'PCI-e Topology'), E('div', { id: 'hw-pcie', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0; display: flex; flex-direction: column; gap: 8px;' })]);

        
        
        var pingCard = E('div', { class: 'hw-card wide', style: 'justify-content: flex-start; display: none;' }, [
            E('h3', {}, 'Ping Latency'),
            E('div', { id: 'hw-ping', style: 'width: 100%;' }),
            E('div', { style: 'text-align: center; font-size: 0.72em; opacity: 0.45; margin-top: 8px;' }, 'Add targets via \u2699 Settings (top right), or /etc/hwdash-ping.targets on the router')
        ]);
        var wifiCard = E('div', { class: 'hw-card wide', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Wi-Fi PHY & Spectrum'), E('div', { id: 'hw-wifi-radios', style: 'margin-top: 0; padding-top: 0; width: 100%;' })]);

        var hwmonCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Power & Fans'), E('div', { id: 'hw-hwmon', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0;' })]);

        var offloadCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Offload Engines'), E('div', { id: 'hw-offload', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0;' })]);

        var irqCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Interrupts'), E('div', { id: 'hw-irq', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0;' })]);

        var eventsCard = E('div', { class: 'hw-card wide', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Hardware Events'), E('div', { id: 'hw-events', style: 'width: 100%; display: flex; flex-direction: column; gap: 5px;' })]);

        var sysCard = E('div', {class: 'hw-card wide', style: 'justify-content: flex-start;'});
        sysCard.appendChild(E('h3', {}, 'System Info'));
        sysCard.appendChild(E('div', {id: 'hw-sysinfo-grid', style: 'width: 100%;'}));

        container.appendChild(style);
        container.appendChild(sysCard);
        container.appendChild(cpuCard.node);
        container.appendChild(ramCard.node);
        container.appendChild(advCard);
        container.appendChild(irqCard);
        container.appendChild(hwmonCard);
        container.appendChild(offloadCard);
        container.appendChild(dskCard.node);
        container.appendChild(extCard);
        var myExtWrapper = E('div', {
            id: 'my-ext-wrapper',
            style: 'display: contents;'
        });
        container.appendChild(myExtWrapper);
        container.appendChild(ethCard);
        container.appendChild(pcieCard);
        container.appendChild(pingCard);
        container.appendChild(wifiCard);
        container.appendChild(thermWrapper);
        container.appendChild(eventsCard);
        var self = this;

        // ---------- Settings (persisted per-browser in localStorage) ----------
        var loadLS = function(key, dflt) {
            try {
                var v = JSON.parse(localStorage.getItem(key));
                return v == null ? dflt : v;
            } catch (e) { return dflt; }
        };
        // Settings live on the ROUTER (set_config -> /etc/hwdash-settings.json)
        // so they follow the device like normal LuCI config. localStorage is
        // only read once to migrate pre-existing browser-side settings.
        var savedCfg = self.savedConfig || {};
        self.hiddenCards = Array.isArray(savedCfg.hidden) ? savedCfg.hidden : loadLS('hwdash.hiddenCards', []);
        self.pingTargets = Array.isArray(savedCfg.targets) ? savedCfg.targets : loadLS('hwdash.pingTargets', []);
        var saveConfig = function() {
            callHwSetConfig({ hidden: self.hiddenCards, targets: self.pingTargets }).catch(function() {});
        };
        if (!Array.isArray(savedCfg.hidden) && (self.hiddenCards.length > 0 || self.pingTargets.length > 0)) {
            saveConfig(); // one-time migration of old browser-side settings
        }
        // Defaults are ALWAYS pinged; user targets are added on top of them.
        var DEFAULT_PING_TARGETS = [
            { host: 'dns.google', fam: 4 }, { host: 'dns.google', fam: 6 },
            { host: 'one.one.one.one', fam: 4 }, { host: 'one.one.one.one', fam: 6 },
            { host: 'google.com', fam: 4 }, { host: 'google.com', fam: 6 },
            { host: 'youtube.com', fam: 4 }, { host: 'youtube.com', fam: 6 }
        ];
        var expandFams = function(t) { return String(t.fam) === 'both' ? [4, 6] : [parseInt(t.fam) === 6 ? 6 : 4]; };
        var pingTargetPairs = function() {
            // defaults + customs, de-duplicated by host+family
            var seen = {};
            var pairs = [];
            DEFAULT_PING_TARGETS.concat(self.pingTargets).forEach(function(t) {
                expandFams(t).forEach(function(fam) {
                    var key = t.host + '|' + fam;
                    if (seen[key]) return;
                    seen[key] = true;
                    pairs.push(t.host + ' ' + fam);
                });
            });
            return pairs;
        };

        // Card registry: which container node(s) a settings checkbox controls.
        // "show" is the display value to restore on unhide for cards that are
        // unconditionally visible; conditional cards are re-shown by their own
        // poll logic on the next tick.
        var cardRegistry = {
            sysinfo: { nodes: [sysCard], label: 'System Info', show: 'flex' },
            cpu: { nodes: [cpuCard.node], label: 'CPU', show: 'flex' },
            ram: { nodes: [ramCard.node], label: 'Memory', show: 'flex' },
            load: { nodes: [advCard], label: 'CPU Detailed Load', show: 'flex' },
            hwmon: { nodes: [hwmonCard], label: 'Power & Fans', show: null },
            offload: { nodes: [offloadCard], label: 'Offload Engines', show: null },
            irq: { nodes: [irqCard], label: 'Interrupts', show: null },
            events: { nodes: [eventsCard], label: 'Hardware Events', show: null },
            storage: { nodes: [dskCard.node], label: 'Internal Storage', show: 'flex' },
            ext: { nodes: [extCard, myExtWrapper], label: 'External Storage', show: null },
            ports: { nodes: [ethCard], label: 'Ports Topology', show: null },
            pcie: { nodes: [pcieCard], label: 'PCI-e', show: null },
            ping: { nodes: [pingCard], label: 'Ping Latency', show: null },
            wifi: { nodes: [wifiCard], label: 'Wi-Fi PHY & Spectrum', show: null },
            thermal: { nodes: [thermWrapper], label: 'Thermal Sensors', show: 'contents' }
        };
        var applyCardVisibility = function() {
            for (var key in cardRegistry) {
                var c = cardRegistry[key];
                var hidden = self.hiddenCards.indexOf(key) !== -1;
                c.nodes.forEach(function(n) {
                    if (hidden) n.style.display = 'none';
                    else if (c.show) n.style.display = c.show;
                });
            }
        };

        var settingsPanel = E('div', {
            class: 'cbi-section',
            style: 'display: none; width: 100%; padding: 14px 18px; border: 1px solid var(--border-color, rgba(128,128,128,0.25)); border-radius: 8px; background: var(--background-color-high, rgba(128,128,128,0.05));'
        });
        settingsPanel.appendChild(E('h4', { style: 'margin: 0 0 8px 0; font-size: 0.85em; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px;' }, 'Visible Cards'));
        var cardChecks = E('div', { style: 'display: flex; flex-wrap: wrap; gap: 4px 18px; margin-bottom: 14px;' });
        Object.keys(cardRegistry).forEach(function(key) {
            var cb = E('input', {
                type: 'checkbox',
                change: function(ev) {
                    var idx = self.hiddenCards.indexOf(key);
                    if (ev.target.checked && idx !== -1) self.hiddenCards.splice(idx, 1);
                    else if (!ev.target.checked && idx === -1) self.hiddenCards.push(key);
                    saveConfig();
                    applyCardVisibility();
                }
            });
            cb.checked = self.hiddenCards.indexOf(key) === -1;
            cardChecks.appendChild(E('label', { style: 'display: inline-flex; align-items: center; gap: 6px; font-size: 0.9em; cursor: pointer;' }, [cb, cardRegistry[key].label]));
        });
        settingsPanel.appendChild(cardChecks);

        settingsPanel.appendChild(E('h4', { style: 'margin: 0 0 8px 0; font-size: 0.85em; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px;' }, 'Ping Targets'));
        var targetList = E('div', { style: 'display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;' });
        var renderTargetList = function() {
            targetList.innerHTML = '';
            if (self.pingTargets.length === 0) {
                targetList.appendChild(E('span', { style: 'font-size: 0.85em; opacity: 0.55;' }, 'No extra targets. Defaults (always pinged): dns.google, one.one.one.one, google.com, youtube.com — all v4+v6'));
                return;
            }
            self.pingTargets.forEach(function(t, i) {
                var famLbl = String(t.fam) === 'both' ? 'IPv4+IPv6' : 'IPv' + t.fam;
                targetList.appendChild(E('span', { style: 'display: inline-flex; align-items: center; gap: 6px; font-size: 0.85em; padding: 3px 8px; border-radius: 4px; border: 1px solid var(--border-color, rgba(128,128,128,0.3)); background: rgba(128,128,128,0.08);' }, [
                    E('span', {}, t.host + ' (' + famLbl + ')'),
                    E('a', {
                        style: 'cursor: pointer; color: #ff5252; font-weight: bold; text-decoration: none;',
                        click: function() {
                            self.pingTargets.splice(i, 1);
                            saveConfig();
                            self.pingHist = {};
                            renderTargetList();
                        }
                    }, '\u00d7')
                ]));
            });
        };
        renderTargetList();
        settingsPanel.appendChild(targetList);
        var tgtInput = E('input', { type: 'text', class: 'cbi-input-text', placeholder: 'host or IP (e.g. quad9.net)', style: 'width: 220px; max-width: 60%;' });
        var tgtFam = E('select', { class: 'cbi-input-select' }, [
            E('option', { value: '4' }, 'IPv4'),
            E('option', { value: '6' }, 'IPv6'),
            E('option', { value: 'both' }, 'IPv4 + IPv6')
        ]);
        var addTarget = function() {
            var h = tgtInput.value.trim();
            if (!h || !/^[A-Za-z0-9.:-]+$/.test(h)) { tgtInput.style.borderColor = '#ff5252'; return; }
            // reject duplicates against defaults AND existing custom targets
            var existing = {};
            DEFAULT_PING_TARGETS.concat(self.pingTargets).forEach(function(t) {
                expandFams(t).forEach(function(fam) { existing[t.host + '|' + fam] = true; });
            });
            var want = tgtFam.value === 'both' ? [4, 6] : [parseInt(tgtFam.value)];
            var missing = want.filter(function(fam) { return !existing[h + '|' + fam]; });
            if (missing.length === 0) { tgtInput.style.borderColor = '#ff5252'; return; }
            tgtInput.style.borderColor = '';
            self.pingTargets.push({ host: h, fam: missing.length === 2 ? 'both' : missing[0] });
            saveConfig();
            self.pingHist = {};
            tgtInput.value = '';
            renderTargetList();
        };
        settingsPanel.appendChild(E('div', { style: 'display: flex; flex-wrap: wrap; gap: 8px; align-items: center;' }, [
            tgtInput, tgtFam,
            E('button', { class: 'cbi-button cbi-button-add', click: addTarget }, 'Add'),
            E('button', {
                class: 'cbi-button cbi-button-reset',
                click: function() {
                    self.pingTargets = [];
                    saveConfig();
                    self.pingHist = {};
                    renderTargetList();
                }
            }, 'Reset to defaults')
        ]));
        settingsPanel.appendChild(E('div', { style: 'margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-color, rgba(128,128,128,0.2));' }, [
            E('button', {
                class: 'cbi-button cbi-button-action',
                click: function() {
                    // Full info payload as a downloadable file — handy for bug
                    // reports and before/after firmware comparisons.
                    if (!self.lastInfo) return;
                    var host = (self.lastInfo.sys_info && self.lastInfo.sys_info.hostname) || 'router';
                    var blob = new Blob([JSON.stringify(self.lastInfo, null, 2)], { type: 'application/json' });
                    var a = E('a', {
                        href: URL.createObjectURL(blob),
                        download: 'hwdash-' + host + '-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json'
                    });
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(a.href);
                }
            }, '\u2913 Download diagnostics snapshot'),
            E('span', { style: 'font-size: 0.78em; opacity: 0.5; margin-left: 10px;' }, 'Saves the latest full hardware readout as JSON')
        ]));

        var settingsBtn = E('button', {
            class: 'cbi-button',
            style: 'padding: 4px 14px;',
            click: function() {
                settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
            }
        }, '\u2699 Settings');
        var settingsRow = E('div', { style: 'width: 100%; display: flex; justify-content: flex-end;' }, [settingsBtn]);
        container.insertBefore(settingsPanel, sysCard);
        container.insertBefore(settingsRow, settingsPanel);
        applyCardVisibility();

        var pingTick = function() {
            // Same hidden-tab rule as the main poll: no pings for a dashboard
            // nobody is looking at. History simply resumes on return.
            if (document.hidden) return Promise.resolve();
            // Never let requests pile up on a slow device: skip the tick if
            // the previous one is still in flight.
            if (self.pingBusy) return Promise.resolve();
            self.pingBusy = true;
            return callHwPing(pingTargetPairs()).then(function(res) {
                if (!res || !res.targets || res.targets.length === 0) return;
                if (!self.pingHist) self.pingHist = {};
                var hist = self.pingHist;
                res.targets.forEach(function(t, i) {
                    var key = t.host + '/v' + t.fam;
                    if (!hist[key]) {
                        var isGw = (res.gateway && t.host === res.gateway) ? 4 : (res.gateway6 && t.host === res.gateway6) ? 6 : 0;
                        hist[key] = {
                            label: isGw ? 'Gateway v' + isGw : t.host + ' (v' + t.fam + ')',
                            gw: isGw,
                            host: t.host,
                            fam: t.fam,
                            color: PING_COLORS[Object.keys(hist).length % PING_COLORS.length],
                            hidden: false,
                            data: [],
                            agg: [],
                            acc: { sum: 0, n: 0, loss: 0, cnt: 0 }
                        };
                    }
                    var h = hist[key];
                    if (t.ip) h.ip = t.ip;
                    if (t.rdns) h.rdns = t.rdns;
                    var v = typeof t.ms === 'number' ? t.ms : null;
                    h.data.push(v);
                    if (h.data.length > PING_WINDOW) h.data.shift();
                    // 10s aggregation buckets feed the 15m/1h/3h views
                    h.acc.cnt++;
                    if (v === null) h.acc.loss++;
                    else { h.acc.sum += v; h.acc.n++; }
                    if (h.acc.cnt >= 10) {
                        h.agg.push({ a: h.acc.n > 0 ? h.acc.sum / h.acc.n : null, n: h.acc.n, loss: h.acc.loss });
                        if (h.agg.length > PING_AGG_KEEP) h.agg.shift();
                        h.acc = { sum: 0, n: 0, loss: 0, cnt: 0 };
                    }
                });
                // No global v6 gateway on this link: keep an explicit N/A row
                // so it's visible that detection ran and found nothing global.
                if (!res.gateway6) {
                    var gk6 = '__gw6na';
                    if (!hist[gk6]) {
                        hist[gk6] = {
                            label: 'Gateway v6', gw: 6, na: true, host: '', fam: 6,
                            color: '#9e9e9e', hidden: false,
                            data: [], agg: [], acc: { sum: 0, n: 0, loss: 0, cnt: 0 }
                        };
                    }
                    var g6 = hist[gk6];
                    g6.data.push(null);
                    if (g6.data.length > PING_WINDOW) g6.data.shift();
                } else if (hist['__gw6na']) {
                    delete hist['__gw6na'];
                }
                var pgNode = document.getElementById('hw-ping');
                if (pgNode) {
                    // Persistent skeleton, created once: graph panel, stats
                    // table, bufferbloat chip. Ticks only update data in place.
                    if (!self.pingPanel) {
                        self.pingPanel = createGraphPanel({
                            views: PING_VIEWS,
                            defaultView: '2m',
                            unit: ' ms',
                            csvName: 'ping',
                            height: 250,
                            spikeNulls: true,
                            lossTicks: true,
                            autoRange: false,
                            yFloor: 20,
                            legend: true,
                            legendValue: function(t) {
                                var last = t.data.length ? t.data[t.data.length - 1] : null;
                                var okCnt = 0;
                                t.data.forEach(function(v) { if (v !== null) okCnt++; });
                                var dead = okCnt === 0 && t.data.length >= 3;
                                return {
                                    text: dead ? 'N/A' : (last === null ? 'timeout' : last.toFixed(1) + ' ms'),
                                    color: dead ? '#9e9e9e' : (last === null ? '#ff5252' : t.color),
                                    dotColor: dead ? '#9e9e9e' : t.color,
                                    dim: dead
                                };
                            }
                        });
                        pgNode.innerHTML = '';
                        pgNode.appendChild(self.pingPanel.el);
                        var tblWrap = E('div', { style: 'overflow-x: auto; margin-top: 10px;' });
                        var thStyle = 'text-align: right; padding: 3px 8px; opacity: 0.55; font-weight: 600; border-bottom: 1px solid var(--border-color, rgba(128,128,128,0.2));';
                        var divS = 'border-left: 1px solid var(--border-color, rgba(128,128,128,0.3));';
                        var tbl = E('table', { style: 'width: 100%; min-width: 620px; border-collapse: collapse; font-size: 0.78em; table-layout: fixed;' });
                        tbl.appendChild(E('tr', {}, [
                            E('th', { style: thStyle + 'text-align: left; width: 8%;' }, 'Protocol'),
                            E('th', { style: thStyle + 'text-align: left; width: 15%;' + divS }, 'Target'),
                            E('th', { style: thStyle + 'text-align: left; width: 16%;' + divS }, 'IP Address'),
                            E('th', { style: thStyle }, 'cur'), E('th', { style: thStyle }, 'min'),
                            E('th', { style: thStyle }, 'avg'), E('th', { style: thStyle }, 'p95'),
                            E('th', { style: thStyle }, 'max'), E('th', { style: thStyle }, 'jitter'),
                            E('th', { style: thStyle }, 'loss')
                        ]));
                        tblWrap.appendChild(tbl);
                        pgNode.appendChild(tblWrap);
                        self.pingTable = { tbl: tbl, rows: {}, sig: '', divS: divS };
                    }
                    self.pingPanel.update(hist);
                    // stats table — persistent rows keyed by target, cells
                    // updated in place
                    var pt = self.pingTable;
                    var keys = Object.keys(hist);
                    var sig = keys.join('|');
                    if (pt.sig !== sig) {
                        pt.sig = sig;
                        for (var rk in pt.rows) pt.rows[rk].tr.remove();
                        pt.rows = {};
                        keys.forEach(function(k) {
                            var t = hist[k];
                            var tdS = 'text-align: right; padding: 3px 8px; opacity: 0.85;';
                            var ellip = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 0;';
                            var cells = {
                                target: E('td', { style: 'padding: 3px 8px; color: ' + t.color + '; ' + ellip + pt.divS }),
                                ip: E('td', { style: 'padding: 3px 8px; opacity: 0.65; font-family: monospace; font-size: 0.95em; ' + ellip + pt.divS }),
                                cur: E('td', { style: tdS }), min: E('td', { style: tdS }),
                                avg: E('td', { style: tdS }), p95: E('td', { style: tdS }),
                                max: E('td', { style: tdS }), jit: E('td', { style: tdS }),
                                loss: E('td', { style: tdS })
                            };
                            var tr = E('tr', {}, [
                                E('td', { style: 'padding: 3px 8px; color: ' + t.color + '; white-space: nowrap;' }, 'IPv' + (t.fam || (k.indexOf('/v6') !== -1 ? 6 : 4))),
                                cells.target, cells.ip, cells.cur, cells.min, cells.avg, cells.p95, cells.max, cells.jit, cells.loss
                            ]);
                            pt.tbl.appendChild(tr);
                            pt.rows[k] = { tr: tr, cells: cells };
                        });
                    }
                    var curSeries = self.pingPanel.currentSeries() || {};
                    keys.forEach(function(k) {
                        var t = hist[k];
                        var row = pt.rows[k];
                        if (!row) return;
                        row.tr.style.opacity = t.hidden ? '0.35' : '';
                        var sr = curSeries[k] || [];
                        var vals = [], lostSamples = 0, totSamples = 0;
                        sr.forEach(function(p) { if (p.v !== null) vals.push(p.v); lostSamples += p.lostN; totSamples += p.cnt; });
                        vals.sort(function(a, b) { return a - b; });
                        var sum = 0;
                        vals.forEach(function(v) { sum += v; });
                        var jit = null, jn = 0, prevV = null;
                        t.data.forEach(function(v) {
                            if (v !== null && prevV !== null) { jit = (jit || 0) + Math.abs(v - prevV); jn++; }
                            if (v !== null) prevV = v;
                        });
                        var last = t.data.length ? t.data[t.data.length - 1] : null;
                        var fmt = function(v) { return v === null || v === undefined ? '—' : v.toFixed(1); };
                        var lossPct = totSamples > 0 ? Math.round(lostSamples / totSamples * 1000) / 10 : 0;
                        // Target column: domains stay as-is, IP-literal targets show
                        // their reverse-DNS name (or —); IP column always shows the
                        // address actually being probed.
                        if (t.na) {
                            row.cells.target.textContent = 'Gateway';
                            row.cells.ip.textContent = 'N/A';
                            ['cur', 'min', 'avg', 'p95', 'max', 'jit', 'loss'].forEach(function(c) { row.cells[c].textContent = '—'; });
                            row.cells.loss.style.color = '';
                            return;
                        }
                        var isIpLit = /^[0-9.]+$/.test(t.host) || t.host.indexOf(':') !== -1;
                        var tgtTxt = t.gw ? 'Gateway' + (t.rdns ? ' (' + t.rdns + ')' : '') : (isIpLit ? (t.rdns || '—') : t.host);
                        row.cells.target.textContent = tgtTxt;
                        row.cells.target.title = tgtTxt;
                        var ipTxt = isIpLit ? t.host : (t.ip || '—');
                        row.cells.ip.textContent = ipTxt;
                        row.cells.ip.title = ipTxt;
                        row.cells.cur.textContent = last === null ? 'TO' : fmt(last);
                        row.cells.min.textContent = fmt(vals.length ? vals[0] : null);
                        row.cells.avg.textContent = fmt(vals.length ? sum / vals.length : null);
                        row.cells.p95.textContent = fmt(pingPct(vals, 0.95));
                        row.cells.max.textContent = fmt(vals.length ? vals[vals.length - 1] : null);
                        row.cells.jit.textContent = jn > 0 ? (jit / jn).toFixed(1) : '—';
                        row.cells.loss.textContent = lossPct + '%';
                        row.cells.loss.style.color = lossPct > 0 ? '#ff5252' : '';
                    });
                    pingCard.style.display = 'flex';
                }
                applyCardVisibility();
            }).catch(function() {}).then(function() { self.pingBusy = false; });
        };
        poll.add(pingTick, 1);

        var infoTick = function() {
            // Skip the RPC entirely while the tab is hidden — the router does
            // no collection work for dashboards nobody is looking at.
            if (document.hidden) return Promise.resolve();
            if (self.infoBusy) return Promise.resolve();
            self.infoBusy = true;
            return callHwInfo().then(function(res) {
                if (!res || !res.cpus) return;
                self.lastInfo = res;
                var coresNode = document.getElementById('hw-cores');
                // Per-core rows are fixed-shape: build once, update text/width
                // in place on subsequent polls instead of rebuilding the DOM
                // subtree every 3 seconds. Rebuilt only if the core count changes.
                var nCores = res.cpus.length - 1;
                if (!self._coreEls || self._coreCount !== nCores) {
                    coresNode.innerHTML = '';
                    self._coreEls = {};
                    self._coreCount = nCores;
                }
                var advStats = null;
                res.cpus.forEach(function(cpuLine) {
                    var stat = parseCpu(cpuLine);
                    if (self.prevCpu[stat.name]) {
                        var prev = self.prevCpu[stat.name];
                        var totalDiff = stat.total - prev.total;
                        var idleDiff = stat.idleAll - prev.idleAll;
                        var pct = 0;
                        if (totalDiff > 0) {
                            pct = 100 * (totalDiff - idleDiff) / totalDiff;
                        }
                        pct = Math.max(0, Math.min(100, pct));
                        if (stat.name === 'cpu') {
                            var pctRound = Math.round(pct);
                            if (!self.cpuHist) self.cpuHist = [];
                            self.cpuHist.push(pct);
                            if (self.cpuHist.length > 60) self.cpuHist.shift();
                            drawUsageSpark(document.getElementById('hw-cpu-spark'), self.cpuHist, '#00bcd4');
                            updateDial('cpu', pctRound, cpuCard.circ);
                            document.getElementById('dial-sub-cpu').textContent = (res.cpus.length - 1) + ' Cores';
                            var calcPct = function(key) {
                                return totalDiff > 0 ? ((stat[key] - prev[key]) / totalDiff) * 100 : 0;
                            };
                            advStats = {
                                Idle: calcPct('idle'),
                                User: calcPct('user'),
                                Nice: calcPct('nice'),
                                System: calcPct('sys'),
                                'I/O Wait': calcPct('iowait'),
                                IRQ: calcPct('irq'),
                                'Soft IRQ': calcPct('softirq')
                            };
                            var cpuStats = document.getElementById('stats-cpu');
                            cpuStats.innerHTML = '';
                            var meta = res.cpu_meta || {};
                            var addMeta = function(label, val) {
                                cpuStats.appendChild(E('div', {
                                    class: 'hw-stat-row',
                                    style: 'margin-bottom: 2px;'
                                }, [E('span', {
                                    class: 'hw-stat-label'
                                }, label), E('span', {
                                    class: 'hw-stat-value'
                                }, val)]));
                            };
                            var _cores = meta.cores || (res.cpus.length - 1);
                            var _threads = meta.threads || _cores;
                            addMeta('Cores / Threads', _cores + 'C / ' + _threads + 'T');
                            var _si = res.sys_info || {};
                            var _cacheParts = [];
                            if (_si.l0 > 0) _cacheParts.push('L0 ' + fmtCacheBytes(_si.l0));
                            var _l1 = (_si.l1d || 0) + (_si.l1i || 0);
                            if (_l1 > 0) _cacheParts.push('L1 ' + fmtCacheBytes(_l1));
                            if (_si.l2 > 0) _cacheParts.push('L2 ' + fmtCacheBytes(_si.l2));
                            if (_si.l3 > 0) _cacheParts.push('L3 ' + fmtCacheBytes(_si.l3));
                            if (_si.l4 > 0) _cacheParts.push('L4 ' + fmtCacheBytes(_si.l4));
                            addMeta('Cache', _cacheParts.length > 0 ? _cacheParts.join(' + ') : '0 MB');
                            var curFreq = '';
                            if (res.freqs && res.freqs.length > 0) {
                                var validFreqs = res.freqs.filter(function(f) {
                                    return f !== null;
                                });
                                if (validFreqs.length > 0) {
                                    var maxC = Math.max.apply(null, validFreqs);
                                    if (maxC > 1000000) curFreq = (maxC / 1000000).toFixed(2) + ' GHz';
                                    else if (maxC > 1000) curFreq = (maxC / 1000).toFixed(0) + ' MHz';
                                    else curFreq = maxC + ' MHz';
                                }
                            }
                            var maxFreqStr = '';
                            if (meta.max_freq && meta.max_freq > 0) {
                                if (meta.max_freq > 1000000) maxFreqStr = (meta.max_freq / 1000000).toFixed(2) + ' GHz';
                                else maxFreqStr = (meta.max_freq / 1000).toFixed(0) + ' MHz';
                            }
                            if (curFreq) addMeta('Current Freq', curFreq);
                            if (maxFreqStr) addMeta('Max Freq', maxFreqStr);
                            if (meta.tasks) addMeta('Tasks (Run/Total)', meta.tasks);
                            var uptimeStr = '';
                            if (res.uptime) {
                                var days = Math.floor(res.uptime / 86400);
                                var hours = Math.floor((res.uptime % 86400) / 3600);
                                var mins = Math.floor((res.uptime % 3600) / 60);
                                if (days > 0) uptimeStr += days + 'd ';
                                if (hours > 0 || days > 0) uptimeStr += hours + 'h ';
                                uptimeStr += mins + 'm';
                            }
                            var metaNode = document.getElementById('hw-cpu-meta');
                            if (metaNode) {
                                metaNode.innerHTML = '';
                                metaNode.appendChild(E('div', {
                                    class: 'hw-stat-row'
                                }, [E('span', {
                                    class: 'hw-stat-label'
                                }, 'Load Average'), E('span', {
                                    class: 'hw-stat-value'
                                }, (res.cpu_meta.load_1 || '0') + ', ' + (res.cpu_meta.load_5 || '0') + ', ' + (res.cpu_meta.load_15 || '0'))]));
                                if (res.cpu_meta.governor && res.cpu_meta.governor.trim() !== '' && res.cpu_meta.governor !== 'null' && res.cpu_meta.governor.toLowerCase() !== 'unknown') {
                                    metaNode.appendChild(E('div', {
                                        class: 'hw-stat-row'
                                    }, [E('span', {
                                        class: 'hw-stat-label'
                                    }, 'CPU Governor'), E('span', {
                                        class: 'hw-stat-value',
                                        style: 'text-transform: uppercase;'
                                    }, res.cpu_meta.governor)]));
                                }
                                metaNode.appendChild(E('div', {
                                    class: 'hw-stat-row'
                                }, [E('span', {
                                    class: 'hw-stat-label'
                                }, 'Uptime'), E('span', {
                                    class: 'hw-stat-value'
                                }, uptimeStr)]));
                                var psi = res.cpu_meta && res.cpu_meta.psi;
                                if (psi) {
                                    metaNode.appendChild(E('div', {
                                        class: 'hw-stat-row'
                                    }, [E('span', {
                                        class: 'hw-stat-label'
                                    }, 'Pressure (CPU / IO, 10s)'), E('span', {
                                        class: 'hw-stat-value',
                                        style: (psi.cpu >= 20 || psi.io >= 20) ? 'color:#ffb300;' : ''
                                    }, psi.cpu.toFixed(1) + '% / ' + psi.io.toFixed(1) + '%')]));
                                }
                            }
                        } else {
                            var coreIdx = parseInt(stat.name.replace('cpu', ''));
                            var freqStr = '';
                            if (res.freqs && res.freqs[coreIdx] && res.freqs[coreIdx] !== null) {
                                var mhz = Math.round(res.freqs[coreIdx] / 1000);
                                freqStr = mhz + ' MHz | ';
                            }
                            var coreName = stat.name.toUpperCase().replace('CPU', 'CORE ');
                            var colorCore = getDynColor(pct);
                            var ce = self._coreEls[coreIdx];
                            if (!ce) {
                                var ceVal = E('span', { class: 'hw-stat-value' });
                                var ceFill = E('div', { class: 'hw-bar-fill' });
                                coresNode.appendChild(E('div', {
                                    class: 'hw-progress-item'
                                }, [E('div', {
                                    class: 'hw-progress-header'
                                }, [E('span', {
                                    class: 'hw-stat-label'
                                }, coreName), ceVal]), E('div', {
                                    class: 'hw-bar-bg'
                                }, [ceFill])]));
                                ce = self._coreEls[coreIdx] = { val: ceVal, fill: ceFill };
                            }
                            ce.val.textContent = freqStr + pct.toFixed(2) + '%';
                            ce.val.style.color = colorCore;
                            ce.fill.style.width = pct + '%';
                            ce.fill.style.background = colorCore;
                        }
                    }
                    self.prevCpu[stat.name] = stat;
                });
                if (advStats) {
                    var advNode = document.getElementById('hw-adv');
                    if (advNode) {
                        advNode.innerHTML = '';
                        var addAdvBar = function(label, val) {
                            var colorAdv = getDynColor(val, label === 'Idle');
                            advNode.appendChild(E('div', {
                                class: 'hw-progress-item'
                            }, [E('div', {
                                class: 'hw-progress-header'
                            }, [E('span', {
                                class: 'hw-stat-label'
                            }, label), E('span', {
                                class: 'hw-stat-value',
                                style: 'color: ' + colorAdv + ';'
                            }, val.toFixed(1) + '%')]), E('div', {
                                class: 'hw-bar-bg'
                            }, [E('div', {
                                class: 'hw-bar-fill',
                                style: 'width: ' + val + '%; background: ' + colorAdv + ';'
                            })])]));
                        };
                        for (var key in advStats) {
                            addAdvBar(key, advStats[key]);
                        }
                        var addAdvRowText = function(label, val, color) {
                            advNode.appendChild(E('div', {
                                class: 'hw-progress-item',
                                style: 'margin-top: 5px;'
                            }, [E('div', {
                                class: 'hw-progress-header'
                            }, [E('span', {
                                class: 'hw-stat-label',
                                style: 'font-size: 0.9em;'
                            }, label), E('span', {
                                class: 'hw-stat-value',
                                style: (color ? 'color: ' + color + '; font-size: 0.9em;' : 'font-size: 0.9em;')
                            }, val)])]));
                        };

                        if (res.cpu_meta && res.cpu_meta.tasks) {
                            addAdvRowText('System Tasks', res.cpu_meta.tasks, null);
                            var ctxt = res.cpu_meta.ctxt || 0;
                            var intr = res.cpu_meta.intr || 0;
                            if (self.prevCtxt !== undefined) {
                                var ctxtRate = ctxt - self.prevCtxt;
                                var intrRate = intr - self.prevIntr;
                                addAdvRowText('Context Switches / s', ctxtRate + ' /s', null);
                                addAdvRowText('Hardware Interrupts / s', intrRate + ' /s', null);
                            }
                            self.prevCtxt = ctxt;
                            self.prevIntr = intr;
                            var connCount = res.cpu_meta.conntrack || 0;
                            var connMax = res.cpu_meta.conntrack_max || 1;
                            var connPct = Math.min((connCount / connMax) * 100, 100);
                            var colorConn = getDynColor(connPct, false);
                            advNode.appendChild(E('div', {
                                class: 'hw-progress-item',
                                style: 'margin-top: 10px;'
                            }, [E('div', {
                                class: 'hw-progress-header'
                            }, [E('span', {
                                class: 'hw-stat-label'
                            }, 'Active Connections'), E('span', {
                                class: 'hw-stat-value',
                                style: 'color: ' + colorConn + ';'
                            }, connCount + ' / ' + connMax)]), E('div', {
                                class: 'hw-bar-bg'
                            }, [E('div', {
                                class: 'hw-bar-fill',
                                style: 'width: ' + connPct + '%; background: ' + colorConn + ';'
                            })])]));
                        }
                        // Cumulative frequency residency (time in each OPP since
                        // boot) — shows whether the CPU ever leaves its min/max
                        // state. Hidden when the kernel doesn't expose the stats
                        // or the policy has a single OPP.
                        if (res.freq_stats && res.freq_stats.length > 1) {
                            var fsTotal = 0;
                            res.freq_stats.forEach(function(p) { fsTotal += p[1]; });
                            if (fsTotal > 0) {
                                advNode.appendChild(E('div', { style: 'font-size: 0.8em; opacity: 0.6; text-transform: uppercase; letter-spacing: 1px; margin-top: 12px; margin-bottom: 6px;' }, 'Freq Residency (since boot)'));
                                var fsList = res.freq_stats;
                                if (fsList.length > 10) {
                                    fsList = fsList.slice().sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10)
                                        .sort(function(a, b) { return a[0] - b[0]; });
                                }
                                fsList.forEach(function(p) {
                                    var pctF = p[1] / fsTotal * 100;
                                    var fLbl = p[0] >= 1000000 ? (p[0] / 1000000).toFixed(2) + ' GHz' : Math.round(p[0] / 1000) + ' MHz';
                                    advNode.appendChild(E('div', { class: 'hw-progress-item', style: 'margin-bottom: 6px;' }, [
                                        E('div', { class: 'hw-progress-header' }, [
                                            E('span', { class: 'hw-stat-label', style: 'font-size: 0.9em;' }, fLbl),
                                            E('span', { class: 'hw-stat-value', style: 'font-size: 0.9em;' }, pctF.toFixed(1) + '%')
                                        ]),
                                        E('div', { class: 'hw-bar-bg', style: 'height: 4px;' }, [
                                            E('div', { class: 'hw-bar-fill', style: 'width: ' + pctF + '%; background: #00bcd4;' })
                                        ])
                                    ]));
                                });
                            }
                        }
                    }
                }
                var mem = res.mem;
                if (mem && mem.total > 0) {
                    var used = mem.total - mem.avail;
                    var pct = Math.round((used / mem.total) * 100);
                    updateDial('ram', pct, ramCard.circ);
                    document.getElementById('dial-sub-ram').textContent = (used / 1024).toFixed(0) + ' MB';
                    var _dtMb = res.sys_info && res.sys_info.mem_phys_mb;
                    var physRamKB = (_dtMb > 0) ? _dtMb * 1024 : getPhysicalRamTotal(mem.total);
                    var ramStats = document.getElementById('stats-ram');
                    ramStats.innerHTML = '';
                    ramStats.appendChild(E('div', {
                        class: 'hw-stat-row',
                        style: 'margin-bottom: 5px;'
                    }, [E('span', {
                        class: 'hw-stat-label'
                    }, 'Physical Total'), E('span', {
                        class: 'hw-stat-value'
                    }, (physRamKB / 1024).toFixed(0) + ' MB')]));
                    ramStats.appendChild(E('div', {
                        class: 'hw-stat-row',
                        style: 'margin-bottom: 15px;'
                    }, [E('span', {
                        class: 'hw-stat-label'
                    }, 'Usable Total'), E('span', {
                        class: 'hw-stat-value'
                    }, (mem.total / 1024).toFixed(0) + ' MB')]));
                    ramStats.appendChild(makeMemBar('Used', used / 1024, mem.total / 1024));
                    ramStats.appendChild(makeMemBar('Free', mem.free / 1024, mem.total / 1024));
                    ramStats.appendChild(makeMemBar('Cached', mem.cached / 1024, mem.total / 1024));
                    ramStats.appendChild(makeMemBar('Buffers', mem.buffers / 1024, mem.total / 1024));
                    if (mem.swap_total > 0) {
                        var swapUsed = mem.swap_total - mem.swap_free;
                        ramStats.appendChild(makeMemBar('Swap', swapUsed / 1024, mem.swap_total / 1024));
                    }
                    if (mem.zram_total > 0) {
                        ramStats.appendChild(makeMemBar('ZRAM', mem.zram_used / 1024, mem.zram_total / 1024));
                    }
                    if (mem.zram_total > 0) {
                        var ratio = mem.zram_used > 0 ? (mem.zram_orig / mem.zram_used).toFixed(2) : 1.0;
                        ramStats.appendChild(E('div', {style: 'text-align: center; font-size: 0.8em; opacity: 0.8; margin-top: -10px; margin-bottom: 10px;'}, 'Compression: ' + ratio + 'x'));
                    }
                    if (mem.slab > 0) {
                        ramStats.appendChild(makeMemBar('Slab Kernel', mem.slab / 1024, mem.total / 1024));
                    }
                    if (mem.pagetables > 0) {
                        ramStats.appendChild(makeMemBar('PageTables', mem.pagetables / 1024, mem.total / 1024));
                    }
                    if (mem.dirty > 0 || mem.writeback > 0) {
                        ramStats.appendChild(E('div', { class: 'hw-stat-row' }, [
                            E('span', { class: 'hw-stat-label' }, 'Dirty / Writeback'),
                            E('span', { class: 'hw-stat-value', style: mem.writeback > 1024 ? 'color:#ffb300;' : '' },
                                (mem.dirty / 1024).toFixed(1) + ' MB / ' + (mem.writeback / 1024).toFixed(1) + ' MB')
                        ]));
                    }
                    var memPsi = res.cpu_meta && res.cpu_meta.psi;
                    if (memPsi && (memPsi.mem > 0 || memPsi.mem_full > 0)) {
                        ramStats.appendChild(E('div', { class: 'hw-stat-row' }, [
                            E('span', { class: 'hw-stat-label' }, 'Memory Pressure (10s)'),
                            E('span', { class: 'hw-stat-value', style: memPsi.mem_full >= 5 ? 'color:#ff5252;' : memPsi.mem >= 10 ? 'color:#ffb300;' : '' },
                                memPsi.mem.toFixed(1) + '%' + (memPsi.mem_full > 0 ? ' (full ' + memPsi.mem_full.toFixed(1) + '%)' : ''))
                        ]));
                    }
                    if (!self.memHist) self.memHist = [];
                    self.memHist.push(pct);
                    if (self.memHist.length > 60) self.memHist.shift();
                    drawUsageSpark(document.getElementById('hw-mem-spark'), self.memHist, '#b388ff');
                }
                if (res.df && Array.isArray(res.df)) {
                    var totalSpace = 0;
                    var totalUsed = 0;
                    var totalPhys = 0;
                    var nandChipTotal = (res.mtd_count > 0 && res.mtd_phys) ? Math.round(res.mtd_phys / 1024) : 0;
                    var nandRootfsVol = 0;
                    var emmcTotal = 0;
                    var diskTotal = 0;
                    var diskRootfsVol = 0;
                    var _seenDiskDev = {};
                    var dskNode = document.getElementById('stats-dsk');
                    if (dskNode) dskNode.innerHTML = '';
                    res.df.forEach(function(fs) {
                        var isExt = (fs.hw_type === 'USB');
                        if (fs.total > 0 && !isExt) {
                            totalSpace += fs.total;
                            totalUsed += fs.used;
                        }
                        if (fs.hw_size > 0 && !isExt) totalPhys += fs.hw_size;
                        if (fs.hw_type === 'NAND' && !isExt && fs.mount === '/' && fs.hw_size > 0) {
                            nandRootfsVol = fs.hw_size;
                        }
                        if (!isExt) {
                            if (fs.hw_type === 'eMMC' || fs.hw_type === 'MMC' || fs.hw_type === 'SD') {
                                if (fs.hw_size > emmcTotal) emmcTotal = fs.hw_size;
                            } else if (fs.hw_type === 'HDD' || fs.hw_type === 'SSD' || fs.hw_type === 'NVMe') {
                                if (!_seenDiskDev[fs.dev]) { diskTotal += fs.hw_size; _seenDiskDev[fs.dev] = true; }
                                if (fs.mount === '/' && fs.total > 0) diskRootfsVol = fs.total;
                            }
                        }
                        if (isExt) return;
                        var readSpeed = 0;
                        var writeSpeed = 0;
                        var rIops = 0;
                        var wIops = 0;
                        if (fs.mount === '/') {
                            var intRead = 0,
                                intWrite = 0,
                                intR_io = 0,
                                intW_io = 0;
                            for (var k in res.diskstats) {
                                if (!k.match(/^(loop|ram|sda|sdb|sdc)/)) {
                                    var stat = res.diskstats[k];
                                    if (self.prevDisk[k]) {
                                        var prev = self.prevDisk[k];
                                        intRead += (stat.r - prev.r) * 512;
                                        intWrite += (stat.w - prev.w) * 512;
                                        intR_io += (stat.r_io - prev.r_io);
                                        intW_io += (stat.w_io - prev.w_io);
                                    }
                                    self.prevDisk[k] = stat;
                                }
                            }
                            readSpeed = intRead;
                            writeSpeed = intWrite;
                            rIops = intR_io;
                            wIops = intW_io;
                        } else if (res.diskstats && res.diskstats[fs.dev]) {
                            var stat = res.diskstats[fs.dev];
                            if (self.prevDisk[fs.dev]) {
                                var prev = self.prevDisk[fs.dev];
                                readSpeed = (stat.r - prev.r) * 512;
                                writeSpeed = (stat.w - prev.w) * 512;
                                rIops = (stat.r_io - prev.r_io);
                                wIops = (stat.w_io - prev.w_io);
                            }
                            self.prevDisk[fs.dev] = stat;
                        }
                        var usedPctStr = fs.pct;
                        var pctNum = parseInt(usedPctStr) || 0;
                        var colorDsk = getDynColor(pctNum);
                        var labelStr = fs.mount === '/' ? 'Root FS' : fs.mount.replace(/^\/mnt\//, '');
                        var typeStr = fs.hw_type ? '[' + fs.hw_type + (fs.hw_model ? ' - ' + fs.hw_model : '') + ']' : '';
                        var inodesInfo = res.inodes ? res.inodes[fs.mount] : null;
                        if (dskNode) {
                            var _isNand = fs.hw_type === 'NAND';
                            var speedStr = _isNand ? fmtKb(fs.used) + ' / ' + fmtKb(fs.total) : 'R: ' + fmtSpeedDf(readSpeed) + ' | W: ' + fmtSpeedDf(writeSpeed);
                            var iopsStr = _isNand ? (fs.total > 0 ? ((fs.used/fs.total)*100).toFixed(1)+'% filesystem used' : '') : '(' + rIops + 'R / ' + wIops + 'W) IOPS';
                            var bars = [E('div', {
                                class: 'hw-progress-header'
                            }, [E('span', {
                                style: 'display: flex; opacity: 0.8; font-size: 0.95em; flex-shrink: 1; min-width: 0; margin-right: 5px;'
                            }, [E('span', {
                                style: 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
                            }, labelStr), E('span', {
                                style: 'opacity: 0.6; margin-left: 5px; flex-shrink: 0;'
                            }, typeStr)]), E('span', {
                                class: 'hw-stat-value',
                                style: 'color: ' + colorDsk + '; flex-shrink: 0;'
                            }, speedStr)]), E('div', {
                                class: 'hw-bar-bg'
                            }, [E('div', {
                                class: 'hw-bar-fill',
                                style: 'width: ' + pctNum + '%; background: ' + colorDsk + ';'
                            })]), E('div', {
                                style: 'width: 100%; display: flex; justify-content: space-between; margin-top: 5px; font-size: 0.9em; opacity: 0.8;'
                            }, [E('span', {}, iopsStr), E('span', {
                                class: 'hw-stat-value'
                            }, usedPctStr)])];
                            if (inodesInfo && inodesInfo.ipct !== '-') {
                                var ipctNum = parseInt(inodesInfo.ipct) || 0;
                                var icolor = getDynColor(ipctNum);
                                bars.push(E('div', {
                                    class: 'hw-progress-header',
                                    style: 'margin-top: 6px;'
                                }, [E('span', {
                                    class: 'hw-stat-label',
                                    style: 'font-size: 0.8em; opacity: 0.7;'
                                }, 'Inodes Used'), E('span', {
                                    class: 'hw-stat-value',
                                    style: 'font-size: 0.8em; color: ' + icolor + ';'
                                }, inodesInfo.ipct)]), E('div', {
                                    class: 'hw-bar-bg',
                                    style: 'height: 4px;'
                                }, [E('div', {
                                    class: 'hw-bar-fill',
                                    style: 'width: ' + ipctNum + '%; background: ' + icolor + ';'
                                })]));
                            }
                            dskNode.appendChild(E('div', {
                                class: 'hw-progress-item',
                                style: 'margin-bottom: 15px;'
                            }, bars));
                        }
                    });
                    var _ovSi = res.sys_info || {};
                    var dskMeta = document.getElementById('dial-meta-dsk');
                    if (dskMeta) {
                        var addMR = function(lbl, val, color) {
                            dskMeta.appendChild(E('div', {class: 'hw-stat-row'}, [
                                E('span', {class: 'hw-stat-label'}, lbl),
                                E('span', {class: 'hw-stat-value', style: color ? 'color:' + color + ';' : ''}, val)
                            ]));
                        };
                        dskMeta.innerHTML = '';
                        if (nandChipTotal > 0) {
                            addMR('Physical NAND Total', fmtSize(nandChipTotal));
                            if (nandRootfsVol > 0 && nandRootfsVol !== nandChipTotal) addMR('Rootfs Total', fmtSize(nandRootfsVol));
                            if (_ovSi.overlay_total > 0) {
                                var _ovPctN = Math.round(_ovSi.overlay_used / _ovSi.overlay_total * 100);
                                addMR('Overlay Total', fmtBytesS(_ovSi.overlay_total));
                                addMR('Overlay Used', fmtBytesS(_ovSi.overlay_used), getDynColor(_ovPctN));
                                addMR('Overlay Free', fmtBytesS(_ovSi.overlay_free));
                            }
                        } else if (emmcTotal > 0) {
                            addMR('Physical eMMC Total', fmtSize(emmcTotal));
                            if (totalSpace > 0) { addMR('Usable Total', fmtSize(totalSpace)); addMR('Usable Free', fmtSize(totalSpace - totalUsed)); }
                        } else if (diskTotal > 0) {
                            addMR('Physical Disk Total', fmtSize(diskTotal));
                            if (diskRootfsVol > 0 && diskRootfsVol !== diskTotal) addMR('Rootfs Total', fmtSize(diskRootfsVol));
                            if (totalSpace > 0) { addMR('Usable Total', fmtSize(totalSpace)); addMR('Usable Free', fmtSize(totalSpace - totalUsed)); }
                        } else if (totalSpace > 0) {
                            addMR('Usable Total', fmtSize(totalSpace));
                            addMR('Usable Free', fmtSize(totalSpace - totalUsed));
                        }
                        if (res.mtd_count > 0) addMR('MTD Partitions', String(res.mtd_count));
                    }
                    var extCardNode = document.getElementById('hw-ext-card');
                    if (extCardNode) extCardNode.style.display = 'none';
                }

                (function() {
                    var extraNode = document.getElementById('hw-int-storage-extra');
                    if (!extraNode) return;
                    extraNode.innerHTML = '';

                    var hasUbi = res.ubi_devs && res.ubi_devs.length > 0;
                    var hasMtd = res.mtd_parts && res.mtd_parts.length > 0;
                    var hasEmmc = !!res.emmc_info;
                    var hasNvme = !!res.nvme_info;
                    var hasF2fs = res.f2fs_info && res.f2fs_info.length > 0;

                    // UBI + MTD side-by-side in a two-column thermals-style row
                    if (hasUbi || hasMtd) {
                        var nandRow = E('div', {id: 'hw-nand-row', class: 'hw-thermals-container'});

                        if (hasUbi) {
                            var ubiCol = E('div', {class: 'hw-thermals-col' + (hasMtd ? ' hw-thermals-col-left' : '')});
                            ubiCol.appendChild(secH('UBI / NAND Flash'));
                            res.ubi_devs.forEach(function(u) {
                                var peb_str = u.block_size > 0 ? fmtBytesS(u.block_size) + ' blocks' : '';
                                var box = makeDevBox(u.dev.toUpperCase(), 'MTD' + u.mtd_num + (peb_str ? ' | ' + peb_str : ''));
                                if (u.max_ec > 0) {
                                    var meanStr = u.mean_ec > 0 ? u.mean_ec : '-';
                                    box.appendChild(makeRow('Erase Count (min / mean / max)', u.min_ec + ' / ' + meanStr + ' / ' + u.max_ec + ' cycles', null, true));
                                }
                                var rp = u.reserved_pebs || 0;
                                var pebColor = u.bad_pebs > rp ? '#ff5252' : u.bad_pebs > 0 ? '#ffb300' : null;
                                var pebStr = 'Total: ' + u.total_ebs + '  Avail: ' + u.avail_ebs + '  Bad: ' + u.bad_pebs + (rp > 0 ? '  Rsv: ' + rp : '');
                                box.appendChild(makeRow('PEB Status', pebStr, pebColor, true));
                                if (u.page_size > 0) {
                                    var geoChip = function(lbl) { return E('span', {style: 'font-size: 0.78em; padding: 2px 7px; border-radius: 4px; background: rgba(128,128,128,0.1); border: 1px solid rgba(128,128,128,0.2); white-space: nowrap;'}, lbl); };
                                    var geoChips = [
                                        geoChip('Page ' + fmtBytesS(u.page_size)),
                                        geoChip('Block ' + fmtBytesS(u.block_size)),
                                        geoChip('OOB ' + fmtBytesS(u.oob_size))
                                    ];
                                    if (u.ecc_strength > 0) geoChips.push(geoChip('ECC ' + u.ecc_strength + 'b'));
                                    box.appendChild(E('div', {style: 'margin-bottom: 8px;'}, [
                                        E('div', {style: 'font-size: 0.78em; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;'}, 'NAND Geometry'),
                                        E('div', {style: 'display:flex; flex-wrap:wrap; gap: 4px;'}, geoChips)
                                    ]));
                                }
                                if (u.volumes && u.volumes.length > 0) {
                                    var vd = E('div', {style: 'margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--border-color, rgba(128,128,128,0.2));'});
                                    vd.appendChild(E('div', {style: 'font-size: 0.75em; opacity: 0.55; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;'}, 'Volumes'));
                                    var si = res.sys_info || {};
                                    u.volumes.forEach(function(vol) {
                                        var reservedBytes = (vol.reserved_ebs || 0) * (vol.eb_size || u.eb_size);
                                        var vsz;
                                        var fillRatio = -1;
                                        if (vol.name === 'rootfs_data' && si.overlay_total > 0) {
                                            vsz = fmtBytesS(si.overlay_used) + ' used, ' + fmtBytesS(si.overlay_free) + ' free';
                                            fillRatio = si.overlay_used / si.overlay_total;
                                        } else if (reservedBytes > 0 && vol.data_bytes !== reservedBytes) {
                                            vsz = fmtBytesS(vol.data_bytes) + ' / ' + fmtBytesS(reservedBytes);
                                            fillRatio = vol.data_bytes / reservedBytes;
                                        } else {
                                            vsz = fmtBytesS(reservedBytes > 0 ? reservedBytes : vol.data_bytes);
                                        }
                                        var volEntry = E('div', {style: 'border-bottom: 1px solid var(--border-color, rgba(128,128,128,0.07)); padding: 3px 0;'});
                                        volEntry.appendChild(E('div', {style: 'display:flex; justify-content:space-between; align-items:baseline; gap: 12px; font-size: 0.85em;'}, [
                                            E('span', {style: 'color:#00bcd4; flex-shrink: 0; white-space: nowrap;'}, vol.name),
                                            E('span', {style: 'opacity: 0.7; text-align: right; min-width: 0; word-break: break-word;'}, vsz + ' | ' + vol.type)
                                        ]));
                                        if (fillRatio >= 0) {
                                            var fillPct = Math.max(0, Math.min(100, fillRatio * 100));
                                            var fillColor = fillRatio > 0.9 ? '#ff5252' : fillRatio > 0.7 ? '#ffb300' : '#00bcd4';
                                            volEntry.appendChild(E('div', {style: 'height: 2px; margin-top: 3px; background: rgba(128,128,128,0.12); border-radius: 1px; overflow: hidden;'}, [
                                                E('div', {style: 'height: 100%; width: ' + fillPct.toFixed(0) + '%; background: ' + fillColor + '; border-radius: 1px;'})
                                            ]));
                                        }
                                        vd.appendChild(volEntry);
                                    });
                                    box.appendChild(vd);
                                }
                                ubiCol.appendChild(box);
                            });
                            nandRow.appendChild(ubiCol);
                        }

                        if (hasUbi && hasMtd) nandRow.appendChild(E('div', {class: 'hw-thermals-divider'}));

                        if (hasMtd) {
                            var mtdCol = E('div', {class: 'hw-thermals-col' + (hasUbi ? ' hw-thermals-col-right' : ''), style: 'min-width: 0;'});
                            mtdCol.appendChild(secH('MTD Partition Table'));
                            var mtdWrap = E('div', {style: 'font-size: 0.82em;'});
                            res.mtd_parts.forEach(function(p) {
                                var sz = fmtBytesS(p.size);
                                var tc = p.type === 'nor' ? '#00bcd4' : p.type === 'nand' ? '#ffea00' : '#9e9e9e';
                                mtdWrap.appendChild(E('div', {style: 'display:flex; justify-content:space-between; align-items:center; padding: 3px 6px; border-bottom: 1px solid var(--border-color, rgba(128,128,128,0.08));'}, [
                                    E('span', {style: 'color:#00bcd4; flex-shrink:0; min-width: 48px;'}, 'mtd' + p.num),
                                    E('span', {style: 'flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding: 0 8px; opacity:0.85;'}, p.name),
                                    E('span', {style: 'flex-shrink:0; opacity:0.7; min-width: 60px; text-align:right;'}, sz),
                                    E('span', {style: 'flex-shrink:0; color:' + tc + '; margin-left: 8px; min-width: 38px; text-align:right;'}, p.type.toUpperCase())
                                ]));
                            });
                            mtdCol.appendChild(mtdWrap);
                            // ECC error alert — only shown when non-zero errors exist
                            var eccParts = res.mtd_parts.filter(function(p) { return p.ecc_fail > 0 || p.ecc_corr > 0; });
                            if (eccParts.length > 0) {
                                var eccDiv = E('div', {style: 'margin-top:10px; padding-top:8px; border-top:1px dashed var(--border-color,rgba(128,128,128,0.2));'});
                                var eccHdr = 'ECC Alerts';
                                if (res.ecc_base_date > 0) eccHdr += ' (+n since ' + new Date(res.ecc_base_date * 1000).toLocaleDateString() + ')';
                                eccDiv.appendChild(E('div', {style: 'font-size:0.75em; opacity:0.5; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;'}, eccHdr));
                                eccParts.forEach(function(p) {
                                    var eccRow = E('div', {style: 'display:flex; justify-content:space-between; font-size:0.82em; padding:3px 0;'});
                                    eccRow.appendChild(E('span', {style: 'color:#00bcd4;'}, 'mtd'+p.num+' ('+p.name+')'));
                                    var eccVals = E('span', {});
                                    var dCorr = (p.ecc_corr_base != null) ? p.ecc_corr - p.ecc_corr_base : 0;
                                    var dFail = (p.ecc_fail_base != null) ? p.ecc_fail - p.ecc_fail_base : 0;
                                    if (p.ecc_corr > 0) eccVals.appendChild(E('span', {style: 'color:#ffb300; margin-right:8px;'}, p.ecc_corr + ' corr' + (dCorr > 0 ? ' (+' + dCorr + ')' : '')));
                                    if (p.ecc_fail > 0) eccVals.appendChild(E('span', {style: 'color:#ff5252;'}, p.ecc_fail + ' fail' + (dFail > 0 ? ' (+' + dFail + ')' : '')));
                                    eccRow.appendChild(eccVals);
                                    eccDiv.appendChild(eccRow);
                                });
                                mtdCol.appendChild(eccDiv);
                            }
                            nandRow.appendChild(mtdCol);
                        }

                        extraNode.appendChild(nandRow);
                    }

                    // eMMC / SD health
                    if (hasEmmc) {
                        if (hasUbi || hasMtd) extraNode.appendChild(hRule());
                        extraNode.appendChild(secH('eMMC / SD Health'));
                        var em = res.emmc_info;
                        var eolLbls = ['Not Defined', 'Normal', 'Warning', 'Urgent'];
                        var eolClrs = ['#9e9e9e', '#00bcd4', '#ffea00', '#ff1744'];
                        var ltLbls = ['N/A', '0–10%', '10–20%', '20–30%', '30–40%', '40–50%', '50–60%', '60–70%', '70–80%', '80–90%', '90–100%', 'Exceeded'];
                        var eolIdx = Math.max(0, Math.min(em.pre_eol || 0, 3));
                        var eolBadge = E('span', {style: 'padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; color:' + eolClrs[eolIdx] + '; background:' + eolClrs[eolIdx] + '22;'}, eolLbls[eolIdx]);
                        var emBox = makeDevBox(em.dev.toUpperCase() + (em.name ? ' (' + em.name + ')' : ''), eolBadge);
                        if (em.vendor && em.vendor !== 'Unknown') emBox.appendChild(makeRow('Manufacturer', em.vendor + (em.date ? ' (' + em.date + ')' : ''), null));
                        if (em.fwrev && em.fwrev !== '0x0' && em.fwrev !== '') emBox.appendChild(makeRow('FW Rev / HW Rev', em.fwrev + ' / ' + em.hwrev, null));
                        var la = Math.min(em.life_a || 0, 11), lb = Math.min(em.life_b || 0, 11);
                        if (em.life_a > 0) emBox.appendChild(makeBar2('Lifetime Type A', Math.min(em.life_a * 10, 100), ltLbls[la] || 'Exceeded', getDynColor(em.life_a * 10)));
                        if (em.life_b > 0) emBox.appendChild(makeBar2('Lifetime Type B', Math.min(em.life_b * 10, 100), ltLbls[lb] || 'Exceeded', getDynColor(em.life_b * 10)));
                        if (!em.life_a && !em.life_b) emBox.appendChild(makeRow('Lifetime', 'Not reported by device', '#9e9e9e'));
                        extraNode.appendChild(emBox);
                    }

                    // NVMe
                    if (hasNvme) {
                        if (hasUbi || hasMtd || hasEmmc) extraNode.appendChild(hRule());
                        extraNode.appendChild(secH('NVMe Details'));
                        var nv = res.nvme_info;
                        var nvBox = makeDevBox(nv.dev.toUpperCase() + (nv.model ? ' — ' + nv.model : ''), '');
                        if (nv.serial) nvBox.appendChild(makeRow('Serial', nv.serial, null));
                        if (nv.fw) nvBox.appendChild(makeRow('Firmware', nv.fw, null));
                        if (nv.transport) nvBox.appendChild(makeRow('Transport', nv.transport.toUpperCase(), null));
                        extraNode.appendChild(nvBox);
                    }

                    // f2fs
                    if (hasF2fs) {
                        if (hasUbi || hasMtd || hasEmmc || hasNvme) extraNode.appendChild(hRule());
                        extraNode.appendChild(secH('f2fs Statistics'));
                        res.f2fs_info.forEach(function(f) {
                            var lwStr = fmtBytesS(f.lifetime_write_kb * 1024);
                            var totSegs = (f.valid_segs || 0) + (f.dirty_segs || 0) + (f.free_segs || 0);
                            var f2Box = makeDevBox(f.dev.toUpperCase(), '');
                            if (f.lifetime_write_kb > 0) f2Box.appendChild(makeRow('Lifetime Written', lwStr, null));
                            if (f.utilization > 0) f2Box.appendChild(makeBar2('Utilization', f.utilization, f.utilization + '%', getDynColor(f.utilization)));
                            if (totSegs > 0) f2Box.appendChild(makeRow('Segments (Valid/Dirty/Free)', f.valid_segs + ' / ' + f.dirty_segs + ' / ' + f.free_segs, f.dirty_segs > 0 ? '#ffb300' : null));
                            extraNode.appendChild(f2Box);
                        });
                    }
                })();
                (function() {
                    var extraNode = document.getElementById('hw-int-storage-extra');
                    var horizDiv = document.getElementById('hw-dsk-horiz-divider');
                    if (horizDiv && extraNode) horizDiv.style.display = extraNode.children.length > 0 ? '' : 'none';
                })();

                if (res.block_devs && Array.isArray(res.block_devs)) {
                    var extWrapper = document.getElementById('my-ext-wrapper');
                    var driveGroups = {};
                    var now = Date.now();

                    res.block_devs.forEach(function(bdev) {
                        if (bdev.dev.indexOf('mmcblk') === 0 || bdev.dev.indexOf('mtd') === 0 || bdev.dev.indexOf('ubi') === 0 || bdev.dev.indexOf('loop') === 0 || bdev.dev.indexOf('zram') === 0) return;

                        var parent = bdev.dev.replace(/[0-9]+$/, '');
                        if (bdev.dev.indexOf('nvme') === 0) {
                            parent = bdev.dev.replace(/p[0-9]+$/, '');
                        }

                        if (!driveGroups[parent]) driveGroups[parent] = {
                            main: null,
                            parts: []
                        };

                        if (bdev.dev === parent) {
                            driveGroups[parent].main = bdev;
                        } else {
                            driveGroups[parent].parts.push(bdev);
                        }
                    });

                    var extDrives = [];
                    for (var p in driveGroups) {
                        var grp = driveGroups[p];
                        if (!grp.main && grp.parts.length > 0) {
                            grp.main = grp.parts[0];
                        }
                        if (grp.main) {
                            extDrives.push(grp);
                        }
                    }

                    if (extWrapper) {
                        extWrapper.innerHTML = '';
                        if (extDrives.length > 0) {
                            // Advanced Layout Engine: Dynamic dial counting!
                            var dialsCount = document.querySelectorAll('.hw-dial').length;
                            var maxColsPerCard = dialsCount > 0 ? dialsCount : 3;

                            var cards = [];
                            var currentCard = {
                                cols: []
                            };
                            var currentCol = {
                                items: [],
                                weight: 0
                            };
                            var maxWeightPerCol = 4;

                            extDrives.forEach(function(grp) {
                                var weight = 1 + grp.parts.length;

                                if (currentCol.items.length > 0 && currentCol.weight + weight > maxWeightPerCol) {
                                    currentCard.cols.push(currentCol);
                                    currentCol = {
                                        items: [],
                                        weight: 0
                                    };
                                }

                                if (currentCard.cols.length >= maxColsPerCard) {
                                    cards.push(currentCard);
                                    currentCard = {
                                        cols: []
                                    };
                                }

                                currentCol.items.push(grp);
                                currentCol.weight += weight;
                            });

                            if (currentCol.items.length > 0) {
                                currentCard.cols.push(currentCol);
                            }
                            if (currentCard.cols.length > 0) {
                                cards.push(currentCard);
                            }

                            cards.forEach(function(cardData, cardIdx) {
                                var colsCount = cardData.cols.length;

                                // Proportional sizing: card grows proportionally to column count
                                var flexStyle = 'flex: ' + colsCount + ' 1 ' + (colsCount * 280) + 'px;';
                                if (colsCount >= maxColsPerCard) {
                                    flexStyle += ' flex-basis: 100%;';
                                }

                                var titleStr = cards.length > 1 ? 'External Storage (' + (cardIdx + 1) + '/' + cards.length + ')' : 'External Storage';

                                var cardContainer = E('div', {
                                    class: 'hw-thermals-container',
                                    style: 'margin-top: 15px;'
                                });
                                var cardNode = E('div', {
                                    class: 'hw-card',
                                    style: 'justify-content: flex-start; overflow: hidden; ' + flexStyle
                                }, [
                                    E('h3', {}, titleStr),
                                    cardContainer
                                ]);

                                var domCols = [];
                                for (var i = 0; i < colsCount; i++) {
                                    // No min-width limit here! It naturally compresses to fit the row!
                                    domCols.push(E('div', {
                                        class: 'hw-thermals-col hw-thermals-col-mid'
                                    }));
                                }
                                if (domCols.length > 0) {
                                    domCols[0].className = 'hw-thermals-col hw-thermals-col-left';
                                    domCols[domCols.length - 1].className = 'hw-thermals-col hw-thermals-col-right';
                                    if (domCols.length === 1) domCols[0].className = 'hw-thermals-col'; // clean if only 1
                                }

                                cardData.cols.forEach(function(colData, colIdx) {
                                    colData.items.forEach(function(grp) {
                                        var main = grp.main;
                                        var sz = main.size ? (parseInt(main.size) / (1024 * 1024 * 1024)).toFixed(2) + ' GB' : 'Unknown';
                                        var isUsb = main.removable === '1' || main.type === 'USB';
                                        var displayType = isUsb ? 'USB' : main.type;
                                        var mStats = getStats(main, now);

                                        var box = E('div', {
                                            class: 'hw-progress-item',
                                            style: 'background: rgba(128,128,128,0.05); border: 1px solid var(--border-color, rgba(128,128,128,0.1)); border-radius: 8px; padding: 12px; margin-bottom: 12px; overflow: hidden;'
                                        }, [
                                            E('div', {
                                                style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid var(--border-color, rgba(128,128,128,0.2)); padding-bottom: 8px;'
                                            }, [
                                                E('span', {
                                                    style: 'font-weight: bold; font-size: 1.1em;'
                                                }, main.dev.toUpperCase()),
                                                E('span', {
                                                    style: 'color: #ffea00; font-weight: bold;'
                                                }, sz)
                                            ]),
                                            E('div', {
                                                style: 'display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.9em;'
                                            }, [
                                                E('span', {
                                                    style: 'opacity: 0.8;'
                                                }, 'Model:'),
                                                E('span', {
                                                    style: 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; text-align: right;'
                                                }, main.model)
                                            ]),
                                            E('div', {
                                                style: 'display: flex; justify-content: space-between; font-size: 0.9em; margin-bottom: 8px;'
                                            }, [
                                                E('span', {
                                                    style: 'opacity: 0.8;'
                                                }, 'Type:'),
                                                E('span', {}, displayType)
                                            ])
                                        ]);

                                        if (grp.parts.length > 0) {
                                            var partsContainer = E('div', {
                                                style: 'margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-color, rgba(128,128,128,0.3));'
                                            });
                                            grp.parts.forEach(function(part) {
                                                var psz = part.size ? (parseInt(part.size) / (1024 * 1024 * 1024)).toFixed(2) + ' GB' : '';
                                                var formatStr = (part.fs && part.fs !== 'Unknown') ? part.fs : 'Unmounted';
                                                var pStats = getStats(part, now);

                                                var pRow = E('div', {
                                                    style: 'margin-bottom: 12px;'
                                                }, [
                                                    E('div', {
                                                        style: 'display: flex; justify-content: space-between; font-size: 0.9em; font-weight: bold;'
                                                    }, [
                                                        E('span', {
                                                            style: 'color: #00bcd4;'
                                                        }, part.dev.toUpperCase()),
                                                        E('span', {}, psz)
                                                    ]),
                                                    E('div', {
                                                        style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8; margin-top: 4px;'
                                                    }, [
                                                        E('span', {}, 'Format:'),
                                                        E('span', {
                                                            style: 'color: #00bcd4;'
                                                        }, formatStr)
                                                    ]),
                                                    E('div', {
                                                        style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.7; margin-top: 6px;'
                                                    }, [
                                                        E('span', {}, 'Speed:'),
                                                        E('span', {}, 'R: ' + fmtSpeedExt(pStats.rSpeed) + ' / W: ' + fmtSpeedExt(pStats.wSpeed))
                                                    ]),
                                                    E('div', {
                                                        style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.6; margin-top: 2px;'
                                                    }, [
                                                        E('span', {}, 'IOPS:'),
                                                        E('span', {}, 'R: ' + Math.round(pStats.rIops) + ' / W: ' + Math.round(pStats.wIops))
                                                    ])
                                                ]);
                                                partsContainer.appendChild(pRow);
                                            });
                                            box.appendChild(partsContainer);
                                        } else {
                                            var footer = E('div', {
                                                style: 'margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-color, rgba(128,128,128,0.3));'
                                            }, [
                                                E('div', {
                                                    style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.7; margin-top: 4px;'
                                                }, [
                                                    E('span', {}, 'Speed:'),
                                                    E('span', {}, 'R: ' + fmtSpeedExt(mStats.rSpeed) + ' / W: ' + fmtSpeedExt(mStats.wSpeed))
                                                ]),
                                                E('div', {
                                                    style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.6; margin-top: 2px;'
                                                }, [
                                                    E('span', {}, 'IOPS:'),
                                                    E('span', {}, 'R: ' + Math.round(mStats.rIops) + ' / W: ' + Math.round(mStats.wIops))
                                                ])
                                            ]);
                                            box.appendChild(footer);
                                        }
                                        domCols[colIdx].appendChild(box);
                                    });
                                });

                                for (var i = 0; i < domCols.length; i++) {
                                    cardContainer.appendChild(domCols[i]);
                                    if (i < domCols.length - 1) {
                                        cardContainer.appendChild(E('div', {
                                            class: 'hw-thermals-divider'
                                        }));
                                    }
                                }

                                extWrapper.appendChild(cardNode);
                            });
                        }
                    }
                }
                var thermWrap = document.getElementById('hw-therm-wrapper');
                if (thermWrap) thermWrap.innerHTML = '';
                if (res.thermals && res.thermals.length > 0 && thermWrap) {
                    if (res.model) {
                        var title = res.model;
                        if (title.length > 30) title = title.substring(0, 30);
                        var tEl = document.getElementById('title-cpu');
                        if (tEl && tEl.textContent !== title) tEl.textContent = title;
                    }
                    // Normalize + de-duplicate sensors, sorted alphabetically.
                    var sensors = [];
                    var seenSensors = {};
                    if (!self.tempHist) self.tempHist = {};
                    res.thermals.slice().sort(function(a, b) {
                        return a.type.localeCompare(b.type);
                    }).forEach(function(t) {
                        var tempC = t.temp;
                        if (tempC > 1000) tempC = tempC / 1000;
                        var name = t.type.replace(/_/g, '-').toUpperCase();
                        if (seenSensors[name]) return;
                        seenSensors[name] = true;
                        if (name.length > 20) name = name.substring(0, 20);
                        var crit = t.crit && t.crit !== 'null' ? parseInt(t.crit) : null;
                        var pass = t.pass && t.pass !== 'null' ? parseInt(t.pass) : null;
                        if (crit && crit > 1000) crit = crit / 1000;
                        if (pass && pass > 1000) pass = pass / 1000;
                        // Some drivers report nonsense trip points (-274 °C, 65000 °C
                        // …). Since trips now drive the badge colors, only keep
                        // physically plausible values.
                        if (crit !== null && (crit < 40 || crit > 150)) crit = null;
                        if (pass !== null && (pass <= 0 || pass > 150)) pass = null;
                        if (crit !== null && pass !== null && pass >= crit) pass = null;
                        var th = self.tempHist[name];
                        if (!th || Array.isArray(th) || !th.agg) th = self.tempHist[name] = { label: name, color: PING_COLORS[Object.keys(self.tempHist).length % PING_COLORS.length], hidden: false, data: [], agg: [], acc: { sum: 0, n: 0, cnt: 0 } };
                        th.data.push(tempC);
                        if (th.data.length > TEMP_WINDOW) th.data.shift();
                        // 30s aggregation buckets feed the 1h/3h views
                        th.acc.cnt++; th.acc.sum += tempC; th.acc.n++;
                        if (th.acc.cnt >= 10) {
                            th.agg.push({ a: th.acc.n > 0 ? th.acc.sum / th.acc.n : null, n: th.acc.n, loss: 0 });
                            if (th.agg.length > TEMP_AGG_KEEP) th.agg.shift();
                            th.acc = { sum: 0, n: 0, cnt: 0 };
                        }
                        sensors.push({ name: name, temp: tempC, crit: crit, pass: pass, color: th.color, hist: th.data });
                    });
                    // Realtime temperature history — the same persistent graph
                    // panel as the ping card (10m/1h/3h windows, hover crosshair,
                    // CSV export). The panel element keeps its DOM identity and is
                    // re-parented into the rebuilt card each tick, so buttons and
                    // hover never lose pointer state.
                    var tGraph = null;
                    var tHistMap = {};
                    sensors.forEach(function(sn) {
                        var th = self.tempHist[sn.name];
                        if (th && th.data.length >= 2) tHistMap[sn.name] = th;
                    });
                    if (Object.keys(tHistMap).length > 0) {
                        if (!self.tempPanel) {
                            self.tempPanel = createGraphPanel({
                                views: TEMP_VIEWS,
                                defaultView: '10m',
                                unit: ' \u00b0C',
                                csvName: 'temps',
                                spikeNulls: false,
                                lossTicks: false,
                                autoRange: true,
                                legend: false,
                                height: 170
                            });
                            self.tempPanel.el.style.marginBottom = '16px';
                        }
                        tGraph = self.tempPanel.el;
                        // update AFTER the cards are attached below — updating
                        // while detached froze the hover tooltip on old values
                        self.tempPanelData = tHistMap;
                    }
                    // Up to 3 columns per card, up to 4 sensors per column; when
                    // the platform exposes more sensors, additional cards are added.
                    var MAX_PER_CARD = 12;
                    var cardCount = Math.ceil(sensors.length / MAX_PER_CARD);
                    for (var off = 0; off < sensors.length; off += MAX_PER_CARD) {
                        var chunk = sensors.slice(off, off + MAX_PER_CARD);
                        var nCols = Math.min(3, chunk.length);
                        var cols = [];
                        for (var ci = 0; ci < nCols; ci++) cols.push([]);
                        chunk.forEach(function(s, i) {
                            cols[i % nCols].push(s);
                        });
                        var rowEl = E('div', { class: 'hw-thermals-container' });
                        cols.forEach(function(colSensors, cidx) {
                            if (cidx > 0) rowEl.appendChild(E('div', { class: 'hw-thermals-divider' }));
                            var colCls = 'hw-thermals-col';
                            if (nCols > 1) {
                                colCls += cidx === 0 ? ' hw-thermals-col-left' : cidx === nCols - 1 ? ' hw-thermals-col-right' : ' hw-thermals-col-mid';
                            }
                            var list = E('div', {
                                class: 'hw-stats-list',
                                style: 'margin-top: 0; padding-top: 0;'
                            });
                            colSensors.forEach(function(s) {
                                list.appendChild(makeSensorRow(s));
                            });
                            if (list.lastChild) list.lastChild.style.borderBottom = 'none';
                            rowEl.appendChild(E('div', { class: colCls }, [list]));
                        });
                        var cardTitle = cardCount > 1 ? 'Thermal Sensors (' + (off / MAX_PER_CARD + 1) + '/' + cardCount + ')' : 'Thermal Sensors';
                        var cardKids = [E('h3', {}, cardTitle)];
                        if (off === 0 && tGraph) cardKids.push(tGraph);
                        cardKids.push(rowEl);
                        thermWrap.appendChild(E('div', {
                            class: 'hw-card wide'
                        }, cardKids));
                    }
                    if (self.tempPanel && self.tempPanelData) self.tempPanel.update(self.tempPanelData);
                    // Cooling device states (cpufreq throttling, fans, ...) as a
                    // chip row under the first thermal card. cur > 0 = the kernel
                    // is actively limiting that device right now.
                    if (res.cooling && res.cooling.length > 0 && thermWrap.firstChild) {
                        var coolRow = E('div', { style: 'display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-color, rgba(128,128,128,0.15));' });
                        var coolShown = 0;
                        res.cooling.forEach(function(c) {
                            if (!c.max) return;
                            var cc = c.cur >= c.max ? '#ff1744' : c.cur > 0 ? '#ffb300' : '#00bcd4';
                            var lbl = c.type + ': ' + (c.cur > 0 ? c.cur + '/' + c.max : 'idle');
                            coolRow.appendChild(E('span', { style: 'font-size: 0.75em; padding: 3px 8px; border-radius: 4px; border: 1px solid ' + cc + '44; color: ' + cc + '; background: ' + cc + '18; white-space: nowrap;' }, lbl));
                            coolShown++;
                        });
                        if (coolShown > 0) {
                            coolRow.insertBefore(E('span', { style: 'font-size: 0.75em; opacity: 0.55; text-transform: uppercase; letter-spacing: 1px; align-self: center;' }, 'Cooling'), coolRow.firstChild);
                            thermWrap.firstChild.appendChild(coolRow);
                        }
                    }
                }
                // Ports Topology: ethernet links and the USB bus share one card.
                var portsNode = document.getElementById('hw-eth-links');
                var validPcie = [];
                if (res.pcie_devs) {
                    validPcie = res.pcie_devs.filter(function(p){ var n = p.name.toLowerCase(); return p.speed && p.speed !== 'Unknown' && n.indexOf('unknown device')===-1 && n.indexOf('controller')===-1 && n.indexOf('bridge')===-1 && n.indexOf('root')===-1; });
                }
                var usbDevs = (res.usb_devs || []).filter(function(u){ var n = (u.name || '').trim(); return n && n !== 'Unknown' && n !== 'Unknown Device'; });
                // Physical USB port wiring can't be read reliably from the controller:
                // a USB 3.0 controller often exposes a 2.0-only port. So the port spec
                // is hardcoded per known JioRouter board and omitted for everything else.
                var boardId = res.board || '';
                var hwPortStr = '';
                if (/JIDU6[J0-9]11/.test(boardId)) hwPortStr = 'USB 3.0 (1 Physical Port)';
                else if (/JIDU6[J0-9]01/.test(boardId)) hwPortStr = 'USB 2.0 (1 Physical Port)';
                else if (boardId.indexOf('JIDU6700') !== -1) hwPortStr = 'USB 2.0 (1 Physical Port)';
                var hasUsb = hwPortStr !== '' || usbDevs.length > 0;
                var hasEth = res.eth_links && res.eth_links.length > 0;
                var portsSubH = function(txt, mt) {
                    return E('h4', { style: 'margin: ' + (mt ? '10px' : '0') + ' 0 4px 0; font-size: 0.85em; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px;' }, txt);
                };
                if ((hasEth || hasUsb) && portsNode) {
                    ethCard.style.display = 'flex';
                    portsNode.innerHTML = '';
                    if (hasEth) {
                        portsNode.appendChild(portsSubH('Ethernet', false));
                        if (!self.prevEth) self.prevEth = {};
                        res.eth_links.forEach(function(l) {
                            var st = l.speed;
                            var col = '#9e9e9e';
                            if (st.indexOf('10000') >= 0 || st.indexOf('2500') >= 0 || st.indexOf('1000') >= 0) col = '#00bcd4';
                            else if (st.indexOf('100') >= 0 || st.indexOf('10') >= 0) col = '#ffea00';

                            var rxErr = parseInt(l.rx_err) || 0, txErr = parseInt(l.tx_err) || 0;
                            var rxDrop = parseInt(l.rx_drop) || 0, txDrop = parseInt(l.tx_drop) || 0;

                            // Live throughput from rx/tx byte deltas between polls.
                            var dlMbps = null, ulMbps = null;
                            var curRx = parseInt(l.rx_bytes) || 0, curTx = parseInt(l.tx_bytes) || 0, nowT = Date.now();
                            var pe = self.prevEth[l.iface];
                            if (pe && nowT > pe.t && curRx >= pe.rx && curTx >= pe.tx) {
                                var dt = (nowT - pe.t) / 1000;
                                dlMbps = (curRx - pe.rx) * 8 / 1e6 / dt;
                                ulMbps = (curTx - pe.tx) * 8 / 1e6 / dt;
                            }
                            self.prevEth[l.iface] = { rx: curRx, tx: curTx, t: nowT };

                            var box = E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; border-left: 4px solid ' + col + '; margin-bottom: 4px;' }, [
                                E('div', { style: 'display: flex; justify-content: space-between; align-items: center;' }, [
                                    E('div', { style: 'display: flex; align-items: center; gap: 8px;' }, [
                                        E('div', { style: 'width: 10px; height: 10px; border-radius: 50%; background-color: ' + col + '; box-shadow: 0 0 5px ' + col + '; flex-shrink: 0;' }),
                                        E('span', { style: 'font-weight: bold;' }, l.iface.toUpperCase())
                                    ]),
                                    E('span', { style: 'color:' + col + ';' }, st === 'Down' ? 'Disconnected' : st + ' Mbps (' + l.duplex + ')')
                                ])
                            ]);

                            if (st !== 'Down') {
                                if (dlMbps !== null) {
                                    box.appendChild(E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.9; margin-top: 6px; border-top: 1px dashed rgba(128,128,128,0.3); padding-top: 6px;' }, [
                                        E('span', {}, 'Throughput:'),
                                        E('span', { style: 'color:#00bcd4;' }, '↓ ' + fmtMbps(dlMbps) + '   ↑ ' + fmtMbps(ulMbps))
                                    ]));
                                }
                                var errColor = (rxErr > 0 || txErr > 0 || rxDrop > 0 || txDrop > 0) ? '#ff5252' : 'currentColor';
                                box.appendChild(E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8; margin-top: 6px;' }, [
                                    E('span', {}, 'Errors/Drops:'),
                                    E('span', { style: 'color:' + errColor + ';' }, 'Rx: ' + rxErr + '/' + rxDrop + ' | Tx: ' + txErr + '/' + txDrop)
                                ]));
                            }
                            var et = res.ethtool && res.ethtool[l.iface];
                            if (et && st !== 'Down') {
                                var eeeCol = et.eee === 'active' ? '#ffb300' : '';
                                var etStr = 'autoneg ' + et.an + ' \u00b7 pause ' + et.pause + (et.eee !== 'n/a' ? ' \u00b7 EEE ' + et.eee : '') + (et.drv ? ' \u00b7 ' + et.drv + (et.fw && et.fw !== 'N/A' ? ' fw ' + et.fw : '') : '');
                                box.appendChild(E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.7; margin-top: 4px;' }, [
                                    E('span', {}, 'PHY:'),
                                    E('span', { style: eeeCol ? 'color:' + eeeCol + ';' : '' }, etStr)
                                ]));
                            }
                            if (l.mac) {
                                var flaps = parseInt(l.carrier_changes) || 0;
                                // carrier_changes counts up+down edges; >2 means it
                                // flapped after the initial link-up.
                                var flapStr = flaps > 2 ? ' \u00b7 ' + flaps + ' link flaps' : '';
                                box.appendChild(E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.6; margin-top: 4px;' }, [
                                    E('span', {}, 'MAC / MTU:'),
                                    E('span', { style: flaps > 2 ? 'color:#ffb300;' : '' }, l.mac.toUpperCase() + ' \u00b7 ' + l.mtu + flapStr)
                                ]));
                            }
                            portsNode.appendChild(box);
                        });
                    }
                    if (hasUsb) {
                        portsNode.appendChild(portsSubH('USB', hasEth));
                        if (hwPortStr) {
                            portsNode.appendChild(E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; margin-bottom: 6px;' }, [
                                E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em;' }, [
                                    E('span', {}, 'Physical Port:'),
                                    E('span', { style: 'color:#00bcd4; font-weight: bold;' }, hwPortStr)
                                ])
                            ]));
                        }
                        usbDevs.forEach(function(u) {
                            var spd = parseInt(u.speed) || 0;
                            var col = spd >= 5000 ? '#00bcd4' : spd >= 480 ? '#ffea00' : '#9e9e9e';
                            var spdLabel = spd >= 10000 ? 'USB 3.2 (' + spd + ' Mbps)' : spd >= 5000 ? 'USB 3.0 (' + spd + ' Mbps)' : spd >= 480 ? 'USB 2.0 (' + spd + ' Mbps)' : spd > 0 ? 'USB 1.x (' + spd + ' Mbps)' : '';
                            var rows = [E('div', { style: 'font-weight: bold; margin-bottom: 4px;' }, u.name)];
                            if (spdLabel) rows.push(E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8;' }, [E('span', {}, 'Speed:'), E('span', { style: 'color:' + col + ';' }, spdLabel)]));
                            var ver = u.version ? u.version.trim() : '';
                            if (ver) rows.push(E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8;' }, [E('span', {}, 'USB Version:'), E('span', {}, ver)]));
                            if (u.max_power && u.max_power !== '0mA') rows.push(E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8;' }, [E('span', {}, 'Max Power Draw:'), E('span', {}, u.max_power)]));
                            portsNode.appendChild(E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; margin-bottom: 6px;' }, rows));
                        });
                    }
                } else {
                    ethCard.style.display = 'none';
                }

                // PCI-e gets its own card, hidden entirely when nothing to show.
                if (validPcie.length > 0) {
                    pcieCard.style.display = 'flex';
                    var pcNode = document.getElementById('hw-pcie');
                    if (pcNode) {
                        pcNode.innerHTML = '';
                        validPcie.forEach(function(p) {
                            var speedStr = p.speed + ' ' + p.width;
                            if (p.max_speed && p.max_speed !== 'Unknown' && p.speed !== p.max_speed) speedStr += ' (Max: ' + p.max_speed + ')';
                            pcNode.appendChild(E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; margin-bottom: 6px;' }, [
                                E('div', { style: 'font-weight: bold; margin-bottom: 4px;' }, p.name),
                                E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8;' }, [
                                    E('span', {}, 'Link Speed:'),
                                    E('span', { style: p.speed !== p.max_speed ? 'color:#ffea00;' : '' }, speedStr)
                                ])
                            ]));
                        });
                    }
                } else {
                    pcieCard.style.display = 'none';
                }

                if (res.wifi_radios && res.wifi_radios.length > 0) {
                    var wfNode = document.getElementById('hw-wifi-radios');
                    if (wfNode) {
                        wfNode.innerHTML = '';
                        var wifiRendered = 0;
                        // Group radios by band — one column per band, radios of
                        // the same band stacked vertically inside it.
                        var WIFI_BANDS = ['2.4 GHz', '5 GHz', '6 GHz'];
                        var bandGroups = { '2.4 GHz': [], '5 GHz': [], '6 GHz': [], 'Other': [] };
                        if (!self.prevSurvey) self.prevSurvey = {};
                        res.wifi_radios.forEach(function(w) {
                            if ((!w.band || w.band === 'Unknown') && (!w.hwmode || w.hwmode === 'Unknown')) return;
                            var bKey = w.band.replace(' GHz', 'GHz');
                            var bCap = (w.phycap && w.phycap.bands && w.phycap.bands[bKey]) ? w.phycap.bands[bKey] : null;

                            // Strictly real data from upstream kernel sources only
                            var phycapSp = w.phycap ? parseInt(w.phycap.max_spatial) : 0;
                            var hwMaxSp = phycapSp > 1 ? phycapSp : (parseInt(w.hw_nss) > 1 ? parseInt(w.hw_nss) : 0);
                            var hwMaxCw = (w.phycap && w.phycap.max_cw && parseInt(w.phycap.max_cw) >= 20) ? w.phycap.max_cw : null;
                            var hwMaxCwNum = hwMaxCw ? (parseInt(hwMaxCw.replace(/[^0-9]/g, '')) || 0) : 0;
                            var currCwNum = parseInt(w.curr_width) || 0;
                            var currCwStr = currCwNum > 0 ? currCwNum + ' MHz' : null;
                            var cfgNss = parseInt(w.cfg_nss) || 0;

                            // Chip HW Max: only from iw list phycap — no guessing
                            var chipMaxBr = (hwMaxSp > 0 && hwMaxCw && w.hwmode) ? calcMaxBitrate(w.hwmode, hwMaxCw, hwMaxSp) : null;

                            // Config Max: only shown when software config differs from hw max
                            var cfgMaxBr = null;
                            var cfgMaxLabel = null;
                            if (chipMaxBr) {
                                var cfgSp = cfgNss > 0 ? cfgNss : hwMaxSp;
                                var cfgCw = currCwStr || hwMaxCw;
                                var cfgCwNum = currCwNum > 0 ? currCwNum : hwMaxCwNum;
                                if (cfgSp !== hwMaxSp || cfgCwNum !== hwMaxCwNum) {
                                    cfgMaxBr = calcMaxBitrate(w.hwmode, cfgCw, cfgSp);
                                    cfgMaxLabel = cfgSp + 'x' + cfgSp + ' MIMO @ ' + cfgCw;
                                }
                            }

                            var suppChs = (w.channels && w.channels.length > 0) ? w.channels.split(',') : (bCap ? bCap.enabled : []);
                            var cleanHw = w.hardware ? w.hardware.replace(/^.*\[/, '').replace(/\]$/, '') : '';
                            var chStr = (w.channel && w.channel !== 'Unknown' && w.channel !== 'unknown' && w.channel !== '0') ? w.channel : null;

                            // Regulatory domain (country code + DFS regime)
                            var regStr = '';
                            if (w.country && w.country !== '00' && w.country !== '') regStr = w.country + (w.dfs_region ? ' · ' + w.dfs_region : '');
                            else if (w.country === '00') regStr = '00 · World';
                            // Channel survey — airtime load (busy %) + noise floor.
                            // Prefer the between-poll delta so it tracks CURRENT
                            // congestion (ath11k advances the counters every read). Some
                            // mt76 builds only refresh the survey snapshot lazily, so the
                            // counters don't move between polls — there, fall back to the
                            // cumulative busy/active ratio so airtime is still shown.
                            var sv = (res.wifi_survey && res.wifi_survey[w.iface]) || null;
                            var busyPct = -1, surveyStr = '', noiseVal = 0;
                            if (sv) {
                                noiseVal = parseInt(sv.noise) || 0;
                                var psv = self.prevSurvey[w.iface];
                                var curAct = parseInt(sv.active) || 0, curBusy = parseInt(sv.busy) || 0;
                                var curTx = parseInt(sv.tx) || 0, curRx = parseInt(sv.rx) || 0;
                                if (curAct > 0) {
                                    var live = psv && curAct > psv.active;          // counters advanced
                                    var stale = psv && curAct === psv.active;        // snapshot didn't move
                                    var dA, dB, dT, dR;
                                    if (live)       { dA = curAct - psv.active; dB = curBusy - psv.busy; dT = curTx - psv.tx; dR = curRx - psv.rx; }
                                    else if (stale) { dA = curAct; dB = curBusy; dT = curTx; dR = curRx; } // cumulative fallback
                                    if (dA > 0) {
                                        busyPct = Math.max(0, Math.min(100, Math.round(dB / dA * 100)));
                                        var txPct = Math.max(0, Math.min(100, Math.round(dT / dA * 100)));
                                        var rxPct = Math.max(0, Math.min(100, Math.round(dR / dA * 100)));
                                        surveyStr = busyPct + '% busy (' + txPct + '% tx / ' + rxPct + '% rx)';
                                    }
                                }
                                self.prevSurvey[w.iface] = { active: curAct, busy: curBusy, tx: curTx, rx: curRx };
                            }

                            wifiRendered++;
                            var bandKey = bandGroups[w.band] ? w.band : 'Other';
                            bandGroups[bandKey].push(E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; margin-bottom: 8px;' }, [
                                E('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid rgba(128,128,128,0.2); padding-bottom: 8px;' }, [
                                    E('span', { style: 'font-weight: bold;' }, w.iface.toUpperCase() + ' (' + w.band + ')'),
                                    chStr ? E('span', { style: 'color:#00bcd4; font-size: 0.9em;' }, 'Ch: ' + chStr) : E('span', {}, '')
                                ]),
                                cleanHw && cleanHw !== 'Unknown' ? E('div', { class: 'hw-wifi-ssid', style: 'font-size: 0.9em; margin-bottom: 4px;' }, cleanHw) : '',
                                w.hwmode && w.hwmode !== 'Unknown' ? E('div', { class: 'hw-wifi-detail' }, 'HW Mode(s): ' + w.hwmode) : '',
                                chipMaxBr ? E('div', { class: 'hw-wifi-detail' }, 'Chip HW Max: ' + chipMaxBr + ' (' + hwMaxSp + 'x' + hwMaxSp + ' MIMO @ ' + hwMaxCw + ')') : '',
                                cfgMaxBr ? E('div', { class: 'hw-wifi-detail', style: 'color: #00bcd4;' }, 'Config Max: ' + cfgMaxBr + ' (' + cfgMaxLabel + ')') : '',
                                chStr ? E('div', { class: 'hw-wifi-detail' }, 'Current Channel: ' + chStr) : '',
                                surveyStr ? E('div', { class: 'hw-wifi-detail' }, ['Channel Load: ', E('span', { style: 'color:' + getDynColor(busyPct) + ';' }, surveyStr)]) : '',
                                noiseVal < 0 ? E('div', { class: 'hw-wifi-detail' }, 'Noise Floor: ' + noiseVal + ' dBm') : '',
                                hwMaxCw ? E('div', { class: 'hw-wifi-detail' }, 'Max Channel Width: ' + hwMaxCw) : '',
                                w.txpower && w.txpower !== 'Unknown' ? E('div', { class: 'hw-wifi-detail' }, 'Max TX Power: ' + w.txpower) : '',
                                regStr ? E('div', { class: 'hw-wifi-detail' }, 'Regulatory Domain: ' + regStr) : '',
                                suppChs && suppChs.length > 0 ? E('div', { class: 'hw-wifi-detail', style: 'margin-top:4px;' }, 'Supported Channels: ' + groupChannels(w.band, suppChs)) : '',
                                bCap && bCap.disabled && bCap.disabled.length > 0 ? E('div', { class: 'hw-wifi-detail', style: 'color: #ff5252; font-size: 0.85em; padding-left: 8px;' }, 'Disabled (Regdomain): ' + bCap.disabled.join(', ')) : '',
                                bCap && bCap.exceptions && bCap.exceptions.length > 0 ? E('div', { class: 'hw-wifi-detail', style: 'color: #ffb74d; font-size: 0.85em; padding-left: 8px;' }, 'Radar Detection (DFS): ' + bCap.exceptions.join(', ')) : ''
                            ]));
                        });
                        // One column per band actually present (2.4 / 5 / 6 GHz,
                        // plus Other for band-unknown radios); radios of a band
                        // stack vertically inside their column. Missing bands are
                        // simply not rendered. Collapses to a single column on
                        // mobile via the shared container CSS.
                        var presentBands = WIFI_BANDS.concat(['Other']).filter(function(b) { return bandGroups[b].length > 0; });
                        if (presentBands.length > 0) {
                            var wNCols = presentBands.length;
                            var wRow = E('div', { class: 'hw-thermals-container' });
                            presentBands.forEach(function(b, wc) {
                                if (wc > 0) wRow.appendChild(E('div', { class: 'hw-thermals-divider' }));
                                var wCls = 'hw-thermals-col';
                                if (wNCols > 1) wCls += wc === 0 ? ' hw-thermals-col-left' : wc === wNCols - 1 ? ' hw-thermals-col-right' : ' hw-thermals-col-mid';
                                var wCol = E('div', { class: wCls, style: 'min-width: 0; display: flex; flex-direction: column;' });
                                wCol.appendChild(E('div', { class: 'hw-thermals-title' }, b === 'Other' ? 'OTHER' : b.toUpperCase()));
                                bandGroups[b].forEach(function(box) {
                                    // equal-height boxes: each radio stretches to share
                                    // the column, so side-by-side bands line up.
                                    box.style.flex = '1 1 0';
                                    wCol.appendChild(box);
                                });
                                wRow.appendChild(wCol);
                            });
                            wfNode.appendChild(wRow);
                        }
                        wifiCard.style.display = wifiRendered > 0 ? 'flex' : 'none';
                    }
                } else {
                    wifiCard.style.display = 'none';
                }

                // Interrupts card: top IRQ sources with per-core split + softnet backlog.
                if (res.irqs && res.irqs.length > 0) {
                    var irqNode = document.getElementById('hw-irq');
                    if (!self.prevIrqs) self.prevIrqs = {};
                    var CORE_COLORS = ['#00bcd4', '#ffb300', '#e91e63', '#8bc34a', '#b388ff', '#ff7043', '#4dd0e1', '#f06292'];
                    var irqRates = [];
                    res.irqs.forEach(function(q) {
                        var pk = q.n + '|' + q.d;
                        var prev = self.prevIrqs[pk];
                        if (prev) {
                            var rate = (q.t - prev.t) / 3;
                            if (rate >= 1) {
                                var coreD = q.c.map(function(v, ci) { return Math.max(0, v - (prev.c[ci] || 0)); });
                                var parts = q.d.split(/\s+/);
                                var iname = parts[parts.length - 1] || q.d;
                                if (/^interrupts?$/i.test(iname)) iname = q.d.length > 24 ? q.d.slice(0, 23) + '\u2026' : q.d;
                                irqRates.push({ name: iname, rate: rate, cores: coreD });
                            }
                        }
                        self.prevIrqs[pk] = q;
                    });
                    irqRates.sort(function(a, b) { return b.rate - a.rate; });
                    if (irqNode && irqRates.length > 0) {
                        irqNode.innerHTML = '';
                        irqRates.slice(0, 6).forEach(function(q) {
                            var total = q.cores.reduce(function(a, b) { return a + b; }, 0) || 1;
                            var segs = [];
                            q.cores.forEach(function(cv, ci) {
                                if (cv <= 0) return;
                                segs.push(E('div', { style: 'height: 100%; width: ' + (cv / total * 100) + '%; background: ' + CORE_COLORS[ci % CORE_COLORS.length] + ';' }));
                            });
                            irqNode.appendChild(E('div', { class: 'hw-progress-item', style: 'margin-bottom: 8px;' }, [
                                E('div', { class: 'hw-progress-header' }, [
                                    E('span', { class: 'hw-stat-label', style: 'font-size: 0.9em;' }, q.name),
                                    E('span', { class: 'hw-stat-value', style: 'font-size: 0.9em;' }, Math.round(q.rate) + ' /s')
                                ]),
                                E('div', { class: 'hw-bar-bg', style: 'height: 5px; display: flex;' }, segs)
                            ]));
                        });
                        var legendCores = E('div', { style: 'display: flex; gap: 10px; justify-content: center; font-size: 0.72em; opacity: 0.6; margin: 4px 0 8px 0; flex-wrap: wrap;' });
                        for (var lc = 0; lc < Math.min(res.cpus.length - 1, 8); lc++) {
                            legendCores.appendChild(E('span', { style: 'display: inline-flex; align-items: center; gap: 4px;' }, [
                                E('span', { style: 'width: 8px; height: 8px; border-radius: 2px; background: ' + CORE_COLORS[lc % CORE_COLORS.length] + ';' }),
                                'C' + lc
                            ]));
                        }
                        irqNode.appendChild(legendCores);
                        if (res.softnet && res.softnet.length > 0) {
                            var snD = 0, snS = 0;
                            if (self.prevSoftnet) {
                                res.softnet.forEach(function(sn, si) {
                                    var p = self.prevSoftnet[si];
                                    if (p) { snD += Math.max(0, sn.d - p.d); snS += Math.max(0, sn.s - p.s); }
                                });
                                var snColor = snD > 0 ? '#ff5252' : snS > 0 ? '#ffb300' : 'currentColor';
                                irqNode.appendChild(E('div', { class: 'hw-stat-row', style: 'border-top: 1px solid var(--border-color, rgba(128,128,128,0.15)); padding-top: 8px;' }, [
                                    E('span', { class: 'hw-stat-label', style: 'font-size: 0.9em;' }, 'Backlog Drops / Squeezed'),
                                    E('span', { class: 'hw-stat-value', style: 'font-size: 0.9em; color: ' + snColor + ';' }, snD + ' / ' + snS + ' per 3s')
                                ]));
                            }
                            self.prevSoftnet = res.softnet;
                        }
                        irqCard.style.display = 'flex';
                    }
                } else {
                    irqCard.style.display = 'none';
                }

                // Offload Engines — flowtable / PPE hardware NAT / WED status.
                if (res.offload && (res.offload.ft > 0 || res.offload.ppe_flows >= 0 || res.offload.wed > 0 || res.offload.sw_cfg > 0 || res.offload.hw_cfg > 0)) {
                    var off = res.offload;
                    var offNode = document.getElementById('hw-offload');
                    if (offNode) {
                        offNode.innerHTML = '';
                        var addOff = function(lbl, val, color) {
                            offNode.appendChild(E('div', { class: 'hw-stat-row' }, [
                                E('span', { class: 'hw-stat-label' }, lbl),
                                E('span', { class: 'hw-stat-value', style: color ? 'color:' + color + ';' : '' }, val)
                            ]));
                        };
                        addOff('Flowtable Fast Path', off.ft > 0 ? 'Active' : 'Not configured', off.ft > 0 ? '#00bcd4' : '#9e9e9e');
                        addOff('Config (SW / HW)', (off.sw_cfg > 0 ? 'on' : 'off') + ' / ' + (off.hw_cfg > 0 ? 'on' : 'off'), (off.sw_cfg > 0 || off.hw_cfg > 0) ? null : '#9e9e9e');
                        // turboacc-style current/total bars
                        var mkOffBar = function(lbl, cur, tot, color) {
                            var pctB = tot > 0 ? Math.min(100, cur / tot * 100) : 0;
                            var valSpan = E('span', { class: 'hw-stat-value', style: 'color:' + color + ';' }, cur + ' / ' + tot);
                            offNode.appendChild(E('div', { class: 'hw-progress-item', style: 'margin-bottom: 8px;' }, [
                                E('div', { class: 'hw-progress-header' }, [
                                    E('span', { class: 'hw-stat-label' }, lbl),
                                    valSpan
                                ]),
                                E('div', { class: 'hw-bar-bg' }, [E('div', { class: 'hw-bar-fill', style: 'width: ' + pctB + '%; background: ' + color + ';' })])
                            ]));
                        };
                        var connNow = (res.cpu_meta && res.cpu_meta.conntrack) || 0;
                        if (off.sw_flows >= 0) mkOffBar('Offloaded / Active Flows', off.sw_flows, connNow, '#00bcd4');
                        // vs the real hardware table: 16384 entries per PPE on the
                        // upstream driver (turboacc-style bind/total display)
                        if (off.ppe_flows >= 0) mkOffBar('PPE Bind Entries', off.ppe_flows, off.ppe_total > 0 ? off.ppe_total : (off.sw_flows >= 0 ? off.sw_flows : off.ppe_flows), '#8bc34a');
                        if (off.wed > 0) addOff('WED (Wi-Fi offload)', off.wed + ' engine' + (off.wed > 1 ? 's' : ''), '#00bcd4');
                        offNode.appendChild(E('div', { style: 'font-size: 0.72em; opacity: 0.45; margin-top: 8px; text-align: center;' }, 'Flows bound to the PPE are routed in hardware and never touch the CPU'));
                    }
                    offloadCard.style.display = 'flex';
                } else {
                    offloadCard.style.display = 'none';
                }

                // Hardware Events — filtered dmesg lines with relative timestamps.
                if (res.hw_events && res.hw_events.length > 0) {
                    var evNode = document.getElementById('hw-events');
                    if (evNode) {
                        evNode.innerHTML = '';
                        res.hw_events.slice().reverse().forEach(function(line) {
                            var rel = '';
                            var m = line.match(/^\[\s*(\d+)\./);
                            if (m && res.uptime) {
                                var ago = res.uptime - parseInt(m[1]);
                                if (ago < 0) ago = 0;
                                rel = ago < 60 ? ago + 's ago' : ago < 3600 ? Math.floor(ago / 60) + 'm ago' : ago < 86400 ? Math.floor(ago / 3600) + 'h ago' : Math.floor(ago / 86400) + 'd ago';
                            }
                            var msg = line.replace(/^\[\s*[\d.]+\]\s*/, '');
                            evNode.appendChild(E('div', { style: 'display: flex; gap: 10px; align-items: baseline; font-size: 0.85em; padding: 4px 8px; background: rgba(128,128,128,0.05); border-radius: 4px;' }, [
                                E('span', { style: 'flex-shrink: 0; min-width: 62px; opacity: 0.55; font-size: 0.9em;' }, rel),
                                E('span', { style: 'font-family: monospace; font-size: 0.92em; opacity: 0.85; word-break: break-word; min-width: 0;' }, msg)
                            ]));
                        });
                    }
                    eventsCard.style.display = 'flex';
                } else {
                    eventsCard.style.display = 'none';
                }

                // Power & Fans — voltage rails / fans / power / current from
                // hwmon; hidden when the platform exposes none.
                if (res.hwmon_extra && res.hwmon_extra.length > 0) {
                    var hxNode = document.getElementById('hw-hwmon');
                    var hxShown = 0;
                    if (hxNode) {
                        hxNode.innerHTML = '';
                        res.hwmon_extra.forEach(function(hx) {
                            var txt = '';
                            if (hx.unit === 'V') txt = (hx.val / 1000).toFixed(2) + ' V';
                            else if (hx.unit === 'RPM') txt = hx.val + ' RPM';
                            else if (hx.unit === 'W') txt = (hx.val / 1e6).toFixed(2) + ' W';
                            else if (hx.unit === 'A') txt = (hx.val / 1000).toFixed(2) + ' A';
                            if (!txt) return;
                            hxShown++;
                            hxNode.appendChild(E('div', { class: 'hw-stat-row' }, [
                                E('span', { class: 'hw-stat-label' }, hx.name),
                                E('span', { class: 'hw-stat-value' }, txt)
                            ]));
                        });
                    }
                    hwmonCard.style.display = hxShown > 0 ? 'flex' : 'none';
                } else {
                    hwmonCard.style.display = 'none';
                }

                // System Info card
                var sysInfoGrid = document.getElementById('hw-sysinfo-grid');
                if (sysInfoGrid && res.sys_info) {
                    sysInfoGrid.innerHTML = '';
                    var si = res.sys_info;
                    // Header: board name + OS badge
                    var boardName = res.board || si.hostname || 'OpenWrt Device';
                    var siHeader = E('div', {style: 'display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:15px; padding-bottom:12px; border-bottom:1px solid var(--border-color,rgba(128,128,128,0.2));'});
                    var siTitle = E('div', {});
                    siTitle.appendChild(E('div', {style: 'font-size:1.1em; font-weight:600; opacity:0.9;'}, boardName));
                    if (res.model) siTitle.appendChild(E('div', {style: 'font-size:0.8em; opacity:0.55; margin-top:3px;'}, res.model));
                    siHeader.appendChild(siTitle);
                    var osStr = (si.distrib || 'OpenWrt') + (si.release ? ' ' + si.release : '');
                    if (si.revision) osStr += ' (' + si.revision + ')';
                    siHeader.appendChild(E('span', {style: 'font-size:0.85em; padding:4px 10px; border-radius:6px; background:rgba(0,188,212,0.1); border:1px solid rgba(0,188,212,0.3); color:#00bcd4; white-space:nowrap;'}, osStr));
                    sysInfoGrid.appendChild(siHeader);
                    // Info grid — auto-fill columns, wraps gracefully on mobile
                    var siGrid = E('div', {style: 'display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:5px 20px; margin-bottom:12px;'});
                    var addSi = function(lbl, val) {
                        siGrid.appendChild(E('div', {class:'hw-stat-row', style:'margin:0;'}, [
                            E('span', {class:'hw-stat-label', style:'font-size:0.88em;'}, lbl),
                            E('span', {class:'hw-stat-value', style:'font-size:0.88em;'}, val)
                        ]));
                    };
                    if (si.hostname) addSi('Hostname', si.hostname);
                    if (si.kver) addSi('Kernel', si.kver);
                    if (si.arch) addSi('Architecture', si.arch);
                    if (typeof si.wd_bootstatus === 'number' && si.wd_bootstatus >= 0) {
                        var wb = si.wd_bootstatus;
                        var wbTxt = 'Normal (power-on)';
                        var wbCol = '';
                        if (wb & 0x20) { wbTxt = 'Watchdog reset'; wbCol = ' color:#ff5252;'; }
                        else if (wb & 0x02) { wbTxt = 'Overheat reset'; wbCol = ' color:#ff5252;'; }
                        else if (wb !== 0) { wbTxt = 'Code 0x' + wb.toString(16); wbCol = ' color:#ffb300;'; }
                        siGrid.appendChild(E('div', {class:'hw-stat-row', style:'margin:0;'}, [
                            E('span', {class:'hw-stat-label', style:'font-size:0.88em;'}, 'Last Boot'),
                            E('span', {class:'hw-stat-value', style:'font-size:0.88em;' + wbCol}, wbTxt)
                        ]));
                    }
                    if (si.soc_family) addSi('SoC Family', si.soc_family);
                    if (si.soc_machine) addSi('Machine', si.soc_machine);
                    if (si.soc_id) addSi('SoC ID', si.soc_id);
                    if (si.soc_revision) addSi('SoC Revision', si.soc_revision);
                    if (si.soc_serial) addSi('SoC Serial', si.soc_serial);
                    if (si.l0 > 0) addSi('L0 Cache', fmtCacheBytes(si.l0));
                    if (si.l1d > 0 || si.l1i > 0) {
                        var cArr = [];
                        if (si.l1d > 0) cArr.push('L1d '+fmtCacheBytes(si.l1d));
                        if (si.l1i > 0) cArr.push('L1i '+fmtCacheBytes(si.l1i));
                        addSi('L1 Cache', cArr.join(' / '));
                    }
                    if (si.l2 > 0) addSi('L2 Cache', fmtCacheBytes(si.l2));
                    if (si.l3 > 0) addSi('L3 Cache', fmtCacheBytes(si.l3));
                    if (si.l4 > 0) addSi('L4 Cache', fmtCacheBytes(si.l4));
                    sysInfoGrid.appendChild(siGrid);
                    // CPU Security vulnerability chips
                    if (si.vulns && typeof si.vulns === 'object' && Object.keys(si.vulns).length > 0) {
                        var vulnDiv = E('div', {style: 'padding-top:10px; border-top:1px solid var(--border-color,rgba(128,128,128,0.15));'});
                        vulnDiv.appendChild(E('div', {style: 'font-size:0.75em; opacity:0.5; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;'}, 'CPU Security'));
                        var chipRow = E('div', {style: 'display:flex; flex-wrap:wrap; gap:6px;'});
                        for (var vn in si.vulns) {
                            var vst = si.vulns[vn];
                            var isOk = vst.indexOf('Not affected') === 0;
                            var isMit = vst.indexOf('Mitigated') === 0;
                            var vc = isOk ? '#00bcd4' : isMit ? '#ffb300' : '#ff5252';
                            var vdn = vn.replace(/_/g, ' ');
                            var vshort = isOk ? 'OK' : isMit ? 'Mitigated' : 'Vulnerable';
                            chipRow.appendChild(E('span', {style: 'font-size:0.75em; padding:3px 8px; border-radius:4px; border:1px solid '+vc+'44; color:'+vc+'; background:'+vc+'18; white-space:nowrap;'}, vdn+': '+vshort));
                        }
                        vulnDiv.appendChild(chipRow);
                        sysInfoGrid.appendChild(vulnDiv);
                    }
                }

                applyCardVisibility();
            }).catch(function(err) {
                console.error(err);
            }).then(function() { self.infoBusy = false; });
        };
        poll.add(infoTick, 3);
        // First paint NOW — don't wait for LuCI's poll to align to its 3s
        // boundary (that alignment is why the hardware cards used to appear
        // seconds after the ping card).
        infoTick();
        pingTick();

        return container;
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
