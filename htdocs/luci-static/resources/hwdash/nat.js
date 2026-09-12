'use strict';
'require baseclass';
'require rpc';
'require ui as dialog';
'require hwdash.ui as ui';

// What the ISP hands each WAN and what that means for reaching the router
// from outside. The backend does the classification; this presents it.

var callWanIps = rpc.declare({
	object: 'luci.hwdash.wanip',
	method: 'wan_ips',
	expect: {}
});

var callNatTest = rpc.declare({
	object: 'luci.hwdash.ctl',
	method: 'nat_test',
	params: ['iface', 'force'],
	timeout: 25000,
	expect: {}
});

var CLASSES = {
	public:    { label: _('Public IPv4'), sev: 'good', note: _('Publicly routable IPv4 address space. Direct ingress reachability is available; inbound connections and port forwarding operate without hindrance.') },
	cgnat:     { label: _('CG-NAT'), sev: 'warn', note: _('Carrier-Grade Network Address Translation (RFC 6598). Ingress traffic is restricted by the service provider; port forwarding and unsolicited inbound connections are unsupported.') },
	natted:    { label: _('Translated Public Address'), sev: 'warn', note: _('The assigned interface address deviates from the observed Internet egress address, indicating active translation by an upstream routing device.') },
	private:   { label: _('Behind upstream NAT'), sev: 'warn', note: _('Private Address Space (RFC 1918). Non-routable on the public Internet; Network Address Translation (NAT) is actively performed by an upstream gateway.') },
	loopback:  { label: _('Localhost (Loopback)'), sev: 'mute', note: _('Loopback Address Space (RFC 1122). A virtual interface utilised for routing traffic strictly back to the local host system.') },
	thisnet:   { label: _('Current Network'), sev: 'mute', note: _('"This Network" Address Space (RFC 1122). Exclusively utilised for local broadcast communications or during initial dynamic address assignment (DHCP discovery).') },
	protocol:  { label: _('Protocol Assignment'), sev: 'warn', note: _('IETF Protocol Assignments (RFC 6890). Designated for specialised networking protocols, frequently deployed for Dual-Stack Lite (DS-Lite) IPv4-in-IPv6 tunneling.') },
	benchmark: { label: _('ISP Private Routing'), sev: 'warn', note: _('Benchmarking Address Space (RFC 2544). Officially reserved for network performance testing, yet frequently repurposed by service providers for internal private routing.') },
	testnet:   { label: _('TEST-NET (Doc Only)'), sev: 'mute', note: _('TEST-NET Documentation Address Space (RFC 5737). Strictly reserved for utilization within technical documentation and example configurations.') },
	multicast: { label: _('Multicast Network'), sev: 'mute', note: _('Multicast Address Space (RFC 1112). Reserved for one-to-many communication flows, predominantly utilised by routing protocols and IPTV distributions.') },
	reserved:  { label: _('Reserved Address'), sev: 'bad', note: _('Reserved Address Space (RFC 1112). Explicitly restricted from deployment within active public routing tables.') },
	v6only:    { label: _('Public IPv6'), sev: 'good', note: _('Globally Routable IPv6 Address Space (RFC 4291). Provides direct, end-to-end Internet reachability without intermediary address translation.') },
	linklocal: { label: _('Link-local only'), sev: 'bad', note: _('Link-Local Address Space (RFC 3927). Valid exclusively for communication within the local network segment; signifies the absence of a globally routable prefix.') },
	none:      { label: _('No address'), sev: 'bad', note: _('No IP address is currently assigned to this logical interface.') },
	unreachable: { label: _('Egress Unreachable'), sev: 'bad', note: _('The interface is offline or unreachable. Internet egress address and NAT classification cannot be determined.') },
	unknown:   { label: _('Unknown'), sev: 'mute', note: _('The classification of this network address cannot be definitively determined.') }
};

