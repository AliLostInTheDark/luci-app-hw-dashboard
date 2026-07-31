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
var callHwGetWanQuality = rpc.declare({
    object: 'luci.hwdash',
    method: 'wan_quality',
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
var callHwGetAql = rpc.declare({
    object: 'luci.hwdash',
    method: 'get_aql',
    expect: {}
});
var callHwSetAql = rpc.declare({
    object: 'luci.hwdash',
    method: 'set_aql',
    params: ['aql'],
    expect: {}
});
var callHwWifiClients = rpc.declare({
    object: 'luci.hwdash',
    method: 'wifi_clients',
    expect: {}
});
var callHwWanIps = rpc.declare({
    object: 'luci.hwdash',
    method: 'wan_ips',
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
        var style = E('style', {}, ' .hw-dashboard { display: flex; flex-wrap: wrap; align-items: stretch; gap: 20px; padding: 15px; font-family: system-ui, -apple-system, sans-serif; width: 100%; max-width: 100%; overflow: hidden; } .hw-dashboard * { box-sizing: border-box; } .hw-thermals-container { display: flex; flex-direction: row; width: 100%; height: 100%; } .hw-thermals-col { flex: 1; } .hw-thermals-col-left { padding-right: 15px; } .hw-thermals-col-mid { padding: 0 15px; } .hw-thermals-col-right { padding-left: 15px; } .hw-thermals-title { font-size: 0.85em; opacity: 0.6; margin-bottom: 10px; text-align: center; } .hw-thermals-divider { width: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 10px 15px 30px 15px; } @media (max-width: 768px) { .hw-thermals-container { flex-direction: column; } .hw-thermals-col { padding: 0 !important; } .hw-thermals-divider { width: auto; height: 1px; margin: 25px 0; } } .hw-meta-grid { margin-top: 15px; font-size: 0.8em; color: currentColor; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; opacity: 0.8; width: 75%; margin-left: auto; margin-right: auto; } @media (max-width: 480px) { .hw-meta-grid { width: 100%; font-size: 0.75em; } .hw-dial { transform: scale(0.9); } .hw-card { padding: 15px; } } .hw-card { flex: 1 1 280px; background: var(--background-color-high, rgba(128, 128, 128, 0.05)); border: 1px solid var(--border-color, rgba(128, 128, 128, 0.2)); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-color, inherit); position: relative; box-shadow: 0 4px 10px rgba(0,0,0,0.1); max-width: 100%; overflow: hidden; } .hw-card.wide { flex: 1 1 100%; align-items: stretch; } .hw-card h3 { margin: 0 0 20px 0; font-size: 1.1em; color: var(--text-color, inherit); opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; text-align: center; word-break: break-word; line-height: 1.3; }.hw-dial { position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center; margin: 0 auto; } .hw-dial svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform: rotate(-90deg); } .hw-dial-bg { fill: none; stroke: rgba(128, 128, 128, 0.2); stroke-width: 10; } .hw-dial-progress { fill: none; stroke-width: 10; stroke-linecap: round; transition: stroke-dasharray 0.5s ease; } .hw-dial-text { font-size: 2.2em; font-weight: 600; z-index: 1; } .hw-dial-subtext { position: absolute; bottom: 25px; font-size: 0.9em; opacity: 0.7; z-index: 1; } .hw-stats-list { width: 100%; display: flex; flex-direction: column; gap: 12px; } .hw-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 30px; width: 100%; } .hw-stat-row { display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 8px; } .hw-stat-label { opacity: 0.8; font-size: 0.95em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex-shrink: 1; margin-right: 10px; } .hw-stat-value { font-weight: bold; font-size: 0.95em; white-space: nowrap; flex-shrink: 0; } .hw-progress-item { display: flex; flex-direction: column; margin-bottom: 15px; width: 100%; } .hw-progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; width: 100%; min-width: 0; } .hw-bar-bg { width: 100%; height: 6px; background: var(--border-color, rgba(128, 128, 128, 0.2)); border-radius: 3px; overflow: hidden; margin-top: 6px; } .hw-bar-fill { height: 100%; transition: width 0.5s ease; } .hw-temp-badge { padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 0.9em; white-space: nowrap; } .hw-temp-crit { animation: hwTempPulse 1.1s ease-in-out infinite; } @keyframes hwTempPulse { 0%, 100% { box-shadow: 0 0 3px rgba(255,23,68,0.5); } 50% { box-shadow: 0 0 14px rgba(255,23,68,0.95); } } #hw-nand-row { align-items: flex-start; } @media (max-width: 768px) { #hw-nand-row { align-items: stretch; } #hw-nand-row > .hw-thermals-col { width: 100%; min-width: 0; } #hw-nand-row > .hw-thermals-divider { margin: 12px 0; } } .hw-core-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; width: 100%; } .hw-core-cell { background: rgba(128, 128, 128, 0.05); border: 1px solid var(--border-color, rgba(128, 128, 128, 0.15)); border-radius: 8px; padding: 10px 14px; } .hw-core-cell .hw-progress-header { margin-bottom: 6px; } .cbi-value { min-width: 0; } .cbi-value .cbi-value-title { flex-shrink: 0; }  .hw-dashboard .cbi-map > .cbi-section { margin-bottom: 14px; }  .hw-dashboard .cbi-section > h3 { margin-top: 0; }  .hw-dashboard .cbi-value-field > input, .hw-dashboard .cbi-value-field > select { max-width: 100%; }  .hw-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 10px; }  @media (max-width: 600px) {  .hw-dashboard .cbi-value-field > input[type=text], .hw-dashboard .cbi-value-field > select { width: 100%; box-sizing: border-box; min-width: 0; }  .hw-stat-label { white-space: normal; overflow: visible; text-overflow: clip; }  }  .hw-sta-row { display: flex; align-items: flex-start; gap: 12px 16px; flex-wrap: wrap; padding: 9px 12px; border: 1px solid var(--border-color, rgba(128,128,128,0.22)); border-radius: 8px; }  .hw-sta-id { display: flex; flex-direction: column; min-width: 0; gap: 2px; flex: 1 1 200px; }  .hw-sta-metrics { display: flex; gap: 16px; flex: 0 1 auto; min-width: 0; margin-left: auto; flex-wrap: wrap; justify-content: flex-end; }  .hw-sta-cell { display: flex; flex-direction: column; align-items: center; gap: 2px; }  .hw-sta-val { font-family: monospace; font-weight: 700; line-height: 1.2; white-space: nowrap; }  .hw-sta-lbl { font-size: 0.62em; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }  .hw-kv { display: flex; align-items: baseline; gap: 10px; width: 100%; }  .hw-kv-k { flex: 0 0 auto; font-size: 0.72em; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.5px; }  #hw-wanip .hw-kv-k { opacity: 1; font-weight: 700; }  .hw-kv-v { flex: 1 1 auto; min-width: 0; text-align: right; font-family: monospace; font-size: 0.85em; word-break: break-all; }  @media (max-width: 640px) {  .hw-sta-metrics { flex-direction: column; width: 100%; margin-left: 0; gap: 7px; }  .hw-sta-cell { flex-direction: row-reverse; justify-content: space-between; align-items: center; width: 100% !important; flex: 1 1 auto !important; }  .hw-sta-lbl { font-size: 0.72em; } .hw-wanq-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; flex: 1 1 100% !important; max-width: 100% !important; margin-top: 8px; } } @media (max-width: 480px) { .hw-wanq-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } .hw-kv { flex-direction: column; align-items: flex-start; gap: 2px; } .hw-kv-v { text-align: left; word-break: break-all; } .hw-wifi-card-body > div { font-size: 0.85em; } } .hw-check-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 1px 14px; } .hw-tgt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(185px, 1fr)); gap: 1px 14px; }  .hw-tgt { display: flex; align-items: center; gap: 7px; font-size: 0.88em; cursor: pointer; min-width: 0; padding: 2px 0; }  .hw-tgt input { flex: 0 0 auto; margin: 0; }  .hw-tgt-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }  .hw-dashboard .hw-tgt-x { flex: 0 0 auto; width: 17px; height: 17px; padding: 0; margin: 0; border: 0; border-radius: 4px; background: transparent; color: #ff5252; opacity: 1; font-size: 15px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s ease; }  .hw-dashboard .hw-tgt-x:hover, .hw-dashboard .hw-tgt-x:focus-visible { background: rgba(255,82,82,0.18); } ');
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
        // Smooth cubic-bezier interpolation between points (mid-x control
        // handles, the same construction luci-app-wanlive-dashboard uses for
        // its traffic/latency charts) instead of a jagged straight polyline
        // -- a soft "hill" shape reads as a trend at a glance.
        var smoothPathXY = function(pts) {
            var path = 'M ' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
            for (var i = 0; i < pts.length - 1; i++) {
                var x0 = pts[i][0], y0 = pts[i][1], x1 = pts[i + 1][0], y1 = pts[i + 1][1];
                var mx = (x0 + x1) / 2;
                path += ' C ' + mx.toFixed(1) + ',' + y0.toFixed(1) + ' ' + mx.toFixed(1) + ',' + y1.toFixed(1) + ' ' + x1.toFixed(1) + ',' + y1.toFixed(1);
            }
            return path;
        };
        // Small per-WAN-interface ping-stability trend graph. Same
        // width:100%+viewBox trick as drawUsageSpark above (so it scales to
        // mobile for free), Y-axis auto-ranged off the actual latency values.
        // Down/timeout samples are pinned to the chart's floor instead of
        // leaving a gap, so the ONE continuous curve eases smoothly down
        // into an outage and back up out of it -- a hard-edged block
        // dropped on top read as a sudden jump-cut, not a trend. A second
        // fill, sharing the exact same curve geometry (plus the one real
        // point on each side so it meets the healthy curve exactly rather
        // than starting/ending mid-air), recolors just that stretch red --
        // the color change rides on one continuous shape instead of being
        // a visibly separate layer.
        var drawWanHistorySpark = function(el, history, color) {
            if (!el) return;
            var W = 160, H = 40, P = 2;
            if (!history || history.length < 2) { el.innerHTML = ''; return; }
            var vals = history.filter(function(v) { return v != null; });
            var n = history.length;
            var x = function(i) { return P + i * (W - 2 * P) / (n - 1); };
            color = color || '#00bcd4';
            var gid = 'wq' + Math.random().toString(36).slice(2, 9);
            var svg = '<defs>' +
                '<linearGradient id="' + gid + '" x1="0%" y1="0%" x2="0%" y2="100%">' +
                '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.8"/>' +
                '<stop offset="100%" stop-color="' + color + '" stop-opacity="0.06"/>' +
                '</linearGradient>' +
                '<linearGradient id="' + gid + 'd" x1="0%" y1="0%" x2="0%" y2="100%">' +
                '<stop offset="0%" stop-color="#f44336" stop-opacity="0.8"/>' +
                '<stop offset="100%" stop-color="#f44336" stop-opacity="0.06"/>' +
                '</linearGradient>' +
                '</defs>';

            if (vals.length === 0) {
                // A zero-height filled path paints nothing. Give a fully
                // offline window a real, two-pixel red baseline instead.
                el.innerHTML = '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
                    svg + '<rect x="' + P + '" y="' + (H - P - 2) + '" width="' + (W - 2 * P) + '" height="2" rx="1" fill="#f44336" fill-opacity="0.9"/></svg>';
                return;
            }

            var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
            if (hi - lo < 10) { var mid = (hi + lo) / 2; lo = mid - 5; hi = mid + 5; }
            var pad = (hi - lo) * 0.15;
            lo = Math.max(0, lo - pad); hi = hi + pad;
            var y = function(v) { return H - P - (v - lo) * (H - 2 * P) / (hi - lo); };

            var allPts = [];
            for (var i = 0; i < n; i++) {
                var v = history[i];
                allPts.push([x(i), v == null ? (H - P) : y(v)]);
            }
            var basePath = smoothPathXY(allPts);
            var baseFill = basePath + ' L ' + allPts[n - 1][0].toFixed(1) + ',' + (H - P) + ' L ' + allPts[0][0].toFixed(1) + ',' + (H - P) + ' Z';
            // The fill and its fine highlight stroke are one continuous
            // healthy curve. Outage segments below overlay that exact same
            // geometry, so their color transition is smooth rather than a
            // separate-looking block.
            svg += '<path d="' + baseFill + '" fill="url(#' + gid + ')" stroke="none"/>' +
                '<path d="' + basePath + '" fill="none" stroke="' + color + '" stroke-opacity="0.72" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>';

            var j = 0;
            while (j < n) {
                if (history[j] == null) {
                    var runEnd = j;
                    while (runEnd < n && history[runEnd] == null) runEnd++;
                    var segStart = Math.max(0, j - 1);
                    var segEnd = Math.min(n - 1, runEnd);
                    var seg = allPts.slice(segStart, segEnd + 1);
                    if (seg.length >= 2) {
                        var dPath = smoothPathXY(seg);
                        var dFill = dPath + ' L ' + seg[seg.length - 1][0].toFixed(1) + ',' + (H - P) + ' L ' + seg[0][0].toFixed(1) + ',' + (H - P) + ' Z';
                        svg += '<path d="' + dFill + '" fill="url(#' + gid + 'd)" stroke="none"/>' +
                            '<path d="' + dPath + '" fill="none" stroke="#f44336" stroke-opacity="0.9" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>';
                    }
                    j = runEnd;
                } else {
                    j++;
                }
            }
            el.innerHTML = '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + svg + '</svg>';
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
        // psent/plost carry REAL ICMP packet counts alongside the poll-level
        // lostN/cnt. The graph keeps using lostN/cnt (a loss tick means a poll
        // that returned nothing); the table's loss column prefers psent/plost,
        // which counts individual packets and so still sees a 1-in-2 drop that
        // the poll-level view cannot distinguish from a clean probe.
        var buildSeriesFrom = function(t, vw) {
            var pd = t.pdata || [];
            if (vw.raw) {
                var off = Math.max(0, t.data.length - vw.pts);
                return t.data.slice(-vw.pts).map(function(v, i) {
                    var p = pd[off + i] || { s: 0, r: 0 };
                    return { v: v, loss: v === null, lostN: v === null ? 1 : 0, cnt: 1,
                             psent: p.s, plost: p.s - p.r };
                });
            }
            var per = vw.group;
            var src = t.agg.slice(-(vw.pts * per));
            var out = [];
            for (var i = 0; i < src.length; i += per) {
                var sum = 0, n = 0, loss = 0, psent = 0, precv = 0;
                for (var k = i; k < Math.min(i + per, src.length); k++) {
                    var b = src[k];
                    if (b.a !== null) { sum += b.a * b.n; n += b.n; }
                    loss += b.loss;
                    psent += b.ps || 0;
                    precv += b.pr || 0;
                }
                var cnt = n + loss;
                out.push({ v: n > 0 ? sum / n : null, loss: loss > 0 && cnt > 0 && loss / cnt >= 0.02, lostN: loss, cnt: cnt,
                           psent: psent, plost: psent - precv });
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
            var sortPingKeys = function(h) {
                return Object.keys(h).sort(function(ka, kb) {
                    var a = h[ka], b = h[kb];
                    if (!a || !b) return ka.localeCompare(kb);
                    if (a.gw && !b.gw) return -1;
                    if (!a.gw && b.gw) return 1;
                    if (a.gw && b.gw) return (a.fam || 4) - (b.fam || 4);
                    var hA = (a.host || '').toLowerCase();
                    var hB = (b.host || '').toLowerCase();
                    var c = hA.localeCompare(hB, undefined, { sensitivity: 'base' });
                    if (c !== 0) return c;
                    return (a.fam || 4) - (b.fam || 4);
                });
            };
            var update = function(hist) {
                P.hist = hist;
                P.keys = sortPingKeys(hist);
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
        // One ordering for every list of names on the page, matching how LuCI
        // itself sorts interfaces and sections: case-insensitive, with embedded
        // digits compared as numbers so wan2 comes before wan10 rather than
        // after it. Anything the user reads as a list gets sorted with this --
        // an order that depends on discovery time means the same router shows
        // the same cards in a different order on the next boot.
        var byName = function(a, b) {
            return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
        };
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
        // The graph is a view of this card's own data, not a card of its own --
        // it has always lived inside this element. Exposing it as a second
        // entry in Visible Cards implied the two were peers and produced one
        // combination that could not work: hiding "Ping Latency" makes pingTick
        // return early, so a "Ping Graph" left ticked simply froze. The control
        // belongs on the card it affects.
        // Same shape for both graph toggles: a compact control on the card
        // whose view it changes, storing under the key its old Visible Cards
        // checkbox used so an existing config needs no migration.
        var makeGraphToggle = function(key) {
            return E('button', {
                type: 'button',
                class: 'hw-tgt-x',
                style: 'width: auto; padding: 1px 8px; font-size: 0.68em; font-weight: 700; letter-spacing: 0.4px; color: inherit; opacity: 0.6;',
                click: function() {
                    var i = self.hiddenCards.indexOf(key);
                    if (i === -1) self.hiddenCards.push(key); else self.hiddenCards.splice(i, 1);
                    applyCardVisibility();
                    saveConfig();
                }
            });
        };
        var thermGraphToggle = makeGraphToggle('therm_graph');
        var pingGraphToggle = E('button', {
            type: 'button',
            class: 'hw-tgt-x',
            style: 'width: auto; padding: 1px 8px; font-size: 0.68em; font-weight: 700; letter-spacing: 0.4px; color: inherit; opacity: 0.6;',
            click: function() {
                var i = self.hiddenCards.indexOf('ping_graph');
                if (i === -1) self.hiddenCards.push('ping_graph'); else self.hiddenCards.splice(i, 1);
                applyCardVisibility();
                saveConfig();
            }
        });
        var pingHead = E('div', { style: 'display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%;' }, [
            E('h3', { style: 'margin-bottom: 0;' }, 'Ping Latency'), pingGraphToggle
        ]);
        var pingCard = E('div', { class: 'hw-card wide', style: 'justify-content: flex-start; display: none;' }, [
            E('div', { style: 'width: 100%; margin-bottom: 20px;' }, [pingHead]),
            pingGraphNode,
            E('div', { style: 'text-align: center; font-size: 0.72em; opacity: 0.45; margin-top: 8px;' }, 'Add targets via \u2699 Settings (top right), or /etc/hwdash-ping.targets on the router')
        ]);
        var wanQualityCard = E('div', { class: 'hw-card wide', style: 'justify-content: flex-start; display: none;' }, [
            E('h3', {}, 'WAN Uptime Status'),
            E('div', { id: 'hw-wanq-list', style: 'width: 100%; display: flex; flex-direction: column; gap: 16px;' })
        ]);
        var wifiCard = E('div', { class: 'hw-card wide', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Wi-Fi PHY & Spectrum'), E('div', { id: 'hw-wifi-radios', style: 'margin-top: 0; padding-top: 0; width: 100%;' })]);
        var wanIpCard = E('div', { class: 'hw-card wide', style: 'justify-content: flex-start; display: none;' }, [
            E('h3', {}, 'NAT Type'),
            E('div', { id: 'hw-wanip', style: 'width: 100%; display: flex; flex-direction: column; gap: 8px;' })
        ]);
        var alertsCard = E('div', { class: 'hw-card wide', style: 'justify-content: flex-start; display: none;' }, [
            E('h3', {}, 'Alerts'),
            E('div', { id: 'hw-alerts', style: 'width: 100%; display: flex; flex-direction: column; gap: 6px;' })
        ]);
        var wifiStaCard = E('div', { class: 'hw-card wide', style: 'justify-content: flex-start; display: none;' }, [
            E('h3', {}, 'Wi-Fi Clients'),
            E('div', { id: 'hw-wifi-sta', style: 'width: 100%; display: flex; flex-direction: column; gap: 8px;' })
        ]);
        var hwmonCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Power & Fans'), E('div', { id: 'hw-hwmon', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0;' })]);
        var offloadCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Offload Engines'), E('div', { id: 'hw-offload', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0;' })]);
        var aqlCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Wireless AQL'), E('div', { id: 'hw-aql', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0;' })]);
        var irqCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Interrupts'), E('div', { id: 'hw-irq', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0;' })]);
        var eventsCard = E('div', { class: 'hw-card wide', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Hardware Events'), E('div', { id: 'hw-events', style: 'width: 100%; display: flex; flex-direction: column; gap: 5px;' })]);
        var sysCard = E('div', {class: 'hw-card wide', style: 'justify-content: flex-start;'});
        sysCard.appendChild(E('h3', {}, 'System Info'));
        sysCard.appendChild(E('div', {id: 'hw-sysinfo-grid', style: 'width: 100%;'}));
        container.appendChild(style);
        // Alerts sit above everything: if something is wrong it should be the
        // first thing on the page, not found by scrolling.
        container.appendChild(alertsCard);
        container.appendChild(sysCard);
        container.appendChild(cpuCard.node);
        container.appendChild(ramCard.node);
        container.appendChild(advCard);
        container.appendChild(coresCard);
        container.appendChild(irqCard);
        container.appendChild(hwmonCard);
        container.appendChild(offloadCard);
        container.appendChild(aqlCard);
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
        container.appendChild(wanQualityCard);
        container.appendChild(wifiCard);
        container.appendChild(wifiStaCard);
        container.appendChild(wanIpCard);
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
        var cleanWanList = function(arr) {
            if (!Array.isArray(arr)) return [];
            return arr.map(function(x) { return String(x).replace(/^!/, ''); });
        };
        var isIfaceHidden = function(iface, aliasOf) {
            if (!self.hiddenWanIfaces || !self.hiddenWanIfaces.length) return false;
            if (iface && self.hiddenWanIfaces.indexOf(iface) !== -1) return true;
            if (aliasOf && self.hiddenWanIfaces.indexOf(aliasOf) !== -1) return true;
            return false;
        };
        self.hiddenCards = Array.isArray(savedCfg.hidden) ? savedCfg.hidden : loadLS('hwdash.hiddenCards', []);
        self.pingTargets = Array.isArray(savedCfg.targets) ? savedCfg.targets : loadLS('hwdash.pingTargets', []);
        self.disabledPings = Array.isArray(savedCfg.disabledPings) ? savedCfg.disabledPings : [];
        self.hiddenWanIfaces = cleanWanList(Array.isArray(savedCfg.wanHidden) ? savedCfg.wanHidden : loadLS('hwdash.hiddenWanIfaces', []));
        self.wanTarget4 = typeof savedCfg.wanTarget4 === 'string' && savedCfg.wanTarget4 ? savedCfg.wanTarget4 : '1.1.1.1';
        self.wanTarget6 = typeof savedCfg.wanTarget6 === 'string' && savedCfg.wanTarget6 ? savedCfg.wanTarget6 : '2606:4700:4700::1111';
        var saveConfig = function() {
            if (typeof wanTgt4Input !== 'undefined' && wanTgt4Input && typeof wanTgt4Input.value === 'string') {
                self.wanTarget4 = wanTgt4Input.value.trim() || '1.1.1.1';
            }
            if (typeof wanTgt6Input !== 'undefined' && wanTgt6Input && typeof wanTgt6Input.value === 'string') {
                self.wanTarget6 = wanTgt6Input.value.trim() || '2606:4700:4700::1111';
            }
            return callHwSetConfig({
                hidden: self.hiddenCards,
                targets: self.pingTargets,
                disabledPings: self.disabledPings,
                wanHidden: self.hiddenWanIfaces,
                wanTarget4: self.wanTarget4,
                wanTarget6: self.wanTarget6
            }).catch(function() {});
        };
        // Settings are staged, not written the instant a control moves. The
        // control still updates the live view -- that is the preview, and it
        // is what makes the choice reviewable -- but nothing reaches the
        // router until Save. Revert re-reads the saved config, so anything
        // staged and not saved is discarded, which is what makes it safe to
        // experiment in here.
        var settingsDirty = false;
        var markDirty = function() {
            settingsDirty = true;
            if (typeof setPageMsg === 'function') setPageMsg('Unsaved changes \u2014 press Save to apply.', '#ffb300');
        };
        if (!Array.isArray(savedCfg.hidden) && (self.hiddenCards.length > 0 || self.pingTargets.length > 0)) {
            saveConfig();
        }
        var DEFAULT_PING_TARGETS = [
            { host: 'dns.google', fam: 4 }, { host: 'dns.google', fam: 6 },
            { host: 'google.com', fam: 4 }, { host: 'google.com', fam: 6 },
            { host: 'one.one.one.one', fam: 4 }, { host: 'one.one.one.one', fam: 6 },
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
            var items = [];
            DEFAULT_PING_TARGETS.concat(self.pingTargets).forEach(function(t) {
                expandFams(t).forEach(function(fam) {
                    var key = t.host + '|' + fam;
                    if (seen[key]) return;
                    seen[key] = true;
                    if (isPingDisabled(t.host, fam)) return;
                    items.push({ host: t.host, fam: fam, str: t.host + ' ' + fam });
                });
            });
            items.sort(function(a, b) {
                var c = a.host.localeCompare(b.host, undefined, { sensitivity: 'base' });
                if (c !== 0) return c;
                return a.fam - b.fam;
            });
            return items.map(function(it) { return it.str; });
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
        // Local SVGs cover the common ISPs. logos.hunter.io remains a
        // no-auth, domain-keyed fallback for the rest; an unrecognised ISP
        // uses a colored monogram while a remote image is loading or fails.
        var ISP_LOGO_DOMAINS = {
            airtel: 'airtel.in', bharti: 'airtel.in',
            jio: 'jio.com', reliance: 'jio.com',
            vodafone: 'myvi.in', ' vi ': 'myvi.in',
            bsnl: 'bsnl.co.in',
            // Matched against the whole registry string, which includes the AS
            // handle -- so one key covers every ASN an operator holds:
            // "railtel" hits AS24186/AS135750/AS151100, "gtpl" hits
            // AS135872/AS135257/AS132390, without listing each.
            // gtpl before hathway: GTPL Hathway should resolve to GTPL.
            gtpl: 'gtpl.net',
            railtel: 'railwire.co.in', railwire: 'railwire.co.in',
            hathway: 'hathway.com',
            comcast: 'xfinity.com', xfinity: 'xfinity.com',
            verizon: 'verizon.com',
            't-mobile': 't-mobile.com',
            spectrum: 'spectrum.com',
            cox: 'cox.com'
        };
        // Keep commonly seen providers bundled in the package. They do not
        // depend on a third-party favicon service supplying a transparent,
        // high-resolution image, and they render offline. Every asset is
        // trimmed and capped at 256px: the badge draws at 34px with
        // object-fit:contain, so that is still ~7x headroom for hi-DPI while
        // keeping each file small.
        var ISP_LOGO_ASSETS = {
            airtel: L.resource('hwdash-icons/airtel.png') + '?v=1', bharti: L.resource('hwdash-icons/airtel.png') + '?v=1',
            jio: L.resource('hwdash-icons/jio.png') + '?v=1', reliance: L.resource('hwdash-icons/jio.png') + '?v=1',
            // Keyed on the registry string, so one entry covers every ASN the
            // operator holds. gtpl before hathway, as in ISP_LOGO_DOMAINS.
            bsnl: L.resource('hwdash-icons/bsnl.png') + '?v=3',
            gtpl: L.resource('hwdash-icons/gtpl.png') + '?v=2',
            railtel: L.resource('hwdash-icons/railwire.png') + '?v=2',
            railwire: L.resource('hwdash-icons/railwire.png') + '?v=2'
        };
        // Friendly display names. The registry string is accurate but written
        // for network operators, not people: "AIRTELBROADBAND-AS-AP - Bharti
        // Airtel Ltd., Telemedia Services, IN" says Airtel in the least
        // readable way possible. Rather than take a dependency on a third-party
        // naming API -- which would add rate limits, a key, and a way for the
        // card to break when someone else's service is down -- map the handful
        // of operators worth naming locally. Matched against the whole registry
        // string exactly like the logo maps, so one entry covers every ASN an
        // operator holds. The untouched registry string stays available as the
        // row's tooltip, so nothing is actually lost.
        var ISP_DISPLAY_NAMES = {
            airtel: 'Bharti Airtel', bharti: 'Bharti Airtel',
            jio: 'Reliance Jio', reliance: 'Reliance Jio',
            bsnl: 'BSNL',
            vodafone: 'Vodafone Idea', idea: 'Vodafone Idea',
            // gtpl before hathway: GTPL Hathway should resolve to GTPL.
            gtpl: 'GTPL Hathway',
            railtel: 'RailWire', railwire: 'RailWire',
            hathway: 'Hathway',
            excitel: 'Excitel', tikona: 'Tikona',
            comcast: 'Comcast Xfinity', xfinity: 'Comcast Xfinity',
            verizon: 'Verizon', 't-mobile': 'T-Mobile',
            spectrum: 'Spectrum', cox: 'Cox Communications',
            'at&t': 'AT&T'
        };
        // ASN is a stable, unambiguous identifier (unlike the free-text org
        // name, which varies in punctuation/casing across lookups) -- so a
        // small local ISP that never shows up in any public logo service can
        // still get a real badge, keyed by its ASN rather than a name guess.
        var ISP_BY_ASN = {
            'AS151690': { color: '#c9432e', label: 'F5', name: 'FAB Five Network', logo: L.resource('hwdash-icons/fabfive.png') + '?v=1' },
            'AS133661': { color: '#da252b', label: 'NP', name: 'Netplus Broadband', logo: L.resource('hwdash-icons/netplus.svg') + '?v=4' },
            // Pinned by ASN rather than matched by name: AS45775 is WISH
            // NET PRIVATE LIMITED (IN), but AS59034 is "WISHNET - BeiJing
            // Wish Network Technology" (CN) -- a substring match on
            // "wishnet" hits both and would badge a Chinese network with
            // an Indian ISP's logo.
            'AS45775': { color: '#DA252B', label: 'WN', name: 'Wish Net', domain: 'wishnet.in', logo: L.resource('hwdash-icons/wishnet.png') + '?v=2' }
        };
        var ispBadge = function(ispFull, ifaceName) {
            var raw = ispFull || '';
            var asn = '';
            var org = raw;
            if (raw.indexOf(' | ') !== -1) {
                var parts = raw.split(' | ');
                asn = parts[0];
                org = parts[1];
            }
            if (!org && ifaceName) {
                var lowerIface = ifaceName.toLowerCase();
                if (lowerIface.indexOf('jio') !== -1 || lowerIface.indexOf('reliance') !== -1) {
                    org = 'Reliance Jio Infocomm'; asn = 'AS55836';
                } else if (lowerIface.indexOf('netplus') !== -1) {
                    org = 'Netplus Broadband'; asn = 'AS132540';
                } else if (lowerIface.indexOf('airtel') !== -1 || lowerIface.indexOf('bharti') !== -1) {
                    org = 'Bharti Airtel Ltd.'; asn = 'AS24560';
                } else if (lowerIface.indexOf('bsnl') !== -1) {
                    org = 'BSNL'; asn = 'AS9829';
                } else if (lowerIface.indexOf('railwire') !== -1 || lowerIface.indexOf('railtel') !== -1) {
                    org = 'RailWire'; asn = 'AS24186';
                }
            }
            var isp = org.toLowerCase();
            // Show the operator string exactly as the ASN registry gives it,
            // handle and all: "BSNL-NIB - National Internet Backbone, IN".
            // Trimming the handle reads better for operators whose name already
            // carries the brand, but it is guesswork, and it silently hid the
            // only recognisable token for the ones where the brand lives solely
            // in the handle. The full string is always the true answer, and the
            // ASN it came from is shown right beneath it.
            var full = (org || '').trim() || 'Unknown ISP';
            // Prefer a readable operator name where we know one; otherwise the
            // registry string stands as-is, which is always correct if ugly.
            var name = full;
            for (var nk in ISP_DISPLAY_NAMES) {
                if (isp.indexOf(nk) !== -1) { name = ISP_DISPLAY_NAMES[nk]; break; }
            }
            var color = '#607d8b', label = name.charAt(0).toUpperCase() || '?', domain = '', logo = '';
            if (ISP_BY_ASN[asn]) {
                // A pinned entry supplies branding (colour, short label, bundled
                // logo) for an operator no public logo service knows about. It
                // deliberately does NOT override the name: the registry name is
                // still the accurate one, and it is what gets displayed.
                var _pin = ISP_BY_ASN[asn];
                return { color: _pin.color, label: _pin.label, name: _pin.name || name, full: full, asn: asn, domain: _pin.domain || '', logo: _pin.logo || '' };
            }
            if (isp.indexOf('airtel') !== -1 || isp.indexOf('bharti') !== -1) { color = '#ED1B24'; label = 'A'; }
            else if (isp.indexOf('jio') !== -1 || isp.indexOf('reliance') !== -1) { color = '#0F1C4D'; label = 'Jio'; }
            else if (isp.indexOf('vodafone') !== -1 || isp.indexOf('idea') !== -1 || isp.indexOf(' vi ') !== -1) { color = '#E60000'; label = 'Vi'; }
            else if (isp.indexOf('bsnl') !== -1) { color = '#004C97'; label = 'BSNL'; }
            else if (isp.indexOf('gtpl') !== -1) { color = '#1B75BC'; label = 'GTPL'; }
            else if (isp.indexOf('railtel') !== -1 || isp.indexOf('railwire') !== -1) { color = '#00AEEF'; label = 'RW'; }
            else if (isp.indexOf('wish net private') !== -1) { color = '#DA252B'; label = 'WN'; }
            else if (isp.indexOf('hathway') !== -1) { color = '#E31E24'; label = 'HW'; }
            else if (isp.indexOf('comcast') !== -1 || isp.indexOf('xfinity') !== -1) { color = '#111827'; label = 'X'; }
            else if (isp.indexOf('at&t') !== -1) { color = '#00A8E0'; label = 'AT&T'; }
            else if (isp.indexOf('verizon') !== -1) { color = '#CD040B'; label = 'V'; }
            for (var key in ISP_LOGO_DOMAINS) {
                if (isp.indexOf(key) !== -1) { domain = ISP_LOGO_DOMAINS[key]; break; }
            }
            for (var assetKey in ISP_LOGO_ASSETS) {
                if (isp.indexOf(assetKey) !== -1) { logo = ISP_LOGO_ASSETS[assetKey]; break; }
            }
            return { color: color, label: label, name: name, full: full, asn: asn, domain: domain, logo: logo };
        };
        var fmtDuration = function(s) {
            s = Math.max(0, Math.floor(s || 0));
            var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
            if (d > 0) return d + 'D ' + h + 'H';
            if (h > 0) return h + 'H ' + m + 'M';
            if (m > 0) return m + 'M';
            return s + 'S';
        };
        // Full breakdown down to the second (WAN Quality's uptime/downtime
        // streak) -- unlike fmtDuration above, never caps at two units, so
        // an admin can tell exactly when a link flipped, not just "9h".
        var fmtDurationFull = function(s) {
            s = Math.max(0, Math.floor(s || 0));
            var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
            var parts = [];
            if (d > 0) parts.push(d + 'D');
            if (d > 0 || h > 0) parts.push(h + 'H');
            if (d > 0 || h > 0 || m > 0) parts.push(m + 'M');
            parts.push(sec + 'S');
            return parts.join(' ');
        };
        var cardRegistry = {
            sysinfo: { nodes: [sysCard], label: 'System Info', show: 'flex' },
            cpu: { nodes: [cpuCard.node], label: 'CPU', show: 'flex' },
            ram: { nodes: [ramCard.node], label: 'Memory', show: 'flex' },
            load: { nodes: [advCard], label: 'CPU Detailed Load', show: 'flex' },
            cores: { nodes: [coresCard], label: 'Per-Core Usage', show: 'flex' },
            hwmon: { nodes: [hwmonCard], label: 'Power & Fans', show: null },
            offload: { nodes: [offloadCard], label: 'Offload Engines', show: null },
            aql: { nodes: [aqlCard], label: 'Wireless AQL', show: null },
            irq: { nodes: [irqCard], label: 'Interrupts', show: null },
            events: { nodes: [eventsCard], label: 'Hardware Events', show: null },
            storage: { nodes: [dskCard.node], label: 'Internal Storage', show: 'flex' },
            ext: { nodes: [extCard, myExtWrapper], label: 'External Storage', show: null },
            ports: { nodes: [ethCard], label: 'Ports Topology', show: null },
            pcie: { nodes: [pcieCard], label: 'PCI-e', show: null },
            ping: { nodes: [pingCard], label: 'Ping Latency', show: null },
            wan_quality: { nodes: [wanQualityCard], label: 'WAN Uptime Status', show: null },
            wifi: { nodes: [wifiCard], label: 'Wi-Fi PHY & Spectrum', show: null },
            wifi_clients: { nodes: [wifiStaCard], label: 'Wi-Fi Clients', show: null },
            alerts: { nodes: [alertsCard], label: 'Alerts', show: null },
            wan_ips: { nodes: [wanIpCard], label: 'NAT Type', show: null },
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
            // In-card view toggles. These keep their old hiddenCards keys so a
            // saved config carries over untouched -- only the control moved,
            // from the Visible Cards list onto the card it belongs to.
            var graphOff = self.hiddenCards.indexOf('ping_graph') !== -1;
            pingGraphWrapper.style.display = graphOff ? 'none' : 'block';
            // textContent, not setText: applyCardVisibility runs once at load
            // from a point above setText's definition, and a var-hoisted
            // function expression is still undefined there.
            pingGraphToggle.textContent = graphOff ? 'SHOW GRAPH' : 'HIDE GRAPH';
            var tOff = self.hiddenCards.indexOf('therm_graph') !== -1;
            thermGraphNode.style.display = tOff ? 'none' : 'block';
            thermGraphToggle.textContent = tOff ? 'SHOW GRAPH' : 'HIDE GRAPH';
        };
        // LuCI's own CBI markup rather than a hand-rolled panel. cbi-map,
        // cbi-section and cbi-value are what every other settings page on the
        // router is built from, so the active theme styles this one to match --
        // and goes on matching when the theme changes, which the hardcoded
        // paddings, borders and background colours here never did.
        var settingsPanel = E('div', { class: 'cbi-map', style: 'display: none; width: 100%;' });
        var cbiSection = function(title, descr, body) {
            var kids = [E('h3', {}, title)];
            if (descr) kids.push(E('div', { class: 'cbi-section-descr' }, descr));
            kids.push(E('div', { class: 'cbi-section-node' }, body));
            return E('div', { class: 'cbi-section' }, kids);
        };
        var cbiRow = function(labelTxt, field, descr) {
            var f = [field];
            if (descr) f.push(E('div', { class: 'cbi-value-description' }, descr));
            return E('div', { class: 'cbi-value' }, [
                E('label', { class: 'cbi-value-title' }, labelTxt),
                E('div', { class: 'cbi-value-field' }, f)
            ]);
        };
        // Buttons are NOT a cbi-value with an empty title. A titled row still
        // reserves the whole label column, and on a phone that squeezed the
        // buttons into a wrap -- the reason the panel stopped using CBI markup
        // the last time round. They get their own full-width row instead.
        var cbiActions = function(kids) {
            return E('div', { class: 'hw-actions' }, kids);
        };
        var cardChecks = E('div', { class: 'hw-check-grid' });
        var cardCheckboxes = {};
        // Alphabetical by the label the user actually reads. Registry order is
        // the order the cards were written, which is no help at all when
        // hunting for one entry in a list of twenty-odd.
        Object.keys(cardRegistry).sort(function(a, b) {
            return byName(cardRegistry[a].label, cardRegistry[b].label);
        }).forEach(function(key) {
            var cb = E('input', {
                type: 'checkbox',
                change: function(ev) {
                    var idx = self.hiddenCards.indexOf(key);
                    if (ev.target.checked && idx !== -1) self.hiddenCards.splice(idx, 1);
                    else if (!ev.target.checked && idx === -1) self.hiddenCards.push(key);
                    markDirty();
                    applyCardVisibility();
                }
            });
            cb.checked = self.hiddenCards.indexOf(key) === -1;
            cardCheckboxes[key] = cb;
            cardChecks.appendChild(E('label', { class: 'hw-tgt' }, [
                cb, E('span', { class: 'hw-tgt-name' }, cardRegistry[key].label)
            ]));
        });
        // Revert/Reset change self.hiddenCards directly; without this the
        // boxes would keep showing the old state.
        var syncCardCheckboxes = function() {
            Object.keys(cardCheckboxes).forEach(function(k) {
                cardCheckboxes[k].checked = self.hiddenCards.indexOf(k) === -1;
            });
        };
        settingsPanel.appendChild(cbiSection('Visible Cards',
            'Cards unticked here are hidden from the dashboard.', cardChecks));
        var wanIfaceSection = cbiSection('WAN Uptime Status Interfaces',
            'Which WAN interfaces the uptime, NAT type and alert cards report on.',
            E('div', { id: 'hw-wanq-checks', class: 'hw-check-grid' }));
        wanIfaceSection.style.display = 'none';
        settingsPanel.appendChild(wanIfaceSection);
        self._wanIfaceCheckCache = {};
        var targetList = E('div', { style: 'margin-bottom: 10px;' });
        var makePingToggle = function(host, fam, label, isCustom, customIdx) {
            var dKey = host + '|' + fam;
            var cb = E('input', {
                type: 'checkbox',
                change: function(ev) {
                    var idx = self.disabledPings.indexOf(dKey);
                    if (ev.target.checked && idx !== -1) self.disabledPings.splice(idx, 1);
                    else if (!ev.target.checked && idx === -1) self.disabledPings.push(dKey);
                    markDirty();
                    self.pingHist = {};
                }
            });
            cb.checked = self.disabledPings.indexOf(dKey) === -1;
            var kids = [cb, E('span', { class: 'hw-tgt-name', title: label }, label)];
            if (isCustom) {
                // Deliberately not a cbi-button: the theme's own padding and
                // border made a 3-character control as tall as the row and put
                // its glyph off-centre, and since each row is a grid cell the
                // ragged right edge showed up as a column of misaligned X's.
                kids.push(E('button', {
                    type: 'button',
                    class: 'hw-tgt-x',
                    title: 'Remove target',
                    click: function() {
                        self.pingTargets.splice(customIdx, 1);
                        var di = self.disabledPings.indexOf(dKey);
                        if (di !== -1) self.disabledPings.splice(di, 1);
                        markDirty();
                        self.pingHist = {};
                        renderTargetList();
                    }
                }, '\u00d7'));
            }
            return E('label', { class: 'hw-tgt' }, kids);
        };
        // Split by address family rather than by category. The two families
        // fail for completely different reasons -- a broken IPv6 deployment
        // says nothing about IPv4 -- so the common job is "turn all of one
        // family off", which needed picking through an interleaved list.
        var renderTargetList = function() {
            targetList.innerHTML = '';
            var famBox = function(fam) {
                var rows = [];
                // A grid, not inline-flex wrapping: every cell is the same
                // width, so the remove buttons land in a straight column
                // instead of trailing whatever the hostname happened to be.
                var group = function(title, items) {
                    if (!items.length) return;
                    rows.push(E('div', { style: 'font-size: 0.72em; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.5px; margin: 8px 0 3px;' }, title));
                    rows.push(E('div', { class: 'hw-tgt-grid' }, items));
                };
                var defs = [];
                DEFAULT_PING_TARGETS.forEach(function(t) {
                    if (expandFams(t).indexOf(fam) !== -1) defs.push(t.host);
                });
                group('Default', defs.sort(byName).map(function(h) { return makePingToggle(h, fam, h, false, -1); }));
                group('Gateway', [makePingToggle('__gateway', fam, 'Gateway (auto-detected)', false, -1)]);
                // Sorted for display, but each toggle keeps the index it has in
                // self.pingTargets -- that is what removal splices, and it must
                // not follow the sorted position.
                var cust = [];
                self.pingTargets.forEach(function(t, i) {
                    if (expandFams(t).indexOf(fam) !== -1) cust.push({ host: t.host, idx: i });
                });
                cust.sort(function(a, b) { return byName(a.host, b.host); });
                group('Custom', cust.map(function(c) { return makePingToggle(c.host, fam, c.host, true, c.idx); }));
                var kids = [E('div', { style: 'font-weight: 700; font-size: 0.9em; letter-spacing: 0.5px;' }, 'IPv' + fam)];
                // Say it plainly when the family cannot work at all, rather
                // than leaving a box of targets that will only ever report as
                // down and look like a fault in the dashboard.
                if (fam === 6 && self.hasV6 === false) {
                    kids.push(E('div', { style: 'font-size: 0.76em; color: #ffb300; margin-top: 4px; line-height: 1.35;' },
                        'No IPv6 WAN detected on this router. These targets cannot be reached and will report as down.'));
                }
                rows.forEach(function(r) { kids.push(r); });
                return E('div', { style: 'flex: 1 1 240px; min-width: 0; border: 1px solid var(--border-color, rgba(128,128,128,0.22)); border-radius: 8px; padding: 10px 12px;' }, kids);
            };
            targetList.appendChild(E('div', { style: 'display: flex; gap: 12px; flex-wrap: wrap;' }, [famBox(4), famBox(6)]));
        };
        renderTargetList();
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
            markDirty();
            self.pingHist = {};
            tgtInput.value = '';
            renderTargetList();
        };
        settingsPanel.appendChild(cbiSection('Ping Targets',
            'Hosts the Ping Latency and Ping Graph cards probe, split by address family.',
            [
                targetList,
                E('div', { style: 'display: flex; flex-wrap: wrap; gap: 8px; align-items: center;' }, [
                    tgtInput, tgtFam,
                    E('button', { type: 'button', class: 'cbi-button cbi-button-add', click: addTarget }, 'Add'),
                    E('button', {
                        type: 'button',
                        class: 'cbi-button cbi-button-reset',
                        click: function() {
                            self.pingTargets = [];
                            self.disabledPings = [];
                            markDirty();
                            self.pingHist = {};
                            renderTargetList();
                        }
                    }, 'Reset to defaults')
                ])
            ]));
        // Brand logos carry fixed colours, so legibility depends on what is
        // behind them: RailWire's wordmark is dark grey and vanishes on a dark
        // card, while a white tile would be pointless on a light one. Probe the
        // theme actually in use -- walking up for the first opaque background
        // beats prefers-color-scheme, since a LuCI theme can be dark while the
        // OS is light. Cached: a LuCI theme change reloads the page anyway.
        var _pageDark = null;
        var pageIsDark = function() {
            if (_pageDark !== null) return _pageDark;
            var el = document.body, dark;
            while (el) {
                var c = window.getComputedStyle(el).backgroundColor || '';
                var m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                if (m && (m[4] === undefined || parseFloat(m[4]) > 0.5)) {
                    dark = (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255 < 0.5;
                    break;
                }
                el = el.parentElement;
            }
            if (dark === undefined) {
                dark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
            }
            _pageDark = dark;
            return _pageDark;
        };
        // The cache above assumed a theme change reloads the page. It does when
        // you pick a different theme, but not when the OS switches to dark at
        // sunset: the bootstrap theme listens on the media query and flips
        // data-darkmode on <html> in place. Everything the theme styles follows
        // along, while anything holding this cached answer keeps painting the
        // light palette on a now-dark page -- which for the WAN card means
        // every address at about 1.4:1. Drop the cache on both signals; the
        // cards repaint on their next poll a second or two later.
        var _forgetPageDark = function() { _pageDark = null; };
        if (window.matchMedia) {
            var _dmq = window.matchMedia('(prefers-color-scheme: dark)');
            if (_dmq.addEventListener) _dmq.addEventListener('change', _forgetPageDark);
            else if (_dmq.addListener) _dmq.addListener(_forgetPageDark);
        }
        if (window.MutationObserver) {
            new MutationObserver(_forgetPageDark).observe(document.documentElement,
                { attributes: true, attributeFilter: ['data-darkmode'] });
        }
        // Whether a logo needs a light backing tile is a property of the
        // artwork, not of the ISP, so measure it instead of keeping a
        // hand-maintained list -- that way a logo swapped in later, or one
        // pulled from the remote service, is judged on what it actually looks
        // like. Take the median of the max RGB channel ("value") over the
        // non-transparent pixels.
        //
        // Value, not luminance: Airtel's red is dark by luminance (0.19) yet
        // vivid on a dark card, while RailWire's grey is brighter by luminance
        // (0.35) and all but invisible -- luminance ranks those two backwards.
        // Measured medians: wishnet 11, railwire 64 | jio 144, gtpl 165,
        // fabfive 204, airtel 233, bsnl 241. The threshold sits in that gap.
        //
        // A remote logo comes from another origin and taints the canvas, so
        // getImageData throws; keep the tile then, the safe default for
        // artwork we are not allowed to inspect.
        var LOGO_TILE_MAX_VALUE = 110;
        var logoNeedsTile = function(img) {
            try {
                var c = document.createElement('canvas');
                c.width = 32; c.height = 32;
                var ctx = c.getContext('2d');
                if (!ctx) return true;
                ctx.drawImage(img, 0, 0, 32, 32);
                var d = ctx.getImageData(0, 0, 32, 32).data, vals = [];
                for (var i = 0; i < d.length; i += 4) {
                    if (d[i + 3] < 128) continue;
                    var m = d[i];
                    if (d[i + 1] > m) m = d[i + 1];
                    if (d[i + 2] > m) m = d[i + 2];
                    vals.push(m);
                }
                if (!vals.length) return true;
                vals.sort(function(a, b) { return a - b; });
                return vals[vals.length >> 1] < LOGO_TILE_MAX_VALUE;
            } catch (e) {
                return true;
            }
        };
        var wanTgt4Input = E('input', { type: 'text', class: 'cbi-input-text', value: self.wanTarget4, placeholder: 'IP or domain (e.g. 1.1.1.1 or dns.google)', style: 'width: 260px;' });
        var wanTgt6Input = E('input', { type: 'text', class: 'cbi-input-text', value: self.wanTarget6, placeholder: 'IP or domain (e.g. 2606:4700:4700::1111)', style: 'width: 260px;' });
        var saveWanTargets = function() {
            var v4 = wanTgt4Input.value.trim() || '1.1.1.1';
            var v6 = wanTgt6Input.value.trim() || '2606:4700:4700::1111';
            self.wanTarget4 = v4;
            self.wanTarget6 = v6;
            markDirty();
        };
        wanTgt4Input.addEventListener('input', saveWanTargets);
        wanTgt4Input.addEventListener('change', saveWanTargets);
        wanTgt6Input.addEventListener('input', saveWanTargets);
        wanTgt6Input.addEventListener('change', saveWanTargets);
        settingsPanel.appendChild(cbiSection('WAN Uptime Status Probing Targets',
            'What the background collector pings to decide whether each WAN is up.', [
                cbiRow('IPv4 Quality Target', wanTgt4Input),
                cbiRow('IPv6 Quality Target', wanTgt6Input)
            ]));

        var cpuPerfBody = E('div', { style: 'opacity: 0.5;' }, 'Loading…');
        var cpuPerfSection = E('div', {}, [cpuPerfBody]);
        settingsPanel.appendChild(cbiSection('CPU Performance', null, cpuPerfSection));
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
                    // rpc.declare({params:['perf']}) already wraps the first
                    // argument as {perf: <arg>}, so passing {perf:{...}} here
                    // sent {perf:{perf:{...}}}. The backend reads @.perf.governor,
                    // found nothing, and rejected every apply as invalid --
                    // pass the value directly, as set_config/set_aql do.
                    callHwSetCpuPerf({
                        governor: govSel.value,
                        min_freq: minV * 1000,
                        max_freq: maxV * 1000,
                        turbo_enabled: turboCb.checked
                    }).then(function(res) {
                        applyBtn.disabled = false;
                        if (res && res.result === 'ok') {
                            // The backend verifies the boost write actually took;
                            // some drivers expose the knob and then refuse it.
                            if (res.turbo === 'unsupported') {
                                msg.textContent = '✓ Applied (turbo not supported by this driver)';
                                msg.style.color = '#ffa726';
                            } else {
                                msg.textContent = '✓ Applied';
                                msg.style.color = '#8bc34a';
                            }
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
            cpuPerfBody.appendChild(cbiRow('Current Frequency', E('span', {}, mhz(perf.cur_freq) + ' MHz')));
            cpuPerfBody.appendChild(cbiRow('Governor', govSel));
            cpuPerfBody.appendChild(cbiRow('Min Frequency (MHz)', minInput));
            cpuPerfBody.appendChild(cbiRow('Max Frequency (MHz)', maxInput));
            if (perf.turbo_available) {
                cpuPerfBody.appendChild(cbiRow('Turbo / Boost', turboCb));
            }
            cpuPerfBody.appendChild(cbiActions([applyBtn, msg]));
            cpuPerfBody.appendChild(E('div', { style: 'font-size: 0.78em; opacity: 0.5; margin-top: 4px;' },
                perf.persist_available
                    ? 'Applies immediately and persists across reboot (synced to /etc/config/cpu-perf).'
                    : 'Applies immediately; resets after reboot. Install luci-app-cpu-perf to persist.'));
        };
        // --- Wireless AQL settings ------------------------------------
        // Save / Revert / Reset follow LuCI's own semantics:
        //   Save   - apply to the live radios AND persist to UCI
        //   Revert - discard unsaved edits, reload what is persisted
        //   Reset  - drop the persisted section and restore mac80211 defaults
        var aqlBody = E('div', { style: 'opacity: 0.5;' }, 'Loading…');
        settingsPanel.appendChild(cbiSection('Wireless AQL (Airtime Queue Limits)', null, aqlBody));

        var AQL_PRESETS = {
            latency:   { low: 1500, high: 2500, label: 'Latency (1500 / 2500)' },
            balanced:  { low: 5000, high: 12000, label: 'Balanced (5000 / 12000)' },
            bandwidth: { low: 15000, high: 20000, label: 'Bandwidth (15000 / 20000)' }
        };
        var buildAqlForm = function(aq) {
            aqlBody.innerHTML = '';
            aqlBody.style.opacity = '1';
            if (!aq || !aq.available) {
                aqlSaveCurrent = function() { return Promise.resolve({ result: 'skipped' }); };
                aqlBody.appendChild(E('div', { style: 'opacity: 0.7; line-height: 1.5;' },
                    (aq && aq.debugfs === 0)
                        ? 'Not available: debugfs is not mounted on this build (needs CONFIG_DEBUG_FS, mounted at /sys/kernel/debug).'
                        : 'Not available: debugfs is present, but this kernel exposes no mac80211 AQL controls under /sys/kernel/debug/ieee80211 (needs CONFIG_MAC80211_DEBUGFS).'));
                return;
            }
            var def = aq.defaults || { low: 5000, high: 12000, threshold: 24000 };
            var saved = aq.saved || {};
            // What the radios are running right now, which is the honest
            // starting point when nothing has been persisted yet.
            var live = (aq.phys && aq.phys[0]) || null;
            var liveBe = null;
            if (live && live.limits) live.limits.forEach(function(l) { if (l.ac === 'BE') liveBe = l; });
            var curLow  = saved.low  != null ? saved.low  : (liveBe ? liveBe.low  : def.low);
            var curHigh = saved.high != null ? saved.high : (liveBe ? liveBe.high : def.high);
            var curTh   = saved.threshold != null ? saved.threshold : (live ? live.threshold : def.threshold);
            var curEn   = saved.enable != null ? saved.enable : (live && live.enable === 0 ? 0 : 1);

            if (aq.wed_active) {
                aqlBody.appendChild(E('div', {
                    style: 'margin-bottom: 10px; padding: 8px 10px; border-left: 3px solid #ffa726; background: rgba(255,167,38,0.08); font-size: 0.82em; line-height: 1.45;'
                }, 'WED is active' + (aq.wed_devs ? ' (' + aq.wed_devs + ')' : '') + '. It offloads the Wi\u2011Fi datapath in hardware and bypasses mac80211\u2019s queues entirely, so AQL does not govern that traffic and these values will have no effect. Disable WED to tune latency with AQL \u2014 the two are mutually exclusive.'));
            }

            var presetSel = E('select', { class: 'cbi-input-select', style: 'width: 260px;' });
            Object.keys(AQL_PRESETS).forEach(function(k) {
                presetSel.appendChild(E('option', { value: k }, AQL_PRESETS[k].label));
            });
            presetSel.appendChild(E('option', { value: 'custom' }, 'Custom'));
            var lowInput  = E('input', { type: 'text', class: 'cbi-input-text', value: String(curLow),  style: 'width: 110px;' });
            var highInput = E('input', { type: 'text', class: 'cbi-input-text', value: String(curHigh), style: 'width: 110px;' });
            var thInput   = E('input', { type: 'text', class: 'cbi-input-text', value: String(curTh),   style: 'width: 110px;' });
            var enCb = E('input', { type: 'checkbox', style: 'width: 18px; height: 18px;' });
            enCb.checked = curEn !== 0;

            var syncPreset = function() {
                var m = 'custom';
                Object.keys(AQL_PRESETS).forEach(function(k) {
                    if (String(AQL_PRESETS[k].low) === lowInput.value.trim() &&
                        String(AQL_PRESETS[k].high) === highInput.value.trim()) m = k;
                });
                presetSel.value = m;
            };
            syncPreset();
            presetSel.addEventListener('change', function() {
                var pr = AQL_PRESETS[presetSel.value];
                if (!pr) return;
                lowInput.value = String(pr.low);
                highInput.value = String(pr.high);
            });
            lowInput.addEventListener('input', syncPreset);
            highInput.addEventListener('input', syncPreset);

            var msg = E('span', { style: 'margin-left: 10px; font-size: 0.85em;' });
            var setMsg = function(t, c) { msg.textContent = t; msg.style.color = c || ''; };
            var busy = function(b) {
                [saveBtn, revertBtn, resetBtn].forEach(function(x) { x.disabled = b; });
            };
            var reload = function(note) {
                return callHwGetAql().then(function(fresh) {
                    buildAqlForm(fresh);
                    if (note) setTimeout(function() {
                        var m2 = aqlBody.querySelector('[data-aqlmsg]');
                        if (m2) { m2.textContent = note.t; m2.style.color = note.c; }
                    }, 0);
                });
            };
            var saveBtn = E('button', { class: 'cbi-button cbi-button-save' }, 'Save');
            var revertBtn = E('button', { class: 'cbi-button' }, 'Revert');
            var resetBtn = E('button', { class: 'cbi-button cbi-button-reset' }, 'Reset');
            msg.setAttribute('data-aqlmsg', '1');

            saveBtn.addEventListener('click', function() {
                var lo = parseInt(lowInput.value, 10), hi = parseInt(highInput.value, 10), th = parseInt(thInput.value, 10);
                if (!(lo > 0) || !(hi > 0) || lo > hi) { setMsg('Low must be a number \u2264 high.', '#ff5252'); return; }
                busy(true); setMsg('Applying\u2026');
                callHwSetAql({ low: lo, high: hi, threshold: th > 0 ? th : def.threshold, enable: enCb.checked ? 1 : 0 })
                    .then(function(r) {
                        busy(false);
                        if (r && r.result === 'ok') reload({ t: 'Saved and applied.', c: '#8bc34a' });
                        else setMsg('Rejected: ' + ((r && r.result) || 'error'), '#ff5252');
                    }).catch(function() { busy(false); setMsg('Request failed.', '#ff5252'); });
            });
            revertBtn.addEventListener('click', function() {
                busy(true); setMsg('Reverting\u2026');
                reload({ t: 'Reverted to saved values.', c: '' }).then(function() { busy(false); });
            });
            resetBtn.addEventListener('click', function() {
                busy(true); setMsg('Resetting\u2026');
                callHwSetAql({ reset: true }).then(function(r) {
                    busy(false);
                    if (r && r.result === 'ok') reload({ t: 'Reset to driver defaults.', c: '#8bc34a' });
                    else setMsg('Reset failed.', '#ff5252');
                }).catch(function() { busy(false); setMsg('Request failed.', '#ff5252'); });
            });

            // Let the page-level Save flush whatever is in these inputs.
            aqlSaveCurrent = function() {
                var lo = parseInt(lowInput.value, 10), hi = parseInt(highInput.value, 10), th = parseInt(thInput.value, 10);
                if (!(lo > 0) || !(hi > 0) || lo > hi) return Promise.resolve({ result: 'invalid' });
                return callHwSetAql({ low: lo, high: hi, threshold: th > 0 ? th : def.threshold, enable: enCb.checked ? 1 : 0 })
                    .catch(function() { return { result: 'error' }; });
            };

            aqlBody.appendChild(cbiRow('Preset', presetSel));
            aqlBody.appendChild(cbiRow('TX queue low (\u00b5s)', lowInput));
            aqlBody.appendChild(cbiRow('TX queue high (\u00b5s)', highInput));
            aqlBody.appendChild(cbiRow('Threshold (\u00b5s)', thInput));
            aqlBody.appendChild(cbiRow('AQL enabled', enCb));
            aqlBody.appendChild(cbiActions([saveBtn, revertBtn, resetBtn, msg]));
            aqlBody.appendChild(E('div', { style: 'font-size: 0.78em; opacity: 0.5; margin-top: 4px; line-height: 1.5;' },
                'Lower limits cut latency under load at some cost to peak throughput; 1500\u20132500 is the usual sweet spot, and Balanced matches the mac80211 defaults. Applies to every radio immediately and is replayed on boot, since debugfs itself does not persist.'));
        };
        // Assigned once the AQL form exists; the page-level Save calls it to
        // flush the staged values. Resolves with {result:'skipped'} when there
        // is no form (unsupported build) so Save still reports success.
        var aqlSaveCurrent = function() { return Promise.resolve({ result: 'skipped' }); };
        var aqlLoaded = false;
        var loadAql = function() {
            if (aqlLoaded) return;
            aqlLoaded = true;
            callHwGetAql().then(buildAqlForm).catch(function() {
                aqlBody.textContent = 'Failed to read AQL state.';
                aqlBody.style.opacity = '1';
            });
        };

        var cpuPerfLoaded = false;
        var loadCpuPerf = function() {
            if (cpuPerfLoaded) return;
            cpuPerfLoaded = true;
            callHwGetCpuPerf().then(function(perf) {
                // Trust the backend's explicit flag rather than inferring from
                // governor being non-empty: a board with no OPP table reports
                // the literal string "unknown", which is truthy.
                var cpfOk = perf && (perf.available !== undefined
                    ? perf.available === 1
                    : (perf.governor && perf.governor !== 'unknown' && perf.cpuinfo_max_freq > 0));
                if (cpfOk) {
                    buildCpuPerfForm(perf);
                } else {
                    cpuPerfBody.textContent = 'CPU frequency scaling not available on this device (no cpufreq/OPP table exposed by the kernel).';
                    cpuPerfBody.style.opacity = '1';
                }
            }).catch(function() {
                cpuPerfBody.textContent = 'Failed to read CPU performance state.';
            });
        };
        settingsPanel.appendChild(cbiSection('Diagnostics', null, [
            E('button', {
                type: 'button',
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
        // --- page-level Save / Revert / Reset --------------------------
        // Everything above applies as you change it (that behaviour predates
        // this bar and is what makes the panel feel live), so Save's job is to
        // flush the one section that is genuinely staged -- the AQL form --
        // and re-persist the rest, then report a single result. Revert and
        // Reset are the ones that really needed to be page-wide: previously
        // there was no way to undo a settings change short of reversing each
        // control by hand.
        var pageMsg = E('span', { style: 'font-size: 0.85em; font-weight: 600; line-height: 1;' });
        var setPageMsg = function(t, c) { pageMsg.textContent = t || ''; pageMsg.style.color = c || ''; };
        var pageSaveBtn = E('button', { type: 'button', class: 'cbi-button cbi-button-save' }, 'Save');
        var pageRevertBtn = E('button', { type: 'button', class: 'cbi-button cbi-button-neutral' }, 'Revert');
        var pageResetBtn = E('button', { type: 'button', class: 'cbi-button cbi-button-reset' }, 'Reset');
        var pageBusy = function(b) { [pageSaveBtn, pageRevertBtn, pageResetBtn].forEach(function(x) { x.disabled = b; }); };

        pageSaveBtn.addEventListener('click', function() {
            pageBusy(true); setPageMsg('Saving\u2026');
            var jobs = [saveConfig()];
            if (typeof aqlSaveCurrent === 'function') jobs.push(aqlSaveCurrent());
            Promise.all(jobs).then(function(r) {
                pageBusy(false);
                var aqlRes = r[1];
                if (aqlRes && aqlRes.result && aqlRes.result !== 'ok' && aqlRes.result !== 'skipped') {
                    setPageMsg('Saved, but AQL was rejected: ' + aqlRes.result, '#ffa726');
                } else {
                    settingsDirty = false;
                    setPageMsg('All settings saved.', '#8bc34a');
                }
            }).catch(function() { pageBusy(false); setPageMsg('Save failed.', '#ff5252'); });
        });

        pageRevertBtn.addEventListener('click', function() {
            pageBusy(true); setPageMsg('Reverting\u2026');
            // Re-read everything from the router and rebuild the panel state
            // from it, discarding anything edited but not saved.
            callHwGetConfig().then(function(cfg) {
                cfg = cfg || {};
                self.hiddenCards = Array.isArray(cfg.hidden) ? cfg.hidden : [];
                self.pingTargets = Array.isArray(cfg.targets) ? cfg.targets : [];
                self.disabledPings = Array.isArray(cfg.disabledPings) ? cfg.disabledPings : [];
                self.hiddenWanIfaces = cleanWanList(Array.isArray(cfg.wanHidden) ? cfg.wanHidden : []);
                if (typeof cfg.wanTarget4 === 'string' && cfg.wanTarget4) {
                    self.wanTarget4 = cfg.wanTarget4;
                    if (wanTgt4Input) wanTgt4Input.value = cfg.wanTarget4;
                }
                if (typeof cfg.wanTarget6 === 'string' && cfg.wanTarget6) {
                    self.wanTarget6 = cfg.wanTarget6;
                    if (wanTgt6Input) wanTgt6Input.value = cfg.wanTarget6;
                }
                applyCardVisibility();
                if (typeof renderTargetList === 'function') renderTargetList();
                if (typeof syncCardCheckboxes === 'function') syncCardCheckboxes();
                aqlLoaded = false; loadAql();
                settingsDirty = false;
                pageBusy(false); setPageMsg('Reverted to saved settings.', '');
            }).catch(function() { pageBusy(false); setPageMsg('Revert failed.', '#ff5252'); });
        });

        pageResetBtn.addEventListener('click', function() {
            pageBusy(true); setPageMsg('Resetting\u2026');
            self.hiddenCards = [];
            self.pingTargets = [];
            self.disabledPings = [];
            self.hiddenWanIfaces = [];
            self.wanTarget4 = '1.1.1.1';
            self.wanTarget6 = '2606:4700:4700::1111';
            if (wanTgt4Input) wanTgt4Input.value = self.wanTarget4;
            if (wanTgt6Input) wanTgt6Input.value = self.wanTarget6;
            self.pingHist = {};
            applyCardVisibility();
            if (typeof renderTargetList === 'function') renderTargetList();
            if (typeof syncCardCheckboxes === 'function') syncCardCheckboxes();
            Promise.all([saveConfig(), callHwSetAql({ reset: true }).catch(function() { return null; })])
                .then(function() {
                    aqlLoaded = false; loadAql();
                    settingsDirty = false;
                    pageBusy(false); setPageMsg('All settings reset to defaults.', '#8bc34a');
                }).catch(function() { pageBusy(false); setPageMsg('Reset failed.', '#ff5252'); });
        });

        // cbi-page-actions is where LuCI puts Save/Revert on every config page,
        // so the theme gives it the same right-aligned, sticky-footer treatment
        // it gives the rest of the router's settings.
        var leftBox = E('div', { style: 'display: flex; align-items: center;' }, [pageMsg]);
        var rightBox = E('div', { style: 'display: flex; align-items: center; gap: 8px; flex-wrap: wrap;' }, [pageResetBtn, pageRevertBtn, pageSaveBtn]);
        settingsPanel.appendChild(E('div', { class: 'cbi-page-actions', style: 'display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px 16px; margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(128,128,128,0.15);' },
            [leftBox, rightBox]));

        var settingsBtn = E('button', {
            class: 'cbi-button',
            style: 'padding: 4px 14px;',
            click: function() {
                settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
                if (settingsPanel.style.display !== 'none') { loadCpuPerf(); loadAql(); }
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
        // Only touch the DOM when the text actually changed. An unconditional
        // write on every poll drops any selection the user is making inside
        // the row, which is exactly the kind of churn the persistent-skeleton
        // rendering exists to avoid.
        var setText = function(el, txt) {
            if (el.textContent !== txt) el.textContent = txt;
        };
        // --- Alerts ---------------------------------------------------------
        // Everything here is derived from data the dashboard already polls, so
        // the card costs nothing on the router. It stays hidden while all is
        // well: a panel that always says "OK" trains you to stop reading it,
        // and the whole point is to be noticed on the day it says something.
        //
        // Thresholds come from the hardware itself wherever the hardware states
        // them -- the thermal zones publish their own critical and passive trip
        // points, which beats a number invented here that would be wrong for
        // some other SoC.
        var ALERT_COLORS = { crit: '#ff5252', warn: '#ffb300' };
        var computeAlerts = function(info, wq) {
            var out = [];
            if (!info) return out;

            // Only the critical trip is used. The passive trip is where the
            // kernel begins gentle throttling, which on plenty of SoCs is a
            // normal operating point -- MT7986 sets it at 60 °C and idles
            // above it, so alerting there would light the card up permanently
            // and teach you to ignore it.
            var seenTemp = {};
            (info.thermals || []).forEach(function(t) {
                var c = (t.temp || 0) / 1000;
                var crit = (t.crit || 0) / 1000;
                // Reject non-physical trip points: zones with no trip
                // configured publish placeholders like -274 °C, which is below
                // absolute zero and would make every comparison true.
                if (!(crit > 0 && crit < 200)) return;
                // One physical sensor can be exposed twice under punctuation
                // variants (cpu-thermal and cpu_thermal); same reading and same
                // trip means one alert, not two.
                var tkey = String(t.type || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + c.toFixed(1) + '|' + crit;
                if (seenTemp[tkey]) return;
                seenTemp[tkey] = 1;
                if (c >= crit)
                    out.push({ sev: 'crit', title: 'Critical temperature', detail: t.type + ' at ' + c.toFixed(1) + ' °C, trip point ' + crit.toFixed(0) + ' °C' });
                else if (c >= crit * 0.9)
                    out.push({ sev: 'warn', title: 'Temperature approaching limit', detail: t.type + ' at ' + c.toFixed(1) + ' °C, 90% of the ' + crit.toFixed(0) + ' °C trip' });
            });

            // ECC: uncorrectable failures mean data actually got through
            // corrupted, so they are always critical. Corrected bitflips are
            // normal NAND behaviour and are only worth raising once they climb
            // past the sector's correction strength.
            (info.mtd_parts || []).forEach(function(m) {
                var fail = (m.ecc_fail || 0) - (m.ecc_fail_base || 0);
                var corr = (m.ecc_corr || 0) - (m.ecc_corr_base || 0);
                if (fail > 0)
                    out.push({ sev: 'crit', title: 'Uncorrectable flash errors', detail: 'mtd' + m.num + ' (' + m.name + '): ' + fail + ' uncorrectable since baseline' });
                else if (corr > 0 && m.ecc_strength && corr >= m.ecc_strength)
                    out.push({ sev: 'warn', title: 'Flash bitflips accumulating', detail: 'mtd' + m.num + ' (' + m.name + '): ' + corr + ' corrected since baseline, ECC strength ' + m.ecc_strength });
            });

            // Worded as "present", not "new": flash ships with factory bad
            // blocks, and without a recorded starting count claiming they
            // appeared recently would be a guess.
            if ((info.ubi_bad_peb || 0) > 0)
                out.push({ sev: (info.ubi_bad_peb >= 10 ? 'crit' : 'warn'), title: 'Bad flash blocks present', detail: info.ubi_bad_peb + ' bad PEB' + (info.ubi_bad_peb === 1 ? '' : 's') + ' on UBI' });

            var cm = info.cpu_meta || {};
            if (cm.conntrack_max > 0) {
                var cpct = (cm.conntrack / cm.conntrack_max) * 100;
                if (cpct >= 90) out.push({ sev: 'crit', title: 'Connection table nearly full', detail: cm.conntrack + ' of ' + cm.conntrack_max + ' (' + cpct.toFixed(0) + '%) -- new connections will start being dropped' });
                else if (cpct >= 80) out.push({ sev: 'warn', title: 'Connection table filling', detail: cm.conntrack + ' of ' + cm.conntrack_max + ' (' + cpct.toFixed(0) + '%)' });
            }

            // /rom is a read-only SquashFS and is 100% full by design, as is
            // any other fully-packed read-only image -- alerting on those would
            // fire permanently on every device and drown out the real ones.
            (info.df || []).forEach(function(d) {
                if (d.mount === '/rom' || d.hw_type === 'SquashFS') return;
                var pct = parseInt(d.pct, 10);
                if (!(pct >= 0)) return;
                if (pct >= 95) out.push({ sev: 'crit', title: 'Filesystem almost full', detail: d.mount + ' at ' + pct + '% (' + fmtSize(d.avail) + ' free)' });
                else if (pct >= 90) out.push({ sev: 'warn', title: 'Filesystem filling up', detail: d.mount + ' at ' + pct + '% (' + fmtSize(d.avail) + ' free)' });
            });

            (wq || []).forEach(function(w) {
                if (isIfaceHidden(w.iface, w.alias_of)) return;
                var up = parseFloat(w.uptime_pct);
                if (w.status === 'down') {
                    // The cause, when the collector could work one out. How
                    // long it has been down says only that something is wrong;
                    // the reason is what decides whether you go and look at a
                    // cable or wait for the ISP.
                    var d = w.iface.toUpperCase() + ' has been down for ' + fmtDurationFull(w.since_change_s || 0);
                    if (w.down_reason) d += ' — ' + w.down_reason;
                    out.push({ sev: 'crit', title: 'WAN down', detail: d });
                }
                else if (up >= 0 && up < 99)
                    out.push({ sev: 'warn', title: 'WAN unstable', detail: w.iface.toUpperCase() + ' at ' + up.toFixed(2) + '% uptime over 24h' });
            });

            out.sort(function(a, b) { return (a.sev === b.sev) ? 0 : (a.sev === 'crit' ? -1 : 1); });
            return out;
        };
        var renderAlerts = function() {
            if (self.hiddenCards && self.hiddenCards.indexOf('alerts') !== -1) { alertsCard.style.display = 'none'; return; }
            var list = computeAlerts(self.lastInfo, self.lastWq);
            alertsCard.style.display = list.length ? 'flex' : 'none';
            if (!list.length) return;
            var box = document.getElementById('hw-alerts');
            if (!box) return;
            if (!self._alertCache) self._alertCache = {};
            syncRows(box, self._alertCache, list, function(a) { return a.sev + '|' + a.title + '|' + a.detail; }, function(a) {
                var dot = E('span', { style: 'width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: ' + ALERT_COLORS[a.sev] + ';' });
                var ttl = E('span', { style: 'font-weight: 700; font-size: 0.9em; color: ' + ALERT_COLORS[a.sev] + ';' });
                var det = E('span', { style: 'font-size: 0.82em; opacity: 0.75; word-break: break-word;' });
                return {
                    el: E('div', { style: 'display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; padding: 7px 10px; border-radius: 7px; border-left: 3px solid ' + ALERT_COLORS[a.sev] + '; background: rgba(128,128,128,0.07);' }, [dot, ttl, det]),
                    ttl: ttl, det: det
                };
            }, function(e, a) {
                setText(e.ttl, a.title);
                setText(e.det, a.detail);
            });
        };
        // --- WAN addressing -------------------------------------------------
        // What the ISP actually hands this router, and what that implies for
        // reaching it from outside. The classification is done in the backend,
        // where both the interface address and the observed egress address are
        // available; this only presents it.
        // Two palettes for the same five meanings. The bright set reads well on
        // the dark theme and washes out to 1.4-2.6:1 on the light one, which is
        // fine for a badge that also has a tinted pill behind it but not for the
        // addresses themselves -- the moment colour carries meaning it has to be
        // legible in the theme actually in use. The light values are the same
        // hues darkened until each clears 3:1 on white.
        var SEV = {
            // Verdict hues -- what the addresses mean.
            good: { dark: '#69f0ae', light: '#0f9d58' },
            warn: { dark: '#ffb300', light: '#b26a00' },
            info: { dark: '#40c4ff', light: '#0277bd' },
            bad:  { dark: '#ff5252', light: '#c62828' },
            mute: { dark: '#90a4ae', light: '#546e7a' },
            // Identity hues -- what a link IS, kept clear of the verdict hues
            // above so the two families never read as each other. Learn them
            // once and every row is scannable: violet is always the protocol,
            // teal is always whether the address moves, orange always means
            // this interface is riding another one's link.
            proto: { dark: '#b388ff', light: '#5e35b1' },
            assign:{ dark: '#64ffda', light: '#00796b' },
            alias: { dark: '#ffab40', light: '#c25e00' },
            dev:   { dark: '#90a4ae', light: '#455a64' }
        };
        var sevColor = function(k) {
            var s = SEV[k] || SEV.mute;
            return pageIsDark() ? s.dark : s.light;
        };
        var WAN_CLASS = {
            public:    { label: 'Public IPv4',       sev: 'good', note: 'Publicly routable IPv4 address space. Direct ingress reachability is available; inbound connections and port forwarding operate without hindrance.' },
            cgnat:     { label: 'CG-NAT',            sev: 'warn', note: 'Carrier-Grade Network Address Translation (RFC 6598). Ingress traffic is restricted by the service provider; port forwarding and unsolicited inbound connections are unsupported.' },
            natted:    { label: 'Translated Public Address', sev: 'warn', note: 'The assigned interface address deviates from the observed Internet egress address, indicating active translation by an upstream routing device.' },
            private:   { label: 'Behind upstream NAT',   sev: 'warn', note: 'Private Address Space (RFC 1918). Non-routable on the public Internet; Network Address Translation (NAT) is actively performed by an upstream gateway.' },
            loopback:  { label: 'Localhost (Loopback)', sev: 'mute', note: 'Loopback Address Space (RFC 1122). A virtual interface utilized for routing traffic strictly back to the local host system.' },
            thisnet:   { label: 'Current Network',   sev: 'mute', note: '"This Network" Address Space (RFC 1122). Exclusively utilized for local broadcast communications or during initial dynamic address assignment (DHCP discovery).' },
            protocol:  { label: 'Protocol Assignment', sev: 'warn', note: 'IETF Protocol Assignments (RFC 6890). Designated for specialized networking protocols, frequently deployed for Dual-Stack Lite (DS-Lite) IPv4-in-IPv6 tunneling.' },
            benchmark: { label: 'ISP Private Routing', sev: 'warn', note: 'Benchmarking Address Space (RFC 2544). Officially reserved for network performance testing, yet frequently repurposed by service providers for internal private routing.' },
            testnet:   { label: 'TEST-NET (Doc Only)', sev: 'mute', note: 'TEST-NET Documentation Address Space (RFC 5737). Strictly reserved for utilization within technical documentation and example configurations.' },
            multicast: { label: 'Multicast Network',   sev: 'mute', note: 'Multicast Address Space (RFC 1112). Reserved for one-to-many communication flows, predominantly utilized by routing protocols and IPTV distributions.' },
            reserved:  { label: 'Reserved Address',  sev: 'bad',  note: 'Reserved Address Space (RFC 1112). Explicitly restricted from deployment within active public routing tables.' },
            v6only:    { label: 'Public IPv6',       sev: 'good', note: 'Globally Routable IPv6 Address Space (RFC 4291). Provides direct, end-to-end Internet reachability without intermediary address translation.' },
            linklocal: { label: 'Link-local only',   sev: 'bad',  note: 'Link-Local Address Space (RFC 3927). Valid exclusively for communication within the local network segment; signifies the absence of a globally routable prefix.' },
            none:      { label: 'No address',        sev: 'bad',  note: 'No IP address is currently assigned to this logical interface.' },
            unreachable: { label: 'Egress Unreachable', sev: 'bad', note: 'The interface is offline or unreachable. Internet egress address and NAT classification cannot be determined.' },
            unknown:   { label: 'Unknown',           sev: 'mute', note: 'The classification of this network address cannot be definitively determined.' }
        };
        // The protocol names LuCI itself shows, taken from the getI18n() of the
        // protocol handlers it ships (luci-static/resources/protocol/*.js), so
        // this card and the Interfaces page never disagree about what to call
        // the same link. LuCI falls back to the raw protocol name for a handler
        // it has no class for, and so does this.
        var PROTO_I18N = {
            '464xlat': '464XLAT (CLAT)',
            '6in4':    'IPv6-in-IPv4 (RFC4213)',
            '6rd':     'IPv6-over-IPv4 (6rd)',
            '6to4':    'IPv6-over-IPv4 (6to4)',
            dhcp:      'DHCP client',
            dhcpv6:    'DHCPv6 client',
            dslite:    'Dual-Stack Lite (RFC6333)',
            ipip6:     'IPv4 over IPv6 (RFC2473-IPIPv6)',
            l2tp:      'L2TP',
            map:       'MAP / LW4over6',
            none:      'Unmanaged',
            ppp:       'PPP',
            pppoa:     'PPPoATM',
            pppoe:     'PPPoE',
            pptp:      'PPtP',
            'static':  'Static address',
            // Not shipped as protocol/*.js on these boards, but netifd will
            // report them wherever the package is installed.
            wwan:      'WWAN',
            qmi:       'QMI Cellular',
            ncm:       'NCM',
            mbim:      'MBIM',
            modemmanager: 'ModemManager',
            wireguard: 'WireGuard VPN',
            relay:     'Relay bridge',
            gre:       'GRE', gretap: 'GRETAP', grev6: 'GRE over IPv6', grev6tap: 'GRETAP over IPv6',
            vxlan:     'VXLAN', vxlan6: 'VXLAN over IPv6',
            vti:       'VTI', vti6: 'VTI over IPv6',
            xfrm:      'XFRM', unet: 'unet'
        };
        // hasOwnProperty, not a bare lookup: a protocol named "constructor" or
        // "toString" would otherwise resolve to something off Object.prototype
        // and render a function body into the card.
        var protoLabel = function(p) {
            if (p && Object.prototype.hasOwnProperty.call(PROTO_I18N, p)) return PROTO_I18N[p];
            return p || '';
        };
        var wanIpTick = function() {
            if (document.hidden) return Promise.resolve();
            if (self.hiddenCards && self.hiddenCards.indexOf('wan_ips') !== -1) return Promise.resolve();
            if (self.wanIpBusy) return Promise.resolve();
            self.wanIpBusy = true;
            return callHwWanIps().then(function(res) {
                self.wanIpBusy = false;
                var wans = (res && res.wans) || [];
                // A link-local address is not connectivity, so fe80:: does not
                // count -- a router with only those has no working IPv6 WAN.
                var v6 = wans.some(function(w) {
                    return (w.ip6 && w.ip6.toLowerCase().indexOf('fe80') !== 0) || !!w.prefix6;
                });
                if (self.hasV6 !== v6) {
                    self.hasV6 = v6;
                    if (typeof renderTargetList === 'function') renderTargetList();
                }
                if (self.hiddenWanIfaces)
                    wans = wans.filter(function(w) { return !isIfaceHidden(w.iface, w.alias_of); });
                // The backend walks the collector's tracked list, which is in
                // the order interfaces were first discovered -- so a router that
                // brought wanb up before wan showed the cards that way round,
                // and differently again after the next reboot.
                wans = wans.slice().sort(function(a, b) { return byName(a.iface, b.iface); });
                wanIpCard.style.display = wans.length ? 'flex' : 'none';
                if (!wans.length) return;
                var box = document.getElementById('hw-wanip');
                if (!box) return;
                if (!self._wanIpCache) self._wanIpCache = {};
                syncRows(box, self._wanIpCache, wans, function(w) { return w.iface; }, function() {
                    // Each chip owns a hue from the identity family, tinted from
                    // its own colour rather than a shared grey, so the kind of
                    // fact is readable before the text is.
                    var CHIP = 'font-size: 0.68em; font-weight: 700; letter-spacing: 0.4px; padding: 2px 8px; border-radius: 10px; white-space: nowrap;';
                    var ifn = E('span', { style: 'font-weight: 700; font-size: 1.1em; font-family: monospace; letter-spacing: 0.6px;' });
                    // Devices get chips of their own, and a tunnel protocol
                    // gets two: the device it was configured on and the device
                    // it built on top of that one, joined by an arrow so the
                    // derivation is the thing you read. Previously the tunnel
                    // device trailed the row as unstyled grey text, which made
                    // PPPoE rows look like they were missing what the alias
                    // rows showed.
                    var DEVCHIP = CHIP + ' font-family: monospace;';
                    var devPar = E('span', { style: DEVCHIP });
                    var devArrow = E('span', { style: 'font-size: 0.8em; opacity: 0.6;' }, '→');
                    var devL3 = E('span', { style: DEVCHIP });
                    var devs = E('span', { style: 'display: inline-flex; align-items: center; gap: 4px;' }, [devPar, devArrow, devL3]);
                    var proto = E('span', { style: CHIP });
                    var alias = E('span', { style: CHIP + ' text-transform: uppercase;' });
                    var badge = E('span', { style: 'font-size: 0.68em; font-weight: 700; padding: 2px 8px; border-radius: 10px; white-space: nowrap;' });
                    var assign = E('span', { style: CHIP + ' text-transform: uppercase;' });
                    var head = E('div', { style: 'display: flex; align-items: center; gap: 8px; flex-wrap: wrap;' }, [ifn, devs, proto, assign, alias, badge]);
                    // One label/value line per fact rather than a single run-on
                    // string: "IPv4 100.x/32 -> seen as 106.x" wrapped mid-address
                    // on a phone and read as one long token.
                    var kv4 = kvRow('IPv4'), kvPub = kvRow('Seen as');
                    var kv6 = kvRow('IPv6'), kvPfx = kvRow('Delegated');
                    var note = E('div', { style: 'font-size: 0.76em; opacity: 0.75; line-height: 1.4; word-break: break-word; margin-top: 3px;' });
                    return {
                        el: E('div', { class: 'hw-sta-row', style: 'flex-direction: column; gap: 5px;' }, [head, kv4.el, kvPub.el, kv6.el, kvPfx.el, note]),
                        ifn: ifn, devPar: devPar, devArrow: devArrow, devL3: devL3,
                        proto: proto, alias: alias, badge: badge, assign: assign,
                        kv4: kv4, kvPub: kvPub, kv6: kv6, kvPfx: kvPfx, note: note
                    };
                }, function(e, w) {
                    var cls = WAN_CLASS[w.class] || WAN_CLASS.unknown;
                    var col = sevColor(cls.sev);
                    setText(e.ifn, w.iface.toUpperCase());
                    e.ifn.style.color = col;
                    // The device the link is configured on, beside the name of
                    // the interface that claims it. Two interfaces on one
                    // device is the normal shape of a v4/v6 pair, and without
                    // this the card gave no way to see which rows share a wire
                    // -- so an outage that will take two rows down looked no
                    // different from one that will take a single row down.
                    //
                    // PPPoE and the other tunnelling protocols build a second
                    // device on top of the first (pppoe-wan over wan), and both
                    // are worth naming: the lower one is the port to go and
                    // look at, the upper one is what carries the address and
                    // what every other tool on the router will call this link.
                    var fmtChipText = function(txt) {
                        if (!txt) return '';
                        var s = String(txt).toUpperCase();
                        return s.replace(/PPPOE/g, 'PPPoE')
                                .replace(/PPPOA/g, 'PPPoA')
                                .replace(/PPPOTM/g, 'PPPoATM');
                    };
                    var dcol = sevColor('dev');
                    var acol = sevColor('alias');
                    var par = w.parent || '', l3 = w.device || '';
                    var chainL3 = !!(l3 && l3 !== par);
                    var devChip = function(el, txt, show, color) {
                        var c = color || dcol;
                        setText(el, fmtChipText(txt));
                        el.style.color = c;
                        el.style.background = c + '22';
                        el.style.border = '1px solid ' + c + '55';
                        el.style.display = show ? '' : 'none';
                    };
                    if (w.alias_of) {
                        devChip(e.devPar, 'ALIAS OF ' + w.alias_of.toUpperCase(), true, dcol);
                        devChip(e.devL3, l3, !!l3, dcol);
                        e.devArrow.style.display = l3 ? '' : 'none';
                    } else {
                        devChip(e.devPar, par, !!par, dcol);
                        devChip(e.devL3, l3, chainL3, dcol);
                        e.devArrow.style.display = (par && chainL3) ? '' : 'none';
                    }
                    var pcol = sevColor('proto');
                    setText(e.proto, protoLabel(w.proto));
                    e.proto.style.color = pcol;
                    e.proto.style.background = pcol + '22';
                    e.proto.style.border = '1px solid ' + pcol + '55';
                    e.proto.style.display = w.proto ? '' : 'none';
                    e.alias.style.display = 'none';
                    setText(e.badge, cls.label);
                    e.badge.style.background = col + '22';
                    e.badge.style.color = col;
                    e.badge.style.border = '1px solid ' + col + '66';
                    // Whether the address moves, next to the protocol that
                    // decides it. It no longer needs to say "public" too -- the
                    // badge beside it already states reachability, and saying it
                    var alabel = (w.assign === 'static' || w.assign === 'dynamic') ? w.assign : '';
                    var ascol = sevColor('assign');
                    setText(e.assign, alabel);
                    e.assign.style.color = ascol;
                    e.assign.style.background = ascol + '22';
                    e.assign.style.border = '1px solid ' + ascol + '55';
                    e.assign.style.display = alabel ? '' : 'none';
                    // Each address is coloured by what it means, not uniformly:
                    // the whole point of the card is that two addresses on the
                    // same row can disagree, and a wall of identical monospace
                    // grey is exactly what hides that.
                    var C_GOOD = sevColor('good'), C_WARN = sevColor('warn'),
                        C_SEEN = sevColor('info'), C_BAD = sevColor('bad');
                    // The label takes its value's hue too, so each fact reads
                    // as one coloured pair rather than a grey word next to a
                    // coloured address. Hierarchy comes from size, not from
                    // fading the label: these hues are chosen to clear 3:1 at
                    // full strength, and dropping the label to 0.75 put it at
                    // 2.54 -- the one thing colouring it was meant to improve.
                    var showKv = function(kv, val, color, dim) {
                        setText(kv.val, val || '');
                        kv.val.style.color = color || '';
                        kv.val.style.opacity = dim ? '0.65' : '';
                        kv.key.style.color = color || '';
                        kv.el.style.display = val ? '' : 'none';
                    };
                    showKv(e.kv4, w.ip4 ? w.ip4 + (w.mask4 && w.mask4 !== '0' ? '/' + w.mask4 : '') : '',
                        w.class === 'public' ? C_GOOD : (w.class === 'none' ? C_BAD : C_WARN));
                    // Only worth a line when it differs -- when the link
                    // terminates on a public address the two are the same and
                    // repeating it just adds something else to read. When it
                    // does differ it is the evidence for the whole verdict, so
                    // it gets a colour of its own rather than matching the
                    // interface address it contradicts.
                    showKv(e.kvPub, (w.pub4 && w.pub4 !== w.ip4) ? w.pub4 : '', C_SEEN);
                    // fe80:: is not connectivity. Labelled and dimmed rather
                    // than shown as a plain "IPv6", which read as though the
                    // link had working IPv6 when it has none -- the same
                    // distinction the settings panel already makes when it
                    // decides whether any IPv6 WAN exists at all.
                    var isLL = !!(w.ip6 && w.ip6.toLowerCase().indexOf('fe80') === 0);
                    setText(e.kv6.key, isLL ? 'IPv6 link-local' : 'IPv6');
                    showKv(e.kv6, w.ip6 || '', isLL ? '' : C_GOOD, isLL);
                    // A delegated prefix is routed IPv6 for the whole LAN --
                    // unambiguously good news, and the one thing on this card
                    // that no amount of upstream NAT can take away.
                    showKv(e.kvPfx, w.prefix6 ? w.prefix6 + '/' + w.prefix6_len : '', C_GOOD);
                    // While the collector has not resolved the egress address
                    // yet, say so rather than implying the classification is
                    // settled -- a public-looking address can still turn out to
                    // be NATed once the real egress is known.
                    var n = cls.note;
                    if (w.class === 'public' && !w.pub4) n = 'Checking the egress address… this can still turn out to be NATed.';
                    setText(e.note, n);
                    e.note.style.display = n ? '' : 'none';
                });
            }).catch(function() { self.wanIpBusy = false; });
        };
        // --- Wi-Fi clients -------------------------------------------------
        // Polled on its own 5s tick rather than folded into info: the backend
        // pays one fork per VAP for the station dump, which has no business on
        // the 3s poll.
        var staSigColor = function(d) {
            if (d >= -55) return '#69f0ae';
            if (d >= -65) return '#b2ff59';
            if (d >= -72) return '#ffee58';
            if (d >= -80) return '#ffb300';
            return '#ff7043';
        };
        // Fixed width, not content width. These are columns: if each cell sizes
        // to whatever it currently holds, a station renegotiating from "12 / 48"
        // to "1922 / 2402" reflows the row and every column after it jumps
        // sideways on the poll -- and rows never line up with each other either.
        // A fixed width per metric makes the block's total width identical in
        // every row, so the columns genuinely align and stay put.
        var staCell = function(label, width, big) {
            var v = E('span', { class: 'hw-sta-val', style: 'font-size: ' + (big ? '0.95em' : '0.85em') + ';' });
            return {
                el: E('div', { class: 'hw-sta-cell', style: 'flex: 0 0 ' + width + 'px; width: ' + width + 'px;' }, [
                    v, E('span', { class: 'hw-sta-lbl' }, label)
                ]),
                val: v
            };
        };
        // Label/value line: label left, value right. Used by the WAN card and
        // by the client metrics once they stack on a narrow screen.
        var kvRow = function(k) {
            var kk = E('span', { class: 'hw-kv-k' }, k);
            var vv = E('span', { class: 'hw-kv-v' });
            return { el: E('div', { class: 'hw-kv' }, [kk, vv]), key: kk, val: vv };
        };
        var renderWifiSta = function(res) {
            var avail = res && res.available;
            var list = (res && res.clients) || [];
            // No iw on the box at all: the card can never say anything, so it
            // stays hidden rather than showing a permanently empty panel.
            if (!avail) { wifiStaCard.style.display = 'none'; return; }
            if (self.hiddenCards && self.hiddenCards.indexOf('wifi_clients') !== -1) return;
            wifiStaCard.style.display = 'flex';
            // Sorted by radio then MAC, deliberately not by signal: signal
            // fluctuates every poll and would make rows swap places under the
            // cursor while you are reading them.
            list = list.slice().sort(function(a, b) {
                if (a.iface !== b.iface) return a.iface < b.iface ? -1 : 1;
                return a.mac < b.mac ? -1 : (a.mac > b.mac ? 1 : 0);
            });
            var box = wifiStaCard.querySelector('#hw-wifi-sta');
            if (!self._staCache) self._staCache = {};
            if (!list.length) {
                for (var k in self._staCache) { self._staCache[k].el.remove(); delete self._staCache[k]; }
                if (!self._staEmpty) {
                    self._staEmpty = E('div', { style: 'opacity: 0.5; font-size: 0.85em; padding: 6px 2px;' }, 'No stations associated.');
                    box.appendChild(self._staEmpty);
                }
                return;
            }
            if (self._staEmpty) { self._staEmpty.remove(); self._staEmpty = null; }

            syncRows(box, self._staCache, list, function(c) { return c.iface + '/' + c.mac; }, function() {
                var nameEl = E('span', { style: 'font-weight: 600; font-size: 1em; word-break: break-word;' });
                var macEl = E('span', { style: 'font-size: 0.72em; opacity: 0.55; font-family: monospace; letter-spacing: 0.3px;' });
                // Modulation and error detail belongs under the name it
                // describes, not stranded on its own full-width line below the
                // row -- on a station with only "tx failed N" to report that
                // line read as an orphan.
                var phyEl = E('span', { style: 'font-size: 0.68em; opacity: 0.5; font-family: monospace; white-space: normal; word-break: break-word; margin-top: 3px;' });
                var idBlock = E('div', { class: 'hw-sta-id' }, [nameEl, macEl, phyEl]);
                var sigVal = E('span', { class: 'hw-sta-val', style: 'font-size: 0.95em;' });
                var sigBar = E('div', { style: 'height: 4px; border-radius: 2px; transition: width 0.4s, background 0.4s;' });
                var sigTrack = E('div', { style: 'width: 54px; height: 4px; border-radius: 2px; background: rgba(128,128,128,0.22); overflow: hidden;' }, [sigBar]);
                var sigBlock = E('div', { class: 'hw-sta-cell', style: 'flex: 0 0 78px; width: 78px;' }, [
                    sigVal, sigTrack, E('span', { class: 'hw-sta-lbl' }, 'Signal')
                ]);
                var rate = staCell('TX / RX Rate', 104, true);
                var traf = staCell('TX / RX Data', 152);
                var conn = staCell('Connected', 76);
                // margin-left:auto pins the whole metric block to the right
                // edge; since every cell inside is a fixed width the block's
                // total is identical in every row, so the columns line up.
                var metrics = E('div', { class: 'hw-sta-metrics' }, [sigBlock, rate.el, traf.el, conn.el]);
                var el = E('div', { class: 'hw-sta-row' }, [idBlock, metrics]);
                return { el: el, nameEl: nameEl, macEl: macEl, sigVal: sigVal, sigBar: sigBar, rate: rate, traf: traf, conn: conn, phyEl: phyEl, sig: {} };
            }, function(e, c) {
                var host = c.host || '';
                setText(e.nameEl, host || c.mac);
                // Showing the MAC twice when there is no hostname is noise.
                setText(e.macEl, (host ? c.mac + '  •  ' : '') + c.iface);
                var d = c.signal || 0;
                setText(e.sigVal, d + ' dBm');
                var col = staSigColor(d);
                e.sigVal.style.color = col;
                // -90 dBm (unusable) to -30 (touching the AP) mapped across the bar.
                var pct = Math.max(0, Math.min(100, ((d + 90) / 60) * 100));
                if (sigGate(e.sig, 'bar', pct.toFixed(0) + col)) {
                    e.sigBar.style.width = pct.toFixed(0) + '%';
                    e.sigBar.style.background = col;
                }
                setText(e.rate.val, (c.tx_rate || 0).toFixed(0) + ' / ' + (c.rx_rate || 0).toFixed(0));
                setText(e.traf.val, fmtBytesS(c.tx_bytes || 0) + ' / ' + fmtBytesS(c.rx_bytes || 0));
                setText(e.conn.val, fmtDuration(c.conn || 0));
                // The driver stops reporting a bitrate for a station that has
                // gone quiet, so tx_info and rx_info blink in and out between
                // polls. Rendering only whichever happened to be present made
                // the line rewrite itself every few seconds -- "TX … • RX …",
                // then "RX … •  tx failed N", then the failure count alone.
                // Both slots are always drawn, and the last rate actually
                // reported is kept: a modulation does not stop being true
                // because the station went idle for a moment.
                if (c.tx_info) e.lastTx = c.tx_info;
                if (c.rx_info) e.lastRx = c.rx_info;
                var bits = ['TX ' + (e.lastTx || '—'), 'RX ' + (e.lastRx || '—')];
                // tx failed is the one that means trouble; retries alone are normal.
                if (c.tx_failed) bits.push('tx failed ' + c.tx_failed);
                if (!c.auth) bits.push('not authorized');
                setText(e.phyEl, bits.join('   •   '));
            });
        };
        var wifiStaTick = function() {
            if (document.hidden) return Promise.resolve();
            if (self.hiddenCards && self.hiddenCards.indexOf('wifi_clients') !== -1) return Promise.resolve();
            if (self.staBusy) return Promise.resolve();
            self.staBusy = true;
            return callHwWifiClients().then(function(res) {
                self.staBusy = false;
                renderWifiSta(res || {});
            }).catch(function() { self.staBusy = false; });
        };
        var pingTick = function() {
            if (document.hidden) return Promise.resolve();
            if (self.hiddenCards && self.hiddenCards.indexOf('ping') !== -1) return Promise.resolve();
            var _pnow = Date.now();
            if (self.pingBusy && (_pnow - (self.pingBusyAt || 0)) < 10000) return Promise.resolve();
            self.pingBusy = true;
            self.pingBusyAt = _pnow;
            // poll.add shares one master tick across every registered
            // interval, so a 1s tick coincides with a 3s tick (infoTick)
            // every 3rd cycle no matter what -- a small offset keeps this
            // rpcd invocation from landing in the same instant as info's
            // and wan_quality's, instead of three separate shell-script
            // processes all forking at once and briefly spiking the CPU.
            return new Promise(function(res) { setTimeout(res, 400); }).then(function() {
                return callHwPing(pingTargetPairs());
            }).then(function(res) {
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
                            // Real ICMP packet counts, one entry per poll,
                            // kept in step with data[] so the loss column can
                            // report packets lost rather than polls that
                            // returned nothing at all.
                            pdata: [],
                            agg: [],
                            acc: { sum: 0, n: 0, loss: 0, cnt: 0, ps: 0, pr: 0 }
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
                    // A backend without sent/recv (older package) reports 0/0,
                    // which the loss column treats as "no packet data" and
                    // falls back to the old poll-level estimate.
                    var ps = typeof t.sent === 'number' ? t.sent : 0;
                    var pr = typeof t.recv === 'number' ? t.recv : 0;
                    h.pdata.push({ s: ps, r: pr });
                    if (h.data.length > PING_WINDOW) h.data.shift();
                    if (h.pdata.length > PING_WINDOW) h.pdata.shift();
                    h.acc.cnt++;
                    h.acc.ps += ps;
                    h.acc.pr += pr;
                    if (v === null) h.acc.loss++;
                    else { h.acc.sum += v; h.acc.n++; }
                    if (h.acc.cnt >= 10) {
                        h.agg.push({ a: h.acc.n > 0 ? h.acc.sum / h.acc.n : null, n: h.acc.n, loss: h.acc.loss, ps: h.acc.ps, pr: h.acc.pr });
                        if (h.agg.length > PING_AGG_KEEP) h.agg.shift();
                        h.acc = { sum: 0, n: 0, loss: 0, cnt: 0, ps: 0, pr: 0 };
                    }
                });
                if (!res.gateway6 && !isGwDisabled(6)) {
                    var gk6 = '__gw6na';
                    if (!hist[gk6]) {
                        hist[gk6] = {
                            label: 'Gateway v6', gw: 6, na: true, host: '', fam: 6,
                            color: '#9e9e9e', hidden: false,
                            data: [], allData: [], pdata: [], agg: [], acc: { sum: 0, n: 0, loss: 0, cnt: 0, ps: 0, pr: 0 }
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
                    var keys = Object.keys(hist).sort(function(ka, kb) {
                        var a = hist[ka], b = hist[kb];
                        if (!a || !b) return ka.localeCompare(kb);
                        if (a.gw && !b.gw) return -1;
                        if (!a.gw && b.gw) return 1;
                        if (a.gw && b.gw) return (a.fam || 4) - (b.fam || 4);
                        var hA = (a.host || '').toLowerCase();
                        var hB = (b.host || '').toLowerCase();
                        var c = hA.localeCompare(hB, undefined, { sensitivity: 'base' });
                        if (c !== 0) return c;
                        return (a.fam || 4) - (b.fam || 4);
                    });
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
                        var vals = [], lostSamples = 0, totSamples = 0, lostPkts = 0, sentPkts = 0;
                        sr.forEach(function(p) {
                            if (p.v !== null) vals.push(p.v);
                            lostSamples += p.lostN; totSamples += p.cnt;
                            sentPkts += p.psent || 0; lostPkts += p.plost || 0;
                        });
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
                        // Packet-level when the backend supplies counts, else
                        // the old poll-level estimate.
                        var lossPct = sentPkts > 0
                            ? Math.round(lostPkts / sentPkts * 1000) / 10
                            : (totSamples > 0 ? Math.round(lostSamples / totSamples * 1000) / 10 : 0);
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
        // Registered further down by the phased dispatcher, not here -- see the
        // comment next to it for why all three ticks share one poll entry.
        var infoTick = function() {
            if (document.hidden) return Promise.resolve();
            var _inow = Date.now();
            if (self.infoBusy && (_inow - (self.infoBusyAt || 0)) < 10000) return Promise.resolve();
            self.infoBusy = true;
            self.infoBusyAt = _inow;
            return callHwInfo().then(function(res) {
                if (!res || !res.cpus) return;
                self.lastInfo = res;
                renderAlerts();
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
                        // By mount point. df reports in mount order, which is
                        // the order the filesystems happened to be mounted in
                        // this boot -- so /overlay and /tmp could swap places
                        // between two routers running the same image.
                        dskItems.sort(function(a, b) { return byName(a.k, b.k); });
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
                        var nvTempBadge = '';
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
                            if (sm.temp_c > 0) {
                                // Same badge styling/thresholding as the Thermal
                                // Sensors card (.hw-temp-badge, hw-temp-crit pulse),
                                // but using the drive's own reported warn/crit
                                // thresholds directly instead of the thermal
                                // card's derived heuristic — NVMe SMART already
                                // gives real manufacturer values.
                                var tCrit = sm.temp_crit > 0 ? sm.temp_crit : 80;
                                var tWarn = sm.temp_warn > 0 ? sm.temp_warn : (tCrit - 10);
                                var tColor = '#00bcd4', tBg = 'rgba(0,188,212,0.14)', tCls = 'hw-temp-badge';
                                if (sm.temp_c >= tCrit) { tColor = '#ff1744'; tBg = 'rgba(255,23,68,0.22)'; tCls += ' hw-temp-crit'; }
                                else if (sm.temp_c >= tWarn) { tColor = '#ffb300'; tBg = 'rgba(255,179,0,0.2)'; }
                                nvTempBadge = E('span', {class: tCls, style: 'color:' + tColor + '; background:' + tBg + ';'}, sm.temp_c.toFixed(1) + ' °C');
                            }
                        }
                        var nvHeaderRight = E('span', {style: 'display: flex; align-items: center; gap: 8px;'}, [nvBadge, nvTempBadge]);
                        var nvBox = makeDevBox(nv.dev.toUpperCase() + (nv.model ? ' — ' + nv.model : ''), nvHeaderRight);
                        if (nv.serial) nvBox.appendChild(makeRow('Serial', nv.serial, null));
                        if (nv.fw) nvBox.appendChild(makeRow('Firmware', nv.fw, null));
                        if (nv.transport) nvBox.appendChild(makeRow('Transport', nv.transport.toUpperCase(), null));
                        if (nv.discard_gran > 0) {
                            var trimStr = 'Supported (' + fmtBytesS(nv.discard_gran) + ' granularity)' + (nv.discard_mount ? ' · Continuous' : ' · Periodic (fstrim)');
                            nvBox.appendChild(makeRow('TRIM Support', trimStr, '#00bcd4'));
                        } else if (nv.discard_gran === 0) {
                            nvBox.appendChild(makeRow('TRIM Support', 'Not Supported', null));
                        }
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
                        var cardKids = [E('div', { style: 'width: 100%; margin-bottom: 20px;' }, [
                            E('div', { style: 'display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%;' }, [
                                E('h3', { style: 'margin-bottom: 0;' }, 'Thermal Sensors'),
                                tGraph ? thermGraphToggle : E('span')
                            ])
                        ])];
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
                            var cardRows = [];
                            var genTag = (w.wcd_gen && w.wcd_gen !== 'unknown') ? w.wcd_gen : null;
                            if (cleanHw && cleanHw !== 'Unknown') {
                                cardRows.push(E('div', { style: 'font-weight: 600; font-size: 0.95em; color: var(--text-color, #fff); margin-bottom: 10px; word-break: break-word; line-height: 1.35;' }, cleanHw));
                            }

                            function makeWfRow(label, valNode, extraStyle) {
                                return E('div', { style: 'display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(128,128,128,0.1); font-size: 0.88em; flex-wrap: wrap; gap: 4px;' + (extraStyle || '') }, [
                                    E('span', { style: 'opacity: 0.7; word-break: break-word;' }, label),
                                    E('span', { style: 'font-weight: 500; text-align: right; word-break: break-word; max-width: 100%;' }, valNode)
                                ]);
                            }

                            var mimoVal = (w.wcd_mimo && w.wcd_mimo !== 'unknown') ? w.wcd_mimo : (hwMaxSp > 0 ? hwMaxSp + 'x' + hwMaxSp : null);
                            if (mimoVal) cardRows.push(makeWfRow('MIMO / Antennas', mimoVal));

                            var maxTheoretical = (w.wcd_maxmbps && w.wcd_maxmbps !== 'unknown') ? w.wcd_maxmbps + ' Mbps' : chipMaxBr;
                            if (maxTheoretical) cardRows.push(makeWfRow('Theoretical Max', maxTheoretical));

                            if (w.hwmode && w.hwmode !== 'Unknown') cardRows.push(makeWfRow('HW Mode(s)', w.hwmode));

                            if (chipMaxBr && chipMaxBr !== maxTheoretical) cardRows.push(makeWfRow('Chip HW Max', chipMaxBr + ' (' + hwMaxSp + 'x' + hwMaxSp + ' @ ' + hwMaxCw + ')'));

                            if (cfgMaxBr) cardRows.push(makeWfRow('Config Max', cfgMaxBr + ' Mbps (' + cfgMaxLabel + ')', 'color: #00bcd4;'));

                            if (chStr) cardRows.push(makeWfRow('Current Channel', chStr));

                            if (surveyStr) cardRows.push(makeWfRow('Channel Load', E('span', { style: 'color:' + getDynColor(busyPct) + ';' }, surveyStr)));

                            if (noiseVal < 0) cardRows.push(makeWfRow('Noise Floor', noiseVal + ' dBm'));

                            if (hwMaxCw) cardRows.push(makeWfRow('Max Channel Width', hwMaxCw));

                            if (w.txpower && w.txpower !== 'Unknown') cardRows.push(makeWfRow('Max TX Power', w.txpower));

                            if (regStr) cardRows.push(makeWfRow('Regulatory Domain', regStr));

                            if (suppChs && suppChs.length > 0) {
                                cardRows.push(E('div', { style: 'padding-top: 8px; font-size: 0.85em;' }, [
                                    E('div', { style: 'opacity: 0.7; margin-bottom: 3px;' }, 'Supported Channels:'),
                                    E('div', { style: 'line-height: 1.4; opacity: 0.9; word-break: break-word;' }, groupChannels(w.band, suppChs))
                                ]));
                            }

                            if (bCap && bCap.disabled && bCap.disabled.length > 0) {
                                cardRows.push(E('div', { style: 'color: #ff5252; font-size: 0.85em; margin-top: 4px; word-break: break-word;' }, 'Disabled (Regdomain): ' + bCap.disabled.join(', ')));
                            }
                            if (bCap && bCap.exceptions && bCap.exceptions.length > 0) {
                                cardRows.push(E('div', { style: 'color: #ffb74d; font-size: 0.85em; margin-top: 4px; word-break: break-word;' }, 'Radar Detection (DFS): ' + bCap.exceptions.join(', ')));
                            }

                            bandGroups[bandKey].push(E('div', { style: 'padding: 14px; background: rgba(128,128,128,0.05); border-radius: 8px; margin-bottom: 12px;' }, [
                                E('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(128,128,128,0.2); padding-bottom: 10px;' }, [
                                    E('span', { style: 'font-weight: bold; font-size: 1.05em;' }, w.iface.toUpperCase() + ' (' + w.band + ')'),
                                    genTag ? E('span', { style: 'background: rgba(0, 188, 212, 0.15); color: #00bcd4; border: 1px solid rgba(0, 188, 212, 0.4); padding: 2px 10px; border-radius: 12px; font-size: 0.85em; font-weight: 600;' }, genTag) : E('span', {}, '')
                                ]),
                                E('div', { class: 'hw-wifi-card-body' }, cardRows)
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
                        if (off.sw_flows >= 0) offRows.push({ k: 'swflows', type: 'bar', label: off.qcom ? 'Conntrack Offloaded Flows' : 'Offloaded / Active Flows', cur: off.sw_flows, tot: connNow, color: '#00bcd4' });
                        // Qualcomm PPE keeps its own accounting; conntrack's
                        // OFFLOAD count is a different (larger) number and was
                        // previously shown as if it were the hardware figure.
                        if (off.qcom && off.qcom.bound >= 0) {
                            offRows.push({ k: 'qbound', type: 'row', label: 'PPE Bound Flows (hardware)', val: String(off.qcom.bound), color: off.qcom.bound > 0 ? '#8bc34a' : '#9e9e9e' });
                            if (off.qcom.unsupported >= 0) offRows.push({ k: 'qunsup', type: 'row', label: 'Not Accelerable', val: String(off.qcom.unsupported), color: off.qcom.unsupported > 0 ? '#ffa726' : '#9e9e9e' });
                            if (off.qcom.failed > 0) offRows.push({ k: 'qfail', type: 'row', label: 'PPE Bind Failures', val: String(off.qcom.failed), color: '#ff5252' });
                        }
                        if (!off.qcom && off.ppe_flows >= 0) offRows.push({ k: 'ppeflows', type: 'bar', label: 'PPE Bind Entries', cur: off.ppe_flows, tot: off.ppe_total > 0 ? off.ppe_total : (off.sw_flows >= 0 ? off.sw_flows : off.ppe_flows), color: '#8bc34a' });
                        if (off.wed > 0) offRows.push({ k: 'wed', type: 'row', label: 'WED (Wi-Fi offload)', val: off.wed + ' engine' + (off.wed > 1 ? 's' : ''), color: '#00bcd4' });
                        // Accelerator is configured but the kernel exposes no
                        // counters for it -- say so, rather than showing an
                        // "Active" row with no numbers under it and leaving the
                        // reader to guess whether offload is broken.
                        if (off.dbg !== undefined && off.dbg < 2 && (off.ft > 0 || off.hw_cfg > 0 || off.sw_cfg > 0)) {
                            offRows.push({
                                k: 'nodbg', type: 'row', label: 'Flow counters',
                                val: off.dbg === 0 ? 'debugfs not mounted' : 'not exposed by this build',
                                color: '#ffa726'
                            });
                        }
                        if (off.qcom) {
                            var q = off.qcom;
                            offRows.push({ k: 'qcomhdr', type: 'header', label: 'Qualcomm PPE Diagnostics' });
                            var qNum = function(n) { return (typeof n === 'number' ? n : 0).toLocaleString(); };
                            // Named punt reasons straight from the hardware --
                            // "L3 no-route action" is actionable in a way a raw
                            // CPU code number never was. Sorted by volume, top
                            // few only; the long tail is all zeroes.
                            (q.punts || []).slice().sort(function(a, b) { return b.packets - a.packets; }).slice(0, 4).forEach(function(pt, i) {
                                offRows.push({ k: 'punt' + i, type: 'row', label: 'Punt: ' + pt.name, val: qNum(pt.packets), color: '#ffa726' });
                            });
                            (q.drops || []).slice().sort(function(a, b) { return b.packets - a.packets; }).slice(0, 3).forEach(function(dr, i) {
                                offRows.push({ k: 'qdrop' + i, type: 'row', label: 'Drop: ' + dr.name + (dr.port >= 0 ? ' (port ' + dr.port + ')' : ''), val: qNum(dr.packets), color: '#ff5252' });
                            });
                            if (q.port_drops !== undefined) offRows.push({ k: 'qpdrop', type: 'row', label: 'Port RX Drops', val: qNum(q.port_drops), color: q.port_drops > 0 ? '#ff5252' : '#9e9e9e' });
                            if (q.queue_drops !== undefined) offRows.push({ k: 'qqdrop', type: 'row', label: 'Queue Drops / Pending', val: qNum(q.queue_drops) + ' / ' + qNum(q.queue_pending), color: q.queue_drops > 0 ? '#ff5252' : '#9e9e9e' });
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
                // --- Wireless AQL ------------------------------------------
                // Hidden outright when the controls don't exist: no debugfs, or
                // a kernel built without CONFIG_MAC80211_DEBUGFS. There is
                // nothing to show and nothing to tune, so an empty card would
                // just be noise.
                if (res.aql && res.aql.available) {
                    var aq = res.aql;
                    var aqlNode = document.getElementById('hw-aql');
                    if (aqlNode) {
                        var aqlRows = [];
                        // WED offloads the WiFi datapath in hardware and never
                        // enqueues through mac80211, so AQL simply doesn't see
                        // that traffic. Lead with that -- the values below are
                        // real, they just aren't governing anything.
                        if (aq.wed_active) {
                            aqlRows.push({ k: 'wedwarn', type: 'row', label: '⚠ WED active' + (aq.wed_devs ? ' (' + aq.wed_devs + ')' : ''), val: 'AQL bypassed', color: '#ffa726' });
                        } else if (aq.wed_param) {
                            aqlRows.push({ k: 'wedparam', type: 'row', label: 'WED', value: '', val: 'enabled, not attached', color: '#9e9e9e' });
                        }
                        (aq.phys || []).forEach(function(ph) {
                            var be = null;
                            (ph.limits || []).forEach(function(l) { if (l.ac === 'BE') be = l; });
                            if (!be && ph.limits && ph.limits.length) be = ph.limits[0];
                            aqlRows.push({ k: ph.phy + '-hdr', type: 'header', label: ph.phy.toUpperCase() + (ph.enable === 0 ? ' (disabled)' : '') });
                            if (be) {
                                aqlRows.push({ k: ph.phy + '-lim', type: 'row', label: 'TX Queue Limit (low / high)', val: be.low + ' / ' + be.high + ' µs', color: be.high <= 3000 ? '#8bc34a' : (be.high >= 12000 ? '#00bcd4' : '') });
                            }
                            aqlRows.push({ k: ph.phy + '-th', type: 'row', label: 'Threshold', val: ph.threshold + ' µs', color: '' });
                            // Pending airtime is the proof it's live: a WED-
                            // bypassed radio sits at 0 no matter the load.
                            aqlRows.push({ k: ph.phy + '-pend', type: 'row', label: 'Pending Airtime', val: ph.pending_us + ' µs', color: ph.pending_us > 0 ? '#8bc34a' : '#9e9e9e' });
                        });
                        syncRows(aqlNode, self._aqlCache || (self._aqlCache = {}), aqlRows, function(r) { return r.k; }, function(r) {
                            if (r.type === 'header') {
                                var eh = E('div', { class: 'hw-stat-row', style: 'border-top: 1px solid var(--border-color, rgba(128,128,128,0.15)); margin: 8px 0; padding-top: 8px;' }, [
                                    E('span', { class: 'hw-stat-label', style: 'font-weight: bold; color: #8bc34a;' }, r.label),
                                    E('span', { class: 'hw-stat-value' }, '')
                                ]);
                                return { el: eh };
                            }
                            var v = E('span', { class: 'hw-stat-value' });
                            return { el: E('div', { class: 'hw-stat-row' }, [E('span', { class: 'hw-stat-label' }, r.label), v]), val: v };
                        }, function(entry, r) {
                            if (r.type === 'header') {
                                entry.el.firstChild.textContent = r.label;
                                return;
                            }
                            entry.el.firstChild.textContent = r.label;
                            entry.val.textContent = r.val;
                            entry.val.style.color = r.color;
                        });
                    }
                    aqlCard.style.display = 'flex';
                } else {
                    aqlCard.style.display = 'none';
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
                    var siGrid = E('div', {style: 'display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:5px 20px;'});
                    // .hw-stat-value defaults to flex-shrink:0 + nowrap, which
                    // let a long value squeeze .hw-stat-label (shrinkable, with
                    // overflow:hidden) down to zero width -- that is how the
                    // "CPU Accel" label vanished. Rather than promoting long
                    // values to their own full-width row (which left the label
                    // stranded at one end and the value at the other), every row
                    // stays a normal grid cell: the label is pinned so it can
                    // never shrink, and the value wraps inside the cell instead.
                    var addSi = function(lbl, val) {
                        siGrid.appendChild(E('div', {class:'hw-stat-row', style:'margin:0; align-items:baseline;'}, [
                            E('span', {class:'hw-stat-label', style:'font-size:0.88em; flex:0 0 auto; overflow:visible;'}, lbl),
                            E('span', {class:'hw-stat-value', style:'font-size:0.88em; white-space:normal; word-break:break-word; text-align:right; flex:1 1 auto; min-width:0;'}, String(val))
                        ]));
                    };
                    if (si.hostname) addSi('Hostname', si.hostname);
                    if (si.kver) addSi('Kernel', si.kver);
                    if (si.arch) addSi('Architecture', si.arch);
                    // CPU detail. cpu_isa is the ARM ISA level (ARMv8-A), which
                    // is not the same thing as arch (aarch64) and is the more
                    // useful of the two; cpu_core is the core microarchitecture
                    // (Cortex-A73), which ARM /proc/cpuinfo does not expose at
                    // all and only lscpu can supply. Every row is optional.
                    if (si.cpu_isa && si.cpu_isa !== si.arch) addSi('ISA', si.cpu_isa);
                    if (si.cpu_core) addSi('CPU Core', si.cpu_core + (si.cpu_stepping ? ' (' + si.cpu_stepping + ')' : ''));
                    if (si.cpu_vendor) addSi('CPU Vendor', si.cpu_vendor);
                    if (si.cpu_opmode) addSi('Op Modes', si.cpu_opmode);
                    if (si.cpu_byteorder) addSi('Byte Order', si.cpu_byteorder);
                    if (si.cpu_bogomips) addSi('BogoMIPS', si.cpu_bogomips);
                    if (si.cpu_virt) addSi('Virtualization', si.cpu_virt);

                    if (si.lscpu === 0) {
                        addSi('CPU Detail', 'limited \u2014 install lscpu for more');
                    }
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
                    // Same section shape as CPU Security below: a labelled band
                    // of bordered chips. Accelerators that decide crypto/VPN
                    // throughput are floated to the front and tinted green; the
                    // rest keep the neutral chip so the whole set is present
                    // without a "+N more" summary hiding any of it.
                    if (si.cpu_features) {
                        var NOTABLE = ['aes', 'aesni', 'pmull', 'sha1', 'sha2', 'sha512', 'crc32', 'asimd', 'neon', 'sve',
                                       'avx2', 'avx', 'sse4_2', 'rdrand', 'rdseed', 'vmx', 'svm'];
                        var have = si.cpu_features.split(/\s+/).filter(function(f) { return f; });
                        if (have.length) {
                            var hot = [], cold = [];
                            have.forEach(function(f) { (NOTABLE.indexOf(f) !== -1 ? hot : cold).push(f); });
                            var featDiv = E('div', {style: 'margin-top:12px; padding-top:10px; border-top:1px solid var(--border-color,rgba(128,128,128,0.15));'});
                            featDiv.appendChild(E('div', {style: 'font-size:0.75em; opacity:0.5; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;'}, 'CPU Features'));
                            var featRow = E('div', {style: 'display:flex; flex-wrap:wrap; gap:6px;'});
                            hot.concat(cold).forEach(function(f) {
                                var isHot = NOTABLE.indexOf(f) !== -1;
                                var fc = isHot ? '#8bc34a' : '#9e9e9e';
                                featRow.appendChild(E('span', {
                                    style: 'font-size:0.75em; padding:3px 8px; border-radius:4px; border:1px solid ' + fc + '44; color:' + fc + '; background:' + fc + '18; white-space:nowrap;'
                                }, f));
                            });
                            featDiv.appendChild(featRow);
                            sysInfoGrid.appendChild(featDiv);
                        }
                    }
                    if (si.vulns && typeof si.vulns === 'object' && Object.keys(si.vulns).length > 0) {
                        var vulnDiv = E('div', {style: 'margin-top:12px; padding-top:10px; border-top:1px solid var(--border-color,rgba(128,128,128,0.15));'});
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
        infoTick();

        // WAN Quality gets its own poll tick at the same 2s cadence as
        // Ping Latency (both driven by the phased dispatcher below) rather
        // than piggy-
        // backing on the much heavier 3s info tick -- that heavier tick's
        // rate is what made this card feel a beat behind Ping Latency even
        // after the background collector itself sped up. 2s (not 1s) is a
        // deliberate balance: measured sustained CPU cost of 1s polling on
        // both cards was ~10% just from the recurring rpcd invocations
        // alone, which is the actual "gets stuck"/CPU complaint -- 2s
        // roughly halves that while still feeling close to real-time. The
        // rpcd side (luci.hwdash `wan_quality`) is a small, dedicated, pure file
        // reader, so polling it 3x more often costs almost nothing extra.
        var wanQTick = function() {
            if (document.hidden) return Promise.resolve();
            if (self.hiddenCards && self.hiddenCards.indexOf('wan_quality') !== -1) return Promise.resolve();
            var _wnow = Date.now();
            if (self.wanQBusy && (_wnow - (self.wanQBusyAt || 0)) < 10000) return Promise.resolve();
            self.wanQBusy = true;
            self.wanQBusyAt = _wnow;
            // See the matching comment in pingTick -- same shared-tick
            // collision, offset to a different point in the cycle so all
            // three of this card's, ping's, and info's rpcd invocations
            // don't fork at the same instant.
            return new Promise(function(res) { setTimeout(res, 150); }).then(function() {
                return callHwGetWanQuality();
            }).then(function(res) {
                // Sorted once here, so the uptime rows, the settings checkboxes
                // and the alerts all agree on an order that does not depend on
                // which interface netifd happened to bring up first.
                var wqAll = (res && res.wan_quality) || null;
                if (wqAll) wqAll = wqAll.slice().sort(function(a, b) { return byName(a.iface, b.iface); });
                self.lastWq = wqAll || [];
                renderAlerts();
                var wanQBox = document.getElementById('hw-wanq-list');
                if (!wanQBox) return;
                var isHidden = self.hiddenCards && self.hiddenCards.indexOf('wan_quality') !== -1;
                var hasWanQ = wqAll && wqAll.length > 0;
                wanQualityCard.style.display = hasWanQ && !isHidden ? 'flex' : 'none';
                var wanIfaceSectionNode = wanIfaceSection;
                if (wanIfaceSectionNode) wanIfaceSectionNode.style.display = hasWanQ ? '' : 'none';
                if (!hasWanQ) return;
                var wanqChecks = document.getElementById('hw-wanq-checks');
                if (wanqChecks) {
                    syncRows(wanqChecks, self._wanIfaceCheckCache, wqAll, function(r) { return r.iface; }, function(r) {
                        var cb = E('input', { type: 'checkbox' });
                        var lbl = E('label', { class: 'hw-tgt' }, [
                            cb, E('span', { class: 'hw-tgt-name' }, r.iface.toUpperCase())
                        ]);
                        return { el: lbl, cb: cb, iface: r.iface };
                    }, function(entry, r) {
                        entry.cb.checked = self.hiddenWanIfaces.indexOf(r.iface) === -1;
                        entry.cb.onchange = function(ev) {
                            var idxHide = self.hiddenWanIfaces.indexOf(r.iface);
                            var idxShow = self.hiddenWanIfaces.indexOf('!' + r.iface);
                            if (idxHide !== -1) self.hiddenWanIfaces.splice(idxHide, 1);
                            // Legacy "!iface" force-show entries were only
                            // meaningful alongside the auto-hide below; drop
                            // them as they are encountered rather than leaving
                            // dead weight in the saved config.
                            if (idxShow !== -1) self.hiddenWanIfaces.splice(idxShow, 1);
                            if (!ev.target.checked) self.hiddenWanIfaces.push(r.iface);
                            markDirty();
                        };
                    });
                }
                // Only what the user has explicitly unticked is hidden.
                //
                // There used to be an auto-hide for anything down at 0% over
                // 24h, to keep leftover interfaces off the card. Two things
                // have since made it wrong. Pruning now removes interfaces
                // deleted or disabled in uci, which is the clutter it was
                // invented for; and everything still on the tracked list got
                // there by holding a default route at some point, so it is a
                // real WAN by construction. What was left was a rule that hid
                // a genuine WAN precisely when it had been down longest --
                // the worst news the card has, quietly suppressed.
                var wq = wqAll.filter(function(r) {
                    return !isIfaceHidden(r.iface, r.alias_of);
                });
                if (!self._wanQCache) self._wanQCache = {};
                // First row (the list is already sorted) owns its device's
                // counters; any later row on the same device defers to it.
                self._rateOwner = {};
                wq.forEach(function(r) {
                    if (r.rate_dev && !self._rateOwner[r.rate_dev]) self._rateOwner[r.rate_dev] = r.iface;
                });

                syncRows(wanQBox, self._wanQCache, wq, function(r) { return r.iface; }, function(r) {
                    var monogramEl = E('span', { style: 'display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; font-size: 0.8em; font-weight: 700; color: #fff; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.15); flex-shrink: 0;' });
                    var logoImg = E('img', { style: 'width: 34px; height: 34px; object-fit: contain; background: transparent; box-sizing: border-box; flex-shrink: 0; display: none; position: absolute; top: 0; left: 0;' });
                    // Tile only where it earns its keep. Most brand logos are
                    // vivid enough to sit straight on the card, which looks far
                    // better than a white square on every row; only genuinely
                    // dark artwork gets a backing. Decided per image on load,
                    // so a changed src is always re-judged.
                    logoImg.onload = function() {
                        var tile = pageIsDark() && logoNeedsTile(logoImg);
                        logoImg.style.background = tile ? '#fff' : 'transparent';
                        logoImg.style.borderRadius = tile ? '7px' : '0';
                        logoImg.style.padding = tile ? '2px' : '0';
                        monogramEl.style.display = 'none';
                        logoImg.style.display = '';
                    };
                    // Two-tier fallback: a bundled asset is tried first (local,
                    // instant, works with no internet and no third party), and
                    // only if it is missing or fails do we reach for the remote
                    // logo service. The coloured monogram is the last resort, so
                    // the badge is never empty.
                    logoImg.onerror = function() {
                        var alt = logoImg.dataset.fallback;
                        if (alt && logoImg.src.indexOf(alt) === -1) {
                            logoImg.dataset.fallback = '';
                            logoImg.src = alt;
                            return;
                        }
                        logoImg.style.display = 'none';
                        monogramEl.style.display = 'inline-flex';
                        logoImg.dataset.src = '';
                    };
                    var badgeWrapper = E('div', { style: 'position: relative; width: 34px; height: 34px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;' }, [monogramEl, logoImg]);
                    var ispNameSpan = E('span', { style: 'font-weight: 600; font-size: 1.05em; white-space: normal; word-break: break-word; line-height: 1.25;' });
                    var ifaceAsnSpan = E('span', { style: 'font-size: 0.78em; opacity: 0.55; white-space: nowrap; font-family: monospace; letter-spacing: 0.3px;' });
                    var infoBlock = E('div', { style: 'display: flex; flex-direction: column; min-width: 0; gap: 2px;' }, [ispNameSpan, ifaceAsnSpan]);

                    var statusDot = E('span', { style: 'width: 7px; height: 7px; border-radius: 50%; display: inline-block; vertical-align: middle;' });
                    var statusVal = E('span', { style: 'font-size: 0.88em; font-weight: 700; font-family: monospace; line-height: 1; vertical-align: middle;' });
                    var statusLbl = E('span', { style: 'font-size: 0.58em; opacity: 0.8; font-weight: 500; white-space: nowrap;' });
                    var statusBlock = E('div', { style: 'display: flex; flex-direction: column; align-items: center; min-width: 0; gap: 2px; text-align: center;' }, [
                        E('div', { style: 'display: flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; line-height: 1;' }, [statusDot, statusVal]),
                        statusLbl
                    ]);

                    var latVal = E('span', { style: 'font-size: 0.88em; font-weight: 700; color: #00bcd4; font-family: monospace; line-height: 1; white-space: nowrap;' });
                    var latLbl = E('span', { style: 'font-size: 0.58em; opacity: 0.8; letter-spacing: 0.5px; font-weight: 700; white-space: nowrap;' }, 'LATENCY');
                    var latBlock = E('div', { style: 'display: flex; flex-direction: column; align-items: center; min-width: 0; gap: 2px; text-align: center;' }, [latVal, latLbl]);

                    var uptimeVal = E('span', { style: 'font-size: 0.88em; font-weight: 700; font-family: monospace; line-height: 1; white-space: nowrap;' });
                    var uptimeLbl = E('span', { style: 'font-size: 0.58em; opacity: 0.8; letter-spacing: 0.5px; font-weight: 700; white-space: nowrap;' }, 'UPTIME 24H');
                    var uptimeBlock = E('div', { style: 'display: flex; flex-direction: column; align-items: center; min-width: 0; gap: 2px; text-align: center;' }, [uptimeVal, uptimeLbl]);

                    var downtimeVal = E('span', { style: 'font-size: 0.88em; font-weight: 700; font-family: monospace; line-height: 1; white-space: nowrap;' });
                    var downtimeLbl = E('span', { style: 'font-size: 0.58em; opacity: 0.8; letter-spacing: 0.5px; font-weight: 700; white-space: nowrap;' }, 'DOWN 24H');
                    var downtimeBlock = E('div', { style: 'display: flex; flex-direction: column; align-items: center; min-width: 0; gap: 2px; text-align: center;' }, [downtimeVal, downtimeLbl]);

                    // What the link is actually carrying. The card had latency
                    // and availability for each WAN but no idea whether any
                    // traffic was moving over it, which is the first thing you
                    // want when deciding which link a problem is on.
                    var rateVal = E('span', { style: 'font-size: 0.82em; font-weight: 700; font-family: monospace; line-height: 1.25; white-space: nowrap;' });
                    var rateLbl = E('span', { style: 'font-size: 0.58em; opacity: 0.8; letter-spacing: 0.5px; font-weight: 700; white-space: nowrap;' }, 'DOWN / UP');
                    var rateBlock = E('div', { style: 'display: flex; flex-direction: column; align-items: center; min-width: 0; gap: 2px; text-align: center;' }, [rateVal, rateLbl]);

                    var histGraphEl = E('div', { style: 'width: 100%; height: 32px;' });
                    var histLbl = E('span', { style: 'font-size: 0.58em; opacity: 0.8; letter-spacing: 0.5px; font-weight: 700; white-space: nowrap; text-align: center; display: block;' }, 'TREND');
                    var histBlock = E('div', { style: 'display: flex; flex-direction: column; gap: 3px; flex: 1 1 108px; min-width: 108px;' }, [histGraphEl, histLbl]);

                    // Why it is down, on its own full-width line under the row.
                    // The status column has room for "OFFLINE" and a duration
                    // and nothing else, and the cause is a sentence -- so it
                    // goes below rather than being truncated into a column.
                    var reasonEl = E('div', { style: 'display: none; width: 100%; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(128,128,128,0.15); font-size: 0.78em; line-height: 1.4; word-break: break-word;' });
                    var el = E('div', { style: 'width: 100%; padding: 10px 12px; background: rgba(128,128,128,0.05); border: 1px solid rgba(128,128,128,0.1); border-radius: 8px; margin-bottom: 6px;' }, [
                        E('div', { style: 'display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px 16px;' }, [
                            E('div', { style: 'display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1 1 180px;' }, [badgeWrapper, infoBlock]),
                            E('div', { class: 'hw-wanq-metrics', style: 'display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); align-items: start; gap: 8px; width: 100%; max-width: 440px; flex: 1 1 320px;' }, [statusBlock, latBlock, rateBlock, uptimeBlock, downtimeBlock]),
                            histBlock
                        ]),
                        reasonEl
                    ]);

                    return {
                        el: el,
                        monogramEl: monogramEl,
                        logoImg: logoImg,
                        ispName: ispNameSpan,
                        ifaceAsn: ifaceAsnSpan,
                        statusDot: statusDot,
                        statusVal: statusVal,
                        statusLbl: statusLbl,
                        lat: latVal,
                        uptime: uptimeVal,
                        downtime: downtimeVal,
                        rate: rateVal,
                        histGraph: histGraphEl,
                        reason: reasonEl
                    };
                }, function(entry, r) {
                    var statusColor = r.status === 'up' ? '#4caf50' : r.status === 'down' ? '#f44336' : '#9e9e9e';
                    entry.statusDot.style.background = statusColor;
                    entry.statusVal.style.color = statusColor;
                    entry.statusVal.textContent = r.status === 'up' ? 'ACTIVE' : r.status === 'down' ? 'OFFLINE' : 'UNKNOWN';
                    entry.statusLbl.textContent = (r.status === 'down' ? 'DOWN ' : '') + fmtDurationFull(r.since_change_s);
                    // The collector works the cause out anyway, for the Alerts
                    // card. Repeating it here costs nothing and saves reading
                    // "OFFLINE" on one card and going to another to find out
                    // whether that means a cable, a lease or the ISP.
                    // Bytes per second from the kernel counters, shown the way
                    // a link is normally described: down first, then up.
                    //
                    // A v4/v6 pair shares one device, so both rows would report
                    // the same wire and a reader adding the column up would get
                    // double the real traffic. The counter belongs to the
                    // device, so it is shown once -- on whichever row comes
                    // first -- and the sibling says who it is sharing with.
                    var rxb = r.rx_bps || 0, txb = r.tx_bps || 0;
                    var owner = r.rate_dev ? self._rateOwner[r.rate_dev] : null;
                    entry.rate.style.whiteSpace = 'pre';
                    if (owner && owner !== r.iface) {
                        setText(entry.rate, 'shared\n' + owner.toUpperCase());
                        entry.rate.title = 'This interface shares device ' + r.rate_dev +
                            ' with ' + owner.toUpperCase() + '; the traffic is counted there.';
                        entry.rate.style.opacity = '0.5';
                    } else {
                        setText(entry.rate, fmtSpeedDf(rxb) + '\n' + fmtSpeedDf(txb));
                        entry.rate.title = r.rate_dev ? 'On ' + r.rate_dev : '';
                        entry.rate.style.opacity = (rxb || txb) ? '1' : '0.45';
                    }

                    var rsn = (r.status === 'down' && r.down_reason) ? r.down_reason : '';
                    if (entry.reason.textContent !== rsn) setText(entry.reason, rsn);
                    entry.reason.style.display = rsn ? '' : 'none';
                    entry.reason.style.color = rsn ? statusColor : '';

                    var ib = ispBadge(r.isp, r.iface);
                    setText(entry.ispName, ib.name);
                    // The registry string is what the name was derived from, so
                    // keep it reachable rather than discarded.
                    if (entry.ispName.title !== ib.full) entry.ispName.title = ib.full;
                    entry.monogramEl.style.background = ib.color;
                    entry.monogramEl.textContent = ib.label;
                    // Only touch img.src when the selected asset actually
                    // changes -- setting src every poll would refetch and
                    // flicker the logo for no reason.
                    var remoteSrc = ib.domain ? 'https://logos.hunter.io/' + ib.domain : '';
                    var logoSrc = ib.logo || remoteSrc;
                    if (logoSrc && entry.logoImg.dataset.src !== logoSrc) {
                        entry.logoImg.dataset.src = logoSrc;
                        // Only meaningful when both exist: bundled asset primary,
                        // remote service as the standby.
                        entry.logoImg.dataset.fallback = (ib.logo && remoteSrc) ? remoteSrc : '';
                        entry.logoImg.style.display = 'none';
                        entry.monogramEl.style.display = 'inline-flex';
                        entry.logoImg.src = logoSrc;
                    } else if (!logoSrc && entry.logoImg.dataset.src) {
                        entry.logoImg.dataset.src = '';
                        entry.logoImg.style.display = 'none';
                        entry.monogramEl.style.display = 'inline-flex';
                    }

                    var ifnLabel = r.iface.toUpperCase();
                    if (ib.asn) {
                        entry.ifaceAsn.textContent = ifnLabel + ' • ' + ib.asn;
                    } else {
                        entry.ifaceAsn.textContent = ifnLabel + ' • WAN Link';
                    }

                    entry.uptime.textContent = r.uptime_pct.toFixed(2) + '%';
                    entry.uptime.style.color = r.uptime_pct >= 99.9 ? '#4caf50' : r.uptime_pct >= 99.0 ? '#8bc34a' : r.uptime_pct >= 95.0 ? '#ffb300' : '#f44336';

                    entry.downtime.textContent = r.downtime_pct.toFixed(2) + '%';
                    entry.downtime.style.color = r.downtime_pct > 5.0 ? '#f44336' : r.downtime_pct > 1.0 ? '#ff9800' : r.downtime_pct > 0.0 ? '#ffb300' : '#4caf50';

                    var latColor = '#4caf50';
                    if (r.cur_ms != null) {
                        if (r.cur_ms > 250) latColor = '#f44336';
                        else if (r.cur_ms > 150) latColor = '#ff9800';
                        else if (r.cur_ms > 100) latColor = '#ffb300';
                        else if (r.cur_ms > 50) latColor = '#8bc34a';
                    }
                    entry.lat.style.color = latColor;
                    entry.lat.textContent = (r.status === 'up' && r.cur_ms != null) ? (r.cur_ms + ' ms') : '—';

                    // Down periods render their own red band inside
                    // drawWanHistorySpark itself (only from where the
                    // outage actually starts) -- this color only applies
                    // to the healthy segments, so it should never be the
                    // down/red status color even while currently down.
                    drawWanHistorySpark(entry.histGraph, r.history, latColor);
                });
            }).catch(function(err) {
                console.error(err);
            }).then(function() { self.wanQBusy = false; });
        };
        // One poll entry drives all three ticks, on distinct phases.
        //
        // LuCI's poller runs every registered callback whose interval divides
        // the global tick counter, so info(3s), ping(2s) and wanQuality(2s)
        // coincided on every sixth tick -- and, worse, all three fired together
        // on the very first one. That is the most expensive moment info ever
        // has: while the page was closed its caches (offload 15s, events 30s,
        // wifi 20s, ethtool 30s) all expired, so the first call regenerates
        // every one of them. Measured on a 4-core aarch64 router, that first
        // info costs 2-3x a warm one -- and it was landing on the same tick as
        // the other two calls.
        //
        // Phasing them here means at most two ever coincide, never three, and
        // a page load spreads out as info now, wanQuality at +1s, ping at +2s.
        // Cadence is unchanged: ping and wanQuality still every 2s, info still
        // every 3s.
        var hwTick = 0;
        poll.add(function() {
            hwTick++;
            if (hwTick % 2 === 0) {
                wanQTick();
                pingTick();
            }
            if (hwTick % 3 === 0) infoTick();
            // Offset by 1 so the station dump never lands on the same tick as
            // info, which is the expensive one.
            if (hwTick % 5 === 1) wifiStaTick();
            if (hwTick % 5 === 3) wanIpTick();
            return Promise.resolve();
        }, 1);
        return container;
    },
    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
