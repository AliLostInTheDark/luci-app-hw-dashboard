'use strict';
'require baseclass';
'require hwdash.ui as ui';

// Internal Storage (filesystems, flash layout and health) and External
// Storage (every other block device, with live throughput).

var EOL_LABELS = [_('Not Defined'), _('Normal'), _('Warning'), _('Urgent')];
var EOL_COLORS = ['#9e9e9e', '#00bcd4', '#ffea00', '#ff1744'];
var LIFE_LABELS = ['N/A', '0–10%', '10–20%', '20–30%', '30–40%', '40–50%', '50–60%', '60–70%', '70–80%', '80–90%', '90–100%', _('Exceeded')];

function badge(text, color) {
	return E('span', { class: 'hw-badge', style: 'color:' + color + '; background:' + color + '22' }, [text]);
}

function geoChip(text) {
	return E('span', { class: 'hw-geo-chip' }, [text]);
}

function ubiBox(u, si) {
	var box = ui.devBox(u.dev.toUpperCase(), 'MTD' + u.mtd_num + (u.block_size > 0 ? ' | ' + _('%s blocks').format(ui.fmtBytes(u.block_size)) : ''));
	if (u.max_ec > 0)
		box.appendChild(ui.statRow(_('Erase Count (min / mean / max)'), _('%s / %s / %s cycles').format(u.min_ec, u.mean_ec > 0 ? u.mean_ec : '-', u.max_ec), null, true));
	var reserved = u.reserved_pebs || 0;
	box.appendChild(ui.statRow(_('PEB Status'),
		_('Total: %d  Avail: %d  Bad: %d').format(u.total_ebs, u.avail_ebs, u.bad_pebs) + (reserved > 0 ? '  ' + _('Rsv: %d').format(reserved) : ''),
		u.bad_pebs > reserved ? '#ff5252' : u.bad_pebs > 0 ? '#ffb300' : null, true));
	if (u.page_size > 0) {
		var chips = [geoChip(_('Page %s').format(ui.fmtBytes(u.page_size))), geoChip(_('Block %s').format(ui.fmtBytes(u.block_size))), geoChip('OOB ' + ui.fmtBytes(u.oob_size))];
		if (u.ecc_strength > 0) chips.push(geoChip('ECC ' + u.ecc_strength + 'b'));
		box.appendChild(E('div', { class: 'hw-geo' }, [E('div', { class: 'hw-minihead' }, _('NAND Geometry')), E('div', { class: 'hw-chip-row hw-chip-row-tight' }, chips)]));
	}
	if (u.volumes && u.volumes.length) {
		var vols = E('div', { class: 'hw-vols' }, [E('div', { class: 'hw-minihead' }, _('Volumes'))]);
		u.volumes.forEach(function(v) {
			var reservedBytes = (v.reserved_ebs || 0) * (v.eb_size || u.eb_size);
			var size, fill = -1;
			if (v.name === 'rootfs_data' && si.overlay_total > 0) {
				size = _('%s used, %s free').format(ui.fmtBytes(si.overlay_used), ui.fmtBytes(si.overlay_free));
				fill = si.overlay_used / si.overlay_total;
			}
			else if (reservedBytes > 0 && v.data_bytes !== reservedBytes) {
				size = ui.fmtBytes(v.data_bytes) + ' / ' + ui.fmtBytes(reservedBytes);
				fill = v.data_bytes / reservedBytes;
			}
			else {
				size = ui.fmtBytes(reservedBytes > 0 ? reservedBytes : v.data_bytes);
			}
			var entry = E('div', { class: 'hw-vol' }, [E('div', { class: 'hw-vol-head' }, [
				E('span', { class: 'hw-vol-name' }, [v.name]),
				E('span', { class: 'hw-vol-size' }, [size + ' | ' + v.type])
			])]);
			if (fill >= 0) {
				var color = fill > 0.9 ? '#ff5252' : fill > 0.7 ? '#ffb300' : '#00bcd4';
				entry.appendChild(E('div', { class: 'hw-vol-bar' }, [E('div', { style: 'width:' + Math.max(0, Math.min(100, fill * 100)).toFixed(0) + '%; background:' + color })]));
			}
			vols.appendChild(entry);
		});
		box.appendChild(vols);
	}
	return box;
}

