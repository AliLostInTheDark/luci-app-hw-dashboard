'use strict';
'require view';
'require poll';
'require rpc';
'require fs';
'require hwdash.ui as ui';
'require hwdash.alerts as alerts';
'require hwdash.system as system';
'require hwdash.cpu as cpu';
'require hwdash.memory as memory';
'require hwdash.power as power';
'require hwdash.storage as storage';
'require hwdash.ports as ports';
'require hwdash.ping as ping';
'require hwdash.wan as wan';
'require hwdash.wifi as wifi';
'require hwdash.clients as clients';
'require hwdash.nat as nat';
'require hwdash.thermal as thermal';
'require hwdash.settings as settings';
'require hwdash.layout as layout';

// The Hardware Dashboard page. Every card lives in its own hwdash/*.js module;
// this file places them, holds the settings and runs the polling.

var callInfo = rpc.declare({
	object: 'luci.hwdash',
	method: 'info',
	params: ['skip'],
	expect: {}
});

var callGetConfig = rpc.declare({
	object: 'luci.hwdash.ctl',
	method: 'get_config',
	expect: {}
});

var callSetConfig = rpc.declare({
	object: 'luci.hwdash.ctl',
	method: 'set_config',
	params: ['config'],
	expect: {}
});

var DEFAULT_WAN4 = '1.1.1.1';
var DEFAULT_WAN6 = '2606:4700:4700::1111';

// Parts of the info reply the router can skip, with the cards that read each.
// A part is only fetched while one of its cards is visible.
var SECTIONS = {
	storage: ['storage', 'alerts'],
	thermal: ['thermal', 'alerts'],
	ports: ['ports', 'alerts'],
	usb: ['ports'],
	hwmon: ['hwmon'],
	pcie: ['alerts'],
	ext: ['ext'],
	wifi: ['wifi']
};

// Cards shown whenever they are not hidden; the rest appear when their data
// says there is something to show.
var ALWAYS_SHOWN = ['sysinfo', 'cpu', 'ram', 'load', 'cores', 'storage'];

function list(v) {
	return Array.isArray(v) ? v : [];
}

