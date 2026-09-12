'use strict';
'require baseclass';

// Colours, number formatting and the small DOM builders every card uses.

// The same meanings in two palettes: bright for dark themes, and the same hues
// darkened to clear 3:1 on white for light ones. The first five are verdicts;
// the rest say what a link is and never read as a verdict.
var SEV = {
	good:   { dark: '#69f0ae', light: '#0f9d58' },
	warn:   { dark: '#ffb300', light: '#b26a00' },
	info:   { dark: '#40c4ff', light: '#0277bd' },
	bad:    { dark: '#ff5252', light: '#c62828' },
	mute:   { dark: '#90a4ae', light: '#546e7a' },
	proto:  { dark: '#b388ff', light: '#5e35b1' },
	assign: { dark: '#64ffda', light: '#00796b' },
	alias:  { dark: '#ffab40', light: '#c25e00' },
	dev:    { dark: '#90a4ae', light: '#455a64' }
};

var darkCache = null;

// Judged from the first opaque background above <body> rather than the OS
// setting: a LuCI theme can be dark while the OS is light.
function isDark() {
	if (darkCache !== null)
		return darkCache;
	for (var el = document.body; el; el = el.parentElement) {
		var m = (getComputedStyle(el).backgroundColor || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
		if (m && (m[4] === undefined || +m[4] > 0.5))
			return (darkCache = (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 < 0.5);
	}
	return (darkCache = !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches));
}

// Bootstrap switches data-darkmode in place when the OS goes dark at sunset,
// without a reload; the cards repaint on their next poll.
function forgetTheme() { darkCache = null; }
if (window.matchMedia) {
	var themeQuery = matchMedia('(prefers-color-scheme: dark)');
	if (themeQuery.addEventListener) themeQuery.addEventListener('change', forgetTheme);
	else if (themeQuery.addListener) themeQuery.addListener(forgetTheme);
}
new MutationObserver(forgetTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-darkmode'] });

function sevColor(key) {
	var s = SEV[key] || SEV.mute;
	return isDark() ? s.dark : s.light;
}

// Cyan, yellow, red as a load climbs. `invert` is for figures where a low
// number is the bad one, such as idle time or free memory.
function loadColor(pct, invert) {
	if (invert)
		return pct >= 40 ? '#00bcd4' : pct >= 20 ? '#ffea00' : '#ff1744';
	return pct < 60 ? '#00bcd4' : pct < 80 ? '#ffea00' : '#ff1744';
}

// Text, tinted background and border all from one hue.
function tint(el, color) {
	el.style.color = color;
	el.style.background = color + '22';
	el.style.border = '1px solid ' + color + '55';
}

function fmtBytes(b) {
	if (b >= 1099511627776) return (b / 1099511627776).toFixed(2) + ' TB';
	if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
	if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
	if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
	return b + ' B';
}

// Sizes the kernel reports in KiB (df, /proc/meminfo).
function fmtKiB(kb) {
	if (kb >= 1048576) return (kb / 1048576).toFixed(2) + ' GB';
	if (kb >= 1024) return (kb / 1024).toFixed(0) + ' MB';
	return kb + ' KB';
}

function fmtRate(bytesPerSec) {
	if (bytesPerSec < 1024) return Math.round(bytesPerSec) + ' B/s';
	if (bytesPerSec < 1048576) return (bytesPerSec / 1024).toFixed(0) + ' KB/s';
	return (bytesPerSec / 1048576).toFixed(1) + ' MB/s';
}

function fmtMbps(m) {
	if (m >= 1000) return (m / 1000).toFixed(2) + ' Gbps';
	if (m >= 1) return m.toFixed(1) + ' Mbps';
	return (m * 1000).toFixed(0) + ' Kbps';
}

function fmtCache(bytes) {
	return bytes >= 1048576 ? (bytes / 1048576).toFixed(0) + ' MB' : (bytes / 1024).toFixed(0) + ' KB';
}

function fmtKHz(khz) {
	return khz >= 1000000 ? (khz / 1000000).toFixed(2) + ' GHz' : Math.round(khz / 1000) + ' MHz';
}

// "3D 4H": the two largest units, for uptimes and connection ages.
function fmtDuration(s) {
	s = Math.max(0, Math.floor(s || 0));
	var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
	if (d > 0) return d + 'D ' + h + 'H';
	if (h > 0) return h + 'H ' + m + 'M';
	if (m > 0) return m + 'M';
	return s + 'S';
}

// Down to the second, so you can tell exactly when a link flipped.
function fmtDurationFull(s) {
	s = Math.max(0, Math.floor(s || 0));
	var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
	var parts = [];
	if (d > 0) parts.push(d + 'D');
	if (d > 0 || h > 0) parts.push(h + 'H');
	if (d > 0 || h > 0 || m > 0) parts.push(m + 'M');
	parts.push(s % 60 + 'S');
	return parts.join(' ');
}

// How LuCI sorts interfaces: case-insensitive, with numbers compared as
// numbers, so wan2 comes before wan10.
function byName(a, b) {
	return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

// Writes only real changes: rewriting unchanged text on every poll would drop
// any selection the reader is making.
function setText(el, txt) {
	if (el.textContent !== txt)
		el.textContent = txt;
}

// Keeps `box` in step with `items`: rows are built once per key, reordered in
// place and patched on every poll, never rebuilt.
function syncRows(box, cache, items, keyFn, buildFn, patchFn) {
	var seen = {}, prev = null;
	items.forEach(function(item, idx) {
		var key = keyFn(item, idx);
		var entry = cache[key];
		seen[key] = true;
		if (!entry) {
			entry = cache[key] = buildFn(item, idx);
			box.insertBefore(entry.el, prev ? prev.nextSibling : box.firstChild);
		}
		else {
			var want = prev ? prev.nextSibling : box.firstChild;
			if (entry.el !== want)
				box.insertBefore(entry.el, want);
		}
		patchFn(entry, item, idx);
		prev = entry.el;
	});
	for (var key in cache) {
		if (!seen[key]) {
			cache[key].el.remove();
			delete cache[key];
		}
	}
}

// True (and remembers `sig`) when `sig` differs from the last one seen.
function sigGate(cache, key, sig) {
	if (cache[key] === sig)
		return false;
	cache[key] = sig;
	return true;
}

function card(title, children, cls) {
	return E('div', { class: 'hw-card' + (cls ? ' ' + cls : '') }, [E('h3', {}, [title])].concat(children || []));
}

// A heading with controls beside it, for cards that carry a toggle.
function cardHead(title, controls) {
	return E('div', { class: 'hw-card-head' }, [E('h3', {}, [title])].concat(controls || []));
}

function statRow(label, value, color, wrap) {
	return E('div', { class: 'hw-stat-row hw-row-sm' + (wrap ? ' hw-row-wrap' : '') }, [
		E('span', { class: 'hw-stat-label' }, [label]),
		E('span', { class: 'hw-stat-value', style: color ? 'color:' + color : null }, [value])
	]);
}

function barRow(label, pct, value, color) {
	var c = color || loadColor(pct);
	return E('div', { class: 'hw-progress-item hw-row-sm' }, [
		E('div', { class: 'hw-progress-header' }, [
			E('span', { class: 'hw-stat-label' }, [label]),
			E('span', { class: 'hw-stat-value', style: 'color:' + c }, [value])
		]),
		E('div', { class: 'hw-bar-bg' }, [
			E('div', { class: 'hw-bar-fill', style: 'width:' + Math.min(pct, 100) + '%; background:' + c })
		])
	]);
}

// A bordered box with a bold title and a detail on the right.
function devBox(title, detail) {
	return E('div', { class: 'hw-box' }, [
		E('div', { class: 'hw-box-head' }, [
			E('span', { class: 'hw-box-title' }, [title]),
			typeof detail === 'string' ? E('span', { class: 'hw-box-detail' }, [detail]) : detail
		])
	]);
}

function sectionTitle(text) {
	return E('h4', { class: 'hw-section-title' }, [text]);
}

function divider() {
	return E('div', { class: 'hw-divider' });
}

// A label on the left and a value on the right.
function kvRow(label) {
	var key = E('span', { class: 'hw-kv-k' }, [label]);
	var val = E('span', { class: 'hw-kv-v' });
	return { el: E('div', { class: 'hw-kv' }, [key, val]), key: key, val: val };
}

// A card with a percentage ring (CPU and memory). `name` is what a screen
// reader announces with the value; the heading can change later.
function dialCard(title, name) {
	var circ = 2 * Math.PI * 70;
	var svg = E('div', {}, '<svg viewBox="0 0 160 160"><circle class="hw-dial-bg" cx="80" cy="80" r="70"/>' +
		'<circle class="hw-dial-progress" cx="80" cy="80" r="70" stroke-dasharray="0 ' + circ + '"/></svg>').firstChild;
	var ring = svg.querySelector('.hw-dial-progress');
	var text = E('div', { class: 'hw-dial-text' }, '0%');
	var sub = E('div', { class: 'hw-dial-subtext' });
	var dial = E('div', { class: 'hw-dial', role: 'img', 'aria-label': name }, [svg, text, sub]);
	var heading = E('h3', {}, [title]);
	var stats = E('div', { class: 'hw-stats-list' });

	return {
		node: E('div', { class: 'hw-card' }, [heading, dial, stats]),
		heading: heading,
		stats: stats,
		set: function(pct, subText) {
			var c = loadColor(pct);
			ring.style.strokeDasharray = (pct / 100 * circ) + ' ' + circ;
			ring.style.stroke = c;
			setText(text, Math.round(pct) + '%');
			text.style.color = c;
			setText(sub, subText || '');
			dial.setAttribute('aria-label', name + ': ' + Math.round(pct) + '%');
		}
	};
}

// Destructive buttons act on the second click; the first asks. Returns true
// when the click should go ahead.
function confirmed(btn, question) {
	if (btn.dataset.armed) {
		clearTimeout(+btn.dataset.armed);
		delete btn.dataset.armed;
		return true;
	}
	var label = btn.textContent;
	btn.textContent = question;
	btn.dataset.armed = setTimeout(function() {
		delete btn.dataset.armed;
		btn.textContent = label;
	}, 4000);
	return false;
}

// Wraps an RPC tick so only one call is in flight. A call stuck for more than
// 10 s is given up on, so a lost reply cannot freeze a card for good.
function single(fn) {
	var since = 0;
	return function() {
		var now = Date.now();
		if (since && now - since < 10000)
			return Promise.resolve();
		since = now;
		var done = function() { since = 0; };
		return Promise.resolve(fn.apply(this, arguments)).then(done, function(err) {
			done();
			console.error(err);
		});
	};
}

// Offers `text` as a file download named hwdash-<what>-<timestamp>.<ext>.
function download(what, ext, text, type) {
	var a = E('a', {
		href: URL.createObjectURL(new Blob([text], { type: type })),
		download: 'hwdash-' + what + '-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.' + ext
	});
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(a.href);
}

function delay(ms) {
	return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

return baseclass.extend({
	isDark: isDark,
	sevColor: sevColor,
	loadColor: loadColor,
	tint: tint,
	fmtBytes: fmtBytes,
	fmtKiB: fmtKiB,
	fmtRate: fmtRate,
	fmtMbps: fmtMbps,
	fmtCache: fmtCache,
	fmtKHz: fmtKHz,
	fmtDuration: fmtDuration,
	fmtDurationFull: fmtDurationFull,
	byName: byName,
	setText: setText,
	syncRows: syncRows,
	sigGate: sigGate,
	card: card,
	cardHead: cardHead,
	statRow: statRow,
	barRow: barRow,
	devBox: devBox,
	sectionTitle: sectionTitle,
	divider: divider,
	kvRow: kvRow,
	dialCard: dialCard,
	confirmed: confirmed,
	single: single,
	delay: delay,
	download: download
});