function mtdTable(info) {
	var col = E('div', { class: 'hw-mtd' }, [ui.sectionTitle(_('MTD Partition Table'))]);
	var table = col.appendChild(E('div', { class: 'hw-mtd-table' }));
	info.mtd_parts.forEach(function(p) {
		table.appendChild(E('div', { class: 'hw-mtd-row' }, [
			E('span', { class: 'hw-mtd-num' }, ['mtd' + p.num]),
			E('span', { class: 'hw-mtd-name' }, [p.name]),
			E('span', { class: 'hw-mtd-size' }, ui.fmtBytes(p.size)),
			E('span', { class: 'hw-mtd-type', style: 'color:' + (p.type === 'nor' ? '#00bcd4' : p.type === 'nand' ? '#ffea00' : '#9e9e9e') }, p.type.toUpperCase())
		]));
	});
	var ecc = info.mtd_parts.filter(function(p) { return p.ecc_fail > 0 || p.ecc_corr > 0; });
	if (ecc.length) {
		var title = info.ecc_base_date > 0
			? _('ECC Alerts (+n since %s)').format(new Date(info.ecc_base_date * 1000).toLocaleDateString())
			: _('ECC Alerts');
		var list = E('div', { class: 'hw-ecc' }, [E('div', { class: 'hw-minihead' }, [title])]);
		ecc.forEach(function(p) {
			var newCorr = p.ecc_corr_base != null ? p.ecc_corr - p.ecc_corr_base : 0;
			var newFail = p.ecc_fail_base != null ? p.ecc_fail - p.ecc_fail_base : 0;
			var vals = E('span');
			if (p.ecc_corr > 0) vals.appendChild(E('span', { class: 'hw-ecc-corr' }, _('%d corr').format(p.ecc_corr) + (newCorr > 0 ? ' (+' + newCorr + ')' : '')));
			if (p.ecc_fail > 0) vals.appendChild(E('span', { class: 'hw-ecc-fail' }, _('%d fail').format(p.ecc_fail) + (newFail > 0 ? ' (+' + newFail + ')' : '')));
			list.appendChild(E('div', { class: 'hw-ecc-row' }, [E('span', { class: 'hw-mtd-num' }, ['mtd' + p.num + ' (' + p.name + ')']), vals]));
		});
		col.appendChild(list);
	}
	return col;
}

function emmcBox(em) {
	var eol = Math.max(0, Math.min(em.pre_eol || 0, 3));
	var box = ui.devBox(em.dev.toUpperCase() + (em.name ? ' (' + em.name + ')' : ''), badge(EOL_LABELS[eol], EOL_COLORS[eol]));
	if (em.vendor && em.vendor !== 'Unknown')
		box.appendChild(ui.statRow(_('Manufacturer'), em.vendor + (em.date ? ' (' + em.date + ')' : '')));
	if (em.fwrev && em.fwrev !== '0x0')
		box.appendChild(ui.statRow(_('FW Rev / HW Rev'), em.fwrev + ' / ' + em.hwrev));
	var life = function(label, v) {
		box.appendChild(ui.barRow(label, Math.min(v * 10, 100), LIFE_LABELS[Math.min(v, 11)] || _('Exceeded'), ui.loadColor(v * 10)));
	};
	if (em.life_a > 0) life(_('Lifetime Type A'), em.life_a);
	if (em.life_b > 0) life(_('Lifetime Type B'), em.life_b);
	if (!em.life_a && !em.life_b)
		box.appendChild(ui.statRow(_('Lifetime'), _('Not reported by device'), '#9e9e9e'));
	return box;
}

