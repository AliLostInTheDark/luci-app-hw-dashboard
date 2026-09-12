'use strict';
'require baseclass';
'require hwdash.ui as ui';

// MiB/GiB with a decimal, the way btop and LuCI print memory.
function fmtMem(mib) {
	return mib >= 1024 ? (mib / 1024).toFixed(2) + ' GiB' : mib.toFixed(1) + ' MiB';
}

function fmtPhys(mib) {
	return mib >= 1024 ? +(mib / 1024).toFixed(2) + ' GiB' : Math.round(mib) + ' MiB';
}

// Installed DRAM when the devicetree does not say: the next standard module
// size above what the kernel can use.
function guessPhysKiB(totalKiB) {
	var sizes = [32, 64, 128, 256, 512, 1024, 1536, 2048, 3072, 4096, 6144, 8192, 12288, 16384, 24576, 32768, 65536];
	for (var i = 0; i < sizes.length; i++)
		if (totalKiB / 1024 <= sizes[i])
			return sizes[i] * 1024;
	return totalKiB;
}

return baseclass.extend({
	create: function() {
		var dial = ui.dialCard(_('Memory'), _('Memory usage'));
		var rows = {};

		return {
			cards: { ram: dial.node },
			update: function(info) {
				var mem = info.mem;
				if (!mem || !(mem.total > 0))
					return;
				var MiB = function(kb) { return kb / 1024; };
				// Used is Total minus Available, as btop counts it.
				var used = mem.total - mem.avail;
				dial.set(Math.round(used / mem.total * 100), fmtMem(MiB(used)));

				var physMb = info.sys_info && info.sys_info.mem_phys_mb;
				var list = [{ key: 'phys', type: 'stat', cls: 'hw-row-gap-sm', label: _('Physical Total'), val: fmtPhys(physMb > 0 ? physMb : MiB(guessPhysKiB(mem.total))) }];
				if (mem.speed)
					list.push({ key: 'speed', type: 'stat', cls: 'hw-row-gap-sm', label: _('Memory Speed'), val: mem.speed });
				list.push({ key: 'usable', type: 'stat', cls: 'hw-row-gap-lg', label: _('Usable Total'), val: fmtMem(MiB(mem.total)) });

				var bar = function(key, label, valueKb, totalKb, tip, invert, single) {
					var pct = totalKb > 0 ? valueKb / totalKb * 100 : 0;
					list.push({ key: key, type: 'bar', label: label, pct: pct, color: ui.loadColor(pct, invert), tip: tip || '',
						val: single ? fmtMem(MiB(valueKb)) : fmtMem(MiB(valueKb)) + ' / ' + fmtMem(MiB(totalKb)) });
				};
				bar('used', _('Used'), used, mem.total,
					_('Total minus Available — how btop counts it. LuCI’s status page counts the page cache as used (Total minus Free), so its Used reads higher.'), false, true);
				bar('avail', _('Available'), mem.avail, mem.total,
					_('MemAvailable: what programs can still claim without swapping, including cache the kernel can drop. LuCI shows this as Total Available.'), true, true);
				bar('free', _('Free'), mem.free, mem.total,
					_('MemFree: RAM holding nothing at all. A low figure is normal — Linux fills idle RAM with cache, which counts towards Available instead.'), true, true);
				bar('cached', _('Cached'), mem.cached, mem.total,
					_('Page cache (Cached in /proc/meminfo), the same figure btop and LuCI show.'), false, true);
				bar('buffers', _('Buffers'), mem.buffers, mem.total,
					_('Block-device buffers (Buffers in /proc/meminfo).'), false, true);
				if (mem.tmp_total > 0)
					bar('tmp', _('RAM Disk (/tmp)'), mem.tmp_used, mem.tmp_total,
						_('Files in /tmp are held in RAM: logs, downloads and package caches there take memory from everything else. The second figure is the most /tmp may grow to.'));
				if (mem.oom_kills > 0)
					list.push({ key: 'oom', type: 'stat', label: _('OOM Kills (since boot)'), val: String(mem.oom_kills), color: '#ff5252' });
				if (mem.swap_total > 0)
					bar('swap', _('Swap'), mem.swap_total - mem.swap_free, mem.swap_total);
				if (mem.zram_total > 0) {
					bar('zram', _('ZRAM'), mem.zram_used, mem.zram_total);
					list.push({ key: 'zram_ratio', type: 'note', val: _('Compression: %sx').format(mem.zram_used > 0 ? (mem.zram_orig / mem.zram_used).toFixed(2) : '1.00') });
				}
				if (mem.dirty > 0 || mem.writeback > 0)
					list.push({ key: 'dirty', type: 'stat', label: _('Dirty / Writeback'), val: MiB(mem.dirty).toFixed(1) + ' MiB / ' + MiB(mem.writeback).toFixed(1) + ' MiB',
						color: mem.writeback > 1024 ? '#ffb300' : '' });
				var psi = info.cpu_meta && info.cpu_meta.psi;
				if (psi && (psi.mem > 0 || psi.mem_full > 0))
					list.push({ key: 'psi', type: 'stat', label: _('Memory Pressure (10s)'),
						val: psi.mem.toFixed(1) + '%' + (psi.mem_full > 0 ? ' (' + _('full %.1f%%').format(psi.mem_full) + ')' : ''),
						color: psi.mem_full >= 5 ? '#ff5252' : psi.mem >= 10 ? '#ffb300' : '' });

				ui.syncRows(dial.stats, rows, list, function(r) { return r.key; }, function(r) {
					var val = E('span', { class: 'hw-stat-value' });
					if (r.type === 'stat')
						return { el: E('div', { class: 'hw-stat-row ' + (r.cls || '') }, [E('span', { class: 'hw-stat-label' }, [r.label]), val]), val: val };
					if (r.type === 'note')
						return { el: E('div', { class: 'hw-mem-note' }) };
					var fill = E('div', { class: 'hw-bar-fill' });
					return {
						el: E('div', { class: 'hw-progress-item' }, [
							E('div', { class: 'hw-progress-header' }, [E('span', { class: 'hw-stat-label' }, [r.label]), val]),
							E('div', { class: 'hw-bar-bg' }, [fill])
						]),
						val: val,
						fill: fill
					};
				}, function(row, r) {
					if (r.type === 'note')
						return ui.setText(row.el, r.val);
					ui.setText(row.val, r.val);
					if (r.type === 'stat') {
						row.val.style.color = r.color || '';
						return;
					}
					row.el.title = r.tip;
					row.fill.style.width = r.pct + '%';
					row.fill.style.background = r.color;
				});
			}
		};
	}
});
