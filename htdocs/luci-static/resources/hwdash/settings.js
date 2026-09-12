'use strict';
'require baseclass';
'require rpc';
'require hwdash.ui as ui';
'require hwdash.ping as ping';

// The settings panel. Changes show on the page straight away as a preview but
// reach the router only on Save; Revert re-reads what is saved, and Reset
// returns everything to defaults and saves that.

var callPkgStatus = rpc.declare({
	object: 'luci.hwdash.ctl',
	method: 'pkg_status',
	expect: {}
});

var callPkgAction = rpc.declare({
	object: 'luci.hwdash.ctl',
	method: 'pkg_action',
	params: ['pkg', 'op'],
	expect: {}
});

// Optional extras: every card works without them. Each gets its own button
// because apk installs a list all or nothing, so one name missing for this
// architecture would install none of the rest. The router decides what is
// offered, and luci.hwdash.ctl only runs apk on the names in its own list.
var PACKAGES = [
	['stuntman-client', _('NAT Type Test — the STUN probe behind the TEST NAT TYPE button')],
	['ethtool-full', _('Per-port negotiated flow control and EEE state in Ports Topology')],
	['smartmontools', _('NVMe/SATA SMART health: wear, TBW, spare, power-on hours')],
	['lscpu', _('CPU core name on ARM (e.g. Cortex-A73) — the only source for it')],
	['dmidecode', _('Memory speed in the Memory card — x86 only')],
	['kmod-hwmon-nct6775', _('Motherboard fans, fan duty and voltage rails in Power & Fans — Nuvoton Super I/O, x86 only')],
	['kmod-hwmon-it87', _('Motherboard fans, fan duty and voltage rails in Power & Fans — ITE Super I/O, x86 only')]
];

var REFUSED = {
	busy: _('Another package job is still running.'),
	required: _('Other installed packages still need it.'),
	unavailable: _('Not available for this router.'),
	present: _('Already present on the router outside apk.'),
	invalid: _('The router rejected the request.')
};

// LuCI's own CBI markup, so the theme styles this like every settings page.
function section(title, descr, body) {
	var kids = [E('h3', {}, [title])];
	if (descr) kids.push(E('div', { class: 'cbi-section-descr' }, [descr]));
	kids.push(E('div', { class: 'cbi-section-node' }, body));
	return E('div', { class: 'cbi-section' }, kids);
}

function field(label, input) {
	return E('div', { class: 'cbi-value' }, [E('label', { class: 'cbi-value-title' }, [label]), E('div', { class: 'cbi-value-field' }, [input])]);
}

function checkbox(checked, onChange) {
	var cb = E('input', { type: 'checkbox', change: onChange });
	cb.checked = checked;
	return cb;
}

function checkLabel(cb, text, tip) {
	return E('label', { class: 'hw-tgt' }, [cb, E('span', { class: 'hw-tgt-name', title: tip || null }, [text])]);
}