function nvmeBox(nv, sm) {
	var head = E('span', { class: 'hw-box-badges' });
	if (sm) {
		// sm.passed is the drive firmware's own verdict (smartctl -H);
		// "Warning" is ours, for things trending bad before it gives up.
		var warn = sm.critical_warning > 0 || sm.media_errors > 0 || sm.percent_used >= 90;
		head.appendChild(!sm.passed ? badge(_('Critical'), '#ff1744') : warn ? badge(_('Warning'), '#ffb300') : badge(_('Healthy'), '#00bcd4'));
		if (sm.temp_c > 0) {
			var crit = sm.temp_crit > 0 ? sm.temp_crit : 80, hot = sm.temp_warn > 0 ? sm.temp_warn : crit - 10;
			var t = E('span', { class: 'hw-temp-badge' + (sm.temp_c >= crit ? ' hw-temp-crit' : '') }, sm.temp_c.toFixed(1) + ' °C');
			var color = sm.temp_c >= crit ? '#ff1744' : sm.temp_c >= hot ? '#ffb300' : '#00bcd4';
			t.style.color = color;
			t.style.background = color + '26';
			head.appendChild(t);
		}
	}
	var box = ui.devBox(nv.dev.toUpperCase() + (nv.model ? ' — ' + nv.model : ''), head);
	if (nv.serial) box.appendChild(ui.statRow(_('Serial'), nv.serial));
	if (nv.fw) box.appendChild(ui.statRow(_('Firmware'), nv.fw));
	if (nv.transport) box.appendChild(ui.statRow(_('Transport'), nv.transport.toUpperCase()));
	if (nv.discard_gran > 0)
		box.appendChild(ui.statRow(_('TRIM Support'), _('Supported (%s granularity)').format(ui.fmtBytes(nv.discard_gran)) + ' · ' +
			(nv.discard_mount ? _('Continuous') : _('Periodic (fstrim)')), '#00bcd4'));
	else if (nv.discard_gran === 0)
		box.appendChild(ui.statRow(_('TRIM Support'), _('Not Supported')));
	if (!sm)
		return box;

	box.appendChild(ui.barRow(_('Wear (Percentage Used)'), Math.min(sm.percent_used, 100), sm.percent_used + '%',
		sm.percent_used >= 100 ? '#ff1744' : sm.percent_used >= 90 ? '#ffb300' : '#00bcd4'));
	box.appendChild(ui.statRow(_('TBW (Total Bytes Written)'), ui.fmtBytes(sm.data_units_written * 512000)));
	box.appendChild(ui.barRow(_('Available Spare'), sm.avail_spare, _('%d%% (threshold %d%%)').format(sm.avail_spare, sm.spare_thresh),
		sm.avail_spare <= sm.spare_thresh ? '#ff1744' : sm.avail_spare <= sm.spare_thresh + 10 ? '#ffb300' : '#00bcd4'));
	if (sm.ns_capacity > 0) {
		var ns = Math.min(100, sm.ns_utilization / sm.ns_capacity * 100);
		box.appendChild(ui.barRow(_('Namespace Utilization'), ns, ui.fmtBytes(sm.ns_utilization) + ' / ' + ui.fmtBytes(sm.ns_capacity)));
	}
	if (sm.power_on_hours > 0)
		box.appendChild(ui.statRow(_('Power-On Hours'), _('%s h (≈%d days)').format(sm.power_on_hours.toLocaleString(), Math.floor(sm.power_on_hours / 24))));
	box.appendChild(ui.statRow(_('Power Cycles'), sm.power_cycles.toLocaleString()));
	box.appendChild(ui.statRow(_('Unsafe Shutdowns'), sm.unsafe_shutdowns.toLocaleString(), sm.unsafe_shutdowns > 0 ? '#ffb300' : null));
	box.appendChild(ui.statRow(_('Media Errors'), sm.media_errors.toLocaleString(), sm.media_errors > 0 ? '#ff1744' : null));
	if (sm.err_log_entries > 0)
		box.appendChild(ui.statRow(_('Error Log Entries'), sm.err_log_entries.toLocaleString(), '#ffb300'));
	box.appendChild(ui.statRow(_('Data Read'), ui.fmtBytes(sm.data_units_read * 512000)));
	box.appendChild(ui.statRow(_('Host Read / Write Commands'), sm.host_reads.toLocaleString() + ' / ' + sm.host_writes.toLocaleString(), null, true));
	if (sm.critical_warning > 0) {
		var flags = [[0x01, _('Spare below threshold')], [0x02, _('Temperature threshold')], [0x04, _('Reliability degraded')],
			[0x08, _('Media read-only')], [0x10, _('Backup device failed')]]
			.filter(function(f) { return sm.critical_warning & f[0]; }).map(function(f) { return f[1]; });
		box.appendChild(ui.statRow(_('Critical Warning'), flags.length ? flags.join(', ') : 'flags 0x' + sm.critical_warning.toString(16), '#ff1744', true));
	}
	return box;
}