// The names LuCI's own protocol handlers give, so this card and the
// Interfaces page agree; unknown protocols keep their raw name, as in LuCI.
var PROTOCOLS = {
	'464xlat': _('464XLAT (CLAT)'), '6in4': _('IPv6-in-IPv4 (RFC 4213)'), '6rd': _('IPv6-over-IPv4 (6rd)'), '6to4': _('IPv6-over-IPv4 (6to4)'),
	dhcp: _('DHCP client'), dhcpv6: _('DHCPv6 client'), dslite: _('Dual-Stack Lite (RFC 6333)'), ipip6: _('IPv4 over IPv6 (RFC 2473)'),
	l2tp: 'L2TP', map: _('MAP / LW4over6'), none: _('Unmanaged'), ppp: 'PPP', pppoa: 'PPPoATM', pppoe: 'PPPoE', pptp: 'PPtP',
	'static': _('Static address'), wwan: 'WWAN', qmi: _('QMI Cellular'), ncm: 'NCM', mbim: 'MBIM', modemmanager: 'ModemManager',
	wireguard: _('WireGuard VPN'), relay: _('Relay bridge'), gre: 'GRE', gretap: 'GRETAP', grev6: _('GRE over IPv6'),
	grev6tap: _('GRETAP over IPv6'), vxlan: 'VXLAN', vxlan6: _('VXLAN over IPv6'), vti: 'VTI', vti6: _('VTI over IPv6'), xfrm: 'XFRM', unet: 'unet'
};

// RFC 4787 names for mapping and filtering. "Direct" is stunclient's word
// for no translation at all, so it is labelled as that, not as a fourth class.
var TERMS = {
	direct: _('No Translation'),
	endpoint_independent: _('Endpoint-Independent'),
	address_dependent: _('Address-Dependent'),
	address_port_dependent: _('Address and Port-Dependent'),
	unknown: _('Not Determined')
};

var UNAVAILABLE = {
	stunclient_not_installed: _('The optional stuntman-client package is not installed, so no STUN probe can be performed.'),
	invalid_interface: _('The requested interface name is not valid.'),
	not_a_tracked_wan: _('This interface is not tracked as a WAN link, so it is not eligible for testing.'),
	interface_unavailable: _('The interface did not report a status and may be down.')
};

// hasOwnProperty, so a protocol named "constructor" cannot print a function.
function protoLabel(p) {
	return p && Object.prototype.hasOwnProperty.call(PROTOCOLS, p) ? PROTOCOLS[p] : p || '';
}

// A console-style verdict for the chip, with the precise RFC wording as its
// note. IPv4 only: native IPv6 is end-to-end by construction, while the
// tunnel protocols exist because the IPv4 side is CG-NATed.
function verdict(state, mapping, filtering, wanClass) {
	if (wanClass === 'cgnat')
		return { short: _('STRICT · CG-NAT'), level: 'strict', note: _('Carrier-Grade Network Address Translation (RFC 6598). The service provider translates this address upstream, so unsolicited inbound IPv4 connections cannot be delivered.') };
	if (!state)
		return { short: _('NAT TYPE · NOT TESTED'), level: 'unknown', note: _('No measurement has been performed. Run an on-demand STUN test (RFC 5780) to determine the mapping and filtering behaviour of this link.') };
	if (state === 'unavailable')
		return { short: _('NOT AVAILABLE'), level: 'unavailable', note: _('The STUN server did not complete a binding request (RFC 8489, Section 3), so no behaviour could be determined.') };
	if (state === 'unknown')
		return { short: _('NOT DETERMINED'), level: 'unknown', note: _('The STUN server returned an incomplete result. The behaviour discovery procedure defined in RFC 5780 requires responses that this server did not supply.') };
	if (state === 'open' && mapping === 'direct')
		return { short: _('OPEN · NO TRANSLATION'), level: 'open', note: _('No address translation is present on this link. Traffic is routed directly, providing end-to-end reachability (RFC 4787, Section 4.1).') };
	if (state === 'open')
		return { short: _('OPEN · FULL CONE'), level: 'open', note: _('Endpoint-independent mapping with endpoint-independent filtering (RFC 4787, Sections 4.1 and 5). Historically termed a full-cone NAT under RFC 3489, which RFC 4787 supersedes.') };
	if (state === 'moderate' && filtering === 'address_port_dependent')
		return { short: _('MODERATE · PORT RESTRICTED'), level: 'moderate', note: _('Endpoint-independent mapping with address-and-port-dependent filtering (RFC 4787, Sections 4.1 and 5). Historically termed a port-restricted cone NAT under RFC 3489.') };
	if (state === 'moderate')
		return { short: _('MODERATE · RESTRICTED CONE'), level: 'moderate', note: _('Endpoint-independent mapping with address-dependent filtering (RFC 4787, Sections 4.1 and 5). Historically termed a restricted-cone NAT under RFC 3489.') };
	return { short: _('STRICT · SYMMETRIC'), level: 'strict', note: _('Address-and-port-dependent mapping (RFC 4787, Section 4.1). A distinct external port is allocated per destination, which prevents inbound connection establishment; the equivalent TCP requirements are given in RFC 5382.') };
}

