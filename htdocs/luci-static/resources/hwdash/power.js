'use strict';
'require baseclass';
'require hwdash.ui as ui';

// Voltage rails, fans, PWM duty, power and current from hwmon, plus x86 RAPL
// energy counters. Most routers expose none of it and the card stays hidden.

function reading(item) {
	switch (item.unit) {
	case 'V': return (item.val / 1000).toFixed(2) + ' V';
	case 'A': return (item.val / 1000).toFixed(2) + ' A';
	case 'W': return item.val === null ? '—' : (item.val / 1e6).toFixed(2) + ' W';
	case '%': return item.duty + ' %';
	case 'RPM': return item.val + ' RPM' + (item.duty >= 0 ? ' · ' + item.duty + ' %' : '');
	}
	return '';
}

return baseclass.extend({
	create: function() {
		var list = E('div', { class: 'hw-stats-list' });
		var node = ui.card(_('Power & Fans'), [list]);
		var rows = {}, lastEnergy = {};
		var RAPL_NAMES = {
			'package-0': _('Package Power'),
			'package-1': _('Package Power (1)'),
			core: _('Core Power'),
			dram: _('DRAM Power')
		};

		node.style.display = 'none';

		return {
			cards: { hwmon: node },
			update: function(info) {
				var items = (info.hwmon_extra || []).filter(function(h) { return /^(V|RPM|W|A|%)$/.test(h.unit); });
				var now = Date.now();

				// RAPL counts microjoules; watts are the change between polls.
				// The counter wraps at max_uj (about hourly at 65 W).
				(info.rapl || []).forEach(function(z) {
					var prev = lastEnergy[z.name], watts = null;
					if (prev) {
						var dt = (now - prev.t) / 1000, dE = z.energy_uj - prev.uj;
						if (dE < 0 && z.max_uj > 0) dE += z.max_uj;
						if (dt > 0 && dE >= 0) watts = dE / 1e6 / dt;
					}
					lastEnergy[z.name] = { uj: z.energy_uj, t: now };
					// Listed from the first poll so the card does not grow a row later.
					items.push({ name: RAPL_NAMES[z.name] || _('%s Power').format(z.name), val: watts === null ? null : watts * 1e6, unit: 'W' });
				});

				node.style.display = items.length ? 'flex' : 'none';
				ui.syncRows(list, rows, items, function(h, i) { return h.name + '|' + i; }, function(h) {
					var val = E('span', { class: 'hw-stat-value' });
					return { el: E('div', { class: 'hw-stat-row' }, [E('span', { class: 'hw-stat-label' }, [h.name]), val]), val: val };
				}, function(row, h) {
					ui.setText(row.val, reading(h));
					row.val.style.color = h.alarm ? '#ff5252' : '';
					row.val.title = h.alarm ? _('The sensor driver reports an alarm for this reading') : '';
				});
			}
		};
	}
});