return view.extend({
	load: function() {
		var css = new Promise(function(resolve) {
			var link = E('link', { rel: 'stylesheet', href: L.resource('hwdash/hwdash.css') + (L.env.resource_version ? '?v=' + L.env.resource_version : '') });
			link.onload = link.onerror = resolve;
			document.head.appendChild(link);
		});
		return Promise.all([L.resolveDefault(fs.lines('/proc/stat'), []), L.resolveDefault(callGetConfig(), {}), css]);
	},

	applyConfig: function(cfg) {
		this.hiddenCards = list(cfg.hidden);
		this.pingTargets = list(cfg.targets);
		this.disabledPings = list(cfg.disabledPings);
		this.disabledFams = list(cfg.disabledFams);
		// "!iface" entries forced a WAN visible against an auto-hide that no
		// longer exists, so they mean nothing now.
		this.hiddenWanIfaces = list(cfg.wanHidden).filter(function(x) { return String(x).charAt(0) !== '!'; });
		this.wanTarget4 = typeof cfg.wanTarget4 === 'string' && cfg.wanTarget4 ? cfg.wanTarget4 : DEFAULT_WAN4;
		this.wanTarget6 = typeof cfg.wanTarget6 === 'string' && cfg.wanTarget6 ? cfg.wanTarget6 : DEFAULT_WAN6;
		this.persistDir = typeof cfg.persistDir === 'string' ? cfg.persistDir : '';
		this.cardOrder = list(cfg.cardOrder);
		this.cardSize = cfg.cardSize && typeof cfg.cardSize === 'object' && !Array.isArray(cfg.cardSize) ? cfg.cardSize : {};
	},

	// Resolves to the router's {result} either way, so a failed write can
	// never be reported as saved.
	saveConfig: function() {
		return callSetConfig({
			hidden: this.hiddenCards,
			targets: this.pingTargets,
			disabledPings: this.disabledPings,
			disabledFams: this.disabledFams,
			wanHidden: this.hiddenWanIfaces,
			wanTarget4: this.wanTarget4 || DEFAULT_WAN4,
			wanTarget6: this.wanTarget6 || DEFAULT_WAN6,
			persistDir: this.persistDir,
			cardOrder: this.cardOrder,
			cardSize: this.cardSize
		}).then(function(r) {
			return r && r.result ? r : { result: 'error' };
		}, function() {
			return { result: 'error' };
		});
	},

	fetchConfig: function() {
		return callGetConfig().then(function(cfg) { return cfg || {}; });
	},

	fetchInfo: function() {
		return callInfo('');
	},

	isHidden: function(key) {
		return this.hiddenCards.indexOf(key) !== -1;
	},

	setHidden: function(key, hidden) {
		this.hiddenCards = this.hiddenCards.filter(function(k) { return k !== key; });
		if (hidden)
			this.hiddenCards.push(key);
	},

	isIfaceHidden: function(iface, aliasOf) {
		return this.hiddenWanIfaces.indexOf(iface) !== -1 || (!!aliasOf && this.hiddenWanIfaces.indexOf(aliasOf) !== -1);
	},

	applyCardVisibility: function() {
		for (var key in this.cards) {
			var c = this.cards[key];
			if (this.isHidden(key))
				c.node.style.display = 'none';
			else if (c.always)
				c.node.style.display = '';
		}
		for (key in this.views) {
			var off = this.isHidden(key);
			this.views[key].node.style.display = off ? 'none' : '';
			this.views[key].button.textContent = off ? _('SHOW GRAPH') : _('HIDE GRAPH');
		}
	},

	// The graph switches on the cards save at once: they are a view choice
	// made on the card, not a staged setting.
	toggleView: function(key) {
		this.setHidden(key, !this.isHidden(key));
		this.applyCardVisibility();
		this.saveConfig();
	},

	setHasV6: function(v6) {
		if (this.hasV6 !== v6) {
			this.hasV6 = v6;
			this.settings.renderTargetList();
		}
	},

	render: function(data) {
		var dash = this;
		dash.statLines = data[0];
		dash.applyConfig(data[1] || {});
		dash.pingHist = {};

		var mods = {
			alerts: alerts.create(dash),
			system: system.create(dash),
			cpu: cpu.create(dash),
			memory: memory.create(dash),
			power: power.create(dash),
			storage: storage.create(dash),
			ports: ports.create(dash),
			ping: ping.create(dash),
			wan: wan.create(dash),
			wifi: wifi.create(dash),
			clients: clients.create(dash),
			nat: nat.create(dash),
			thermal: thermal.create(dash)
		};
		var infoMods = [mods.system, mods.cpu, mods.memory, mods.power, mods.storage, mods.ports, mods.wifi, mods.thermal];

		// Default order. Alerts lead: if something is wrong it should be the
		// first thing on the page.
		var CARDS = [
			['alerts', _('Alerts')], ['sysinfo', _('System Info')], ['cpu', _('CPU')], ['ram', _('Memory')],
			['load', _('CPU Detailed Load')], ['cores', _('Per-Core Usage')], ['hwmon', _('Power & Fans')],
			['storage', _('Internal Storage')], ['ext', _('External Storage')], ['ports', _('Ports Topology')],
			['ping', _('Ping Latency')], ['wan_quality', _('WAN Uptime Status')], ['ap_stats', _('AP Mode')],
			['wifi', _('Wi-Fi PHY & Spectrum')], ['wifi_clients', _('Wi-Fi Clients')], ['wan_ips', _('NAT Type')],
			['thermal', _('Thermal Sensors')]
		];

		var nodes = {};
		dash.views = {};
		Object.keys(mods).forEach(function(m) {
			var mod = mods[m];
			for (var k in mod.cards) nodes[k] = mod.cards[k];
			for (k in mod.views || {}) dash.views[k] = mod.views[k];
		});
		dash.cards = {};
		CARDS.forEach(function(c) {
			dash.cards[c[0]] = { node: nodes[c[0]], label: c[1], always: ALWAYS_SHOWN.indexOf(c[0]) !== -1 };
		});
		dash.renderAlerts = mods.alerts.render;

		var container = E('div', { id: 'hw-dashboard', class: 'hw-dashboard' });
		var stale = E('div', { class: 'hw-stale', role: 'status', style: 'display:none' });
		dash.settings = settings.create(dash, CARDS.map(function(c) { return { key: c[0], label: c[1] }; }));
		var bar = E('div', { class: 'hw-topbar' }, [
			E('button', { type: 'button', class: 'cbi-button', click: dash.settings.toggle }, [_('⚙ Settings')])
		]);
		container.appendChild(bar);
		container.appendChild(stale);
		container.appendChild(dash.settings.panel);
		CARDS.forEach(function(c) { container.appendChild(dash.cards[c[0]].node); });
		dash.layout = layout.create(dash, container, dash.cards);
		bar.appendChild(dash.layout.button);
		dash.applyCardVisibility();

		var activeInfo = function() {
			return infoMods.filter(function(m) {
				return Object.keys(m.cards).some(function(k) { return !dash.isHidden(k); });
			});
		};
		var infoWanted = function() {
			return activeInfo().length > 0 || !dash.isHidden('alerts');
		};
		var skipList = function() {
			return Object.keys(SECTIONS).filter(function(s) {
				return SECTIONS[s].every(function(k) { return dash.isHidden(k); });
			}).join(',');
		};

		// When the router stops answering, say so, rather than leaving the
		// last values up as if they were live.
		var lastOk = Date.now();
		var checkStale = function() {
			var late = Date.now() - lastOk > 10000;
			stale.style.display = late ? '' : 'none';
			if (late)
				ui.setText(stale, _('The router is not responding. Showing data from %s.').format(new Date(lastOk).toLocaleTimeString()));
		};
		document.addEventListener('visibilitychange', function() {
			if (!document.hidden)
				lastOk = Date.now();
		});

		var infoTick = ui.single(function() {
			var active = activeInfo();
			return callInfo(skipList()).then(function(info) {
				if (!info || !info.cpus)
					return;
				lastOk = Date.now();
				checkStale();
				dash.lastInfo = info;
				active.forEach(function(m) { m.update(info); });
				dash.renderAlerts();
				dash.applyCardVisibility();
			});
		});

		dash.refresh = function() {
			if (infoWanted()) infoTick();
			if (!dash.isHidden('wan_ips')) mods.nat.tick();
		};

		// One poll entry runs every fetch on its own phase, so at most two
		// shell calls start together: WAN quality and ping on alternate
		// seconds, info every 3 s, Wi-Fi clients every 6 s and WAN addresses,
		// which change on the order of hours, every 30 s. Those last two land
		// on counts that are never a multiple of 3, so never on an info tick.
		var count = 0;
		if (dash.pollFn)
			poll.remove(dash.pollFn);
		dash.pollFn = function() {
			if (document.hidden)
				return Promise.resolve();
			count++;
			if (count % 2 === 1) {
				if (!dash.isHidden('wan_quality')) mods.wan.tick();
			}
			else if (!dash.isHidden('ping')) {
				mods.ping.tick();
			}
			if (count % 3 === 0 && infoWanted()) {
				checkStale();
				infoTick();
			}
			if (count % 6 === 1 && !dash.isHidden('wifi_clients'))
				mods.clients.tick();
			if (count % 30 === 5 && !dash.isHidden('wan_ips'))
				mods.nat.tick();
			return Promise.resolve();
		};
		poll.add(dash.pollFn, 1);
		if (infoWanted())
			infoTick();

		return container;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
