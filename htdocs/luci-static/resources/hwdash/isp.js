'use strict';
'require baseclass';
'require hwdash.ui as ui';

// Who the ISP behind a WAN is, and the badge that shows it. The registry name
// ("AIRTELBROADBAND-AS-AP - Bharti Airtel Ltd., ...") is accurate but written
// for operators, so well-known ones get a readable name; the registry string
// stays available as a tooltip. All maps match against that whole string,
// handle included, so one key covers every ASN an operator holds.

function icon(name, v) {
	return L.resource('hwdash-icons/' + name) + '?v=' + v;
}

// Bundled logos render offline and without a third-party service. gtpl comes
// before hathway everywhere: GTPL Hathway is GTPL.
var LOGOS = {
	airtel: icon('airtel.png', 1), bharti: icon('airtel.png', 1),
	jio: icon('jio.png', 1), reliance: icon('jio.png', 1),
	bsnl: icon('bsnl.png', 3),
	gtpl: icon('gtpl.png', 2),
	railtel: icon('railwire.png', 2), railwire: icon('railwire.png', 2),
	excitel: icon('excitel.png', 1),
	netplus: icon('netplus.svg', 4)
};

// For everyone else, logos.hunter.io by domain; a coloured monogram shows
// while it loads or if it fails.
var DOMAINS = {
	airtel: 'airtel.in', bharti: 'airtel.in',
	jio: 'jio.com', reliance: 'jio.com',
	vodafone: 'myvi.in', ' vi ': 'myvi.in',
	bsnl: 'bsnl.co.in',
	excitel: 'excitel.com',
	gtpl: 'gtpl.net',
	railtel: 'railwire.co.in', railwire: 'railwire.co.in',
	hathway: 'hathway.com',
	comcast: 'xfinity.com', xfinity: 'xfinity.com',
	verizon: 'verizon.com',
	't-mobile': 't-mobile.com',
	spectrum: 'spectrum.com',
	cox: 'cox.com'
};

var NAMES = {
	airtel: 'Bharti Airtel', bharti: 'Bharti Airtel',
	jio: 'Reliance Jio', reliance: 'Reliance Jio',
	bsnl: 'BSNL',
	vodafone: 'Vodafone Idea', idea: 'Vodafone Idea',
	gtpl: 'GTPL Hathway',
	railtel: 'RailWire', railwire: 'RailWire',
	hathway: 'Hathway',
	excitel: 'Excitel', tikona: 'Tikona',
	netplus: 'Netplus Broadband',
	comcast: 'Comcast Xfinity', xfinity: 'Comcast Xfinity',
	verizon: 'Verizon', 't-mobile': 'T-Mobile',
	spectrum: 'Spectrum', cox: 'Cox Communications',
	'at&t': 'AT&T'
};

// Monogram colour and letters: [match terms, colour, label].
var MONOGRAMS = [
	[['airtel', 'bharti'], '#ED1B24', 'A'],
	[['jio', 'reliance'], '#0F1C4D', 'Jio'],
	[['vodafone', 'idea', ' vi '], '#E60000', 'Vi'],
	[['bsnl'], '#004C97', 'BSNL'],
	[['excitel'], '#F26522', 'E'],
	[['gtpl'], '#1B75BC', 'GTPL'],
	[['railtel', 'railwire'], '#00AEEF', 'RW'],
	[['wish net private'], '#DA252B', 'WN'],
	[['hathway'], '#E31E24', 'HW'],
	[['comcast', 'xfinity'], '#111827', 'X'],
	[['at&t'], '#00A8E0', 'AT&T'],
	[['verizon'], '#CD040B', 'V']
];

// Small local ISPs no logo service knows, pinned by ASN. AS45775 in
// particular: a name match on "wishnet" would also hit AS59034, a Chinese
// network of the same name.
var BY_ASN = {
	AS151690: { color: '#c9432e', label: 'F5', name: 'FAB Five Network', logo: icon('fabfive.png', 1) },
	AS133661: { color: '#da252b', label: 'NP', name: 'Netplus Broadband', logo: icon('netplus.svg', 4) },
	AS45775:  { color: '#DA252B', label: 'WN', name: 'Wish Net', domain: 'wishnet.in', logo: icon('wishnet.png', 2) },
	AS56209:  { color: '#003979', label: 'AL', name: 'Airlink Teleservices', logo: icon('airlink.png', 1) },
	AS18207:  { color: '#ed2d3e', label: 'YB', name: 'YOU Broadband', logo: icon('youbroadband.png', 1) }
};

