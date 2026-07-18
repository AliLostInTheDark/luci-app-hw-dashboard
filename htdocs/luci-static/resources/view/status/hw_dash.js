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
var callHwGetCpuPerf = rpc.declare({
    object: 'luci.hwdash',
    method: 'get_cpu_perf',
    expect: {}
});
var callHwSetCpuPerf = rpc.declare({
    object: 'luci.hwdash',
    method: 'set_cpu_perf',
    params: ['perf'],
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
        var style = E('style', {}, ' .hw-dashboard { display: flex; flex-wrap: wrap; align-items: stretch; gap: 20px; padding: 15px; font-family: system-ui, -apple-system, sans-serif; width: 100%; max-width: 100%; overflow: hidden; } .hw-dashboard * { box-sizing: border-box; } .hw-thermals-container { display: flex; flex-direction: row; width: 100%; height: 100%; } .hw-thermals-col { flex: 1; } .hw-thermals-col-left { padding-right: 15px; } .hw-thermals-col-mid { padding: 0 15px; } .hw-thermals-col-right { padding-left: 15px; } .hw-thermals-title { font-size: 0.85em; opacity: 0.6; margin-bottom: 10px; text-align: center; } .hw-thermals-divider { width: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 10px 15px 30px 15px; } @media (max-width: 768px) { .hw-thermals-container { flex-direction: column; } .hw-thermals-col { padding: 0 !important; } .hw-thermals-divider { width: auto; height: 1px; margin: 25px 0; } } .hw-meta-grid { margin-top: 15px; font-size: 0.8em; color: currentColor; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; opacity: 0.8; width: 75%; margin-left: auto; margin-right: auto; } @media (max-width: 480px) { .hw-meta-grid { width: 100%; font-size: 0.75em; } .hw-dial { transform: scale(0.9); } .hw-card { padding: 15px; } } .hw-card { flex: 1 1 280px; background: var(--background-color-high, rgba(128, 128, 128, 0.05)); border: 1px solid var(--border-color, rgba(128, 128, 128, 0.2)); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-color, inherit); position: relative; box-shadow: 0 4px 10px rgba(0,0,0,0.1); max-width: 100%; overflow: hidden; } .hw-card.wide { flex: 1 1 100%; align-items: stretch; } .hw-card h3 { margin: 0 0 20px 0; font-size: 1.1em; color: var(--text-color, inherit); opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; text-align: center; word-break: break-word; line-height: 1.3; }.hw-dial { position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center; margin: 0 auto; } .hw-dial svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform: rotate(-90deg); } .hw-dial-bg { fill: none; stroke: rgba(128, 128, 128, 0.2); stroke-width: 10; } .hw-dial-progress { fill: none; stroke-width: 10; stroke-linecap: round; transition: stroke-dasharray 0.5s ease; } .hw-dial-text { font-size: 2.2em; font-weight: 600; z-index: 1; } .hw-dial-subtext { position: absolute; bottom: 25px; font-size: 0.9em; opacity: 0.7; z-index: 1; } .hw-stats-list { width: 100%; display: flex; flex-direction: column; gap: 12px; } .hw-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 30px; width: 100%; } .hw-stat-row { display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 8px; } .hw-stat-label { opacity: 0.8; font-size: 0.95em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex-shrink: 1; margin-right: 10px; } .hw-stat-value { font-weight: bold; font-size: 0.95em; white-space: nowrap; flex-shrink: 0; } .hw-progress-item { display: flex; flex-direction: column; margin-bottom: 15px; width: 100%; } .hw-progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; width: 100%; min-width: 0; } .hw-bar-bg { width: 100%; height: 6px; background: var(--border-color, rgba(128, 128, 128, 0.2)); border-radius: 3px; overflow: hidden; margin-top: 6px; } .hw-bar-fill { height: 100%; transition: width 0.5s ease; } .hw-temp-badge { padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 0.9em; white-space: nowrap; } .hw-temp-crit { animation: hwTempPulse 1.1s ease-in-out infinite; } @keyframes hwTempPulse { 0%, 100% { box-shadow: 0 0 3px rgba(255,23,68,0.5); } 50% { box-shadow: 0 0 14px rgba(255,23,68,0.95); } } #hw-nand-row { align-items: flex-start; } @media (max-width: 768px) { #hw-nand-row { align-items: stretch; } #hw-nand-row > .hw-thermals-col { width: 100%; min-width: 0; } #hw-nand-row > .hw-thermals-divider { margin: 12px 0; } } .hw-core-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; width: 100%; } .hw-core-cell { background: rgba(128, 128, 128, 0.05); border: 1px solid var(--border-color, rgba(128, 128, 128, 0.15)); border-radius: 8px; padding: 10px 14px; } .hw-core-cell .hw-progress-header { margin-bottom: 6px; } .cbi-value { min-width: 0; } .cbi-value .cbi-value-title { flex-shrink: 0; } ');
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
        var chanFreq = function(band, ch) {
            if (band.indexOf('2.4') !== -1) return ch === 14 ? 2484 : 2412 + (ch - 1) * 5;
            if (band.indexOf('6') !== -1) return 5950 + ch * 5;
            return 5000 + ch * 5;
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
            var fmt = function(lo, hi, dfs) {
                var fl = chanFreq(band, lo), fh = chanFreq(band, hi);
                var chTxt = lo === hi ? '' + lo : lo + '-' + hi;
                var frTxt = fl === fh ? fl + ' MHz' : fl + '-' + fh + ' MHz';
                return chTxt + ' (' + frTxt + (dfs ? ', DFS' : '') + ')';
            };
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
        var fmtCacheBytes = function(b) { return b >= 1048576 ? (b/1048576).toFixed(0)+' MB' : (b/1024).toFixed(0)+' KB'; };
        var getPhysicalRamTotal = function(memTotalKb) {
            var sizesMB = [32, 64, 128, 256, 512, 1024, 1536, 2048, 3072, 4096, 6144, 8192, 12288, 16384, 24576, 32768, 65536];
            var memTotalMB = memTotalKb / 1024;
            for (var i = 0; i < sizesMB.length; i++) {
                if (memTotalMB <= sizesMB[i]) return sizesMB[i] * 1024;
            }
            return memTotalKb;
        };
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
        var PING_COLORS = ['#00bcd4', '#ffb300', '#e91e63', '#8bc34a', '#b388ff', '#ff7043', '#4dd0e1', '#f06292', '#ffd54f'];
        var PING_WINDOW = 120;
        var PING_AGG_KEEP = 1080;
        var PING_VIEWS = {
            '2m':  { raw: true,  pts: 120, label: '−2 min',  step: 1 },
            '5m':  { group: 1,   pts: 30,  label: '−5 min',  step: 10 },
            '10m': { group: 1,   pts: 60,  label: '−10 min', step: 10 },
            '15m': { group: 1,   pts: 90,  label: '−15 min', step: 10 },
            '1h':  { group: 3,   pts: 120, label: '−1 h',    step: 30 },
            '3h':  { group: 9,   pts: 120, label: '−3 h',    step: 90 }
        };
        var TEMP_WINDOW = 200;
        var TEMP_AGG_KEEP = 360;
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
                        var isPing = opts.csvName === 'ping';
                        var head = [isPing ? 'sample_idx' : 'offset_s'];
                        var cols = [];
                        var allHist = P.hist || {};
                        P.keys.forEach(function(k) { head.push('"' + allHist[k].label + '"'); cols.push(isPing ? allHist[k].allData : P.series[k]); });
                        var maxLen = 0;
                        cols.forEach(function(c) { maxLen = Math.max(maxLen, c.length); });
                        var lines = [head.join(',')];
                        for (var r = 0; r < maxLen; r++) {
                            var row = [isPing ? String(r + 1) : String(-(maxLen - 1 - r) * vw.step)];
                            cols.forEach(function(c) {
                                var idx = r - (maxLen - c.length);
                                var p = idx >= 0 ? c[idx] : null;
                                if (isPing) {
                                    row.push(p !== null && p !== undefined ? p.toFixed(1) : (p === null ? 'Timeout' : ''));
                                } else {
                                    row.push(p && p.v !== null ? p.v.toFixed(1) : '');
                                }
                            });
                            lines.push(row.join(','));
                        }
                        if (isPing) {
                            lines.push('');
                            lines.push('---');
                            lines.push('Ping Statistics Summary');
                            lines.push('Target,Sent,Received,Timeouts,% Loss,Min,Max,Avg');
                            var grandSent = 0, grandReceived = 0, grandTimeouts = 0, grandSum = 0, grandMin = null, grandMax = null;
                            P.keys.forEach(function(k) {
                                var d = allHist[k].allData;
                                var sent = d.length;
                                var received = 0;
                                var timeouts = 0;
                                var sum = 0, min = null, max = null;
                                d.forEach(function(v) {
                                    if (v !== null && v !== undefined) {
                                        received++;
                                        sum += v;
                                        if (min === null || v < min) min = v;
                                        if (max === null || v > max) max = v;
                                    } else if (v === null) {
                                        timeouts++;
                                    }
                                });
                                var lossPct = sent > 0 ? (timeouts / sent * 100).toFixed(1) : '0.0';
                                var avg = received > 0 ? (sum / received).toFixed(1) : '';
                                lines.push(['"' + allHist[k].label + '"', sent, received, timeouts, lossPct + '%', min !== null ? min.toFixed(1) : '', max !== null ? max.toFixed(1) : '', avg].join(','));
                                grandSent += sent;
                                grandReceived += received;
                                grandTimeouts += timeouts;
                                grandSum += sum;
                                if (min !== null && (grandMin === null || min < grandMin)) grandMin = min;
                                if (max !== null && (grandMax === null || max > grandMax)) grandMax = max;
                            });
                            var grandLossPct = grandSent > 0 ? (grandTimeouts / grandSent * 100).toFixed(1) : '0.0';
                            var grandAvg = grandReceived > 0 ? (grandSum / grandReceived).toFixed(1) : '';
                            lines.push('');
                            lines.push('Overall (All Targets Combined)');
                            lines.push('Total Sent,Total Received,Total Timeouts,Overall % Loss,Overall Min,Overall Max,Overall Avg');
                            lines.push([grandSent, grandReceived, grandTimeouts, grandLossPct + '%', grandMin !== null ? grandMin.toFixed(1) : '', grandMax !== null ? grandMax.toFixed(1) : '', grandAvg].join(','));
                        }
                        var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
                        var a = E('a', { href: URL.createObjectURL(blob), download: 'hwdash-' + opts.csvName + '-' + (isPing ? 'all' : P.view) + '-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.csv' });
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        URL.revokeObjectURL(a.href);
                    }
                }, '⤓ CSV'));
            }
            styleBtns();
            el.appendChild(ctlRow);
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
                        yhi = Math.max(opts.yFloor || 20, all[all.length - 1]);
                        yhi = Math.ceil(yhi / 10) * 10;
                    }
                }
                var yFor = function(v) { return GTOP + plotH * (1 - (Math.min(v, yhi) - ylo) / (yhi - ylo)); };
                var spikeThresh = null;
                if (opts.spikeNulls && all.length >= 5) {
                    var p90 = pingPct(all, 0.90);
                    spikeThresh = Math.max(p90 * 2, 50);
                }
                var svg = '';
                gridFracs.forEach(function(g) {
                    var gy = (GTOP + plotH * (1 - g)).toFixed(1);
                    svg += '<line x1="0" y1="' + gy + '" x2="' + GW + '" y2="' + gy + '" stroke="rgba(128,128,128,0.18)" stroke-width="1" stroke-dasharray="3,4" vector-effect="non-scaling-stroke"/>';
                });
                var lossXs = {};
                var spikeAnnotations = {};
                P.keys.forEach(function(k) {
                    var t = hist[k];
                    if (t.hidden) return;
                    var sr = series[k];
                    var n = sr.length;
                    var xAt = function(i) { return GW - (n - 1 - i) * step; };
                    var ys = new Array(n), isTO = new Array(n), anyOk = false;
                    for (var i = 0; i < n; i++) {
                        var x = xAt(i);
                        if (opts.lossTicks && sr[i].loss) lossXs[x.toFixed(1)] = 1;
                        if (sr[i].v === null) {
                            ys[i] = null;
                            isTO[i] = !!opts.spikeNulls;
                        } else {
                            ys[i] = yFor(sr[i].v);
                            isTO[i] = false;
                            anyOk = true;
                            if (spikeThresh && sr[i].v > spikeThresh) {
                                var rounded = Math.round(sr[i].v);
                                if (!spikeAnnotations[rounded] || sr[i].v > spikeAnnotations[rounded].v) spikeAnnotations[rounded] = { v: sr[i].v, y: ys[i] };
                            }
                        }
                    }
                    if (!anyOk) return;
                    for (i = 0; i < n; i++) {
                        if (ys[i] !== null) continue;
                        var pj = i - 1; while (pj >= 0 && ys[pj] === null) pj--;
                        var nj = i + 1; while (nj < n && ys[nj] === null) nj++;
                        ys[i] = (pj >= 0 && nj < n) ? ys[pj] + (ys[nj] - ys[pj]) * (i - pj) / (nj - pj) : (pj >= 0 ? ys[pj] : ys[nj]);
                    }
                    var pts = [];
                    for (i = 0; i < n; i++) pts.push(xAt(i).toFixed(1) + ',' + ys[i].toFixed(1));
                    svg += '<polyline fill="none" stroke="' + t.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" points="' + pts.join(' ') + '"/>';
                    var run = null;
                    for (i = 0; i <= n; i++) {
                        var to = i < n && isTO[i];
                        if (to && !run) run = { s: i, e: i };
                        else if (to) run.e = i;
                        else if (run) {
                            var rs = Math.max(0, run.s - 1), re = Math.min(n - 1, run.e + 1), seg = [];
                            for (var j = rs; j <= re; j++) seg.push(xAt(j).toFixed(1) + ',' + ys[j].toFixed(1));
                            svg += '<polyline fill="none" stroke="#ff5252" stroke-width="2.5" stroke-dasharray="1,4" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity="0.9" points="' + seg.join(' ') + '"/>';
                            run = null;
                        }
                    }
                    var spikePts = [];
                    for (i = 0; i < n; i++) {
                        if (isTO[i]) {
                            if (i !== n - 1) svg += '<circle cx="' + xAt(i).toFixed(1) + '" cy="' + ys[i].toFixed(1) + '" r="3" fill="var(--background-color-high, #1b1e23)" stroke="#ff5252" stroke-width="1.6"/>';
                        } else if (spikeThresh && sr[i].v !== null && sr[i].v > spikeThresh) {
                            spikePts.push([xAt(i), ys[i]]);
                        }
                    }
                    spikePts.forEach(function(sp) {
                        var sx = sp[0], sy = sp[1];
                        svg += '<polygon points="' + (sx - 4).toFixed(1) + ',' + sy.toFixed(1) + ' ' + (sx + 4).toFixed(1) + ',' + sy.toFixed(1) + ' ' + sx.toFixed(1) + ',' + (sy - 7).toFixed(1) + '" fill="' + t.color + '" opacity="0.85"/>';
                    });
                    svg += '<circle cx="' + xAt(n - 1).toFixed(1) + '" cy="' + ys[n - 1].toFixed(1) + '" r="3" fill="' + (isTO[n - 1] ? '#ff5252' : t.color) + '"/>';
                });
                if (opts.spikeNulls) {
                    var annKeys = Object.keys(spikeAnnotations);
                    annKeys.sort(function(a, b) { return spikeAnnotations[b].v - spikeAnnotations[a].v; });
                    annKeys.slice(0, 2).forEach(function(ak) {
                        var ann = spikeAnnotations[ak];
                        svg += '<line x1="0" y1="' + ann.y.toFixed(1) + '" x2="' + GW + '" y2="' + ann.y.toFixed(1) + '" stroke="rgba(255,23,68,0.25)" stroke-width="1" stroke-dasharray="4,3" vector-effect="non-scaling-stroke"/>';
                        svg += '<text x="' + (GW - 2) + '" y="' + (ann.y - 3).toFixed(1) + '" text-anchor="end" fill="rgba(255,23,68,0.6)" font-size="9" font-family="system-ui,sans-serif">' + Math.round(ann.v) + ' ms</text>';
                    });
                }
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
                    if (plot.getBoundingClientRect().width) applyHover(P.hoverFrac);
                    else window.requestAnimationFrame(function() { if (P.hoverFrac != null) applyHover(P.hoverFrac); });
                }
            };
            return { el: el, update: update, currentSeries: function() { return P.series; }, currentView: function() { return P.view; } };
        };
        var buildSensorRow = function() {
            var dot = E('span', { style: 'width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;' });
            var nameSpan = E('span', {});
            var badge = E('span', { class: 'hw-temp-badge' });
            var passSpan = E('span', { style: 'color: #ffb300; background: rgba(255,179,0,0.15); padding: 2px 6px; border-radius: 4px; font-weight: 600; letter-spacing: 0.5px; display: none;' });
            var critSpan = E('span', { style: 'color: #ff1744; background: rgba(255,23,68,0.15); padding: 2px 6px; border-radius: 4px; font-weight: 600; letter-spacing: 0.5px; display: none;' });
            var tripsDiv = E('div', { style: 'display: none; justify-content: flex-end; gap: 6px; font-size: 0.75em; padding-top: 6px;' }, [passSpan, critSpan]);
            var el = E('div', { style: 'padding: 5px 0; border-bottom: 1px solid var(--border-color, rgba(128,128,128,0.1));' }, [
                E('div', { class: 'hw-stat-row', style: 'border-bottom: none; padding-bottom: 0;' }, [
                    E('span', { class: 'hw-stat-label', style: 'display: inline-flex; align-items: center; gap: 7px;' }, [dot, nameSpan]),
                    badge
                ]),
                tripsDiv
            ]);
            return { el: el, dot: dot, name: nameSpan, badge: badge, tripsDiv: tripsDiv, passSpan: passSpan, critSpan: critSpan };
        };
        var patchSensorRow = function(entry, s) {
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
            entry.dot.style.background = s.color || color;
            entry.name.textContent = s.name;
            entry.badge.className = 'hw-temp-badge' + hotCls;
            entry.badge.style.color = color;
            entry.badge.style.background = bgCol;
            entry.badge.textContent = tempDisplay;
            entry.tripsDiv.style.display = (s.pass || s.crit) ? 'flex' : 'none';
            if (s.pass) { entry.passSpan.style.display = ''; entry.passSpan.textContent = 'PASS ' + s.pass.toFixed(0) + '°'; } else { entry.passSpan.style.display = 'none'; }
            if (s.crit) { entry.critSpan.style.display = ''; entry.critSpan.textContent = 'CRIT ' + s.crit.toFixed(0) + '°'; } else { entry.critSpan.style.display = 'none'; }
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
            if (b >= 1099511627776) return (b / 1099511627776).toFixed(2) + ' TB';
            if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
            if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
            if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
            return b + ' B';
        };
        var makeRow = function(label, val, color, wrap) {
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
            class: 'hw-core-grid'
        });
        var coresCard = E('div', {class: 'hw-card wide', style: 'justify-content: flex-start; align-items: stretch;'}, [
            E('h3', {}, 'Per-Core Usage'),
            coresNode
        ]);
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
        var thermWrapper = E('div', {
            id: 'hw-therm-wrapper',
            style: 'display: contents;'
        });
        var thermGraphNode = E('div', { id: 'hw-therm-graph-wrapper', style: 'width: 100%;' });
        var ethCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Ports Topology'), E('div', { id: 'hw-eth-links', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0; display: flex; flex-direction: column; gap: 8px;' })]);
        var pcieCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'PCI-e Topology'), E('div', { id: 'hw-pcie', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0; display: flex; flex-direction: column; gap: 8px;' })]);
        var pingGraphWrapper = E('div', { style: 'width: 100%;' });
        var pingTableWrapper = E('div', { style: 'width: 100%;' });
        var pingGraphNode = E('div', { id: 'hw-ping', style: 'width: 100%;' }, [pingGraphWrapper, pingTableWrapper]);
        var pingCard = E('div', { class: 'hw-card wide', style: 'justify-content: flex-start; display: none;' }, [
            E('h3', {}, 'Ping Latency'),
            pingGraphNode,
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
        container.appendChild(coresCard);
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
        var loadLS = function(key, dflt) {
            try {
                var v = JSON.parse(localStorage.getItem(key));
                return v == null ? dflt : v;
            } catch (e) { return dflt; }
        };
        var savedCfg = self.savedConfig || {};
        self.hiddenCards = Array.isArray(savedCfg.hidden) ? savedCfg.hidden : loadLS('hwdash.hiddenCards', []);
        self.pingTargets = Array.isArray(savedCfg.targets) ? savedCfg.targets : loadLS('hwdash.pingTargets', []);
        self.disabledPings = Array.isArray(savedCfg.disabledPings) ? savedCfg.disabledPings : [];
        var saveConfig = function() {
            callHwSetConfig({ hidden: self.hiddenCards, targets: self.pingTargets, disabledPings: self.disabledPings }).catch(function() {});
        };
        if (!Array.isArray(savedCfg.hidden) && (self.hiddenCards.length > 0 || self.pingTargets.length > 0)) {
            saveConfig();
        }
        var DEFAULT_PING_TARGETS = [
            { host: 'dns.google', fam: 4 }, { host: 'dns.google', fam: 6 },
            { host: 'one.one.one.one', fam: 4 }, { host: 'one.one.one.one', fam: 6 },
            { host: 'google.com', fam: 4 }, { host: 'google.com', fam: 6 },
            { host: 'youtube.com', fam: 4 }, { host: 'youtube.com', fam: 6 }
        ];
        var expandFams = function(t) { return String(t.fam) === 'both' ? [4, 6] : [parseInt(t.fam) === 6 ? 6 : 4]; };
        var isPingDisabled = function(host, fam) {
            return self.disabledPings.indexOf(host + '|' + fam) !== -1;
        };
        var isGwDisabled = function(fam) {
            return self.disabledPings.indexOf('__gateway|' + fam) !== -1;
        };
        var pingTargetPairs = function() {
            var seen = {};
            var pairs = [];
            DEFAULT_PING_TARGETS.concat(self.pingTargets).forEach(function(t) {
                expandFams(t).forEach(function(fam) {
                    var key = t.host + '|' + fam;
                    if (seen[key]) return;
                    seen[key] = true;
                    if (isPingDisabled(t.host, fam)) return;
                    pairs.push(t.host + ' ' + fam);
                });
            });
            return pairs;
        };
        var pingStatColor = function(ms) {
            if (ms === null || ms === undefined) return '';
            if (ms <= 5) return '#00e676';
            if (ms <= 15) return '#69f0ae';
            if (ms <= 30) return '#b2ff59';
            if (ms <= 50) return '#ffee58';
            if (ms <= 100) return '#ffb300';
            if (ms <= 200) return '#ff7043';
            return '#ff1744';
        };
        var cardRegistry = {
            sysinfo: { nodes: [sysCard], label: 'System Info', show: 'flex' },
            cpu: { nodes: [cpuCard.node], label: 'CPU', show: 'flex' },
            ram: { nodes: [ramCard.node], label: 'Memory', show: 'flex' },
            load: { nodes: [advCard], label: 'CPU Detailed Load', show: 'flex' },
            cores: { nodes: [coresCard], label: 'Per-Core Usage', show: 'flex' },
            hwmon: { nodes: [hwmonCard], label: 'Power & Fans', show: null },
            offload: { nodes: [offloadCard], label: 'Offload Engines', show: null },
            irq: { nodes: [irqCard], label: 'Interrupts', show: null },
            events: { nodes: [eventsCard], label: 'Hardware Events', show: null },
            storage: { nodes: [dskCard.node], label: 'Internal Storage', show: 'flex' },
            ext: { nodes: [extCard, myExtWrapper], label: 'External Storage', show: null },
            ports: { nodes: [ethCard], label: 'Ports Topology', show: null },
            pcie: { nodes: [pcieCard], label: 'PCI-e', show: null },
            ping: { nodes: [pingCard], label: 'Ping Latency', show: null },
            ping_graph: { nodes: [pingGraphWrapper], label: 'Ping Graph', show: 'block' },
            wifi: { nodes: [wifiCard], label: 'Wi-Fi PHY & Spectrum', show: null },
            thermal: { nodes: [thermWrapper], label: 'Thermal Sensors', show: 'contents' },
            therm_graph: { nodes: [thermGraphNode], label: 'Thermal Graph', show: 'block' }
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
        var cardChecks = E('div', { class: 'cbi-value-field', style: 'display: flex; flex-wrap: wrap; gap: 4px 18px; margin-bottom: 14px;' });
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
        var targetList = E('div', { class: 'cbi-value-field', style: 'margin-bottom: 10px;' });
        var makePingToggle = function(host, fam, label, isCustom, customIdx) {
            var dKey = host + '|' + fam;
            var cb = E('input', {
                type: 'checkbox',
                change: function(ev) {
                    var idx = self.disabledPings.indexOf(dKey);
                    if (ev.target.checked && idx !== -1) self.disabledPings.splice(idx, 1);
                    else if (!ev.target.checked && idx === -1) self.disabledPings.push(dKey);
                    saveConfig();
                    self.pingHist = {};
                }
            });
            cb.checked = self.disabledPings.indexOf(dKey) === -1;
            var kids = [cb, E('span', { style: 'flex: 1;' }, label)];
            if (isCustom) {
                kids.push(E('button', {
                    class: 'cbi-button cbi-button-remove',
                    style: 'padding: 1px 6px; font-size: 0.8em; margin-left: 4px;',
                    title: 'Remove target',
                    click: function() {
                        self.pingTargets.splice(customIdx, 1);
                        var di = self.disabledPings.indexOf(dKey);
                        if (di !== -1) self.disabledPings.splice(di, 1);
                        saveConfig();
                        self.pingHist = {};
                        renderTargetList();
                    }
                }, '\u2715'));
            }
            return E('label', { style: 'display: inline-flex; align-items: center; gap: 6px; font-size: 0.88em; cursor: pointer; min-width: 200px;' }, kids);
        };
        var renderTargetList = function() {
            targetList.innerHTML = '';
            targetList.appendChild(E('div', { style: 'font-size: 0.78em; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;' }, 'Default Targets'));
            var defGrid = E('div', { style: 'display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 4px 18px; margin-bottom: 10px;' });
            DEFAULT_PING_TARGETS.forEach(function(t) {
                expandFams(t).forEach(function(fam) {
                    defGrid.appendChild(makePingToggle(t.host, fam, t.host + ' (IPv' + fam + ')', false, -1));
                });
            });
            targetList.appendChild(defGrid);
            targetList.appendChild(E('div', { style: 'font-size: 0.78em; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;' }, 'Gateway (auto-detected)'));
            var gwGrid = E('div', { style: 'display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 4px 18px; margin-bottom: 10px;' });
            gwGrid.appendChild(makePingToggle('__gateway', 4, 'Gateway (IPv4)', false, -1));
            gwGrid.appendChild(makePingToggle('__gateway', 6, 'Gateway (IPv6)', false, -1));
            targetList.appendChild(gwGrid);
            if (self.pingTargets.length > 0) {
                targetList.appendChild(E('div', { style: 'font-size: 0.78em; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;' }, 'Custom Targets'));
                var custGrid = E('div', { style: 'display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 4px 18px; margin-bottom: 10px;' });
                self.pingTargets.forEach(function(t, i) {
                    expandFams(t).forEach(function(fam) {
                        custGrid.appendChild(makePingToggle(t.host, fam, t.host + ' (IPv' + fam + ')', true, i));
                    });
                });
                targetList.appendChild(custGrid);
            }
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
                    self.disabledPings = [];
                    saveConfig();
                    self.pingHist = {};
                    renderTargetList();
                }
            }, 'Reset to defaults')
        ]));
        settingsPanel.appendChild(E('h4', {
            style: 'margin: 18px 0 8px 0; padding-top: 12px; border-top: 1px solid var(--border-color, rgba(128,128,128,0.2)); font-size: 0.85em; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px;'
        }, 'CPU Performance'));
        var cpuPerfBody = E('div', { style: 'opacity: 0.5;' }, 'Loading…');
        var cpuPerfSection = E('div', {}, [cpuPerfBody]);
        settingsPanel.appendChild(cpuPerfSection);
        var cbiRow = function(labelTxt, field) {
            return E('div', { class: 'cbi-value', style: 'display: flex; align-items: center; gap: 12px; margin-bottom: 8px;' }, [
                E('label', { class: 'cbi-value-title', style: 'min-width: 160px; opacity: 0.8;' }, labelTxt),
                E('div', { class: 'cbi-value-field' }, field)
            ]);
        };
        var buildCpuPerfForm = function(perf) {
            cpuPerfBody.innerHTML = '';
            cpuPerfBody.style.opacity = '1';
            var mhz = function(khz) { return Math.round(khz / 1000); };
            var govSel = E('select', { class: 'cbi-input-select' });
            (perf.available_governors || []).forEach(function(g) {
                govSel.appendChild(E('option', { value: g }, g));
            });
            govSel.value = perf.governor;
            var infoMinMhz = mhz(perf.cpuinfo_min_freq || 0);
            var infoMaxMhz = mhz(perf.cpuinfo_max_freq || perf.max_freq || 0);
            var minInput = E('input', {
                type: 'number', class: 'cbi-input-text', style: 'width: 100px;',
                min: infoMinMhz, max: infoMaxMhz, value: mhz(perf.min_freq)
            });
            var maxInput = E('input', {
                type: 'number', class: 'cbi-input-text', style: 'width: 100px;',
                min: infoMinMhz, max: infoMaxMhz, value: mhz(perf.max_freq)
            });
            var turboCb = E('input', { type: 'checkbox' });
            turboCb.checked = !!perf.turbo_enabled;
            var msg = E('span', { style: 'font-size: 0.85em; margin-left: 10px;' });
            var applyBtn = E('button', {
                class: 'cbi-button cbi-button-apply',
                click: function() {
                    var minV = parseInt(minInput.value), maxV = parseInt(maxInput.value);
                    if (isNaN(minV) || isNaN(maxV) || minV < infoMinMhz || maxV > infoMaxMhz || minV > maxV) {
                        msg.textContent = 'Invalid range (' + infoMinMhz + '–' + infoMaxMhz + ' MHz, min ≤ max)';
                        msg.style.color = '#ff5252';
                        return;
                    }
                    applyBtn.disabled = true;
                    msg.textContent = 'Applying…';
                    msg.style.color = '';
                    callHwSetCpuPerf({
                        perf: {
                            governor: govSel.value,
                            min_freq: minV * 1000,
                            max_freq: maxV * 1000,
                            turbo_enabled: turboCb.checked
                        }
                    }).then(function(res) {
                        applyBtn.disabled = false;
                        if (res && res.result === 'ok') {
                            msg.textContent = '✓ Applied';
                            msg.style.color = '#8bc34a';
                            return callHwGetCpuPerf().then(function(p) { if (p) buildCpuPerfForm(p); });
                        } else {
                            msg.textContent = 'Rejected — check governor/frequency range';
                            msg.style.color = '#ff5252';
                        }
                    }).catch(function() {
                        applyBtn.disabled = false;
                        msg.textContent = 'Request failed';
                        msg.style.color = '#ff5252';
                    });
                }
            }, 'Apply');
            cpuPerfBody.appendChild(cbiRow('Current Frequency:', E('span', {}, mhz(perf.cur_freq) + ' MHz')));
            cpuPerfBody.appendChild(cbiRow('Governor:', govSel));
            cpuPerfBody.appendChild(cbiRow('Min Frequency (MHz):', minInput));
            cpuPerfBody.appendChild(cbiRow('Max Frequency (MHz):', maxInput));
            if (perf.turbo_available) {
                cpuPerfBody.appendChild(cbiRow('Turbo / Boost:', turboCb));
            }
            cpuPerfBody.appendChild(cbiRow('', [applyBtn, msg]));
            cpuPerfBody.appendChild(E('div', { style: 'font-size: 0.78em; opacity: 0.5; margin-top: 4px;' },
                perf.persist_available
                    ? 'Applies immediately and persists across reboot (synced to /etc/config/cpu-perf).'
                    : 'Applies immediately; resets after reboot. Install luci-app-cpu-perf to persist.'));
        };
        var cpuPerfLoaded = false;
        var loadCpuPerf = function() {
            if (cpuPerfLoaded) return;
            cpuPerfLoaded = true;
            callHwGetCpuPerf().then(function(perf) {
                if (perf && perf.governor) {
                    buildCpuPerfForm(perf);
                } else {
                    cpuPerfBody.textContent = 'CPU frequency scaling not available on this device.';
                }
            }).catch(function() {
                cpuPerfBody.textContent = 'Failed to read CPU performance state.';
            });
        };
        settingsPanel.appendChild(E('div', { style: 'margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-color, rgba(128,128,128,0.2));' }, [
            E('button', {
                class: 'cbi-button cbi-button-action',
                click: function() {
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
                if (settingsPanel.style.display !== 'none') loadCpuPerf();
            }
        }, '\u2699 Settings');
        var settingsRow = E('div', { style: 'width: 100%; display: flex; justify-content: flex-end;' }, [settingsBtn]);
        container.insertBefore(settingsPanel, sysCard);
        container.insertBefore(settingsRow, settingsPanel);
        applyCardVisibility();
        var syncRows = function(container, cache, items, keyFn, buildFn, patchFn) {
            var seen = {};
            var prev = null;
            items.forEach(function(item, idx) {
                var k = keyFn(item, idx);
                seen[k] = true;
                var entry = cache[k];
                if (!entry) {
                    entry = cache[k] = buildFn(item, idx);
                    container.insertBefore(entry.el, prev ? prev.nextSibling : container.firstChild);
                } else {
                    var wantNext = prev ? prev.nextSibling : container.firstChild;
                    if (entry.el !== wantNext) container.insertBefore(entry.el, wantNext);
                }
                patchFn(entry, item, idx);
                prev = entry.el;
            });
            for (var k in cache) {
                if (!seen[k]) { cache[k].el.remove(); delete cache[k]; }
            }
        };
        var sigGate = function(cache, key, sig) {
            if (cache[key] === sig) return false;
            cache[key] = sig;
            return true;
        };
        var pingTick = function() {
            if (document.hidden) return Promise.resolve();
            if (self.hiddenCards && self.hiddenCards.indexOf('ping') !== -1) return Promise.resolve();
            var _pnow = Date.now();
            if (self.pingBusy && (_pnow - (self.pingBusyAt || 0)) < 10000) return Promise.resolve();
            self.pingBusy = true;
            self.pingBusyAt = _pnow;
            return callHwPing(pingTargetPairs()).then(function(res) {
                if (!res || !res.targets || res.targets.length === 0) return;
                if (!self.pingHist) self.pingHist = {};
                var hist = self.pingHist;
                res.targets.forEach(function(t, i) {
                    var key = t.host + '/v' + t.fam;
                    if (!hist[key]) {
                        var isGw = (res.gateway && t.host === res.gateway) ? 4 : (res.gateway6 && t.host === res.gateway6) ? 6 : 0;
                        if (isGw && isGwDisabled(isGw)) return;
                        hist[key] = {
                            label: isGw ? 'Gateway v' + isGw : t.host + ' (v' + t.fam + ')',
                            gw: isGw,
                            host: t.host,
                            fam: t.fam,
                            color: PING_COLORS[Object.keys(hist).length % PING_COLORS.length],
                            hidden: false,
                            data: [],
                            allData: [],
                            agg: [],
                            acc: { sum: 0, n: 0, loss: 0, cnt: 0 }
                        };
                    } else if (hist[key].gw && isGwDisabled(hist[key].gw)) {
                        delete hist[key];
                        return;
                    }
                    var h = hist[key];
                    if (t.ip) h.ip = t.ip;
                    if (t.rdns) h.rdns = t.rdns;
                    var v = typeof t.ms === 'number' ? t.ms : null;
                    h.data.push(v);
                    h.allData.push(v);
                    if (h.data.length > PING_WINDOW) h.data.shift();
                    h.acc.cnt++;
                    if (v === null) h.acc.loss++;
                    else { h.acc.sum += v; h.acc.n++; }
                    if (h.acc.cnt >= 10) {
                        h.agg.push({ a: h.acc.n > 0 ? h.acc.sum / h.acc.n : null, n: h.acc.n, loss: h.acc.loss });
                        if (h.agg.length > PING_AGG_KEEP) h.agg.shift();
                        h.acc = { sum: 0, n: 0, loss: 0, cnt: 0 };
                    }
                });
                if (!res.gateway6 && !isGwDisabled(6)) {
                    var gk6 = '__gw6na';
                    if (!hist[gk6]) {
                        hist[gk6] = {
                            label: 'Gateway v6', gw: 6, na: true, host: '', fam: 6,
                            color: '#9e9e9e', hidden: false,
                            data: [], allData: [], agg: [], acc: { sum: 0, n: 0, loss: 0, cnt: 0 }
                        };
                    }
                    var g6 = hist[gk6];
                    g6.data.push(null);
                    g6.allData.push(null);
                    if (g6.data.length > PING_WINDOW) g6.data.shift();
                } else if (hist['__gw6na'] && (res.gateway6 || isGwDisabled(6))) {
                    delete hist['__gw6na'];
                }
                var pgNode = document.getElementById('hw-ping');
                if (pgNode) {
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
                        pingGraphWrapper.innerHTML = '';
                        pingGraphWrapper.appendChild(self.pingPanel.el);
                        var tblWrap = E('div', { style: 'overflow-x: auto; margin-top: 10px;' });
                        var thStyle = 'text-align: right; padding: 3px 8px; opacity: 0.55; font-weight: 600; border-bottom: 1px solid var(--border-color, rgba(128,128,128,0.2));';
                        var divS = 'border-left: 1px solid var(--border-color, rgba(128,128,128,0.3));';
                        var tbl = E('table', { style: 'width: 100%; min-width: 620px; border-collapse: collapse; font-size: 0.78em;' });
                        tbl.appendChild(E('tr', {}, [
                            E('th', { style: thStyle + 'text-align: left; width: 1%; white-space: nowrap;' }, 'Protocol'),
                            E('th', { style: thStyle + 'text-align: left; white-space: nowrap;' + divS }, 'Target'),
                            E('th', { style: thStyle + 'text-align: left; white-space: nowrap;' + divS }, 'IP Address'),
                            E('th', { style: thStyle }, 'cur'), E('th', { style: thStyle }, 'min'),
                            E('th', { style: thStyle }, 'avg'), E('th', { style: thStyle }, 'p95'),
                            E('th', { style: thStyle }, 'max'), E('th', { style: thStyle }, 'jitter'),
                            E('th', { style: thStyle }, 'loss')
                        ]));
                        tblWrap.appendChild(tbl);
                        pingTableWrapper.innerHTML = '';
                        pingTableWrapper.appendChild(tblWrap);
                        self.pingTable = { tbl: tbl, rows: {}, sig: '', divS: divS };
                    }
                    self.pingPanel.update(hist);
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
                            var cells = {
                                target: E('td', { style: 'padding: 3px 8px; color: ' + t.color + '; white-space: nowrap; ' + pt.divS }),
                                ip: E('td', { style: 'padding: 3px 8px; color: ' + t.color + '; opacity: 0.85; font-family: monospace; font-size: 0.95em; white-space: nowrap; ' + pt.divS }),
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
                        row.cells.cur.style.color = last === null ? '#ff5252' : pingStatColor(last);
                        row.cells.min.textContent = fmt(vals.length ? vals[0] : null);
                        row.cells.min.style.color = vals.length ? pingStatColor(vals[0]) : '';
                        var avgVal = vals.length ? sum / vals.length : null;
                        row.cells.avg.textContent = fmt(avgVal);
                        row.cells.avg.style.color = avgVal !== null ? pingStatColor(avgVal) : '';
                        var p95Val = pingPct(vals, 0.95);
                        row.cells.p95.textContent = fmt(p95Val);
                        row.cells.p95.style.color = p95Val !== null ? pingStatColor(p95Val) : '';
                        row.cells.max.textContent = fmt(vals.length ? vals[vals.length - 1] : null);
                        row.cells.max.style.color = vals.length ? pingStatColor(vals[vals.length - 1]) : '';
                        var jitVal = jn > 0 ? jit / jn : null;
                        row.cells.jit.textContent = jitVal !== null ? jitVal.toFixed(1) : '—';
                        row.cells.jit.style.color = jitVal !== null ? pingStatColor(jitVal) : '';
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
            if (document.hidden) return Promise.resolve();
            var _inow = Date.now();
            if (self.infoBusy && (_inow - (self.infoBusyAt || 0)) < 10000) return Promise.resolve();
            self.infoBusy = true;
            self.infoBusyAt = _inow;
            return callHwInfo().then(function(res) {
                if (!res || !res.cpus) return;
                self.lastInfo = res;
                if (!self._sig) self._sig = {};
                var coresNode = document.getElementById('hw-cores');
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
                            var meta = res.cpu_meta || {};
                            var _cores = meta.cores || (res.cpus.length - 1);
                            var _threads = meta.threads || _cores;
                            var _si = res.sys_info || {};
                            var _cacheParts = [];
                            if (_si.l0 > 0) _cacheParts.push('L0 ' + fmtCacheBytes(_si.l0));
                            var _l1 = (_si.l1d || 0) + (_si.l1i || 0);
                            if (_l1 > 0) _cacheParts.push('L1 ' + fmtCacheBytes(_l1));
                            if (_si.l2 > 0) _cacheParts.push('L2 ' + fmtCacheBytes(_si.l2));
                            if (_si.l3 > 0) _cacheParts.push('L3 ' + fmtCacheBytes(_si.l3));
                            if (_si.l4 > 0) _cacheParts.push('L4 ' + fmtCacheBytes(_si.l4));
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
                            var cpuStatRows = [{ k: 'cores', label: 'Cores / Threads', val: _cores + 'C / ' + _threads + 'T' }];
                            cpuStatRows.push({ k: 'cache', label: 'Cache', val: _cacheParts.length > 0 ? _cacheParts.join(' + ') : '0 MB' });
                            if (curFreq) cpuStatRows.push({ k: 'curfreq', label: 'Current Freq', val: curFreq });
                            if (maxFreqStr) cpuStatRows.push({ k: 'maxfreq', label: 'Max Freq', val: maxFreqStr });
                            if (meta.tasks) cpuStatRows.push({ k: 'tasks', label: 'Tasks (Run/Total)', val: meta.tasks });
                            if (!self._cpuStatsCache) self._cpuStatsCache = {};
                            syncRows(cpuStats, self._cpuStatsCache, cpuStatRows, function(r) { return r.k; }, function(r) {
                                var val = E('span', { class: 'hw-stat-value' });
                                var elr = E('div', { class: 'hw-stat-row', style: 'margin-bottom: 2px;' }, [E('span', { class: 'hw-stat-label' }, r.label), val]);
                                return { el: elr, val: val };
                            }, function(entry, r) { entry.val.textContent = r.val; });
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
                                var cpuMetaRows = [{ k: 'load', label: 'Load Average', val: (res.cpu_meta.load_1 || '0') + ', ' + (res.cpu_meta.load_5 || '0') + ', ' + (res.cpu_meta.load_15 || '0') }];
                                if (res.cpu_meta.governor && res.cpu_meta.governor.trim() !== '' && res.cpu_meta.governor !== 'null' && res.cpu_meta.governor.toLowerCase() !== 'unknown') {
                                    cpuMetaRows.push({ k: 'gov', label: 'CPU Governor', val: res.cpu_meta.governor, upper: true });
                                }
                                cpuMetaRows.push({ k: 'uptime', label: 'Uptime', val: uptimeStr });
                                var psi = res.cpu_meta && res.cpu_meta.psi;
                                if (psi) {
                                    cpuMetaRows.push({ k: 'psi', label: 'Pressure (CPU / IO, 10s)', val: psi.cpu.toFixed(1) + '% / ' + psi.io.toFixed(1) + '%', color: (psi.cpu >= 20 || psi.io >= 20) ? '#ffb300' : '' });
                                }
                                if (!self._cpuMetaCache) self._cpuMetaCache = {};
                                syncRows(metaNode, self._cpuMetaCache, cpuMetaRows, function(r) { return r.k; }, function(r) {
                                    var val = E('span', { class: 'hw-stat-value' });
                                    var elr = E('div', { class: 'hw-stat-row' }, [E('span', { class: 'hw-stat-label' }, r.label), val]);
                                    return { el: elr, val: val };
                                }, function(entry, r) {
                                    entry.val.textContent = r.val;
                                    entry.val.style.color = r.color || '';
                                    entry.val.style.textTransform = r.upper ? 'uppercase' : '';
                                });
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
                                var ceLabel = E('div', { style: 'font-size: 0.8em; opacity: 0.7; letter-spacing: 0.5px; margin-bottom: 4px;' }, coreName);
                                var ceVal = E('div', { class: 'hw-stat-value', style: 'font-size: 0.9em; white-space: nowrap;' });
                                var ceFill = E('div', { class: 'hw-bar-fill' });
                                coresNode.appendChild(E('div', {
                                    class: 'hw-core-cell'
                                }, [E('div', {
                                    class: 'hw-progress-item', style: 'margin-bottom: 0;'
                                }, [ceLabel, ceVal, E('div', {
                                    class: 'hw-bar-bg'
                                }, [ceFill])])]));
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
                        var advRows = [];
                        for (var key in advStats) {
                            advRows.push({ k: 'bar:' + key, type: 'bar', label: key, val: advStats[key], invert: key === 'Idle' });
                        }
                        if (res.cpu_meta && res.cpu_meta.tasks) {
                            advRows.push({ k: 'tasks', type: 'text', label: 'System Tasks', val: res.cpu_meta.tasks });
                            var ctxt = res.cpu_meta.ctxt || 0;
                            var intr = res.cpu_meta.intr || 0;
                            if (self.prevCtxt !== undefined) {
                                var ctxtRate = ctxt - self.prevCtxt;
                                var intrRate = intr - self.prevIntr;
                                advRows.push({ k: 'ctxt', type: 'text', label: 'Context Switches / s', val: ctxtRate + ' /s' });
                                advRows.push({ k: 'intr', type: 'text', label: 'Hardware Interrupts / s', val: intrRate + ' /s' });
                            }
                            self.prevCtxt = ctxt;
                            self.prevIntr = intr;
                            var connCount = res.cpu_meta.conntrack || 0;
                            var connMax = res.cpu_meta.conntrack_max || 1;
                            var connPct = Math.min((connCount / connMax) * 100, 100);
                            advRows.push({ k: 'conn', type: 'bar2', label: 'Active Connections', val: connPct, valStr: connCount + ' / ' + connMax, color: getDynColor(connPct, false) });
                        }
                        if (res.freq_stats && res.freq_stats.length > 1) {
                            var fsTotal = 0;
                            res.freq_stats.forEach(function(p) { fsTotal += p[1]; });
                            if (fsTotal > 0) {
                                advRows.push({ k: 'freqhdr', type: 'header', label: 'Freq Residency (since boot)' });
                                var fsList = res.freq_stats;
                                if (fsList.length > 10) {
                                    fsList = fsList.slice().sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10)
                                        .sort(function(a, b) { return a[0] - b[0]; });
                                }
                                fsList.forEach(function(p) {
                                    var pctF = p[1] / fsTotal * 100;
                                    var fLbl = p[0] >= 1000000 ? (p[0] / 1000000).toFixed(2) + ' GHz' : Math.round(p[0] / 1000) + ' MHz';
                                    advRows.push({ k: 'freq:' + p[0], type: 'freqbar', label: fLbl, val: pctF });
                                });
                            }
                        }
                        if (!self._advCache) self._advCache = {};
                        syncRows(advNode, self._advCache, advRows, function(r) { return r.k; }, function(r) {
                            if (r.type === 'bar') {
                                var val = E('span', { class: 'hw-stat-value' });
                                var fill = E('div', { class: 'hw-bar-fill' });
                                var elr = E('div', { class: 'hw-progress-item' }, [E('div', { class: 'hw-progress-header' }, [E('span', { class: 'hw-stat-label' }, r.label), val]), E('div', { class: 'hw-bar-bg' }, [fill])]);
                                return { el: elr, val: val, fill: fill };
                            } else if (r.type === 'text') {
                                var val2 = E('span', { class: 'hw-stat-value', style: 'font-size: 0.9em;' });
                                var elr2 = E('div', { class: 'hw-progress-item', style: 'margin-top: 5px;' }, [E('div', { class: 'hw-progress-header' }, [E('span', { class: 'hw-stat-label', style: 'font-size: 0.9em;' }, r.label), val2])]);
                                return { el: elr2, val: val2 };
                            } else if (r.type === 'bar2') {
                                var val3 = E('span', { class: 'hw-stat-value' });
                                var fill3 = E('div', { class: 'hw-bar-fill' });
                                var elr3 = E('div', { class: 'hw-progress-item', style: 'margin-top: 10px;' }, [E('div', { class: 'hw-progress-header' }, [E('span', { class: 'hw-stat-label' }, r.label), val3]), E('div', { class: 'hw-bar-bg' }, [fill3])]);
                                return { el: elr3, val: val3, fill: fill3 };
                            } else if (r.type === 'header') {
                                var elr4 = E('div', { style: 'font-size: 0.8em; opacity: 0.6; text-transform: uppercase; letter-spacing: 1px; margin-top: 12px; margin-bottom: 6px;' }, r.label);
                                return { el: elr4 };
                            } else {
                                var val5 = E('span', { class: 'hw-stat-value', style: 'font-size: 0.9em;' });
                                var fill5 = E('div', { class: 'hw-bar-fill', style: 'background: #00bcd4;' });
                                var elr5 = E('div', { class: 'hw-progress-item', style: 'margin-bottom: 6px;' }, [E('div', { class: 'hw-progress-header' }, [E('span', { class: 'hw-stat-label', style: 'font-size: 0.9em;' }, r.label), val5]), E('div', { class: 'hw-bar-bg', style: 'height: 4px;' }, [fill5])]);
                                return { el: elr5, val: val5, fill: fill5 };
                            }
                        }, function(entry, r) {
                            if (r.type === 'bar') {
                                var colorAdv = getDynColor(r.val, r.invert);
                                entry.val.textContent = r.val.toFixed(1) + '%';
                                entry.val.style.color = colorAdv;
                                entry.fill.style.width = r.val + '%';
                                entry.fill.style.background = colorAdv;
                            } else if (r.type === 'text') {
                                entry.val.textContent = r.val;
                            } else if (r.type === 'bar2') {
                                entry.val.textContent = r.valStr;
                                entry.val.style.color = r.color;
                                entry.fill.style.width = r.val + '%';
                                entry.fill.style.background = r.color;
                            } else if (r.type === 'freqbar') {
                                entry.val.textContent = r.val.toFixed(1) + '%';
                                entry.fill.style.width = r.val + '%';
                            }
                        });
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
                    var ramRows = [];
                    ramRows.push({ k: 'phys', type: 'stat', mb: '5px', label: 'Physical Total', val: (physRamKB / 1024).toFixed(0) + ' MB' });
                    if (mem.speed) ramRows.push({ k: 'speed', type: 'stat', mb: '5px', label: 'Memory Speed', val: mem.speed });
                    ramRows.push({ k: 'usable', type: 'stat', mb: '15px', label: 'Usable Total', val: (mem.total / 1024).toFixed(0) + ' MB' });
                    var addMemBarRow = function(k, label, valueMb, totalMb) {
                        var pct = totalMb > 0 ? (valueMb / totalMb) * 100 : 0;
                        var colorMem = getDynColor(pct, label === 'Free');
                        var valStr = (label === 'Used' || label === 'Free' || label === 'Cached' || label === 'Buffers') ? valueMb.toFixed(0) + ' MB' : valueMb.toFixed(0) + ' / ' + totalMb.toFixed(0) + ' MB';
                        ramRows.push({ k: k, type: 'membar', label: label, pct: pct, valStr: valStr, color: colorMem });
                    };
                    addMemBarRow('used', 'Used', used / 1024, mem.total / 1024);
                    addMemBarRow('free', 'Free', mem.free / 1024, mem.total / 1024);
                    addMemBarRow('cached', 'Cached', mem.cached / 1024, mem.total / 1024);
                    addMemBarRow('buffers', 'Buffers', mem.buffers / 1024, mem.total / 1024);
                    if (mem.swap_total > 0) {
                        var swapUsed = mem.swap_total - mem.swap_free;
                        addMemBarRow('swap', 'Swap', swapUsed / 1024, mem.swap_total / 1024);
                    }
                    if (mem.zram_total > 0) {
                        addMemBarRow('zram', 'ZRAM', mem.zram_used / 1024, mem.zram_total / 1024);
                        var ratio = mem.zram_used > 0 ? (mem.zram_orig / mem.zram_used).toFixed(2) : 1.0;
                        ramRows.push({ k: 'zram_ratio', type: 'centertext', val: 'Compression: ' + ratio + 'x' });
                    }
                    if (mem.slab > 0) addMemBarRow('slab', 'Slab Kernel', mem.slab / 1024, mem.total / 1024);
                    if (mem.pagetables > 0) addMemBarRow('pagetables', 'PageTables', mem.pagetables / 1024, mem.total / 1024);
                    if (mem.dirty > 0 || mem.writeback > 0) {
                        ramRows.push({ k: 'dirty', type: 'stat', label: 'Dirty / Writeback', val: (mem.dirty / 1024).toFixed(1) + ' MB / ' + (mem.writeback / 1024).toFixed(1) + ' MB', color: mem.writeback > 1024 ? '#ffb300' : '' });
                    }
                    var memPsi = res.cpu_meta && res.cpu_meta.psi;
                    if (memPsi && (memPsi.mem > 0 || memPsi.mem_full > 0)) {
                        ramRows.push({ k: 'psi', type: 'stat', label: 'Memory Pressure (10s)', val: memPsi.mem.toFixed(1) + '%' + (memPsi.mem_full > 0 ? ' (full ' + memPsi.mem_full.toFixed(1) + '%)' : ''), color: memPsi.mem_full >= 5 ? '#ff5252' : memPsi.mem >= 10 ? '#ffb300' : '' });
                    }
                    if (!self._ramCache) self._ramCache = {};
                    syncRows(ramStats, self._ramCache, ramRows, function(r) { return r.k; }, function(r) {
                        if (r.type === 'stat') {
                            var val = E('span', { class: 'hw-stat-value' });
                            var elr = E('div', { class: 'hw-stat-row', style: r.mb ? 'margin-bottom: ' + r.mb + ';' : '' }, [E('span', { class: 'hw-stat-label' }, r.label), val]);
                            return { el: elr, val: val };
                        } else if (r.type === 'membar') {
                            var val2 = E('span', { class: 'hw-stat-value' });
                            var fill = E('div', { class: 'hw-bar-fill' });
                            var elr2 = E('div', { class: 'hw-progress-item' }, [E('div', { class: 'hw-progress-header' }, [E('span', { class: 'hw-stat-label' }, r.label), val2]), E('div', { class: 'hw-bar-bg' }, [fill])]);
                            return { el: elr2, val: val2, fill: fill };
                        } else {
                            var elr3 = E('div', { style: 'text-align: center; font-size: 0.8em; opacity: 0.8; margin-top: -10px; margin-bottom: 10px;' });
                            return { el: elr3 };
                        }
                    }, function(entry, r) {
                        if (r.type === 'stat') {
                            entry.val.textContent = r.val;
                            entry.val.style.color = r.color || '';
                        } else if (r.type === 'membar') {
                            entry.val.textContent = r.valStr;
                            entry.fill.style.width = r.pct + '%';
                            entry.fill.style.background = r.color;
                        } else {
                            entry.el.textContent = r.val;
                        }
                    });
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
                    var dskItems = [];
                    var _dfNow = Date.now();
                    res.df.forEach(function(fs) {
                        var isExt = (fs.hw_type === 'USB');
                        // /rom (squashfs) isn't additional usable capacity — it's the
                        // static, always-100%-full base image layered under the real
                        // writable overlay, which is already counted via mount '/'.
                        // Folding it into the headline totals would double-count.
                        var excludeFromTotals = isExt || fs.hw_type === 'SquashFS';
                        if (fs.total > 0 && !excludeFromTotals) {
                            totalSpace += fs.total;
                            totalUsed += fs.used;
                        }
                        if (fs.hw_size > 0 && !excludeFromTotals) totalPhys += fs.hw_size;
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
                        if (fs.mount === '/' && fs.iodev && res.diskstats && res.diskstats[fs.iodev]) {
                            var stat = res.diskstats[fs.iodev];
                            // Namespaced "df:" key: res.diskstats entries and
                            // getStats()'s res.block_devs entries can share the
                            // same bare device name (e.g. a direct-partition
                            // x86 NVMe root also appears as its own External
                            // Storage row) — an unprefixed shared key lets
                            // whichever ran last in a tick clobber the other's
                            // cache with an incompatible shape, producing NaN
                            // speeds. The stored snapshot also carries its own
                            // timestamp so the rate is a real bytes/sec figure
                            // rather than raw counts-since-last-poll mislabeled
                            // as "/s" — poll ticks aren't a precise 3s
                            // metronome (tab throttling, slow ubus round-trips
                            // under heavy I/O contention all skew it).
                            var _dpKey = 'df:' + fs.iodev;
                            if (self.prevDisk[_dpKey]) {
                                var prev = self.prevDisk[_dpKey];
                                var _dpDt = (_dfNow - prev.t) / 1000;
                                if (_dpDt > 0) {
                                    readSpeed = Math.max(0, (stat.r - prev.r) * 512 / _dpDt);
                                    writeSpeed = Math.max(0, (stat.w - prev.w) * 512 / _dpDt);
                                    rIops = Math.max(0, (stat.r_io - prev.r_io) / _dpDt);
                                    wIops = Math.max(0, (stat.w_io - prev.w_io) / _dpDt);
                                }
                            }
                            self.prevDisk[_dpKey] = { r: stat.r, w: stat.w, r_io: stat.r_io, w_io: stat.w_io, t: _dfNow };
                        } else if (fs.mount === '/') {
                            var intRead = 0,
                                intWrite = 0,
                                intR_io = 0,
                                intW_io = 0;
                            for (var k in res.diskstats) {
                                if (!k.match(/^(loop|ram|sda|sdb|sdc)/)) {
                                    var stat = res.diskstats[k];
                                    var _dpKeyK = 'df:' + k;
                                    if (self.prevDisk[_dpKeyK]) {
                                        var prev = self.prevDisk[_dpKeyK];
                                        var _dpDtK = (_dfNow - prev.t) / 1000;
                                        if (_dpDtK > 0) {
                                            intRead += Math.max(0, (stat.r - prev.r) * 512 / _dpDtK);
                                            intWrite += Math.max(0, (stat.w - prev.w) * 512 / _dpDtK);
                                            intR_io += Math.max(0, (stat.r_io - prev.r_io) / _dpDtK);
                                            intW_io += Math.max(0, (stat.w_io - prev.w_io) / _dpDtK);
                                        }
                                    }
                                    self.prevDisk[_dpKeyK] = { r: stat.r, w: stat.w, r_io: stat.r_io, w_io: stat.w_io, t: _dfNow };
                                }
                            }
                            readSpeed = intRead;
                            writeSpeed = intWrite;
                            rIops = intR_io;
                            wIops = intW_io;
                        } else if (res.diskstats && res.diskstats[fs.dev]) {
                            var stat = res.diskstats[fs.dev];
                            var _dpKeyD = 'df:' + fs.dev;
                            if (self.prevDisk[_dpKeyD]) {
                                var prev = self.prevDisk[_dpKeyD];
                                var _dpDtD = (_dfNow - prev.t) / 1000;
                                if (_dpDtD > 0) {
                                    readSpeed = Math.max(0, (stat.r - prev.r) * 512 / _dpDtD);
                                    writeSpeed = Math.max(0, (stat.w - prev.w) * 512 / _dpDtD);
                                    rIops = Math.max(0, (stat.r_io - prev.r_io) / _dpDtD);
                                    wIops = Math.max(0, (stat.w_io - prev.w_io) / _dpDtD);
                                }
                            }
                            self.prevDisk[_dpKeyD] = { r: stat.r, w: stat.w, r_io: stat.r_io, w_io: stat.w_io, t: _dfNow };
                        }
                        var usedPctStr = fs.pct;
                        var pctNum = parseInt(usedPctStr) || 0;
                        // SquashFS is read-only and by definition always 100% used —
                        // that's normal, not a "storage nearly full" warning, so it
                        // doesn't get the usual percentage-driven red/amber/cyan scale.
                        var colorDsk = fs.hw_type === 'SquashFS' ? '#00bcd4' : getDynColor(pctNum);
                        var labelStr = fs.mount === '/' ? 'Root FS' : fs.mount.replace(/^\/mnt\//, '');
                        var typeStr = fs.hw_type ? '[' + fs.hw_type + (fs.hw_model ? ' - ' + fs.hw_model : '') + ']' : '';
                        var inodesInfo = res.inodes ? res.inodes[fs.mount] : null;
                        var _isNand = fs.hw_type === 'NAND';
                        var _isStatic = _isNand || fs.hw_type === 'SquashFS';
                        var speedStr = _isStatic ? fmtKb(fs.used) + ' / ' + fmtKb(fs.total) : 'R: ' + fmtSpeedDf(readSpeed) + ' | W: ' + fmtSpeedDf(writeSpeed);
                        var iopsStr = _isStatic ? (fs.total > 0 ? ((fs.used/fs.total)*100).toFixed(1)+'% filesystem used' : '') : '(' + Math.round(rIops) + 'R / ' + Math.round(wIops) + 'W) IOPS';
                        var hasInodes = !!(inodesInfo && inodesInfo.ipct !== '-');
                        var ipctNum = hasInodes ? (parseInt(inodesInfo.ipct) || 0) : 0;
                        dskItems.push({
                            k: fs.mount + '|' + (fs.dev || ''), labelStr: labelStr, typeStr: typeStr,
                            speedStr: speedStr, colorDsk: colorDsk, pctNum: pctNum, iopsStr: iopsStr, usedPctStr: usedPctStr,
                            hasInodes: hasInodes, ipctStr: hasInodes ? inodesInfo.ipct : '', ipctNum: ipctNum, icolor: hasInodes ? getDynColor(ipctNum) : ''
                        });
                    });
                    if (dskNode) {
                        if (!self._dskCache) self._dskCache = {};
                        syncRows(dskNode, self._dskCache, dskItems, function(r) { return r.k; }, function(r) {
                            var lblSpan = E('span', { style: 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;' });
                            var typeSpan = E('span', { style: 'opacity: 0.6; margin-left: 5px; flex-shrink: 0;' });
                            var valSpan = E('span', { class: 'hw-stat-value', style: 'flex-shrink: 0;' });
                            var fill = E('div', { class: 'hw-bar-fill' });
                            var iopsSpan = E('span', {});
                            var pctSpan = E('span', { class: 'hw-stat-value' });
                            var inVal = E('span', { class: 'hw-stat-value', style: 'font-size: 0.8em;' });
                            var inFill = E('div', { class: 'hw-bar-fill' });
                            var inodesBlock = E('div', {}, [
                                E('div', { class: 'hw-progress-header', style: 'margin-top: 6px;' }, [E('span', { class: 'hw-stat-label', style: 'font-size: 0.8em; opacity: 0.7;' }, 'Inodes Used'), inVal]),
                                E('div', { class: 'hw-bar-bg', style: 'height: 4px;' }, [inFill])
                            ]);
                            var elr = E('div', { class: 'hw-progress-item', style: 'margin-bottom: 15px;' }, [
                                E('div', { class: 'hw-progress-header' }, [
                                    E('span', { style: 'display: flex; opacity: 0.8; font-size: 0.95em; flex-shrink: 1; min-width: 0; margin-right: 5px;' }, [lblSpan, typeSpan]),
                                    valSpan
                                ]),
                                E('div', { class: 'hw-bar-bg' }, [fill]),
                                E('div', { style: 'width: 100%; display: flex; justify-content: space-between; margin-top: 5px; font-size: 0.9em; opacity: 0.8;' }, [iopsSpan, pctSpan]),
                                inodesBlock
                            ]);
                            return { el: elr, lbl: lblSpan, type: typeSpan, val: valSpan, fill: fill, iops: iopsSpan, pct: pctSpan, inodesBlock: inodesBlock, inVal: inVal, inFill: inFill };
                        }, function(entry, r) {
                            entry.lbl.textContent = r.labelStr;
                            entry.type.textContent = r.typeStr;
                            entry.val.textContent = r.speedStr;
                            entry.val.style.color = r.colorDsk;
                            entry.fill.style.width = r.pctNum + '%';
                            entry.fill.style.background = r.colorDsk;
                            entry.iops.textContent = r.iopsStr;
                            entry.pct.textContent = r.usedPctStr;
                            entry.inodesBlock.style.display = r.hasInodes ? '' : 'none';
                            if (r.hasInodes) {
                                entry.inVal.textContent = r.ipctStr;
                                entry.inVal.style.color = r.icolor;
                                entry.inFill.style.width = r.ipctNum + '%';
                                entry.inFill.style.background = r.icolor;
                            }
                        });
                    }
                    var _ovSi = res.sys_info || {};
                    var dskMeta = document.getElementById('dial-meta-dsk');
                    if (dskMeta) {
                        var dskMetaRows = [];
                        var addMR = function(lbl, val, color) {
                            dskMetaRows.push({ k: lbl, label: lbl, val: val, color: color || '' });
                        };
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
                        if (!self._dskMetaCache) self._dskMetaCache = {};
                        syncRows(dskMeta, self._dskMetaCache, dskMetaRows, function(r) { return r.k; }, function(r) {
                            var val = E('span', { class: 'hw-stat-value' });
                            var elr = E('div', { class: 'hw-stat-row' }, [E('span', { class: 'hw-stat-label' }, r.label), val]);
                            return { el: elr, val: val };
                        }, function(entry, r) {
                            entry.val.textContent = r.val;
                            entry.val.style.color = r.color;
                        });
                    }
                    var extCardNode = document.getElementById('hw-ext-card');
                    if (extCardNode) extCardNode.style.display = 'none';
                }
                (function() {
                    var extraNode = document.getElementById('hw-int-storage-extra');
                    if (!extraNode) return;
                    var _ovS = res.sys_info || {};
                    var extraSig = JSON.stringify([res.ubi_devs, res.mtd_parts, res.emmc_info, res.nvme_info, res.nvme_smart, res.squashfs_info, res.f2fs_info, _ovS.overlay_total, _ovS.overlay_used, _ovS.overlay_free, res.ecc_base_date]);
                    if (!sigGate(self._sig, 'extra', extraSig)) return;
                    extraNode.innerHTML = '';
                    var hasUbi = res.ubi_devs && res.ubi_devs.length > 0;
                    var hasMtd = res.mtd_parts && res.mtd_parts.length > 0;
                    var hasEmmc = !!res.emmc_info;
                    var hasNvme = !!res.nvme_info;
                    var hasSquashfs = !!res.squashfs_info;
                    var hasF2fs = res.f2fs_info && res.f2fs_info.length > 0;
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
                    if (hasNvme) {
                        if (hasUbi || hasMtd || hasEmmc) extraNode.appendChild(hRule());
                        extraNode.appendChild(secH('NVMe Details'));
                        var nv = res.nvme_info;
                        var sm = res.nvme_smart;
                        var nvBadge = '';
                        if (sm) {
                            // sm.passed is the drive firmware's own SMART
                            // overall-health verdict (smartctl -H) — the
                            // authoritative "Critical" signal. "Warning" is
                            // our own judgment call for things trending bad
                            // but not yet a firmware-flagged failure.
                            var nvWarn = sm.critical_warning > 0 || sm.media_errors > 0 || sm.percent_used >= 90;
                            var nvColor = !sm.passed ? '#ff1744' : nvWarn ? '#ffb300' : '#00bcd4';
                            var nvLbl = !sm.passed ? 'Critical' : nvWarn ? 'Warning' : 'Healthy';
                            nvBadge = E('span', {style: 'padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; color:' + nvColor + '; background:' + nvColor + '22;'}, nvLbl);
                        }
                        var nvBox = makeDevBox(nv.dev.toUpperCase() + (nv.model ? ' — ' + nv.model : ''), nvBadge);
                        if (nv.serial) nvBox.appendChild(makeRow('Serial', nv.serial, null));
                        if (nv.fw) nvBox.appendChild(makeRow('Firmware', nv.fw, null));
                        if (nv.transport) nvBox.appendChild(makeRow('Transport', nv.transport.toUpperCase(), null));
                        if (sm) {
                            var wearColor = sm.percent_used >= 100 ? '#ff1744' : sm.percent_used >= 90 ? '#ffb300' : '#00bcd4';
                            nvBox.appendChild(makeBar2('Wear (Percentage Used)', Math.min(sm.percent_used, 100), sm.percent_used + '%', wearColor));
                            // TBW (Total Bytes Written) — the standard SSD
                            // endurance/warranty figure, shown alongside wear %
                            // rather than folded into a generic read+write row.
                            nvBox.appendChild(makeRow('TBW (Total Bytes Written)', fmtBytesS(sm.data_units_written * 512000), null));
                            var spareColor = sm.avail_spare <= sm.spare_thresh ? '#ff1744' : sm.avail_spare <= sm.spare_thresh + 10 ? '#ffb300' : '#00bcd4';
                            nvBox.appendChild(makeBar2('Available Spare', sm.avail_spare, sm.avail_spare + '% (threshold ' + sm.spare_thresh + '%)', spareColor));
                            if (sm.ns_capacity > 0) {
                                var nsPct = Math.min(100, (sm.ns_utilization / sm.ns_capacity) * 100);
                                nvBox.appendChild(makeBar2('Namespace Utilization', nsPct, fmtBytesS(sm.ns_utilization) + ' / ' + fmtBytesS(sm.ns_capacity), getDynColor(nsPct)));
                            }
                            if (sm.temp_c > 0) {
                                // Real per-drive thresholds when reported, falling
                                // back to conservative generic guesses otherwise.
                                var tWarn = sm.temp_warn > 0 ? sm.temp_warn : 70;
                                var tCrit = sm.temp_crit > 0 ? sm.temp_crit : 80;
                                var tempColor = sm.temp_c >= tCrit ? '#ff1744' : sm.temp_c >= tWarn ? '#ffb300' : null;
                                var tempThreshStr = sm.temp_warn > 0 ? ' (warn ' + sm.temp_warn + '°C / crit ' + sm.temp_crit + '°C)' : '';
                                nvBox.appendChild(makeRow('Temperature', sm.temp_c + ' °C' + tempThreshStr, tempColor));
                            }
                            if (sm.power_on_hours > 0) {
                                var poDays = Math.floor(sm.power_on_hours / 24);
                                nvBox.appendChild(makeRow('Power-On Hours', sm.power_on_hours.toLocaleString() + ' h (≈' + poDays + ' days)', null));
                            }
                            nvBox.appendChild(makeRow('Power Cycles', sm.power_cycles.toLocaleString(), null));
                            nvBox.appendChild(makeRow('Unsafe Shutdowns', sm.unsafe_shutdowns.toLocaleString(), sm.unsafe_shutdowns > 0 ? '#ffb300' : null));
                            nvBox.appendChild(makeRow('Media Errors', sm.media_errors.toLocaleString(), sm.media_errors > 0 ? '#ff1744' : null));
                            if (sm.err_log_entries > 0) nvBox.appendChild(makeRow('Error Log Entries', sm.err_log_entries.toLocaleString(), '#ffb300'));
                            nvBox.appendChild(makeRow('Data Read', fmtBytesS(sm.data_units_read * 512000), null));
                            nvBox.appendChild(makeRow('Host Read / Write Commands', sm.host_reads.toLocaleString() + ' / ' + sm.host_writes.toLocaleString(), null, true));
                            if (sm.critical_warning > 0) {
                                var cw = sm.critical_warning;
                                var cwFlags = [];
                                if (cw & 0x01) cwFlags.push('Spare below threshold');
                                if (cw & 0x02) cwFlags.push('Temperature threshold');
                                if (cw & 0x04) cwFlags.push('Reliability degraded');
                                if (cw & 0x08) cwFlags.push('Media read-only');
                                if (cw & 0x10) cwFlags.push('Backup device failed');
                                nvBox.appendChild(makeRow('Critical Warning', cwFlags.length ? cwFlags.join(', ') : ('flags 0x' + cw.toString(16)), '#ff1744', true));
                            }
                        }
                        extraNode.appendChild(nvBox);
                    }
                    if (hasSquashfs) {
                        if (hasUbi || hasMtd || hasEmmc || hasNvme) extraNode.appendChild(hRule());
                        extraNode.appendChild(secH('SquashFS Root Image'));
                        var sq = res.squashfs_info;
                        var sqBox = makeDevBox(sq.dev.toUpperCase(), '');
                        if (sq.compression) sqBox.appendChild(makeRow('Compression', sq.compression.toUpperCase(), null));
                        if (sq.block_size > 0) sqBox.appendChild(makeRow('Block Size', fmtBytesS(sq.block_size), null));
                        if (sq.bytes_used > 0) sqBox.appendChild(makeRow('Compressed Size', fmtBytesS(sq.bytes_used), null));
                        extraNode.appendChild(sqBox);
                    }
                    if (hasF2fs) {
                        if (hasUbi || hasMtd || hasEmmc || hasNvme || hasSquashfs) extraNode.appendChild(hRule());
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
                    var statsByDev = {};
                    extDrives.forEach(function(grp) {
                        statsByDev[grp.main.dev] = getStats(grp.main, now);
                        grp.parts.forEach(function(part) { statsByDev[part.dev] = getStats(part, now); });
                    });
                    if (extWrapper) {
                        if (extDrives.length === 0) {
                            extWrapper.innerHTML = '';
                            self._extDriveRefs = null;
                            self._sig.extShape = null;
                        }
                        var extShapeSig = extDrives.length > 0 ? JSON.stringify(extDrives.map(function(grp) {
                            return [grp.main.dev, grp.main.size, grp.main.model, grp.main.type, grp.main.removable, grp.parts.map(function(pt) { return [pt.dev, pt.size, pt.fs]; })];
                        })) : null;
                        if (extDrives.length > 0 && sigGate(self._sig, 'extShape', extShapeSig)) {
                            extWrapper.innerHTML = '';
                            self._extDriveRefs = {};
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
                                    domCols.push(E('div', {
                                        class: 'hw-thermals-col hw-thermals-col-mid'
                                    }));
                                }
                                if (domCols.length > 0) {
                                    domCols[0].className = 'hw-thermals-col hw-thermals-col-left';
                                    domCols[domCols.length - 1].className = 'hw-thermals-col hw-thermals-col-right';
                                    if (domCols.length === 1) domCols[0].className = 'hw-thermals-col';
                                }
                                cardData.cols.forEach(function(colData, colIdx) {
                                    colData.items.forEach(function(grp) {
                                        var main = grp.main;
                                        var sz = main.size ? fmtBytesS(parseInt(main.size)) : 'Unknown';
                                        var isUsb = main.removable === '1' || main.type === 'USB';
                                        var displayType = isUsb ? 'USB' : main.type;
                                        var mStats = statsByDev[main.dev];
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
                                                var psz = part.size ? fmtBytesS(parseInt(part.size)) : '';
                                                var formatStr = (part.fs && part.fs !== 'Unknown') ? part.fs : '—';
                                                var mountedStr = part.mount ? part.mount : 'No';
                                                if (!part.fs || part.fs === 'Unknown') {
                                                    if (part.loop_of) {
                                                        formatStr = part.loop_fs ? part.loop_fs + ' (via ' + part.loop_of + ')' : 'raw (via ' + part.loop_of + ')';
                                                        mountedStr = part.loop_mount ? part.loop_mount + ' (via ' + part.loop_of + ')' : mountedStr;
                                                    }
                                                }
                                                var pStats = statsByDev[part.dev];
                                                var pSpeedSpan = E('span', {}, 'R: ' + fmtSpeedExt(pStats.rSpeed) + ' / W: ' + fmtSpeedExt(pStats.wSpeed));
                                                var pIopsSpan = E('span', {}, 'R: ' + Math.round(pStats.rIops) + ' / W: ' + Math.round(pStats.wIops));
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
                                                        style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8; margin-top: 4px;'
                                                    }, [
                                                        E('span', {}, 'Mounted:'),
                                                        E('span', {
                                                            style: part.mount ? 'color: #8bc34a;' : 'opacity: 0.6;'
                                                        }, mountedStr)
                                                    ]),
                                                    E('div', {
                                                        style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.7; margin-top: 6px;'
                                                    }, [
                                                        E('span', {}, 'Speed:'),
                                                        pSpeedSpan
                                                    ]),
                                                    E('div', {
                                                        style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.6; margin-top: 2px;'
                                                    }, [
                                                        E('span', {}, 'IOPS:'),
                                                        pIopsSpan
                                                    ])
                                                ]);
                                                partsContainer.appendChild(pRow);
                                                self._extDriveRefs[part.dev] = { speed: pSpeedSpan, iops: pIopsSpan };
                                            });
                                            box.appendChild(partsContainer);
                                        } else {
                                            var mFormatStr = (main.fs && main.fs !== 'Unknown') ? main.fs : '—';
                                            var mMountedStr = main.mount ? main.mount : 'No';
                                            if ((!main.fs || main.fs === 'Unknown') && main.loop_of) {
                                                mFormatStr = main.loop_fs ? main.loop_fs + ' (via ' + main.loop_of + ')' : 'raw (via ' + main.loop_of + ')';
                                                mMountedStr = main.loop_mount ? main.loop_mount + ' (via ' + main.loop_of + ')' : mMountedStr;
                                            }
                                            var mSpeedSpan = E('span', {}, 'R: ' + fmtSpeedExt(mStats.rSpeed) + ' / W: ' + fmtSpeedExt(mStats.wSpeed));
                                            var mIopsSpan = E('span', {}, 'R: ' + Math.round(mStats.rIops) + ' / W: ' + Math.round(mStats.wIops));
                                            var footer = E('div', {
                                                style: 'margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-color, rgba(128,128,128,0.3));'
                                            }, [
                                                E('div', {
                                                    style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8;'
                                                }, [
                                                    E('span', {}, 'Format:'),
                                                    E('span', {
                                                        style: 'color: #00bcd4;'
                                                    }, mFormatStr)
                                                ]),
                                                E('div', {
                                                    style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8; margin-top: 4px;'
                                                }, [
                                                    E('span', {}, 'Mounted:'),
                                                    E('span', {
                                                        style: main.mount ? 'color: #8bc34a;' : 'opacity: 0.6;'
                                                    }, mMountedStr)
                                                ]),
                                                E('div', {
                                                    style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.7; margin-top: 6px;'
                                                }, [
                                                    E('span', {}, 'Speed:'),
                                                    mSpeedSpan
                                                ]),
                                                E('div', {
                                                    style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.6; margin-top: 2px;'
                                                }, [
                                                    E('span', {}, 'IOPS:'),
                                                    mIopsSpan
                                                ])
                                            ]);
                                            box.appendChild(footer);
                                            self._extDriveRefs[main.dev] = { speed: mSpeedSpan, iops: mIopsSpan };
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
                        if (extDrives.length > 0) {
                            var extRefs = self._extDriveRefs || {};
                            extDrives.forEach(function(grp) {
                                var mr = extRefs[grp.main.dev];
                                if (mr) {
                                    var mStats2 = statsByDev[grp.main.dev];
                                    mr.speed.textContent = 'R: ' + fmtSpeedExt(mStats2.rSpeed) + ' / W: ' + fmtSpeedExt(mStats2.wSpeed);
                                    mr.iops.textContent = 'R: ' + Math.round(mStats2.rIops) + ' / W: ' + Math.round(mStats2.wIops);
                                }
                                grp.parts.forEach(function(part) {
                                    var pr = extRefs[part.dev];
                                    if (pr) {
                                        var pStats2 = statsByDev[part.dev];
                                        pr.speed.textContent = 'R: ' + fmtSpeedExt(pStats2.rSpeed) + ' / W: ' + fmtSpeedExt(pStats2.wSpeed);
                                        pr.iops.textContent = 'R: ' + Math.round(pStats2.rIops) + ' / W: ' + Math.round(pStats2.wIops);
                                    }
                                });
                            });
                        }
                    }
                }
                var thermWrap = document.getElementById('hw-therm-wrapper');
                if (thermWrap && (!res.thermals || res.thermals.length === 0)) {
                    if (self._sig.therm !== null) { thermWrap.innerHTML = ''; self._sig.therm = null; self._thermRefs = null; self._coolRefs = null; }
                }
                if (res.thermals && res.thermals.length > 0 && thermWrap) {
                    if (res.model) {
                        var title = res.model;
                        var tEl = document.getElementById('title-cpu');
                        if (tEl && tEl.textContent !== title) tEl.textContent = title;
                    }
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
                        var crit = t.crit && t.crit !== 'null' ? parseInt(t.crit) : null;
                        var pass = t.pass && t.pass !== 'null' ? parseInt(t.pass) : null;
                        if (crit && crit > 1000) crit = crit / 1000;
                        if (pass && pass > 1000) pass = pass / 1000;
                        if (crit !== null && (crit < 40 || crit > 150)) crit = null;
                        if (pass !== null && (pass <= 0 || pass > 150)) pass = null;
                        if (crit !== null && pass !== null && pass >= crit) pass = null;
                        var th = self.tempHist[name];
                        if (!th || Array.isArray(th) || !th.agg) th = self.tempHist[name] = { label: name, color: PING_COLORS[Object.keys(self.tempHist).length % PING_COLORS.length], hidden: false, data: [], agg: [], acc: { sum: 0, n: 0, cnt: 0 } };
                        th.data.push(tempC);
                        if (th.data.length > TEMP_WINDOW) th.data.shift();
                        th.acc.cnt++; th.acc.sum += tempC; th.acc.n++;
                        if (th.acc.cnt >= 10) {
                            th.agg.push({ a: th.acc.n > 0 ? th.acc.sum / th.acc.n : null, n: th.acc.n, loss: 0 });
                            if (th.agg.length > TEMP_AGG_KEEP) th.agg.shift();
                            th.acc = { sum: 0, n: 0, cnt: 0 };
                        }
                        sensors.push({ name: name, temp: tempC, crit: crit, pass: pass, color: th.color, hist: th.data });
                    });
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
                        self.tempPanelData = tHistMap;
                    }
                    var validCooling = (res.cooling || []).filter(function(c) { return c.max; });
                    var thermSig = sensors.map(function(s) { return s.name; }).join('|') + '|g' + (tGraph ? 1 : 0) + '|cool:' + validCooling.map(function(c) { return c.type; }).join(',');
                    if (sigGate(self._sig, 'therm', thermSig)) {
                        thermWrap.innerHTML = '';
                        self._thermRefs = {};
                        self._coolRefs = {};
                        var nCols = Math.min(3, sensors.length);
                        var cols = [];
                        for (var ci = 0; ci < nCols; ci++) cols.push([]);
                        sensors.forEach(function(s, i) { cols[i % nCols].push(s); });
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
                                var entry = buildSensorRow();
                                self._thermRefs[s.name] = entry;
                                list.appendChild(entry.el);
                            });
                            if (list.lastChild) list.lastChild.style.borderBottom = 'none';
                            rowEl.appendChild(E('div', { class: colCls }, [list]));
                        });
                        var cardKids = [E('h3', {}, 'Thermal Sensors')];
                        if (tGraph) {
                            thermGraphNode.innerHTML = '';
                            thermGraphNode.appendChild(tGraph);
                            cardKids.push(thermGraphNode);
                        }
                        cardKids.push(rowEl);
                        var thermCard = E('div', {
                            class: 'hw-card wide'
                        }, cardKids);
                        thermWrap.appendChild(thermCard);
                        if (validCooling.length > 0) {
                            var coolRow = E('div', { style: 'display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-color, rgba(128,128,128,0.15));' });
                            coolRow.appendChild(E('span', { style: 'font-size: 0.75em; opacity: 0.55; text-transform: uppercase; letter-spacing: 1px; align-self: center;' }, 'Cooling'));
                            validCooling.forEach(function(c) {
                                var chip = E('span', { style: 'font-size: 0.75em; padding: 3px 8px; border-radius: 4px; white-space: nowrap;' });
                                self._coolRefs[c.type] = chip;
                                coolRow.appendChild(chip);
                            });
                            thermCard.appendChild(coolRow);
                        }
                    }
                    sensors.forEach(function(s) {
                        var entry = self._thermRefs && self._thermRefs[s.name];
                        if (entry) patchSensorRow(entry, s);
                    });
                    validCooling.forEach(function(c) {
                        var chip = self._coolRefs && self._coolRefs[c.type];
                        if (chip) {
                            var cc = c.cur >= c.max ? '#ff1744' : c.cur > 0 ? '#ffb300' : '#00bcd4';
                            chip.style.border = '1px solid ' + cc + '44';
                            chip.style.color = cc;
                            chip.style.background = cc + '18';
                            chip.textContent = c.type + ': ' + (c.cur > 0 ? c.cur + '/' + c.max : 'idle');
                        }
                    });
                    if (self.tempPanel && self.tempPanelData) self.tempPanel.update(self.tempPanelData);
                }
                var portsNode = document.getElementById('hw-eth-links');
                var validPcie = [];
                if (res.pcie_devs) {
                    validPcie = res.pcie_devs.filter(function(p){ var n = p.name.toLowerCase(); return p.speed && p.speed !== 'Unknown' && n.indexOf('unknown device')===-1 && n.indexOf('controller')===-1 && n.indexOf('bridge')===-1 && n.indexOf('root')===-1; });
                }
                var usbDevs = (res.usb_devs || []).filter(function(u){ var n = (u.name || '').trim(); return n && n !== 'Unknown' && n !== 'Unknown Device'; });
                var usbControllers = (res.usb_ports || []).map(function(p) {
                    return { name: p.product || 'USB Host Controller', speed: p.speed, version: '', max_power: '' };
                });
                var usbAll = usbControllers.concat(usbDevs);
                var hasUsb = usbAll.length > 0;
                var hasEth = res.eth_links && res.eth_links.length > 0;
                if ((hasEth || hasUsb) && portsNode) {
                    ethCard.style.display = 'flex';
                    if (!self._portsRefs) {
                        portsNode.innerHTML = '';
                        var ethSubH = E('h4', { style: 'margin: 0 0 4px 0; font-size: 0.85em; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px; display: none;' }, 'Ethernet');
                        var ethListWrap = E('div', {});
                        var usbSubH = E('h4', { style: 'margin: 0 0 4px 0; font-size: 0.85em; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px; display: none;' }, 'USB');
                        var usbListWrap = E('div', {});
                        portsNode.appendChild(ethSubH);
                        portsNode.appendChild(ethListWrap);
                        portsNode.appendChild(usbSubH);
                        portsNode.appendChild(usbListWrap);
                        self._portsRefs = { ethSubH: ethSubH, ethListWrap: ethListWrap, usbSubH: usbSubH, usbListWrap: usbListWrap, ethCache: {}, usbCache: {} };
                    }
                    var pr = self._portsRefs;
                    pr.ethSubH.style.display = hasEth ? '' : 'none';
                    pr.usbSubH.style.display = hasUsb ? '' : 'none';
                    pr.usbSubH.style.margin = hasEth ? '10px 0 4px 0' : '0 0 4px 0';
                    if (hasEth && !self.prevEth) self.prevEth = {};
                    syncRows(pr.ethListWrap, pr.ethCache, hasEth ? res.eth_links : [], function(l) { return l.iface; }, function(l) {
                        var dot = E('div', { style: 'width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;' });
                        var ifaceSpan = E('span', { style: 'font-weight: bold;' }, l.iface.toUpperCase());
                        var statusSpan = E('span', {});
                        var throughVal = E('span', { style: 'color:#00bcd4;' });
                        var throughRow = E('div', { style: 'display: none; justify-content: space-between; font-size: 0.85em; opacity: 0.9; margin-top: 6px; border-top: 1px dashed rgba(128,128,128,0.3); padding-top: 6px;' }, [E('span', {}, 'Throughput:'), throughVal]);
                        var errVal = E('span', {});
                        var errRow = E('div', { style: 'display: none; justify-content: space-between; font-size: 0.85em; opacity: 0.8; margin-top: 6px;' }, [E('span', {}, 'Errors/Drops:'), errVal]);
                        var phyVal = E('span', {});
                        var phyRow = E('div', { style: 'display: none; justify-content: space-between; font-size: 0.8em; opacity: 0.7; margin-top: 4px;' }, [E('span', {}, 'PHY:'), phyVal]);
                        var macVal = E('span', {});
                        var macRow = E('div', { style: 'display: none; justify-content: space-between; font-size: 0.8em; opacity: 0.6; margin-top: 4px;' }, [E('span', {}, 'MAC / MTU:'), macVal]);
                        var box = E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; margin-bottom: 4px;' }, [
                            E('div', { style: 'display: flex; justify-content: space-between; align-items: center;' }, [
                                E('div', { style: 'display: flex; align-items: center; gap: 8px;' }, [dot, ifaceSpan]),
                                statusSpan
                            ]),
                            throughRow, errRow, phyRow, macRow
                        ]);
                        return { el: box, dot: dot, statusSpan: statusSpan, throughRow: throughRow, throughVal: throughVal, errRow: errRow, errVal: errVal, phyRow: phyRow, phyVal: phyVal, macRow: macRow, macVal: macVal };
                    }, function(entry, l) {
                        var st = l.speed;
                        var col = '#9e9e9e';
                        if (st.indexOf('10000') >= 0 || st.indexOf('2500') >= 0 || st.indexOf('1000') >= 0) col = '#00bcd4';
                        else if (st.indexOf('100') >= 0 || st.indexOf('10') >= 0) col = '#ffea00';
                        entry.el.style.borderLeft = '4px solid ' + col;
                        entry.dot.style.background = col;
                        entry.dot.style.boxShadow = '0 0 5px ' + col;
                        entry.statusSpan.style.color = col;
                        entry.statusSpan.textContent = st === 'Down' ? 'Disconnected' : st + ' Mbps (' + l.duplex + ')';
                        var rxErr = parseInt(l.rx_err) || 0, txErr = parseInt(l.tx_err) || 0;
                        var rxDrop = parseInt(l.rx_drop) || 0, txDrop = parseInt(l.tx_drop) || 0;
                        var dlMbps = null, ulMbps = null;
                        var curRx = parseInt(l.rx_bytes) || 0, curTx = parseInt(l.tx_bytes) || 0, nowT = Date.now();
                        var pe = self.prevEth[l.iface];
                        if (pe && nowT > pe.t && curRx >= pe.rx && curTx >= pe.tx) {
                            var dt = (nowT - pe.t) / 1000;
                            dlMbps = (curRx - pe.rx) * 8 / 1e6 / dt;
                            ulMbps = (curTx - pe.tx) * 8 / 1e6 / dt;
                        }
                        self.prevEth[l.iface] = { rx: curRx, tx: curTx, t: nowT };
                        if (st !== 'Down') {
                            entry.throughRow.style.display = dlMbps !== null ? 'flex' : 'none';
                            if (dlMbps !== null) entry.throughVal.textContent = '↓ ' + fmtMbps(dlMbps) + '   ↑ ' + fmtMbps(ulMbps);
                            var errColor = (rxErr > 0 || txErr > 0 || rxDrop > 0 || txDrop > 0) ? '#ff5252' : 'currentColor';
                            entry.errRow.style.display = 'flex';
                            entry.errVal.style.color = errColor;
                            entry.errVal.textContent = 'Rx: ' + rxErr + '/' + rxDrop + ' | Tx: ' + txErr + '/' + txDrop;
                            var et = res.ethtool && res.ethtool[l.iface];
                            if (et) {
                                var eeeCol = et.eee === 'active' ? '#ffb300' : '';
                                entry.phyRow.style.display = 'flex';
                                entry.phyVal.style.color = eeeCol;
                                entry.phyVal.textContent = 'autoneg ' + et.an + ' · pause ' + et.pause + (et.eee !== 'n/a' ? ' · EEE ' + et.eee : '') + (et.drv ? ' · ' + et.drv + (et.fw && et.fw !== 'N/A' ? ' fw ' + et.fw : '') : '');
                            } else {
                                entry.phyRow.style.display = 'none';
                            }
                        } else {
                            entry.throughRow.style.display = 'none';
                            entry.errRow.style.display = 'none';
                            entry.phyRow.style.display = 'none';
                        }
                        if (l.mac) {
                            var flaps = parseInt(l.carrier_changes) || 0;
                            var flapStr = flaps > 2 ? ' · ' + flaps + ' link flaps' : '';
                            entry.macRow.style.display = 'flex';
                            entry.macVal.style.color = flaps > 2 ? '#ffb300' : '';
                            entry.macVal.textContent = l.mac.toUpperCase() + ' · ' + l.mtu + flapStr;
                        } else {
                            entry.macRow.style.display = 'none';
                        }
                    });
                    syncRows(pr.usbListWrap, pr.usbCache, hasUsb ? usbAll : [], function(u, i) { return u.name + '|' + i; }, function(u) {
                        var nameDiv = E('div', { style: 'font-weight: bold; margin-bottom: 4px;' });
                        var speedVal = E('span', {});
                        var speedRow = E('div', { style: 'display: none; justify-content: space-between; font-size: 0.85em; opacity: 0.8;' }, [E('span', {}, 'Speed:'), speedVal]);
                        var verVal = E('span', {});
                        var verRow = E('div', { style: 'display: none; justify-content: space-between; font-size: 0.85em; opacity: 0.8;' }, [E('span', {}, 'USB Version:'), verVal]);
                        var pwrVal = E('span', {});
                        var pwrRow = E('div', { style: 'display: none; justify-content: space-between; font-size: 0.85em; opacity: 0.8;' }, [E('span', {}, 'Max Power Draw:'), pwrVal]);
                        var el = E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; margin-bottom: 6px;' }, [nameDiv, speedRow, verRow, pwrRow]);
                        return { el: el, nameDiv: nameDiv, speedRow: speedRow, speedVal: speedVal, verRow: verRow, verVal: verVal, pwrRow: pwrRow, pwrVal: pwrVal };
                    }, function(entry, u) {
                        entry.nameDiv.textContent = u.name;
                        var spd = parseInt(u.speed) || 0;
                        var col = spd >= 5000 ? '#00bcd4' : spd >= 480 ? '#ffea00' : '#9e9e9e';
                        var spdLabel = spd >= 10000 ? 'USB 3.2 (' + spd + ' Mbps)' : spd >= 5000 ? 'USB 3.0 (' + spd + ' Mbps)' : spd >= 480 ? 'USB 2.0 (' + spd + ' Mbps)' : spd > 0 ? 'USB 1.x (' + spd + ' Mbps)' : '';
                        entry.speedRow.style.display = spdLabel ? 'flex' : 'none';
                        if (spdLabel) { entry.speedVal.style.color = col; entry.speedVal.textContent = spdLabel; }
                        var ver = u.version ? u.version.trim() : '';
                        entry.verRow.style.display = ver ? 'flex' : 'none';
                        if (ver) entry.verVal.textContent = ver;
                        var hasPwr = u.max_power && u.max_power !== '0mA';
                        entry.pwrRow.style.display = hasPwr ? 'flex' : 'none';
                        if (hasPwr) entry.pwrVal.textContent = u.max_power;
                    });
                } else {
                    ethCard.style.display = 'none';
                    self._portsRefs = null;
                }
                if (validPcie.length > 0) {
                    pcieCard.style.display = 'flex';
                    var pcNode = document.getElementById('hw-pcie');
                    if (pcNode) {
                        if (!self._pcieCache) self._pcieCache = {};
                        syncRows(pcNode, self._pcieCache, validPcie, function(p, i) { return p.name + '|' + i; }, function(p) {
                            var nameDiv = E('div', { style: 'font-weight: bold; margin-bottom: 4px;' }, p.name);
                            var speedVal = E('span', {});
                            var el = E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; margin-bottom: 6px;' }, [
                                nameDiv,
                                E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8;' }, [E('span', {}, 'Link Speed:'), speedVal])
                            ]);
                            return { el: el, speedVal: speedVal };
                        }, function(entry, p) {
                            var speedStr = p.speed + ' ' + p.width;
                            if (p.max_speed && p.max_speed !== 'Unknown' && p.speed !== p.max_speed) speedStr += ' (Max: ' + p.max_speed + ')';
                            entry.speedVal.style.color = p.speed !== p.max_speed ? '#ffea00' : '';
                            entry.speedVal.textContent = speedStr;
                        });
                    }
                } else {
                    pcieCard.style.display = 'none';
                }
                if (res.wifi_radios && res.wifi_radios.length > 0) {
                    var wfNode = document.getElementById('hw-wifi-radios');
                    if (wfNode) {
                        var wifiRendered = 0;
                        var WIFI_BANDS = ['2.4 GHz', '5 GHz', '6 GHz'];
                        var bandGroups = { '2.4 GHz': [], '5 GHz': [], '6 GHz': [], 'Other': [] };
                        var wifiSigParts = [];
                        if (!self.prevSurvey) self.prevSurvey = {};
                        res.wifi_radios.forEach(function(w) {
                            if ((!w.band || w.band === 'Unknown') && (!w.hwmode || w.hwmode === 'Unknown')) return;
                            var bKey = w.band.replace(' GHz', 'GHz');
                            var bCap = (w.phycap && w.phycap.bands && w.phycap.bands[bKey]) ? w.phycap.bands[bKey] : null;
                            var phycapSp = w.phycap ? parseInt(w.phycap.max_spatial) : 0;
                            var hwMaxSp = phycapSp > 1 ? phycapSp : (parseInt(w.hw_nss) > 1 ? parseInt(w.hw_nss) : 0);
                            var hwMaxCw = (w.phycap && w.phycap.max_cw && parseInt(w.phycap.max_cw) >= 20) ? w.phycap.max_cw : null;
                            var hwMaxCwNum = hwMaxCw ? (parseInt(hwMaxCw.replace(/[^0-9]/g, '')) || 0) : 0;
                            var currCwNum = parseInt(w.curr_width) || 0;
                            var currCwStr = currCwNum > 0 ? currCwNum + ' MHz' : null;
                            var cfgNss = parseInt(w.cfg_nss) || 0;
                            var chipMaxBr = (hwMaxSp > 0 && hwMaxCw && w.hwmode) ? calcMaxBitrate(w.hwmode, hwMaxCw, hwMaxSp) : null;
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
                            var regStr = '';
                            if (w.country && w.country !== '00' && w.country !== '') regStr = w.country + (w.dfs_region ? ' · ' + w.dfs_region : '');
                            else if (w.country === '00') regStr = '00 · World';
                            var sv = (res.wifi_survey && res.wifi_survey[w.iface]) || null;
                            var busyPct = -1, surveyStr = '', noiseVal = 0;
                            if (sv) {
                                noiseVal = parseInt(sv.noise) || 0;
                                var psv = self.prevSurvey[w.iface];
                                var curAct = parseInt(sv.active) || 0, curBusy = parseInt(sv.busy) || 0;
                                var curTx = parseInt(sv.tx) || 0, curRx = parseInt(sv.rx) || 0;
                                if (curAct > 0) {
                                    var live = psv && curAct > psv.active;
                                    var stale = psv && curAct === psv.active;
                                    var dA, dB, dT, dR;
                                    if (live)       { dA = curAct - psv.active; dB = curBusy - psv.busy; dT = curTx - psv.tx; dR = curRx - psv.rx; }
                                    else if (stale) { dA = curAct; dB = curBusy; dT = curTx; dR = curRx; }
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
                            wifiSigParts.push(w.iface + '|' + chStr + '|' + surveyStr + '|' + noiseVal + '|' + regStr + '|' + cfgMaxBr + '|' + chipMaxBr);
                        });
                        if (sigGate(self._sig, 'wifi', wifiSigParts.join(';'))) {
                            wfNode.innerHTML = '';
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
                                        box.style.flex = '1 1 0';
                                        wCol.appendChild(box);
                                    });
                                    wRow.appendChild(wCol);
                                });
                                wfNode.appendChild(wRow);
                            }
                        }
                        wifiCard.style.display = wifiRendered > 0 ? 'flex' : 'none';
                    }
                } else {
                    wifiCard.style.display = 'none';
                }
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
                        if (!self._irqRefs) {
                            irqNode.innerHTML = '';
                            var irqListWrap = E('div', {});
                            var legendCores = E('div', { style: 'display: flex; gap: 10px; justify-content: center; font-size: 0.72em; opacity: 0.6; margin: 4px 0 8px 0; flex-wrap: wrap;' });
                            var snVal = E('span', { class: 'hw-stat-value', style: 'font-size: 0.9em;' });
                            var softnetRow = E('div', { class: 'hw-stat-row', style: 'border-top: 1px solid var(--border-color, rgba(128,128,128,0.15)); padding-top: 8px; display: none;' }, [
                                E('span', { class: 'hw-stat-label', style: 'font-size: 0.9em;' }, 'Backlog Drops / Squeezed'),
                                snVal
                            ]);
                            irqNode.appendChild(irqListWrap);
                            irqNode.appendChild(legendCores);
                            irqNode.appendChild(softnetRow);
                            self._irqRefs = { irqListWrap: irqListWrap, legendCores: legendCores, snVal: snVal, softnetRow: softnetRow, cache: {}, legendCoreCount: -1 };
                        }
                        var ir = self._irqRefs;
                        syncRows(ir.irqListWrap, ir.cache, irqRates.slice(0, 6), function(q) { return q.name; }, function(q) {
                            var val = E('span', { class: 'hw-stat-value', style: 'font-size: 0.9em;' });
                            var barBg = E('div', { class: 'hw-bar-bg', style: 'height: 5px; display: flex;' });
                            var el = E('div', { class: 'hw-progress-item', style: 'margin-bottom: 8px;' }, [
                                E('div', { class: 'hw-progress-header' }, [E('span', { class: 'hw-stat-label', style: 'font-size: 0.9em;' }, q.name), val]),
                                barBg
                            ]);
                            return { el: el, val: val, barBg: barBg };
                        }, function(entry, q) {
                            entry.val.textContent = Math.round(q.rate) + ' /s';
                            entry.barBg.innerHTML = '';
                            var total = q.cores.reduce(function(a, b) { return a + b; }, 0) || 1;
                            q.cores.forEach(function(cv, ci) {
                                if (cv <= 0) return;
                                entry.barBg.appendChild(E('div', { style: 'height: 100%; width: ' + (cv / total * 100) + '%; background: ' + CORE_COLORS[ci % CORE_COLORS.length] + ';' }));
                            });
                        });
                        var coreCount = Math.min(res.cpus.length - 1, 8);
                        if (ir.legendCoreCount !== coreCount) {
                            ir.legendCoreCount = coreCount;
                            ir.legendCores.innerHTML = '';
                            for (var lc = 0; lc < coreCount; lc++) {
                                ir.legendCores.appendChild(E('span', { style: 'display: inline-flex; align-items: center; gap: 4px;' }, [
                                    E('span', { style: 'width: 8px; height: 8px; border-radius: 2px; background: ' + CORE_COLORS[lc % CORE_COLORS.length] + ';' }),
                                    'C' + lc
                                ]));
                            }
                        }
                        if (res.softnet && res.softnet.length > 0) {
                            var snD = 0, snS = 0;
                            if (self.prevSoftnet) {
                                res.softnet.forEach(function(sn, si) {
                                    var p = self.prevSoftnet[si];
                                    if (p) { snD += Math.max(0, sn.d - p.d); snS += Math.max(0, sn.s - p.s); }
                                });
                                var snColor = snD > 0 ? '#ff5252' : snS > 0 ? '#ffb300' : 'currentColor';
                                ir.softnetRow.style.display = '';
                                ir.snVal.style.color = snColor;
                                ir.snVal.textContent = snD + ' / ' + snS + ' per 3s';
                            }
                            self.prevSoftnet = res.softnet;
                        }
                        irqCard.style.display = 'flex';
                    }
                } else {
                    irqCard.style.display = 'none';
                }
                if (res.offload && (res.offload.ft > 0 || res.offload.ppe_flows >= 0 || res.offload.wed > 0 || res.offload.sw_cfg > 0 || res.offload.hw_cfg > 0 || res.offload.qcom)) {
                    var off = res.offload;
                    var offNode = document.getElementById('hw-offload');
                    if (offNode) {
                        var offRows = [];
                        if (!off.qcom) {
                            offRows.push({ k: 'ft', type: 'row', label: 'Flowtable Fast Path', val: off.ft > 0 ? 'Active' : 'Not configured', color: off.ft > 0 ? '#00bcd4' : '#9e9e9e' });
                            offRows.push({ k: 'cfg', type: 'row', label: 'Config (SW / HW)', val: (off.sw_cfg > 0 ? 'on' : 'off') + ' / ' + (off.hw_cfg > 0 ? 'on' : 'off'), color: (off.sw_cfg > 0 || off.hw_cfg > 0) ? '' : '#9e9e9e' });
                        }
                        var connNow = (res.cpu_meta && res.cpu_meta.conntrack) || 0;
                        if (off.sw_flows >= 0) offRows.push({ k: 'swflows', type: 'bar', label: off.qcom ? 'PPE Offloaded Flows' : 'Offloaded / Active Flows', cur: off.sw_flows, tot: connNow, color: '#00bcd4' });
                        if (!off.qcom && off.ppe_flows >= 0) offRows.push({ k: 'ppeflows', type: 'bar', label: 'PPE Bind Entries', cur: off.ppe_flows, tot: off.ppe_total > 0 ? off.ppe_total : (off.sw_flows >= 0 ? off.sw_flows : off.ppe_flows), color: '#8bc34a' });
                        if (off.wed > 0) offRows.push({ k: 'wed', type: 'row', label: 'WED (Wi-Fi offload)', val: off.wed + ' engine' + (off.wed > 1 ? 's' : ''), color: '#00bcd4' });
                        if (off.qcom) {
                            var q = off.qcom;
                            offRows.push({ k: 'qcomhdr', type: 'header', label: 'Qualcomm PPE Diagnostics' });
                            var hits = 0, misses = 0;
                            if (q.cpu_code) {
                                Object.keys(q.cpu_code).forEach(function(k) {
                                    var val = parseInt(q.cpu_code[k] || 0);
                                    if (k.indexOf('_drop0') !== -1) {
                                        hits += val;
                                    } else if (k.indexOf('_drop') !== -1) {
                                        misses += val;
                                    } else {
                                        var code = k.replace('cpucode_', '');
                                        if (['152', '153', '154', '155'].indexOf(code) !== -1) {
                                            hits += val;
                                        } else if (['162', '163'].indexOf(code) !== -1) {
                                            misses += val;
                                        }
                                    }
                                });
                            }
                            offRows.push({ k: 'hits', type: 'row', label: 'Punted to CPU (No Drop)', val: hits, color: hits > 0 ? '#8bc34a' : '#9e9e9e' });
                            offRows.push({ k: 'misses', type: 'row', label: 'Punted to CPU (Dropped)', val: misses, color: misses > 0 ? '#ffb300' : '#9e9e9e' });
                            var silent = q.bm_silent || 0;
                            var overflow = q.bm_overflow || 0;
                            offRows.push({ k: 'bmdrops', type: 'row', label: 'PPE Buffer Drops (Silent / Over)', val: silent + ' / ' + overflow, color: (silent > 0 || overflow > 0) ? '#ff5252' : '#9e9e9e' });
                            var edma_err_cnt = 0;
                            if (q.edma_err) {
                                Object.keys(q.edma_err).forEach(function(k) {
                                    edma_err_cnt += parseInt(q.edma_err[k] || 0);
                                });
                            }
                            offRows.push({ k: 'edma', type: 'row', label: 'EDMA AXI / Ring Errors', val: edma_err_cnt, color: edma_err_cnt > 0 ? '#ff5252' : '#9e9e9e' });
                        }
                        offRows.push({ k: 'footer', type: 'footer' });
                        if (!self._offCache) self._offCache = {};
                        syncRows(offNode, self._offCache, offRows, function(r) { return r.k; }, function(r) {
                            if (r.type === 'row') {
                                var val = E('span', { class: 'hw-stat-value' });
                                var elr = E('div', { class: 'hw-stat-row' }, [E('span', { class: 'hw-stat-label' }, r.label), val]);
                                return { el: elr, val: val };
                            } else if (r.type === 'bar') {
                                var val2 = E('span', { class: 'hw-stat-value' });
                                var fill = E('div', { class: 'hw-bar-fill' });
                                var elr2 = E('div', { class: 'hw-progress-item', style: 'margin-bottom: 8px;' }, [E('div', { class: 'hw-progress-header' }, [E('span', { class: 'hw-stat-label' }, r.label), val2]), E('div', { class: 'hw-bar-bg' }, [fill])]);
                                return { el: elr2, val: val2, fill: fill };
                            } else if (r.type === 'header') {
                                var elr3 = E('div', { class: 'hw-stat-row', style: 'border-top: 1px solid var(--border-color, rgba(128,128,128,0.15)); margin: 8px 0; padding-top: 8px;' }, [
                                    E('span', { class: 'hw-stat-label', style: 'font-weight: bold; color: #8bc34a;' }, r.label),
                                    E('span', { class: 'hw-stat-value' }, '')
                                ]);
                                return { el: elr3 };
                            } else {
                                var elr4 = E('div', { style: 'font-size: 0.72em; opacity: 0.45; margin-top: 8px; text-align: center;' }, 'Flows bound to the PPE are routed in hardware and never touch the CPU');
                                return { el: elr4 };
                            }
                        }, function(entry, r) {
                            if (r.type === 'row') {
                                entry.val.textContent = r.val;
                                entry.val.style.color = r.color || '';
                            } else if (r.type === 'bar') {
                                var pctB = r.tot > 0 ? Math.min(100, r.cur / r.tot * 100) : 0;
                                entry.val.textContent = r.cur + ' / ' + r.tot;
                                entry.val.style.color = r.color;
                                entry.fill.style.width = pctB + '%';
                                entry.fill.style.background = r.color;
                            }
                        });
                    }
                    offloadCard.style.display = 'flex';
                } else {
                    offloadCard.style.display = 'none';
                }
                if (res.hw_events && res.hw_events.length > 0) {
                    var evNode = document.getElementById('hw-events');
                    if (evNode) {
                        if (!self._evCache) self._evCache = {};
                        syncRows(evNode, self._evCache, res.hw_events.slice().reverse(), function(line) { return line; }, function(line) {
                            var relSpan = E('span', { style: 'flex-shrink: 0; min-width: 62px; opacity: 0.55; font-size: 0.9em;' });
                            var msgSpan = E('span', { style: 'font-family: monospace; font-size: 0.92em; opacity: 0.85; word-break: break-word; min-width: 0;' });
                            var el = E('div', { style: 'display: flex; gap: 10px; align-items: baseline; font-size: 0.85em; padding: 4px 8px; background: rgba(128,128,128,0.05); border-radius: 4px;' }, [relSpan, msgSpan]);
                            return { el: el, relSpan: relSpan, msgSpan: msgSpan };
                        }, function(entry, line) {
                            var rel = '';
                            var m = line.match(/^\[\s*(\d+)\./);
                            if (m && res.uptime) {
                                var ago = res.uptime - parseInt(m[1]);
                                if (ago < 0) ago = 0;
                                rel = ago < 60 ? ago + 's ago' : ago < 3600 ? Math.floor(ago / 60) + 'm ago' : ago < 86400 ? Math.floor(ago / 3600) + 'h ago' : Math.floor(ago / 86400) + 'd ago';
                            }
                            entry.relSpan.textContent = rel;
                            entry.msgSpan.textContent = line.replace(/^\[\s*[\d.]+\]\s*/, '');
                        });
                    }
                    eventsCard.style.display = 'flex';
                } else {
                    eventsCard.style.display = 'none';
                }
                if ((res.hwmon_extra && res.hwmon_extra.length > 0) || (res.rapl && res.rapl.length > 0)) {
                    var hxNode = document.getElementById('hw-hwmon');
                    var hxShown = 0;
                    if (hxNode) {
                        var hxItems = (res.hwmon_extra || []).filter(function(hx) {
                            return hx.unit === 'V' || hx.unit === 'RPM' || hx.unit === 'W' || hx.unit === 'A';
                        });
                        // RAPL reports cumulative microjoules, not an instantaneous
                        // power reading — derive Watts from the delta between polls,
                        // the same client-side pattern already used for disk I/O
                        // speed (self.prevDisk). Re-expressed as synthetic µW so it
                        // rides the existing 'W' formatting path below unchanged.
                        if (res.rapl && res.rapl.length > 0) {
                            var raplNow = Date.now();
                            if (!self.prevRapl) self.prevRapl = {};
                            var raplLabels = { 'package-0': 'Package Power', 'package-1': 'Package Power (1)', core: 'Core Power', dram: 'DRAM Power' };
                            res.rapl.forEach(function(rz) {
                                var prev = self.prevRapl[rz.name];
                                var watts = 0;
                                if (prev) {
                                    var tDiff = (raplNow - prev.time) / 1000.0;
                                    if (tDiff > 0) watts = Math.max(0, (rz.energy_uj - prev.energy_uj) / 1e6 / tDiff);
                                }
                                self.prevRapl[rz.name] = { energy_uj: rz.energy_uj, time: raplNow };
                                if (prev) {
                                    hxItems.push({ name: raplLabels[rz.name] || (rz.name + ' Power'), val: watts * 1e6, unit: 'W' });
                                }
                            });
                        }
                        hxShown = hxItems.length;
                        if (!self._hxCache) self._hxCache = {};
                        syncRows(hxNode, self._hxCache, hxItems, function(hx, i) { return hx.name + '|' + i; }, function(hx) {
                            var val = E('span', { class: 'hw-stat-value' });
                            var el = E('div', { class: 'hw-stat-row' }, [E('span', { class: 'hw-stat-label' }, hx.name), val]);
                            return { el: el, val: val };
                        }, function(entry, hx) {
                            var txt = '';
                            if (hx.unit === 'V') txt = (hx.val / 1000).toFixed(2) + ' V';
                            else if (hx.unit === 'RPM') txt = hx.val + ' RPM';
                            else if (hx.unit === 'W') txt = (hx.val / 1e6).toFixed(2) + ' W';
                            else if (hx.unit === 'A') txt = (hx.val / 1000).toFixed(2) + ' A';
                            entry.val.textContent = txt;
                        });
                    }
                    hwmonCard.style.display = hxShown > 0 ? 'flex' : 'none';
                } else {
                    hwmonCard.style.display = 'none';
                }
                var sysInfoGrid = document.getElementById('hw-sysinfo-grid');
                if (sysInfoGrid && res.sys_info && sigGate(self._sig, 'sysinfo', JSON.stringify(res.sys_info) + '|' + res.board + '|' + res.model)) {
                    sysInfoGrid.innerHTML = '';
                    var si = res.sys_info;
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
        infoTick();
        pingTick();
        return container;
    },
    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