return baseclass.extend({
	create: function(dash, cards) {
		var panel = E('div', { class: 'cbi-map hw-settings', style: 'display:none' });
		var msg = E('span', { class: 'hw-settings-msg' });
		var say = function(text, color) {
			msg.textContent = text || '';
			msg.style.color = color || '';
		};
		var markDirty = function() { say(_('Unsaved changes — press Save to apply.'), '#ffb300'); };
		// Ping history is per target, so it starts over whenever targets change.
		var targetsChanged = function() {
			markDirty();
			dash.pingHist = {};
		};

		// --- Visible cards, alphabetical by the label you read ---------------
		var cardBoxes = {};
		var cardGrid = E('div', { class: 'hw-check-grid' });
		cards.slice().sort(function(a, b) { return ui.byName(a.label, b.label); }).forEach(function(c) {
			cardBoxes[c.key] = checkbox(!dash.isHidden(c.key), function(ev) {
				dash.setHidden(c.key, !ev.target.checked);
				markDirty();
				dash.applyCardVisibility();
				if (ev.target.checked)
					dash.refresh();
			});
			cardGrid.appendChild(checkLabel(cardBoxes[c.key], c.label));
		});
		panel.appendChild(section(_('Visible Cards'), _('Cards not selected here are hidden from the dashboard.'), [cardGrid]));

		// --- WAN interfaces, filled in once the uptime data arrives ----------
		var wanGrid = E('div', { class: 'hw-check-grid' });
		var wanSection = section(_('WAN Uptime Status Interfaces'), _('Which WAN interfaces the uptime, NAT type and alert cards report on.'), [wanGrid]);
		var wanBoxes = {};
		wanSection.style.display = 'none';
		panel.appendChild(wanSection);

		function syncWanIfaces(list) {
			wanSection.style.display = list.length ? '' : 'none';
			ui.syncRows(wanGrid, wanBoxes, list, function(r) { return r.iface; }, function(r) {
				var cb = checkbox(true, function(ev) {
					dash.hiddenWanIfaces = dash.hiddenWanIfaces.filter(function(x) { return x !== r.iface; });
					if (!ev.target.checked)
						dash.hiddenWanIfaces.push(r.iface);
					markDirty();
				});
				return { el: checkLabel(cb, r.iface.toUpperCase()), cb: cb };
			}, function(e, r) {
				e.cb.checked = dash.hiddenWanIfaces.indexOf(r.iface) === -1;
			});
		}

		// --- Ping targets, one box per address family -------------------------
		var targetList = E('div');

		function targetRow(host, fam, label, customIdx) {
			var key = host + '|' + fam;
			var cb = checkbox(dash.disabledPings.indexOf(key) === -1, function(ev) {
				dash.disabledPings = dash.disabledPings.filter(function(x) { return x !== key; });
				if (!ev.target.checked)
					dash.disabledPings.push(key);
				targetsChanged();
			});
			var row = checkLabel(cb, label, label);
			if (customIdx >= 0) {
				row.appendChild(E('button', { type: 'button', class: 'hw-tgt-x', title: _('Remove target'), 'aria-label': _('Remove target'), click: function() {
					dash.pingTargets.splice(customIdx, 1);
					dash.disabledPings = dash.disabledPings.filter(function(x) { return x !== key; });
					targetsChanged();
					renderTargetList();
				} }, ['×']));
			}
			return row;
		}

		// The two families fail for different reasons, so the common job is
		// "turn one family off". Its switch greys the targets out in place,
		// keeping each one's own choice for when it comes back.
		function famBox(fam) {
			var body = E('div');
			var group = function(title, items) {
				if (!items.length) return;
				body.appendChild(E('div', { class: 'hw-fam-group' }, [title]));
				body.appendChild(E('div', { class: 'hw-tgt-grid' }, items));
			};
			var inFam = function(t) { return ping.expandFams(t).indexOf(fam) !== -1; };
			group(_('Default'), ping.DEFAULT_TARGETS.filter(inFam).map(function(t) { return t.host; }).sort(ui.byName)
				.map(function(h) { return targetRow(h, fam, h, -1); }));
			group(_('Gateway'), [targetRow('__gateway', fam, _('Gateway (auto-detected)'), -1)]);
			// Sorted for display; each keeps its index in pingTargets, which is
			// what removal splices.
			var custom = [];
			dash.pingTargets.forEach(function(t, i) { if (inFam(t)) custom.push({ host: t.host, name: t.name || '', idx: i }); });
			custom.sort(function(a, b) { return ui.byName(a.host, b.host); });
			group(_('Custom'), custom.map(function(c) { return targetRow(c.host, fam, c.name || c.host, c.idx); }));

			var setOff = function(off) {
				body.style.opacity = off ? '0.45' : '';
				body.querySelectorAll('input[type="checkbox"]').forEach(function(x) { x.disabled = off; });
			};
			var famCb = checkbox(!ping.famOff(dash, fam), function(ev) {
				dash.disabledFams = dash.disabledFams.filter(function(f) { return parseInt(f, 10) !== fam; });
				if (!ev.target.checked)
					dash.disabledFams.push(fam);
				setOff(!ev.target.checked);
				targetsChanged();
			});
			var kids = [E('label', { class: 'hw-fam-head', title: _('Probe the IPv%d targets below').format(fam) }, [famCb, 'IPv' + fam])];
			if (fam === 6 && dash.hasV6 === false)
				kids.push(E('div', { class: 'hw-fam-note' }, [_('No IPv6 WAN interface was detected on this router. These targets are unreachable and will be reported as such.')]));
			kids.push(body);
			setOff(!famCb.checked);
			return E('div', { class: 'hw-fam' }, kids);
		}

		function renderTargetList() {
			targetList.textContent = '';
			targetList.appendChild(E('div', { class: 'hw-fams' }, [famBox(4), famBox(6)]));
		}

		var hostInput = E('input', { type: 'text', class: 'cbi-input-text hw-tgt-input', placeholder: _('Host name or IP address (for example, quad9.net)') });
		// A label for a bare IP with no PTR record; kept only in settings.
		var nameInput = E('input', { type: 'text', class: 'cbi-input-text hw-tgt-input', placeholder: _('Name (optional, for example Branch Office Router)') });
		var famSelect = E('select', { class: 'cbi-input-select' }, [
			E('option', { value: '4' }, ['IPv4']),
			E('option', { value: '6' }, ['IPv6']),
			E('option', { value: 'both' }, ['IPv4 + IPv6'])
		]);

		function addTarget() {
			var host = hostInput.value.trim(), have = {};
			ping.DEFAULT_TARGETS.concat(dash.pingTargets).forEach(function(t) {
				ping.expandFams(t).forEach(function(f) { have[t.host + '|' + f] = true; });
			});
			var missing = (famSelect.value === 'both' ? [4, 6] : [parseInt(famSelect.value, 10)]).filter(function(f) { return !have[host + '|' + f]; });
			var ok = /^[A-Za-z0-9.:-]+$/.test(host) && missing.length > 0;
			hostInput.style.borderColor = ok ? '' : '#ff5252';
			if (!ok)
				return;
			dash.pingTargets.push({ host: host, fam: missing.length === 2 ? 'both' : missing[0], name: nameInput.value.trim() });
			hostInput.value = nameInput.value = '';
			targetsChanged();
			renderTargetList();
		}

		renderTargetList();
		panel.appendChild(section(_('Ping Targets'),
			_('The hosts probed by the Ping Latency card, grouped by address family. Untick IPv4 or IPv6 to pause that whole family; the individual choices underneath are kept for when it is switched back on.'), [
				targetList,
				E('div', { class: 'hw-tgt-add' }, [
					hostInput, nameInput, famSelect,
					E('button', { type: 'button', class: 'cbi-button cbi-button-add', click: addTarget }, [_('Add Target')]),
					E('button', { type: 'button', class: 'cbi-button cbi-button-reset', click: function() {
						dash.pingTargets = [];
						dash.disabledPings = [];
						dash.disabledFams = [];
						targetsChanged();
						renderTargetList();
					} }, [_('Reset to defaults')])
				])
			]));

		// --- WAN probe targets -------------------------------------------------
		var wan4 = E('input', { type: 'text', class: 'cbi-input-text hw-wide-input', placeholder: _('IP or domain (e.g. 1.1.1.1 or dns.google)') });
		var wan6 = E('input', { type: 'text', class: 'cbi-input-text hw-wide-input', placeholder: _('IP or domain (e.g. 2606:4700:4700::1111)') });
		wan4.addEventListener('input', function() { dash.wanTarget4 = wan4.value.trim(); markDirty(); });
		wan6.addEventListener('input', function() { dash.wanTarget6 = wan6.value.trim(); markDirty(); });
		panel.appendChild(section(_('WAN Uptime Status Probing Targets'), _('What the background collector pings to decide whether each WAN is up.'), [
			field(_('IPv4 Quality Target'), wan4),
			field(_('IPv6 Quality Target'), wan6)
		]));

		// --- Persistent storage directory --------------------------------------
		// Additive, not a relocation: internal flash keeps its own copy, and
		// the router re-checks the path before every write.
		var persistInput = E('input', { type: 'text', class: 'cbi-input-text hw-persist-input', placeholder: _('/mnt/usb1/hwdash (leave empty to disable)') });
		var persistMsg = E('div', { class: 'hw-field-msg hw-bad' });
		var validatePersist = function() {
			var v = persistInput.value.trim();
			var bad = !!v && (v.charAt(0) !== '/' || v.slice(-1) === '/');
			persistMsg.textContent = bad ? _('Must be an absolute path (e.g. /mnt/usb1/hwdash), without a trailing slash.') : '';
			persistInput.style.borderColor = bad ? '#ff5252' : '';
		};
		persistInput.addEventListener('input', function() {
			dash.persistDir = persistInput.value.trim();
			validatePersist();
			markDirty();
		});
		panel.appendChild(section(_('Persistent Storage Directory'),
			_('Point this at an already-mounted, writable directory — typically on a USB drive — to keep a second copy of the WAN interface list and NAND wear baseline there, and to let the WAN Uptime card’s 24-hour history and any saved NAT type test result survive a real power outage rather than only a graceful reboot. Internal flash keeps its own copy of everything regardless of this setting, so an unplugged or missing drive never breaks the dashboard — it is checked before every write, and anything written here is skipped rather than silently landing back on internal flash. This package does not mount the drive itself.'),
			[field(_('Directory'), persistInput), persistMsg]));

		// --- Optional packages -------------------------------------------------
		var pkgRows = {}, pkgJob = null, pkgTimer = null;
		var pkgNote = E('div', { class: 'hw-pkg-note' });
		var pkgList = PACKAGES.map(function(p) {
			var r = { name: E('code', { class: 'hw-pkg-name' }, [p[0]]), state: E('span', { class: 'hw-pkg-state' }), btn: E('button', { type: 'button', class: 'cbi-button', style: 'display:none' }) };
			r.btn.addEventListener('click', function() { pkgAction(p[0], r.btn.getAttribute('data-op')); });
			pkgRows[p[0]] = r;
			return E('div', { class: 'hw-pkg' }, [r.name, E('span', { class: 'hw-pkg-desc' }, [p[1]]), E('span', { class: 'hw-pkg-side' }, [r.state, r.btn])]);
		});

		function pkgState(name, text, color) {
			var r = pkgRows[name];
			r.state.textContent = text || '';
			r.state.style.color = color || '';
			r.state.style.opacity = color ? '1' : '';
		}

		function renderPkgs(st) {
			var job = st.job || null, running = !!(job && job.state === 'running');
			(st.pkgs || []).forEach(function(pk) {
				var r = pkgRows[pk.name];
				if (!r)
					return;
				var mine = !!(job && job.pkg === pk.name), op = null, text = '', color = '';
				// The name is the status: green when installed, grey when not.
				r.name.style.color = pk.installed || pk.external ? '#8bc34a' : '#9e9e9e';
				r.name.title = pk.installed ? _('Installed') : pk.external ? _('Present, but not installed with apk') : _('Not installed');
				if (mine && running)
					text = job.op === 'add' ? _('Installing…') : _('Removing…');
				// Present without apk: installing would take the file over, and
				// removing it later would delete the original.
				else if (!pk.installed && pk.external)
					text = _('Already present — not from this package');
				else if (pk.installed && pk.required_by)
					text = _('Required by %s').format(pk.required_by);
				else if (pk.installed)
					op = 'del';
				else if (!pk.arch_ok)
					text = _('Not available for %s').format(st.arch || _('this architecture'));
				else if (pk.available === 0)
					text = _('Not in this router’s package feeds');
				else
					op = 'add';
				if (mine && job.state === 'done' && job.rc !== 0) {
					text = (job.op === 'add' ? _('Install failed') : _('Removal failed')) + (job.msg ? ': ' + job.msg : '');
					color = '#ff5252';
				}
				pkgState(pk.name, text, color);
				r.btn.style.display = op ? '' : 'none';
				if (op) {
					r.btn.setAttribute('data-op', op);
					r.btn.className = 'cbi-button ' + (op === 'add' ? 'cbi-button-positive' : 'cbi-button-remove');
					if (!r.btn.dataset.armed)
						r.btn.textContent = op === 'add' ? _('Install') : _('Remove');
				}
				r.btn.disabled = running;
			});
			pkgNote.textContent = st.index === 0
				? _('The package index has not been downloaded since boot, so availability is not known yet. Install fetches it first.')
				: _('Installed from this router’s own apk feeds') + (st.arch ? ' (' + st.arch + ')' : '') + '. ' + _('Green means installed.');
		}

		function loadPkgStatus() {
			clearTimeout(pkgTimer);
			return callPkgStatus().then(function(st) {
				st = st || {};
				renderPkgs(st);
				var job = st.job;
				if (job && job.state === 'running') {
					pkgTimer = setTimeout(loadPkgStatus, 1500);
				}
				else if (pkgJob && job && job.id === pkgJob) {
					// The backend already dropped what it cached from the
					// package, so the affected cards refresh right away.
					pkgJob = null;
					dash.refresh();
				}
			}).catch(function() {
				pkgNote.textContent = _('Could not read package state from the router.');
			});
		}

		function pkgAction(name, op) {
			var r = pkgRows[name];
			if (op !== 'add' && op !== 'del')
				return;
			if (op === 'del' && !ui.confirmed(r.btn, _('Click again to remove')))
				return;
			Object.keys(pkgRows).forEach(function(k) { pkgRows[k].btn.disabled = true; });
			pkgState(name, op === 'add' ? _('Installing…') : _('Removing…'));
			callPkgAction(name, op).then(function(res) {
				if (res && res.result === 'started') {
					pkgJob = res.id;
					return loadPkgStatus();
				}
				return loadPkgStatus().then(function() { pkgState(name, REFUSED[res && res.result] || _('Request failed.'), '#ff5252'); });
			}).catch(function() {
				loadPkgStatus().then(function() { pkgState(name, _('Request failed.'), '#ff5252'); });
			});
		}

		panel.appendChild(section(_('Optional Packages'),
			_('Everything here is optional. The dashboard works without them and says so where data is missing — installing one just adds detail to a card.'),
			pkgList.concat([pkgNote])));

		// --- Diagnostics ---------------------------------------------------------
		// A full readout, including sections the page skips for hidden cards.
		var snapshotBtn = E('button', { type: 'button', class: 'cbi-button cbi-button-action', click: function() {
			snapshotBtn.disabled = true;
			dash.fetchInfo().then(function(info) {
				ui.download((info && info.sys_info && info.sys_info.hostname) || 'router', 'json', JSON.stringify(info, null, 2), 'application/json');
			}).catch(function() {
				say(_('Could not read the hardware readout from the router.'), '#ff5252');
			}).then(function() {
				snapshotBtn.disabled = false;
			});
		} }, [_('⤓ Download diagnostics snapshot')]);
		panel.appendChild(section(_('Diagnostics'), null, [snapshotBtn, E('span', { class: 'hw-hint' }, [_('Saves a full hardware readout as JSON')])]));

		// --- Save / Revert / Reset -----------------------------------------------
		var saveBtn = E('button', { type: 'button', class: 'cbi-button cbi-button-save' }, [_('Save')]);
		var revertBtn = E('button', { type: 'button', class: 'cbi-button cbi-button-neutral' }, [_('Revert')]);
		var resetBtn = E('button', { type: 'button', class: 'cbi-button cbi-button-reset' }, [_('Reset')]);
		var busy = function(on) { [saveBtn, revertBtn, resetBtn].forEach(function(b) { b.disabled = on; }); };

		function syncControls() {
			Object.keys(cardBoxes).forEach(function(k) { cardBoxes[k].checked = !dash.isHidden(k); });
			Object.keys(wanBoxes).forEach(function(k) { wanBoxes[k].cb.checked = dash.hiddenWanIfaces.indexOf(k) === -1; });
			wan4.value = dash.wanTarget4;
			wan6.value = dash.wanTarget6;
			persistInput.value = dash.persistDir;
			validatePersist();
			renderTargetList();
			dash.applyCardVisibility();
			dash.layout.apply();
		}

		saveBtn.addEventListener('click', function() {
			busy(true);
			say(_('Saving…'));
			dash.saveConfig().then(function(res) {
				busy(false);
				if (res.result === 'ok')
					say(_('All settings saved.'), '#8bc34a');
				else
					say(_('Save failed — the router rejected the settings (%s). Your changes are still staged here.').format(res.result), '#ff5252');
			});
		});

		revertBtn.addEventListener('click', function() {
			busy(true);
			say(_('Reverting…'));
			dash.fetchConfig().then(function(cfg) {
				dash.applyConfig(cfg);
				dash.pingHist = {};
				syncControls();
				busy(false);
				say(_('Reverted to saved settings.'));
			}).catch(function() {
				busy(false);
				say(_('Revert failed.'), '#ff5252');
			});
		});

		resetBtn.addEventListener('click', function() {
			if (!ui.confirmed(resetBtn, _('Click again to reset everything')))
				return;
			busy(true);
			say(_('Resetting…'));
			dash.applyConfig({});
			dash.pingHist = {};
			syncControls();
			dash.saveConfig().then(function(res) {
				busy(false);
				if (res.result === 'ok')
					say(_('All settings reset to defaults.'), '#8bc34a');
				else
					say(_('Reset failed.'), '#ff5252');
			});
		});

		// cbi-page-actions is where every LuCI settings page keeps Save.
		panel.appendChild(E('div', { class: 'cbi-page-actions' }, [msg, E('div', { class: 'hw-page-buttons' }, [resetBtn, revertBtn, saveBtn])]));

		wan4.value = dash.wanTarget4;
		wan6.value = dash.wanTarget6;
		persistInput.value = dash.persistDir;

		return {
			panel: panel,
			markDirty: markDirty,
			renderTargetList: renderTargetList,
			syncWanIfaces: syncWanIfaces,
			toggle: function() {
				var open = panel.style.display === 'none';
				panel.style.display = open ? '' : 'none';
				if (open)
					loadPkgStatus();
			}
		};
	}
});