// When the lookup has nothing yet, an interface named after its ISP is a
// good enough hint. Excitel has no ASN here: the only candidate found,
// AS134889, belongs to someone else.
var IFACE_HINTS = [
	[['jio', 'reliance'], 'Reliance Jio Infocomm', 'AS55836'],
	[['netplus'], 'Netplus Broadband', 'AS133661'],
	[['airtel', 'bharti'], 'Bharti Airtel Ltd.', 'AS24560'],
	[['bsnl'], 'BSNL', 'AS9829'],
	[['railwire', 'railtel'], 'RailWire', 'AS24186'],
	[['excitel'], 'Excitel Broadband', '']
];

function hasAny(text, terms) {
	return terms.some(function(t) { return text.indexOf(t) !== -1; });
}

function firstMatch(map, text) {
	for (var key in map)
		if (text.indexOf(key) !== -1)
			return map[key];
	return '';
}

// `isp` is "AS1234 | Org name" from the collector, or just the name.
function identify(isp, iface) {
	var raw = isp || '', asn = '', org = raw;
	if (raw.indexOf(' | ') !== -1) {
		var parts = raw.split(' | ');
		asn = parts[0];
		org = parts[1];
	}
	if (!org && iface) {
		var lower = iface.toLowerCase();
		IFACE_HINTS.some(function(h) {
			if (hasAny(lower, h[0])) { org = h[1]; asn = h[2]; return true; }
		});
	}
	var text = org.toLowerCase();
	var full = org.trim() || _('Unknown ISP');
	var name = firstMatch(NAMES, text) || full;

	var pinned = BY_ASN[asn];
	if (pinned)
		return { color: pinned.color, label: pinned.label, name: pinned.name || name, full: full, asn: asn, domain: pinned.domain || '', logo: pinned.logo || '' };

	var color = '#607d8b', label = name.charAt(0).toUpperCase() || '?';
	MONOGRAMS.some(function(m) {
		if (hasAny(text, m[0])) { color = m[1]; label = m[2]; return true; }
	});
	return { color: color, label: label, name: name, full: full, asn: asn, domain: firstMatch(DOMAINS, text), logo: firstMatch(LOGOS, text) };
}

// Whether a logo needs a white tile on a dark card is a property of the
// artwork, so measure it: the median of each opaque pixel's brightest channel.
// Channel value rather than luminance, which ranks Airtel's vivid red below
// RailWire's near-invisible grey. Measured medians: wishnet 11, railwire 64 |
// jio 144, gtpl 165, fabfive 204, airtel 233, bsnl 241. A remote logo taints
// the canvas and cannot be read, so it keeps the tile.
var TILE_BELOW = 110;

function needsTile(img) {
	try {
		var c = document.createElement('canvas');
		c.width = c.height = 32;
		var ctx = c.getContext('2d');
		ctx.drawImage(img, 0, 0, 32, 32);
		var d = ctx.getImageData(0, 0, 32, 32).data, vals = [];
		for (var i = 0; i < d.length; i += 4)
			if (d[i + 3] >= 128)
				vals.push(Math.max(d[i], d[i + 1], d[i + 2]));
		if (!vals.length)
			return true;
		vals.sort(function(a, b) { return a - b; });
		return vals[vals.length >> 1] < TILE_BELOW;
	}
	catch (e) {
		return true;
	}
}

// The round ISP badge: bundled logo first, then the remote one, and the
// monogram as the last resort, so it is never empty.
function badge() {
	var mono = E('span', { class: 'hw-isp-mono' });
	var img = E('img', { class: 'hw-isp-logo', alt: '', style: 'display:none' });

	img.onload = function() {
		img.classList.toggle('hw-isp-tile', ui.isDark() && needsTile(img));
		mono.style.display = 'none';
		img.style.display = '';
	};
	img.onerror = function() {
		var alt = img.dataset.fallback;
		if (alt && img.src.indexOf(alt) === -1) {
			img.dataset.fallback = '';
			img.src = alt;
			return;
		}
		img.style.display = 'none';
		mono.style.display = '';
		img.dataset.src = '';
	};

	return {
		el: E('div', { class: 'hw-isp-badge' }, [mono, img]),
		set: function(id) {
			mono.style.background = id.color;
			ui.setText(mono, id.label);
			var remote = id.domain ? 'https://logos.hunter.io/' + id.domain : '';
			var src = id.logo || remote;
			if (src && img.dataset.src !== src) {
				img.dataset.src = src;
				img.dataset.fallback = id.logo && remote ? remote : '';
				img.style.display = 'none';
				mono.style.display = '';
				img.src = src;
			}
			else if (!src && img.dataset.src) {
				img.dataset.src = '';
				img.style.display = 'none';
				mono.style.display = '';
			}
		}
	};
}

return baseclass.extend({
	identify: identify,
	badge: badge
});