function levelColor(level) {
	return ui.sevColor(level === 'open' ? 'good' : level === 'moderate' ? 'warn' : level === 'strict' || level === 'unavailable' ? 'bad' : 'mute');
}

// Device names read in capitals, with the PPP protocols spelled properly.
function chipText(txt) {
	return String(txt || '').toUpperCase().replace(/PPPOE/g, 'PPPoE').replace(/PPPOA/g, 'PPPoA').replace(/PPPOATM/g, 'PPPoATM');
}

function setChip(el, text, show, color) {
	ui.setText(el, text || '');
	el.style.display = show ? '' : 'none';
	if (show) ui.tint(el, color);
}

function message(text, color) {
	return E('div', { class: 'hw-nat-msg', style: color ? 'color:' + color : null }, [text]);
}

function resultBox(title, result, wanClass, wan, parent) {
	var v = verdict(result.state, result.mapping, result.filtering, wanClass), col = levelColor(v.level);
	var local = result.address || (wan && (wan.ip4 || (parent && parent.ip4))) || '—';
	var egress = result.pub && result.pub !== '—' && result.pub !== 'unknown' ? result.pub : (wan && wan.pub4) || (parent && parent.pub4) || '—';
	var fact = function(label, value, color) {
		return E('div', { class: 'hw-nat-fact' }, [E('span', { class: 'hw-nat-fact-k' }, [label]), E('span', { class: 'hw-nat-fact-v', style: 'color:' + color }, [value])]);
	};
	var tag = E('span', { class: 'hw-nat-tag' }, ['UDP / IPv4']);
	var short = E('span', { class: 'hw-nat-verdict' }, [v.short]);
	ui.tint(tag, col);
	short.style.color = col;
	short.style.border = '1px solid ' + col + '66';
	return E('div', { class: 'hw-nat-result', style: 'border-color:' + col + '55; background:' + col + '12' }, [
		E('div', { class: 'hw-nat-result-head' }, [E('div', { class: 'hw-nat-result-title' }, [E('span', { style: 'color:' + col }, [title]), tag]), short]),
		E('div', { class: 'hw-nat-note' }, [v.note]),
		E('div', { class: 'hw-nat-facts' }, [
			fact(_('Local Address'), local, ui.sevColor('info')),
			fact(_('Public Egress'), egress, ui.sevColor('info')),
			fact(_('Mapping'), TERMS[result.mapping] || TERMS.unknown, col),
			fact(_('Filtering'), TERMS[result.filtering] || TERMS.unknown, col),
			// The servers luci.hwdash.ctl tries, in order.
			E('div', { class: 'hw-nat-fact hw-nat-server' }, [E('span', { class: 'hw-nat-fact-k' }, [_('Official STUN Server')]), E('span', {}, ['stun.miwifi.com:3478, ' + _('then') + ' stun.cloudflare.com:3478'])])
		])
	]);
}

function wanRow() {
	var e = {
		name: E('span', { class: 'hw-nat-iface' }),
		devLower: E('span', { class: 'hw-pill hw-mono' }),
		arrow: E('span', { class: 'hw-nat-arrow' }, ['→']),
		devUpper: E('span', { class: 'hw-pill hw-mono' }),
		proto: E('span', { class: 'hw-pill' }),
		assign: E('span', { class: 'hw-pill hw-upper' }),
		cls: E('span', { class: 'hw-pill' }),
		nat: E('span', { class: 'hw-pill' }),
		test: E('button', { type: 'button', class: 'hw-pill hw-pill-btn' }, [_('TEST NAT TYPE')]),
		kv4: ui.kvRow('IPv4'),
		kvPub: ui.kvRow(_('Seen as')),
		kv6: ui.kvRow('IPv6'),
		kvPfx: ui.kvRow(_('Delegated')),
		note: E('div', { class: 'hw-nat-rownote' })
	};
	e.el = E('div', { class: 'hw-sta-row hw-nat-row' }, [
		E('div', { class: 'hw-nat-head' }, [e.name, E('span', { class: 'hw-nat-devs' }, [e.devLower, e.arrow, e.devUpper]), e.proto, e.assign, e.cls, e.nat, e.test]),
		e.kv4.el, e.kvPub.el, e.kv6.el, e.kvPfx.el, e.note
	]);
	return e;
}

