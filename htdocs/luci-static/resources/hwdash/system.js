'use strict';
'require baseclass';
'require hwdash.ui as ui';

// Crypto and virtualisation extensions that decide VPN throughput; they are
// listed first and tinted green.
var NOTABLE = ['aes', 'aesni', 'pmull', 'sha1', 'sha2', 'sha512', 'crc32', 'asimd', 'neon', 'sve',
	'avx2', 'avx', 'sse4_2', 'rdrand', 'rdseed', 'vmx', 'svm'];

function row(label, value, color, tip) {
	return E('div', { class: 'hw-stat-row hw-si-row', title: tip || null }, [
		E('span', { class: 'hw-stat-label' }, [label]),
		E('span', { class: 'hw-stat-value', style: color ? 'color:' + color : null }, [String(value)])
	]);
}

function chip(text, color) {
	var c = E('span', { class: 'hw-chip' }, [text]);
	ui.tint(c, color);
	return c;
}

function band(title, chips) {
	return E('div', { class: 'hw-band' }, [
		E('div', { class: 'hw-minihead' }, [title]),
		E('div', { class: 'hw-chip-row' }, chips)
	]);
}

function lastBoot(status) {
	if (status & 0x20) return [_('Watchdog reset'), '#ff5252'];
	if (status & 0x02) return [_('Overheat reset'), '#ff5252'];
	if (status !== 0) return [_('Code 0x%s').format(status.toString(16)), '#ffb300'];
	return [_('Normal (power-on)'), null];
}

function build(info) {
	var si = info.sys_info, kids = [];
	var os = (si.distrib || 'OpenWrt') + (si.release ? ' ' + si.release : '') + (si.revision ? ' (' + si.revision + ')' : '');

	kids.push(E('div', { class: 'hw-si-head' }, [
		E('div', {}, [
			E('div', { class: 'hw-si-board' }, [info.board || si.hostname || _('OpenWrt Device')]),
			info.model ? E('div', { class: 'hw-si-model' }, [info.model]) : ''
		]),
		E('span', { class: 'hw-si-os' }, [os])
	]));

	var grid = E('div', { class: 'hw-si-grid' });
	var add = function(label, value, color, tip) {
		if (value !== '' && value !== undefined && value !== null)
			grid.appendChild(row(label, value, color, tip));
	};
	add(_('Hostname'), si.hostname);
	add(_('Kernel'), si.kver);
	add(_('Architecture'), si.arch);
	// The ARM ISA level (ARMv8-A) says more than arch (aarch64); the core
	// name (Cortex-A73) only lscpu can supply on ARM.
	if (si.cpu_isa !== si.arch) add(_('ISA'), si.cpu_isa);
	if (si.cpu_core) add(_('CPU Core'), si.cpu_core + (si.cpu_stepping ? ' (' + si.cpu_stepping + ')' : ''));
	add(_('CPU Vendor'), si.cpu_vendor);
	add(_('Op Modes'), si.cpu_opmode);
	add(_('Byte Order'), si.cpu_byteorder);
	add(_('BogoMIPS'), si.cpu_bogomips);
	add(_('Virtualization'), si.cpu_virt);
	if (si.lscpu === 0) add(_('CPU Detail'), _('limited — install lscpu for more'));
	if (typeof si.wd_bootstatus === 'number' && si.wd_bootstatus >= 0) {
		var boot = lastBoot(si.wd_bootstatus);
		add(_('Last Boot'), boot[0], boot[1]);
	}
	if (si.watchdog)
		add(_('Watchdog'), _('%s, %s, %d s timeout').format(si.watchdog.name, si.watchdog.state === 'active' ? _('active') : _('inactive'), si.watchdog.timeout),
			null, _('The hardware watchdog reboots the router if the system stops responding for longer than the timeout.'));
	if (si.ntp) {
		add(_('Clock'),
			si.ntp.synced ? (si.ntp.stratum >= 0 ? _('Synced (stratum %d)').format(si.ntp.stratum) : _('Synced')) : _('Not synced'),
			si.ntp.synced ? '#8bc34a' : '#ffb300',
			_('As last reported by the router’s NTP client. HTTPS, encrypted DNS and log timestamps all depend on a correct clock.'));
	}
	if (si.crash && si.crash.count > 0) {
		add(_('Kernel Crash Log'),
			(si.crash.reason || _('Crash')) + ', ' + (si.crash.time > 0 ? new Date(si.crash.time * 1000).toLocaleString() : _('time unknown')),
			'#ff5252',
			_('Saved by pstore in /sys/fs/pstore and kept until deleted, so it marks a crash at that time rather than proving the latest boot crashed. Delete the dmesg-* files there once read to clear it.'));
	}
	add(_('SoC Family'), si.soc_family);
	add(_('Machine'), si.soc_machine);
	add(_('SoC ID'), si.soc_id);
	add(_('SoC Revision'), si.soc_revision);
	add(_('SoC Serial'), si.soc_serial);
	if (si.l0 > 0) add(_('L0 Cache'), ui.fmtCache(si.l0));
	if (si.l1d > 0 || si.l1i > 0) {
		var l1 = [];
		if (si.l1d > 0) l1.push('L1d ' + ui.fmtCache(si.l1d));
		if (si.l1i > 0) l1.push('L1i ' + ui.fmtCache(si.l1i));
		add(_('L1 Cache'), l1.join(' / '));
	}
	if (si.l2 > 0) add(_('L2 Cache'), ui.fmtCache(si.l2));
	if (si.l3 > 0) add(_('L3 Cache'), ui.fmtCache(si.l3));
	if (si.l4 > 0) add(_('L4 Cache'), ui.fmtCache(si.l4));
	kids.push(grid);

	var features = (si.cpu_features || '').split(/\s+/).filter(Boolean);
	if (features.length) {
		var hot = features.filter(function(f) { return NOTABLE.indexOf(f) !== -1; });
		var rest = features.filter(function(f) { return NOTABLE.indexOf(f) === -1; });
		kids.push(band(_('CPU Features'), hot.map(function(f) { return chip(f, '#8bc34a'); })
			.concat(rest.map(function(f) { return chip(f, '#9e9e9e'); }))));
	}

	var vulns = si.vulns && typeof si.vulns === 'object' ? Object.keys(si.vulns) : [];
	if (vulns.length) {
		kids.push(band(_('CPU Security'), vulns.map(function(name) {
			var st = si.vulns[name];
			var ok = st.indexOf('Not affected') === 0, mitigated = st.indexOf('Mitigated') === 0;
			return chip(name.replace(/_/g, ' ') + ': ' + (ok ? _('OK') : mitigated ? _('Mitigated') : _('Vulnerable')),
				ok ? '#00bcd4' : mitigated ? '#ffb300' : '#ff5252');
		})));
	}
	return kids;
}

return baseclass.extend({
	create: function() {
		var body = E('div', { class: 'hw-si' });
		var shown = null;

		return {
			cards: { sysinfo: ui.card(_('System Info'), [body], 'wide') },
			update: function(info) {
				if (!info.sys_info)
					return;
				// Overlay use changes all the time and is not shown here, so it
				// must not trigger a rebuild.
				var sig = JSON.stringify(info.sys_info, function(k, v) { return /^overlay_/.test(k) ? undefined : v; }) + info.board + info.model;
				if (sig === shown)
					return;
				shown = sig;
				body.textContent = '';
				build(info).forEach(function(n) { body.appendChild(n); });
			}
		};
	}
});