// Flash layout and device health under the filesystem list. Rebuilt only
// when the underlying data changes; nothing in it is interactive.
function healthSections(info) {
	var si = info.sys_info || {}, out = [];
	var section = function(title, nodes) {
		if (out.length) out.push(ui.divider());
		out.push(ui.sectionTitle(title));
		out = out.concat(nodes);
	};
	var hasUbi = info.ubi_devs && info.ubi_devs.length > 0, hasMtd = info.mtd_parts && info.mtd_parts.length > 0;
	if (hasUbi || hasMtd) {
		var row = E('div', { class: 'hw-cols hw-flash' });
		if (hasUbi)
			row.appendChild(E('div', { class: 'hw-col' }, [ui.sectionTitle(_('UBI / NAND Flash'))].concat(info.ubi_devs.map(function(u) { return ubiBox(u, si); }))));
		if (hasMtd)
			row.appendChild(E('div', { class: 'hw-col' }, [mtdTable(info)]));
		out.push(row);
	}
	if (info.emmc_info)
		section(_('eMMC / SD Health'), [emmcBox(info.emmc_info)]);
	if (info.nvme_info)
		section(_('NVMe Details'), [nvmeBox(info.nvme_info, info.nvme_smart)]);
	if (info.squashfs_info) {
		var sq = info.squashfs_info, sqBox = ui.devBox(sq.dev.toUpperCase(), '');
		if (sq.compression) sqBox.appendChild(ui.statRow(_('Compression'), sq.compression.toUpperCase()));
		if (sq.block_size > 0) sqBox.appendChild(ui.statRow(_('Block Size'), ui.fmtBytes(sq.block_size)));
		if (sq.bytes_used > 0) sqBox.appendChild(ui.statRow(_('Compressed Size'), ui.fmtBytes(sq.bytes_used)));
		section(_('SquashFS Root Image'), [sqBox]);
	}
	if (info.f2fs_info && info.f2fs_info.length) {
		section(_('f2fs Statistics'), info.f2fs_info.map(function(f) {
			var segs = (f.valid_segs || 0) + (f.dirty_segs || 0) + (f.free_segs || 0);
			var box = ui.devBox(f.dev.toUpperCase(), '');
			if (f.lifetime_write_kb > 0) box.appendChild(ui.statRow(_('Lifetime Written'), ui.fmtBytes(f.lifetime_write_kb * 1024)));
			if (f.utilization > 0) box.appendChild(ui.barRow(_('Utilization'), f.utilization, f.utilization + '%'));
			if (segs > 0) box.appendChild(ui.statRow(_('Segments (Valid/Dirty/Free)'), f.valid_segs + ' / ' + f.dirty_segs + ' / ' + f.free_segs, f.dirty_segs > 0 ? '#ffb300' : null));
			return box;
		}));
	}
	return out;
}

function detailRow(label, value, cls) {
	return E('div', { class: 'hw-ext-row' + (cls ? ' ' + cls : '') }, [E('span', {}, [label]), value]);
}