// The label takes its value's colour too, so each fact reads as one pair.
function setKv(kv, value, color, dim) {
	ui.setText(kv.val, value || '');
	kv.val.style.color = color || '';
	kv.val.style.opacity = dim ? '0.65' : '';
	kv.key.style.color = color || '';
	kv.el.style.display = value ? '' : 'none';
}

return baseclass.extend({
	create: function(dash) {
		var notice = E('div', { class: 'hw-nat-notice', style: 'display:none' }, [_('Install stuntman-client (Settings → Optional Packages) to test your NAT type.')]);
		var list = E('div', { class: 'hw-nat-list' });
		var node = ui.card(_('NAT Type'), [notice, list], 'wide');
		var rows = {}, byIface = {}, stunOk = false, tick;

		node.style.display = 'none';

		function runTest(iface, wanClass) {
			var content = E('div', { class: 'hw-nat-dialog' }, [
				E('div', { class: 'hw-nat-intro' }, [_('Interface %s is being probed using the STUN behaviour discovery procedure (RFC 5780), which determines the IPv4 mapping and filtering behaviour of the address translation on this link as classified by RFC 4787.').format(iface.toUpperCase())]),
				message(_('Running NAT type test…'), ui.sevColor('info'))
			]);
			dialog.showModal(_('NAT Type Test · %s').format(iface.toUpperCase()), [content, E('div', { class: 'right' }, [
				E('button', { class: 'btn', click: dialog.hideModal }, [_('Close')])
			])]);
			var wan = byIface[iface] || null;
			var parent = wan && (wan.alias_of || wan.parent) ? byIface[wan.alias_of || wan.parent] : null;
			callNatTest(iface, 1).then(function(res) {
				content.textContent = '';
				if (!res || !res.available)
					return content.appendChild(message((res && UNAVAILABLE[res.error]) || _('The NAT type test is unavailable on this interface.'), ui.sevColor('bad')));
				if (res.error)
					return content.appendChild(message(_('NAT test could not run: %s.').format(String(res.error).replace(/_/g, ' ')), ui.sevColor('bad')));
				content.appendChild(res.v4
					? resultBox(_('IPv4 NAT Behaviour (RFC 4787)'), res.v4, wanClass, wan, parent)
					: message(_('No IPv4 address is available on this interface, or its tunnel parent, to test.')));
				// force=1 always measures; the result lands in the cache wan_ips
				// reads, so fetch it to refresh the chip.
				tick();
			}).catch(function(err) {
				content.textContent = '';
				content.appendChild(message(_('NAT test error: %s').format(err ? err.message || String(err) : _('NAT probe timed out or was interrupted.')), ui.sevColor('bad')));
			});
		}

		function patch(e, w) {
			var cls = CLASSES[w.class] || CLASSES.unknown, col = ui.sevColor(cls.sev), dev = ui.sevColor('dev');
			ui.setText(e.name, w.iface.toUpperCase());
			e.name.style.color = col;

			// The device under the interface, and for PPPoE and other tunnels
			// the one built on it: the lower is the port to check, the upper
			// carries the address. Two rows on one device share a wire.
			var lower = w.parent || '', upper = w.device || '', stacked = !!(upper && upper !== lower);
			if (w.alias_of) {
				setChip(e.devLower, chipText(_('Alias of %s').format(w.alias_of)), true, dev);
				setChip(e.devUpper, chipText(upper), !!upper, dev);
				e.arrow.style.display = upper ? '' : 'none';
			}
			else {
				setChip(e.devLower, chipText(lower), !!lower, dev);
				setChip(e.devUpper, chipText(upper), stacked, dev);
				e.arrow.style.display = lower && stacked ? '' : 'none';
			}
			setChip(e.proto, protoLabel(w.proto), !!w.proto, ui.sevColor('proto'));
			setChip(e.cls, cls.label, true, col);
			// Whether the address moves, next to the protocol that decides it.
			setChip(e.assign, w.assign === 'static' ? _('Static') : w.assign === 'dynamic' ? _('Dynamic') : '', w.assign === 'static' || w.assign === 'dynamic', ui.sevColor('assign'));

			// An alias or tunnel inherits its parent's IPv4 and NAT result.
			var parent = w.alias_of || w.parent ? byIface[w.alias_of || w.parent] : null;
			var v4 = w.ip4 || (parent && parent.ip4);
			var state = w.nat4_state || (parent && parent.nat4_state);
			var mute = ui.sevColor('mute');
			if (!v4) {
				e.nat.style.display = 'none';
			}
			else if (!stunOk || (!state && w.class !== 'cgnat')) {
				// CG-NAT is a property of the address, so it is settled even
				// when no probe has run.
				setChip(e.nat, _('NAT TYPE · NOT TESTED'), true, mute);
				e.nat.title = stunOk
					? _('No STUN test has been performed for this interface. Select TEST NAT TYPE to measure the mapping and filtering behaviour of this link (RFC 4787).')
					: _('Install stuntman-client to enable on-demand STUN NAT type testing.');
			}
			else {
				var v = verdict(state, w.nat4_mapping || (parent && parent.nat4_mapping), w.nat4_filtering || (parent && parent.nat4_filtering), w.class);
				setChip(e.nat, v.short, true, levelColor(v.level));
				e.nat.title = v.note;
			}

			var canTest = stunOk && !!v4;
			e.test.style.display = canTest ? '' : 'none';
			if (canTest) {
				var info = ui.sevColor('info');
				e.test.style.color = info;
				e.test.style.borderColor = info + '55';
				e.test.onclick = function() { runTest(w.iface, w.class); };
			}

			// Each address is coloured by what it means: the point of the card
			// is that two addresses on one row can disagree.
			setKv(e.kv4, w.ip4 ? w.ip4 + (w.mask4 && w.mask4 !== '0' ? '/' + w.mask4 : '') : '',
				ui.sevColor(w.class === 'public' ? 'good' : w.class === 'none' ? 'bad' : 'warn'));
			// Only when it differs; then it is the evidence for the verdict.
			setKv(e.kvPub, w.pub4 && w.pub4 !== w.ip4 ? w.pub4 : '', ui.sevColor('info'));
			// fe80:: is not connectivity, so it is labelled and dimmed.
			var linkLocal = !!(w.ip6 && w.ip6.toLowerCase().indexOf('fe80') === 0);
			ui.setText(e.kv6.key, linkLocal ? _('IPv6 link-local') : 'IPv6');
			setKv(e.kv6, w.ip6 || '', linkLocal ? '' : ui.sevColor('good'), linkLocal);
			setKv(e.kvPfx, w.prefix6 ? w.prefix6 + '/' + w.prefix6_len : '', ui.sevColor('good'));
			// Until the egress address is known, a public-looking address can
			// still turn out to be NATed.
			var note = w.class === 'public' && !w.pub4 ? _('Checking the egress address… this can still turn out to be NATed.') : cls.note;
			ui.setText(e.note, note);
			e.note.style.display = note ? '' : 'none';
		}

		function render(res) {
			var wans = (res && res.wans) || [];
			stunOk = !!(res && res.stunclient);
			notice.style.display = stunOk ? 'none' : '';
			if (!stunOk) ui.tint(notice, ui.sevColor('info'));
			// A link-local address is not IPv6 connectivity.
			dash.setHasV6(wans.some(function(w) { return (w.ip6 && w.ip6.toLowerCase().indexOf('fe80') !== 0) || !!w.prefix6; }));

			// By name: the collector lists interfaces in discovery order.
			wans = wans.filter(function(w) { return !dash.isIfaceHidden(w.iface, w.alias_of); })
				.sort(function(a, b) { return ui.byName(a.iface, b.iface); });
			byIface = {};
			wans.forEach(function(w) { byIface[w.iface] = w; });
			node.style.display = wans.length ? 'flex' : 'none';
			ui.syncRows(list, rows, wans, function(w) { return w.iface; }, wanRow, patch);
		}

		tick = ui.single(function() { return callWanIps().then(render); });

		return {
			cards: { wan_ips: node },
			tick: tick
		};
	}
});
