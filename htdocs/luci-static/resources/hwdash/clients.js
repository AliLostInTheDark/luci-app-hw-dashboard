'use strict';
'require baseclass';
'require rpc';
'require hwdash.ui as ui';

// Associated stations, polled on their own slower tick: the backend pays one
// fork per VAP for the station dump.

var callClients = rpc.declare({
	object: 'luci.hwdash.wifi',
	method: 'wifi_clients',
	expect: {}
});

function signalColor(dbm) {
	return dbm >= -55 ? '#69f0ae' : dbm >= -65 ? '#b2ff59' : dbm >= -72 ? '#ffee58' : dbm >= -80 ? '#ffb300' : '#ff7043';
}

// Fixed-width metric columns, so rows line up and nothing jumps sideways
// when a rate goes from "12 / 48" to "1922 / 2402".
function cell(label, width, big) {
	var val = E('span', { class: 'hw-sta-val' + (big ? ' hw-sta-val-big' : '') });
	return {
		el: E('div', { class: 'hw-sta-cell', style: 'flex: 0 0 ' + width + 'px; width: ' + width + 'px' }, [val, E('span', { class: 'hw-sta-lbl' }, [label])]),
		val: val
	};
}

function stationRow() {
	var e = {
		name: E('span', { class: 'hw-sta-name' }),
		mac: E('span', { class: 'hw-sta-mac' }),
		phy: E('span', { class: 'hw-sta-phy' }),
		signal: E('span', { class: 'hw-sta-val hw-sta-val-big' }),
		bar: E('div', { class: 'hw-sta-bar' }),
		rate: cell(_('TX / RX Rate'), 104, true),
		data: cell(_('TX / RX Data'), 152),
		age: cell(_('Connected'), 76)
	};
	var signal = E('div', { class: 'hw-sta-cell', style: 'flex: 0 0 78px; width: 78px' }, [
		e.signal, E('div', { class: 'hw-sta-track' }, [e.bar]), E('span', { class: 'hw-sta-lbl' }, [_('Signal')])
	]);
	e.el = E('div', { class: 'hw-sta-row' }, [
		E('div', { class: 'hw-sta-id' }, [e.name, e.mac, e.phy]),
		E('div', { class: 'hw-sta-metrics' }, [signal, e.rate.el, e.data.el, e.age.el])
	]);
	return e;
}

function patchStation(e, c) {
	ui.setText(e.name, c.host || c.mac);
	ui.setText(e.mac, (c.host ? c.mac + '  •  ' : '') + c.iface);
	var dbm = c.signal || 0, color = signalColor(dbm);
	ui.setText(e.signal, dbm + ' dBm');
	e.signal.style.color = color;
	// -90 dBm (unusable) to -30 dBm (next to the AP) across the bar.
	e.bar.style.width = Math.max(0, Math.min(100, (dbm + 90) / 60 * 100)).toFixed(0) + '%';
	e.bar.style.background = color;
	ui.setText(e.rate.val, (c.tx_rate || 0).toFixed(0) + ' / ' + (c.rx_rate || 0).toFixed(0));
	ui.setText(e.data.val, ui.fmtBytes(c.tx_bytes || 0) + ' / ' + ui.fmtBytes(c.rx_bytes || 0));
	ui.setText(e.age.val, ui.fmtDuration(c.conn || 0));
	// An idle station stops reporting a bitrate; keep the last one seen
	// rather than letting the line rewrite itself every poll.
	if (c.tx_info) e.lastTx = c.tx_info;
	if (c.rx_info) e.lastRx = c.rx_info;
	var bits = ['TX ' + (e.lastTx || '—'), 'RX ' + (e.lastRx || '—')];
	if (c.tx_failed) bits.push(_('tx failed %d').format(c.tx_failed));
	if (!c.auth) bits.push(_('not authorized'));
	ui.setText(e.phy, bits.join('   •   '));
}

return baseclass.extend({
	create: function() {
		var list = E('div', { class: 'hw-sta-list' });
		var empty = E('div', { class: 'hw-empty', style: 'display:none' }, [_('No stations associated.')]);
		var node = ui.card(_('Wi-Fi Clients'), [list, empty], 'wide');
		var rows = {};

		node.style.display = 'none';

		function render(res) {
			// Without iw the card could never say anything.
			if (!res || !res.available) {
				node.style.display = 'none';
				return;
			}
			node.style.display = 'flex';
			// By radio, then MAC; never by signal, which moves every poll.
			var stations = (res.clients || []).slice().sort(function(a, b) {
				return a.iface !== b.iface ? (a.iface < b.iface ? -1 : 1) : (a.mac < b.mac ? -1 : a.mac > b.mac ? 1 : 0);
			});
			empty.style.display = stations.length ? 'none' : '';
			ui.syncRows(list, rows, stations, function(c) { return c.iface + '/' + c.mac; }, stationRow, patchStation);
		}

		return {
			cards: { wifi_clients: node },
			tick: ui.single(function() { return callClients().then(render); })
		};
	}
});