return baseclass.extend({
	create: function() {
		var prevIO = {};
		var mounts = E('div', { class: 'hw-stats-list' });
		var totals = E('div', { class: 'hw-dsk-totals' });
		var healthRule = E('div', { class: 'hw-divider', style: 'display:none' });
		var health = E('div', { class: 'hw-dsk-health' });
		var internal = ui.card(_('Internal Storage'), [mounts, ui.divider(), totals, healthRule, health], 'wide');
		var extGrid = E('div', { class: 'hw-ext-grid' });
		var external = ui.card(_('External Storage'), [extGrid]);
		var cache = { mounts: {}, totals: {} }, healthSig = null, extSig = null, extRefs = {};

		external.style.display = 'none';

		// Bytes and operations per second since the previous poll, measured
		// against the real time between them.
		function rate(key, rd, wr, rio, wio, now) {
			var p = prevIO[key], out = { rd: 0, wr: 0, rio: 0, wio: 0 };
			if (p && now > p.t) {
				var dt = (now - p.t) / 1000;
				out = { rd: Math.max(0, (rd - p.rd) / dt), wr: Math.max(0, (wr - p.wr) / dt), rio: Math.max(0, (rio - p.rio) / dt), wio: Math.max(0, (wio - p.wio) / dt) };
			}
			prevIO[key] = { rd: rd, wr: wr, rio: rio, wio: wio, t: now };
			return out;
		}

		function diskRate(name, stats, now) {
			var s = stats[name];
			return rate('df:' + name, s.r * 512, s.w * 512, s.r_io, s.w_io, now);
		}

		function updateInternal(info) {
			var now = Date.now(), stats = info.diskstats || {}, si = info.sys_info || {};
			var space = 0, spaceUsed = 0, nandRootfs = 0, emmc = 0, disk = 0, diskRootfs = 0, seenDisk = {};
			var nandChip = info.mtd_count > 0 && info.mtd_phys ? Math.round(info.mtd_phys / 1024) : 0;
			var items = [];

			info.df.forEach(function(fs) {
				var usb = fs.hw_type === 'USB';
				// /rom is the read-only base under the overlay, which '/' already
				// counts; adding it would count the same space twice.
				if (!usb && fs.hw_type !== 'SquashFS' && fs.total > 0) { space += fs.total; spaceUsed += fs.used; }
				if (usb)
					return;
				if (fs.hw_type === 'NAND' && fs.mount === '/' && fs.hw_size > 0) nandRootfs = fs.hw_size;
				if (/^(eMMC|MMC|SD)$/.test(fs.hw_type) && fs.hw_size > emmc) emmc = fs.hw_size;
				if (/^(HDD|SSD|NVMe)$/.test(fs.hw_type)) {
					if (!seenDisk[fs.dev]) { disk += fs.hw_size; seenDisk[fs.dev] = true; }
					if (fs.mount === '/' && fs.total > 0) diskRootfs = fs.total;
				}

				var io = { rd: 0, wr: 0, rio: 0, wio: 0 };
				if (fs.mount === '/' && fs.iodev && stats[fs.iodev]) {
					io = diskRate(fs.iodev, stats, now);
				}
				else if (fs.mount === '/') {
					// No known device behind root: add up every internal disk.
					Object.keys(stats).forEach(function(name) {
						if (/^(loop|ram|sda|sdb|sdc)/.test(name)) return;
						var r = diskRate(name, stats, now);
						io.rd += r.rd; io.wr += r.wr; io.rio += r.rio; io.wio += r.wio;
					});
				}
				else if (stats[fs.dev]) {
					io = diskRate(fs.dev, stats, now);
				}

				var pct = parseInt(fs.pct, 10) || 0;
				// SquashFS is full by definition, which is not a warning.
				var color = fs.hw_type === 'SquashFS' ? '#00bcd4' : ui.loadColor(pct);
				// NAND and SquashFS have no useful throughput; show their fill instead.
				var fixed = fs.hw_type === 'NAND' || fs.hw_type === 'SquashFS';
				var inodes = info.inodes && info.inodes[fs.mount];
				var hasInodes = !!(inodes && inodes.ipct !== '-');
				var ipct = hasInodes ? parseInt(inodes.ipct, 10) || 0 : 0;
				items.push({
					key: fs.mount + '|' + (fs.dev || ''),
					label: fs.mount === '/' ? _('Root FS') : fs.mount.replace(/^\/mnt\//, ''),
					type: fs.hw_type ? '[' + fs.hw_type + (fs.hw_model ? ' - ' + fs.hw_model : '') + ']' : '',
					value: fixed ? ui.fmtKiB(fs.used) + ' / ' + ui.fmtKiB(fs.total) : _('R: %s | W: %s').format(ui.fmtRate(io.rd), ui.fmtRate(io.wr)),
					detail: fixed ? (fs.total > 0 ? _('%.1f%% filesystem used').format(fs.used / fs.total * 100) : '') : _('(%dR / %dW) IOPS').format(Math.round(io.rio), Math.round(io.wio)),
					pct: pct, pctText: fs.pct, color: color,
					inodes: hasInodes ? { text: inodes.ipct, pct: ipct, color: ui.loadColor(ipct) } : null
				});
			});

			// By mount point: df lists them in the order this boot mounted them.
			items.sort(function(a, b) { return ui.byName(a.key, b.key); });
			ui.syncRows(mounts, cache.mounts, items, function(r) { return r.key; }, function() {
				var e = {
					label: E('span', { class: 'hw-dsk-label' }), type: E('span', { class: 'hw-dsk-type' }),
					value: E('span', { class: 'hw-stat-value' }), fill: E('div', { class: 'hw-bar-fill' }),
					detail: E('span'), pct: E('span', { class: 'hw-stat-value' }),
					inVal: E('span', { class: 'hw-stat-value hw-dsk-inode-val' }), inFill: E('div', { class: 'hw-bar-fill' })
				};
				e.inodes = E('div', {}, [
					E('div', { class: 'hw-progress-header hw-dsk-inodes' }, [E('span', { class: 'hw-stat-label' }, _('Inodes Used')), e.inVal]),
					E('div', { class: 'hw-bar-bg hw-bar-thin' }, [e.inFill])
				]);
				e.el = E('div', { class: 'hw-progress-item hw-dsk' }, [
					E('div', { class: 'hw-progress-header' }, [E('span', { class: 'hw-dsk-name' }, [e.label, e.type]), e.value]),
					E('div', { class: 'hw-bar-bg' }, [e.fill]),
					E('div', { class: 'hw-dsk-foot' }, [e.detail, e.pct]),
					e.inodes
				]);
				return e;
			}, function(e, r) {
				ui.setText(e.label, r.label);
				ui.setText(e.type, r.type);
				ui.setText(e.value, r.value);
				e.value.style.color = r.color;
				e.fill.style.width = r.pct + '%';
				e.fill.style.background = r.color;
				ui.setText(e.detail, r.detail);
				ui.setText(e.pct, r.pctText);
				e.inodes.style.display = r.inodes ? '' : 'none';
				if (r.inodes) {
					ui.setText(e.inVal, r.inodes.text);
					e.inVal.style.color = r.inodes.color;
					e.inFill.style.width = r.inodes.pct + '%';
					e.inFill.style.background = r.inodes.color;
				}
			});

			var rows = [];
			var add = function(label, value, color) { rows.push({ key: label, label: label, val: value, color: color || '' }); };
			if (nandChip > 0) {
				add(_('Physical NAND Total'), ui.fmtKiB(nandChip));
				if (nandRootfs > 0 && nandRootfs !== nandChip) add(_('Rootfs Total'), ui.fmtKiB(nandRootfs));
				if (si.overlay_total > 0) {
					add(_('Overlay Total'), ui.fmtBytes(si.overlay_total));
					add(_('Overlay Used'), ui.fmtBytes(si.overlay_used), ui.loadColor(Math.round(si.overlay_used / si.overlay_total * 100)));
					add(_('Overlay Free'), ui.fmtBytes(si.overlay_free));
				}
			}
			else if (emmc > 0 || disk > 0) {
				if (emmc > 0) add(_('Physical eMMC Total'), ui.fmtKiB(emmc));
				else {
					add(_('Physical Disk Total'), ui.fmtKiB(disk));
					if (diskRootfs > 0 && diskRootfs !== disk) add(_('Rootfs Total'), ui.fmtKiB(diskRootfs));
				}
			}
			if (nandChip <= 0 && space > 0) {
				add(_('Usable Total'), ui.fmtKiB(space));
				add(_('Usable Free'), ui.fmtKiB(space - spaceUsed));
			}
			if (info.mtd_count > 0) add(_('MTD Partitions'), String(info.mtd_count));
			ui.syncRows(totals, cache.totals, rows, function(r) { return r.key; }, function(r) {
				var val = E('span', { class: 'hw-stat-value' });
				return { el: E('div', { class: 'hw-stat-row' }, [E('span', { class: 'hw-stat-label' }, r.label), val]), val: val };
			}, function(e, r) {
				ui.setText(e.val, r.val);
				e.val.style.color = r.color;
			});

			var sig = JSON.stringify([info.ubi_devs, info.mtd_parts, info.emmc_info, info.nvme_info, info.nvme_smart, info.squashfs_info, info.f2fs_info,
				si.overlay_total, si.overlay_used, si.overlay_free, info.ecc_base_date]);
			if (sig !== healthSig) {
				healthSig = sig;
				health.textContent = '';
				healthSections(info).forEach(function(n) { health.appendChild(n); });
				healthRule.style.display = health.children.length ? '' : 'none';
			}
		}

		// Whole drives with their partitions; mmcblk, mtd and ubi belong to
		// Internal Storage.
		function updateExternal(info) {
			var groups = {}, order = [];
			info.block_devs.forEach(function(b) {
				if (/^(mmcblk|mtd|ubi|loop|zram)/.test(b.dev))
					return;
				var parent = b.dev.indexOf('nvme') === 0 ? b.dev.replace(/p[0-9]+$/, '') : b.dev.replace(/[0-9]+$/, '');
				if (!groups[parent]) { groups[parent] = { main: null, parts: [] }; order.push(parent); }
				if (b.dev === parent) groups[parent].main = b;
				else groups[parent].parts.push(b);
			});
			var drives = order.map(function(p) { var g = groups[p]; g.main = g.main || g.parts[0]; return g; }).filter(function(g) { return g.main; });

			var now = Date.now(), speeds = {};
			drives.forEach(function(g) {
				[g.main].concat(g.parts).forEach(function(b) {
					speeds[b.dev] = rate('ext:' + b.dev, +b.read || 0, +b.write || 0, +b.read_ios || 0, +b.write_ios || 0, now);
				});
			});

			external.style.display = drives.length ? 'flex' : 'none';
			var sig = JSON.stringify(drives.map(function(g) {
				return [g.main.dev, g.main.size, g.main.model, g.main.type, g.main.removable, g.main.fs, g.main.mount, g.parts.map(function(p) { return [p.dev, p.size, p.fs, p.mount]; })];
			}));
			if (sig !== extSig) {
				extSig = sig;
				extGrid.textContent = '';
				extRefs = {};
				drives.forEach(function(g) { extGrid.appendChild(driveBox(g)); });
			}
			Object.keys(extRefs).forEach(function(dev) {
				var s = speeds[dev];
				if (!s) return;
				ui.setText(extRefs[dev].speed, _('R: %s / W: %s').format(ui.fmtRate(s.rd), ui.fmtRate(s.wr)));
				ui.setText(extRefs[dev].iops, _('R: %d / W: %d').format(Math.round(s.rio), Math.round(s.wio)));
			});
		}

		// Filesystem and mount of a device, or of the loop device riding on it
		// (x86 images loop-mount a raw overlay partition).
		function fsOf(b) {
			var fs = b.fs && b.fs !== 'Unknown' ? b.fs : '—', mount = b.mount || _('No');
			if ((!b.fs || b.fs === 'Unknown') && b.loop_of) {
				fs = _('%s (via %s)').format(b.loop_fs || 'raw', b.loop_of);
				if (b.loop_mount) mount = _('%s (via %s)').format(b.loop_mount, b.loop_of);
			}
			return { fs: fs, mount: mount, mounted: !!(b.mount || b.loop_mount) };
		}

		function ioRows(dev) {
			var speed = E('span'), iops = E('span');
			extRefs[dev] = { speed: speed, iops: iops };
			return [detailRow(_('Speed:'), speed, 'hw-ext-io'), detailRow(_('IOPS:'), iops, 'hw-ext-io hw-ext-iops')];
		}

		function fsRows(b) {
			var f = fsOf(b);
			return [
				detailRow(_('Format:'), E('span', { class: 'hw-accent' }, [f.fs])),
				detailRow(_('Mounted:'), E('span', { class: f.mounted ? 'hw-good' : 'hw-muted' }, [f.mount]))
			];
		}

		function driveBox(g) {
			var m = g.main;
			var box = E('div', { class: 'hw-ext-drive' }, [
				E('div', { class: 'hw-ext-head' }, [
					E('span', { class: 'hw-ext-dev' }, [m.dev.toUpperCase()]),
					E('span', { class: 'hw-ext-size' }, m.size ? ui.fmtBytes(parseInt(m.size, 10)) : _('Unknown'))
				]),
				detailRow(_('Model:'), E('span', { class: 'hw-ext-model' }, [m.model])),
				detailRow(_('Type:'), E('span', {}, [m.removable === '1' || m.type === 'USB' ? 'USB' : m.type]))
			]);
			var parts = E('div', { class: 'hw-ext-parts' });
			if (!g.parts.length)
				parts.appendChild(E('div', {}, fsRows(m).concat(ioRows(m.dev))));
			g.parts.forEach(function(p) {
				parts.appendChild(E('div', { class: 'hw-ext-part' }, [
					E('div', { class: 'hw-ext-part-head' }, [E('span', { class: 'hw-accent' }, [p.dev.toUpperCase()]), E('span', {}, p.size ? ui.fmtBytes(parseInt(p.size, 10)) : '')])
				].concat(fsRows(p), ioRows(p.dev))));
			});
			box.appendChild(parts);
			return box;
		}

		return {
			cards: { storage: internal, ext: external },
			update: function(info) {
				if (Array.isArray(info.df))
					updateInternal(info);
				if (Array.isArray(info.block_devs))
					updateExternal(info);
			}
		};
	}
});
