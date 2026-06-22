'use strict';
'require view';
'require poll';
'require rpc';
'require fs';
var callHwInfo = rpc.declare({
    object: 'luci.hwdash',
    method: 'info',
    expect: {}
});
var parseCpu = function(line) {
    var parts = line.trim().split(/\s+/);
    var name = parts[0];
    var user = parseInt(parts[1]) || 0;
    var nice = parseInt(parts[2]) || 0;
    var sys = parseInt(parts[3]) || 0;
    var idle = parseInt(parts[4]) || 0;
    var iowait = parseInt(parts[5]) || 0;
    var irq = parseInt(parts[6]) || 0;
    var softirq = parseInt(parts[7]) || 0;
    var idleAll = idle + iowait;
    var systemAll = sys + irq + softirq;
    var virtAll = 0;
    var total = user + nice + systemAll + idleAll + virtAll;
    return { name: name, total: total, idleAll: idleAll, user: user, nice: nice, sys: sys, idle: idle, iowait: iowait, irq: irq, softirq: softirq };
};
return view.extend({
    prevCpu: {},
    prevDisk: {},
    load: function() {
        var self = this;
        self.prevCpu = {};
        return L.resolveDefault(fs.lines('/proc/stat'), []).then(function(lines) {
            lines.forEach(function(line) {
                if (line.indexOf('cpu') === 0) {
                    var stat = parseCpu(line);
                    self.prevCpu[stat.name] = stat;
                }
            });
            return Promise.resolve();
        });
    },
    render: function() {
        var container = E('div', {
            id: 'hw-dashboard',
            class: 'hw-dashboard'
        });
        var style = E('style', {}, ' .hw-dashboard { display: flex; flex-wrap: wrap; align-items: stretch; gap: 20px; padding: 15px; font-family: system-ui, -apple-system, sans-serif; width: 100%; max-width: 100%; overflow: hidden; } .hw-dashboard * { box-sizing: border-box; } .hw-thermals-container { display: flex; flex-direction: row; width: 100%; height: 100%; } .hw-thermals-col { flex: 1; } .hw-thermals-col-left { padding-right: 15px; } .hw-thermals-col-mid { padding: 0 15px; } .hw-thermals-col-right { padding-left: 15px; } .hw-thermals-title { font-size: 0.85em; opacity: 0.6; margin-bottom: 10px; text-align: center; } .hw-thermals-divider { width: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 10px 15px 30px 15px; } @media (max-width: 768px) { .hw-thermals-container { flex-direction: column; } .hw-thermals-col { padding: 0 !important; } .hw-thermals-divider { width: auto; height: 1px; margin: 25px 0; } } .hw-meta-grid { margin-top: 15px; font-size: 0.8em; color: currentColor; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; opacity: 0.8; width: 75%; margin-left: auto; margin-right: auto; } @media (max-width: 480px) { .hw-meta-grid { width: 100%; font-size: 0.75em; } .hw-dial { transform: scale(0.9); } .hw-card { padding: 15px; } } .hw-card { flex: 1 1 280px; background: var(--background-color-high, rgba(128, 128, 128, 0.05)); border: 1px solid var(--border-color, rgba(128, 128, 128, 0.2)); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-color, inherit); position: relative; box-shadow: 0 4px 10px rgba(0,0,0,0.1); max-width: 100%; overflow: hidden; } .hw-card.wide { flex: 1 1 100%; align-items: stretch; } .hw-card h3 { margin: 0 0 20px 0; font-size: 1.1em; color: var(--text-color, inherit); opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; text-align: center; } .hw-dial { position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center; margin: 0 auto; } .hw-dial svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform: rotate(-90deg); } .hw-dial-bg { fill: none; stroke: rgba(128, 128, 128, 0.2); stroke-width: 10; } .hw-dial-progress { fill: none; stroke-width: 10; stroke-linecap: round; transition: stroke-dasharray 0.5s ease; } .hw-dial-text { font-size: 2.2em; font-weight: 600; z-index: 1; } .hw-dial-subtext { position: absolute; bottom: 25px; font-size: 0.9em; opacity: 0.7; z-index: 1; } .hw-stats-list { width: 100%; display: flex; flex-direction: column; gap: 12px; } .hw-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 30px; width: 100%; } .hw-stat-row { display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 8px; } .hw-stat-label { opacity: 0.8; font-size: 0.95em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex-shrink: 1; margin-right: 10px; } .hw-stat-value { font-weight: bold; font-size: 0.95em; white-space: nowrap; flex-shrink: 0; } .hw-progress-item { display: flex; flex-direction: column; margin-bottom: 15px; width: 100%; } .hw-progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; width: 100%; min-width: 0; } .hw-bar-bg { width: 100%; height: 6px; background: var(--border-color, rgba(128, 128, 128, 0.2)); border-radius: 3px; overflow: hidden; margin-top: 6px; } .hw-bar-fill { height: 100%; transition: width 0.5s ease; } .hw-temp-badge { padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 0.9em; white-space: nowrap; } ');
        var getDynColor = function(pct, invert) {
            if (invert === true) {
                if (pct >= 40) return '#00bcd4';
                if (pct >= 20) return '#ffea00';
                return '#ff1744';
            }
            if (pct < 60) return '#00bcd4';
            if (pct < 80) return '#ffea00';
            return '#ff1744';
        };
        var updateDial = function(id, pct, circ) {
            var dash = (pct / 100) * circ;
            var prog = document.getElementById('dial-prog-' + id);
            if (prog) {
                prog.style.strokeDasharray = dash + ' ' + circ;
                prog.style.stroke = getDynColor(pct);
            }
            var txt = document.getElementById('dial-txt-' + id);
            if (txt) {
                txt.textContent = Math.round(pct) + '%';
                txt.style.fill = getDynColor(pct);
                txt.style.color = getDynColor(pct);
            }
        };
        var createDial = function(id, title) {
            var radius = 70;
            var circumference = 2 * Math.PI * radius;
            var svgContainer = E('div', {
                id: 'dial-svg-' + id,
                style: 'position:absolute; top:0; left:0; width:100%; height:100%;'
            });
            svgContainer.innerHTML = '<svg viewBox="0 0 160 160"><circle class="hw-dial-bg" cx="80" cy="80" r="' + radius + '"/><circle id="dial-prog-' + id + '" class="hw-dial-progress" cx="80" cy="80" r="' + radius + '" style="stroke: #00bcd4; stroke-dasharray: 0 ' + circumference + ';"/></svg>';
            var card = E('div', {
                class: 'hw-card'
            }, [E('h3', {
                id: 'title-' + id
            }, title), E('div', {
                class: 'hw-dial'
            }, [svgContainer, E('div', {
                id: 'dial-txt-' + id,
                class: 'hw-dial-text'
            }, '0%'), E('div', {
                id: 'dial-sub-' + id,
                class: 'hw-dial-subtext'
            }, '')]), E('div', {
                id: 'stats-' + id,
                class: 'hw-stats-list'
            })]);
            return {
                node: card,
                circ: circumference
            };
        };
        var cpuCard = createDial('cpu', 'CPU');
        var ramCard = createDial('ram', 'MEMORY');
        var dskCard = createDial('dsk', 'STORAGE');
        var coresNode = E('div', {
            id: 'hw-cores',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0;'
        });
        cpuCard.node.appendChild(E('h4', {
            style: 'text-align: center; font-size: 0.85em; opacity: 0.7; letter-spacing: 1px; margin: 15px 0 10px 0; text-transform: uppercase;'
        }, 'PER-CORE USAGE'));
        cpuCard.node.appendChild(coresNode);
        cpuCard.node.appendChild(E('div', {
            style: 'width: 100%; height: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 15px 0;'
        }));
        cpuCard.node.appendChild(E('h4', {
            style: 'text-align: center; font-size: 0.85em; opacity: 0.7; letter-spacing: 1px; margin: 0 0 10px 0; text-transform: uppercase;'
        }, 'SYSTEM STATUS'));
        var cpuMetaNode = E('div', {
            id: 'hw-cpu-meta',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0;'
        });
        cpuCard.node.appendChild(cpuMetaNode);
        var advCard = E('div', {
            class: 'hw-card'
        }, [E('h3', {}, 'CPU Detailed Load'), E('div', {
            id: 'hw-adv',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0;'
        })]);
        var extCard = E('div', {
            id: 'hw-ext-card',
            class: 'hw-card',
            style: 'display: none;'
        }, [E('h3', {}, 'EXTERNAL STORAGE'), E('div', {
            id: 'hw-ext-list',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0; width: 100%;'
        }), E('div', {
            id: 'hw-ext-meta',
            style: 'width: 100%; margin-top: 20px; display: flex; flex-direction: column; gap: 8px;'
        })]);
        dskCard.node.appendChild(E('div', {
            id: 'dial-meta-dsk',
            style: 'width: 100%; margin-top: 20px; display: flex; flex-direction: column; gap: 8px;'
        }));
        
        
        
        var thermCard = E('div', {
            class: 'hw-card wide', style: 'display: none;'
        }, [E('h3', {}, 'Thermal Sensors'), E('div', {
            class: 'hw-thermals-container'
        }, [E('div', {
            class: 'hw-thermals-col hw-thermals-col-left'
        }, [E('div', {
            class: 'hw-thermals-title'
        }, 'CPU'), E('div', {
            id: 'hw-thermals-cpu',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0;'
        })]), E('div', {
            id: 'hw-thermals-divider-wifi',
            class: 'hw-thermals-divider'
        }), E('div', {
            id: 'hw-thermals-col-wifi',
            class: 'hw-thermals-col hw-thermals-col-mid'
        }, [E('div', {
            class: 'hw-thermals-title'
        }, 'Wi-Fi'), E('div', {
            id: 'hw-thermals-wifi',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0;'
        })]), E('div', {
            id: 'hw-thermals-divider-misc',
            class: 'hw-thermals-divider'
        }), E('div', {
            id: 'hw-thermals-col-misc',
            class: 'hw-thermals-col hw-thermals-col-right'
        }, [E('div', {
            class: 'hw-thermals-title'
        }, 'MISCELLANEOUS'), E('div', {
            id: 'hw-thermals-misc',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0;'
        })])])]);
        
        
        var ethCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Ethernet Switch Topology'), E('div', { id: 'hw-eth-links', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0; display: flex; flex-direction: column; gap: 8px;' })]);

        
        
        var pcieUsbCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'PCI-e & USB Bus Topology'), E('div', { id: 'hw-pcie-usb', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0; display: flex; flex-direction: column; gap: 8px;' })]);

        
        
        var wifiCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Wi-Fi PHY & Spectrum'), E('div', { id: 'hw-wifi-radios', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0; display: flex; flex-direction: column; gap: 8px;' })]);

        
        
        container.appendChild(style);
        container.appendChild(cpuCard.node);
        container.appendChild(ramCard.node);
        container.appendChild(dskCard.node);
        container.appendChild(advCard);
        container.appendChild(extCard);
        var myExtWrapper = E('div', {
            id: 'my-ext-wrapper',
            style: 'display: contents;'
        });
        container.appendChild(myExtWrapper);
        container.appendChild(ethCard);
        container.appendChild(pcieUsbCard);
        container.appendChild(wifiCard);
        container.appendChild(thermCard);
        var self = this;
        poll.add(function() {
            return callHwInfo().then(function(res) {
                if (!res || !res.cpus) return;
                var coresNode = document.getElementById('hw-cores');
                coresNode.innerHTML = '';
                var advStats = null;
                res.cpus.forEach(function(cpuLine) {
                    var stat = parseCpu(cpuLine);
                    if (self.prevCpu[stat.name]) {
                        var prev = self.prevCpu[stat.name];
                        var totalDiff = stat.total - prev.total;
                        var idleDiff = stat.idleAll - prev.idleAll;
                        var pct = 0;
                        if (totalDiff > 0) {
                            pct = 100 * (totalDiff - idleDiff) / totalDiff;
                        }
                        pct = Math.max(0, Math.min(100, pct));
                        if (stat.name === 'cpu') {
                            var pctRound = Math.round(pct);
                            updateDial('cpu', pctRound, cpuCard.circ);
                            document.getElementById('dial-sub-cpu').textContent = (res.cpus.length - 1) + ' Cores';
                            var calcPct = function(key) {
                                return totalDiff > 0 ? ((stat[key] - prev[key]) / totalDiff) * 100 : 0;
                            };
                            advStats = {
                                Idle: calcPct('idle'),
                                User: calcPct('user'),
                                Nice: calcPct('nice'),
                                System: calcPct('sys'),
                                'I/O Wait': calcPct('iowait'),
                                IRQ: calcPct('irq'),
                                'Soft IRQ': calcPct('softirq')
                            };
                            var cpuStats = document.getElementById('stats-cpu');
                            cpuStats.innerHTML = '';
                            var meta = res.cpu_meta || {};
                            var addMeta = function(label, val) {
                                cpuStats.appendChild(E('div', {
                                    class: 'hw-stat-row',
                                    style: 'margin-bottom: 2px;'
                                }, [E('span', {
                                    class: 'hw-stat-label'
                                }, label), E('span', {
                                    class: 'hw-stat-value'
                                }, val)]));
                            };
                            addMeta('Physical Cores', meta.cores || (res.cpus.length - 1));
                            if (meta.threads && meta.threads !== meta.cores) {
                                addMeta('Logical Threads', meta.threads);
                            }
                            var curFreq = '';
                            if (res.freqs && res.freqs.length > 0) {
                                var validFreqs = res.freqs.filter(function(f) {
                                    return f !== null;
                                });
                                if (validFreqs.length > 0) {
                                    var maxC = Math.max.apply(null, validFreqs);
                                    if (maxC > 1000000) curFreq = (maxC / 1000000).toFixed(2) + ' GHz';
                                    else if (maxC > 1000) curFreq = (maxC / 1000).toFixed(0) + ' MHz';
                                    else curFreq = maxC + ' MHz';
                                }
                            }
                            var maxFreqStr = '';
                            if (meta.max_freq && meta.max_freq > 0) {
                                if (meta.max_freq > 1000000) maxFreqStr = (meta.max_freq / 1000000).toFixed(2) + ' GHz';
                                else maxFreqStr = (meta.max_freq / 1000).toFixed(0) + ' MHz';
                            }
                            if (curFreq) addMeta('Current Freq', curFreq);
                            if (maxFreqStr) addMeta('Max Freq', maxFreqStr);
                            if (meta.tasks) addMeta('Tasks (Run/Total)', meta.tasks);
                            var uptimeStr = '';
                            if (res.uptime) {
                                var days = Math.floor(res.uptime / 86400);
                                var hours = Math.floor((res.uptime % 86400) / 3600);
                                var mins = Math.floor((res.uptime % 3600) / 60);
                                if (days > 0) uptimeStr += days + 'd ';
                                if (hours > 0 || days > 0) uptimeStr += hours + 'h ';
                                uptimeStr += mins + 'm';
                            }
                            var metaNode = document.getElementById('hw-cpu-meta');
                            if (metaNode) {
                                metaNode.innerHTML = '';
                                metaNode.appendChild(E('div', {
                                    class: 'hw-stat-row'
                                }, [E('span', {
                                    class: 'hw-stat-label'
                                }, 'Load Average'), E('span', {
                                    class: 'hw-stat-value'
                                }, (res.cpu_meta.load_1 || '0') + ', ' + (res.cpu_meta.load_5 || '0') + ', ' + (res.cpu_meta.load_15 || '0'))]));
                                if (res.cpu_meta.governor && res.cpu_meta.governor.trim() !== '' && res.cpu_meta.governor !== 'null') {
                                    metaNode.appendChild(E('div', {
                                        class: 'hw-stat-row'
                                    }, [E('span', {
                                        class: 'hw-stat-label'
                                    }, 'CPU Governor'), E('span', {
                                        class: 'hw-stat-value',
                                        style: 'text-transform: uppercase;'
                                    }, res.cpu_meta.governor)]));
                                }
                                metaNode.appendChild(E('div', {
                                    class: 'hw-stat-row'
                                }, [E('span', {
                                    class: 'hw-stat-label'
                                }, 'Uptime'), E('span', {
                                    class: 'hw-stat-value'
                                }, uptimeStr)]));
                            }
                        } else {
                            var coreIdx = parseInt(stat.name.replace('cpu', ''));
                            var freqStr = '';
                            if (res.freqs && res.freqs[coreIdx] && res.freqs[coreIdx] !== null) {
                                var mhz = Math.round(res.freqs[coreIdx] / 1000);
                                freqStr = mhz + ' MHz | ';
                            }
                            var coreName = stat.name.toUpperCase().replace('CPU', 'CORE ');
                            var colorCore = getDynColor(pct);
                            var coreRow = E('div', {
                                class: 'hw-progress-item'
                            }, [E('div', {
                                class: 'hw-progress-header'
                            }, [E('span', {
                                class: 'hw-stat-label'
                            }, coreName), E('span', {
                                class: 'hw-stat-value',
                                style: 'color: ' + colorCore + ';'
                            }, freqStr + pct.toFixed(2) + '%')]), E('div', {
                                class: 'hw-bar-bg'
                            }, [E('div', {
                                class: 'hw-bar-fill',
                                style: 'width: ' + pct + '%; background: ' + colorCore + ';'
                            })])]);
                            coresNode.appendChild(coreRow);
                        }
                    }
                    self.prevCpu[stat.name] = stat;
                });
                if (advStats) {
                    var advNode = document.getElementById('hw-adv');
                    if (advNode) {
                        advNode.innerHTML = '';
                        var addAdvBar = function(label, val) {
                            var colorAdv = getDynColor(val, label === 'Idle');
                            advNode.appendChild(E('div', {
                                class: 'hw-progress-item'
                            }, [E('div', {
                                class: 'hw-progress-header'
                            }, [E('span', {
                                class: 'hw-stat-label'
                            }, label), E('span', {
                                class: 'hw-stat-value',
                                style: 'color: ' + colorAdv + ';'
                            }, val.toFixed(1) + '%')]), E('div', {
                                class: 'hw-bar-bg'
                            }, [E('div', {
                                class: 'hw-bar-fill',
                                style: 'width: ' + val + '%; background: ' + colorAdv + ';'
                            })])]));
                        };
                        for (var key in advStats) {
                            addAdvBar(key, advStats[key]);
                        }
                        var addAdvRowText = function(label, val, color) {
                            advNode.appendChild(E('div', {
                                class: 'hw-progress-item',
                                style: 'margin-top: 5px;'
                            }, [E('div', {
                                class: 'hw-progress-header'
                            }, [E('span', {
                                class: 'hw-stat-label',
                                style: 'font-size: 0.9em;'
                            }, label), E('span', {
                                class: 'hw-stat-value',
                                style: (color ? 'color: ' + color + '; font-size: 0.9em;' : 'font-size: 0.9em;')
                            }, val)])]));
                        };

                        if (res.cpu_meta && res.cpu_meta.tasks) {
                            addAdvRowText('System Tasks', res.cpu_meta.tasks, null);
                            var ctxt = res.cpu_meta.ctxt || 0;
                            var intr = res.cpu_meta.intr || 0;
                            if (self.prevCtxt !== undefined) {
                                var ctxtRate = ctxt - self.prevCtxt;
                                var intrRate = intr - self.prevIntr;
                                addAdvRowText('Context Switches / s', ctxtRate + ' /s', null);
                                addAdvRowText('Hardware Interrupts / s', intrRate + ' /s', null);
                            }
                            self.prevCtxt = ctxt;
                            self.prevIntr = intr;
                            var connCount = res.cpu_meta.conntrack || 0;
                            var connMax = res.cpu_meta.conntrack_max || 1;
                            var connPct = Math.min((connCount / connMax) * 100, 100);
                            var colorConn = getDynColor(connPct, false);
                            advNode.appendChild(E('div', {
                                class: 'hw-progress-item',
                                style: 'margin-top: 10px;'
                            }, [E('div', {
                                class: 'hw-progress-header'
                            }, [E('span', {
                                class: 'hw-stat-label'
                            }, 'Active Connections'), E('span', {
                                class: 'hw-stat-value',
                                style: 'color: ' + colorConn + ';'
                            }, connCount + ' / ' + connMax)]), E('div', {
                                class: 'hw-bar-bg'
                            }, [E('div', {
                                class: 'hw-bar-fill',
                                style: 'width: ' + connPct + '%; background: ' + colorConn + ';'
                            })])]));
                        }
                    }
                }
                var mem = res.mem;
                if (mem && mem.total > 0) {
                    var used = mem.total - mem.avail;
                    var pct = Math.round((used / mem.total) * 100);
                    updateDial('ram', pct, ramCard.circ);
                    document.getElementById('dial-sub-ram').textContent = (used / 1024).toFixed(0) + ' MB';
                    var getPhysicalRamTotal = function(memTotalKb) {
                        var sizesMB = [32, 64, 128, 256, 512, 1024, 1536, 2048, 3072, 4096, 6144, 8192, 12288, 16384, 24576, 32768, 65536];
                        var memTotalMB = memTotalKb / 1024;
                        for (var i = 0; i < sizesMB.length; i++) {
                            if (memTotalMB <= sizesMB[i]) return sizesMB[i] * 1024;
                        }
                        return memTotalKb;
                    };
                    var physRamKB = getPhysicalRamTotal(mem.total);
                    var ramStats = document.getElementById('stats-ram');
                    ramStats.innerHTML = '';
                    ramStats.appendChild(E('div', {
                        class: 'hw-stat-row',
                        style: 'margin-bottom: 5px;'
                    }, [E('span', {
                        class: 'hw-stat-label'
                    }, 'Physical Total'), E('span', {
                        class: 'hw-stat-value'
                    }, (physRamKB / 1024).toFixed(0) + ' MB')]));
                    ramStats.appendChild(E('div', {
                        class: 'hw-stat-row',
                        style: 'margin-bottom: 15px;'
                    }, [E('span', {
                        class: 'hw-stat-label'
                    }, 'Usable Total'), E('span', {
                        class: 'hw-stat-value'
                    }, (mem.total / 1024).toFixed(0) + ' MB')]));
                    var makeMemBar = function(label, valueMb, totalMb) {
                        var pct = totalMb > 0 ? (valueMb / totalMb) * 100 : 0;
                        var colorMem = getDynColor(pct, label === 'Free');
                        var valStr = label === 'Used' || label === 'Free' || label === 'Cached' || label === 'Buffers' ? valueMb.toFixed(0) + ' MB' : valueMb.toFixed(0) + ' / ' + totalMb.toFixed(0) + ' MB';
                        return E('div', {
                            class: 'hw-progress-item'
                        }, [E('div', {
                            class: 'hw-progress-header'
                        }, [E('span', {
                            class: 'hw-stat-label'
                        }, label), E('span', {
                            class: 'hw-stat-value'
                        }, valStr)]), E('div', {
                            class: 'hw-bar-bg'
                        }, [E('div', {
                            class: 'hw-bar-fill',
                            style: 'width: ' + pct + '%; background: ' + colorMem + ';'
                        })])]);
                    };
                    ramStats.appendChild(makeMemBar('Used', used / 1024, mem.total / 1024));
                    ramStats.appendChild(makeMemBar('Free', mem.free / 1024, mem.total / 1024));
                    ramStats.appendChild(makeMemBar('Cached', mem.cached / 1024, mem.total / 1024));
                    ramStats.appendChild(makeMemBar('Buffers', mem.buffers / 1024, mem.total / 1024));
                    if (mem.swap_total > 0) {
                        var swapUsed = mem.swap_total - mem.swap_free;
                        ramStats.appendChild(makeMemBar('Swap', swapUsed / 1024, mem.swap_total / 1024));
                    }
                    if (mem.zram_total > 0) {
                        ramStats.appendChild(makeMemBar('ZRAM', mem.zram_used / 1024, mem.zram_total / 1024));
                    }
                    if (mem.zram_total > 0) {
                        var ratio = mem.zram_used > 0 ? (mem.zram_orig / mem.zram_used).toFixed(2) : 1.0;
                        ramStats.appendChild(E('div', {style: 'text-align: center; font-size: 0.8em; opacity: 0.8; margin-top: -10px; margin-bottom: 10px;'}, 'Compression: ' + ratio + 'x'));
                    }
                    if (mem.slab > 0) {
                        ramStats.appendChild(makeMemBar('Slab Kernel', mem.slab / 1024, mem.total / 1024));
                    }
                    if (mem.pagetables > 0) {
                        ramStats.appendChild(makeMemBar('PageTables', mem.pagetables / 1024, mem.total / 1024));
                    }
                }
                if (res.df && Array.isArray(res.df)) {
                    var totalSpace = 0;
                    var totalUsed = 0;
                    var totalPhys = 0;
                    var extSpace = 0;
                    var extUsed = 0;
                    var extPhys = 0;
                    var extCount = 0;
                    var dskNode = document.getElementById('stats-dsk');
                    var extNode = document.getElementById('hw-ext-list');
                    if (dskNode) dskNode.innerHTML = '';
                    if (extNode) extNode.innerHTML = '';
                    res.df.forEach(function(fs) {
                        var isExt = (fs.hw_type === 'USB');
                        if (fs.total > 0) {
                            if (isExt) {
                                extSpace += fs.total;
                                extUsed += fs.used;
                            } else {
                                totalSpace += fs.total;
                                totalUsed += fs.used;
                            }
                        }
                        if (fs.psize > 0) {
                            if (isExt) extPhys += fs.psize;
                            else totalPhys += fs.psize;
                        }
                        if (isExt) extCount++;
                        var readSpeed = 0;
                        var writeSpeed = 0;
                        var rIops = 0;
                        var wIops = 0;
                        if (fs.mount === '/') {
                            var intRead = 0,
                                intWrite = 0,
                                intR_io = 0,
                                intW_io = 0;
                            for (var k in res.diskstats) {
                                if (!k.match(/^(loop|ram|sda|sdb|sdc)/)) {
                                    var stat = res.diskstats[k];
                                    if (self.prevDisk[k]) {
                                        var prev = self.prevDisk[k];
                                        intRead += (stat.r - prev.r) * 512;
                                        intWrite += (stat.w - prev.w) * 512;
                                        intR_io += (stat.r_io - prev.r_io);
                                        intW_io += (stat.w_io - prev.w_io);
                                    }
                                    self.prevDisk[k] = stat;
                                }
                            }
                            readSpeed = intRead;
                            writeSpeed = intWrite;
                            rIops = intR_io;
                            wIops = intW_io;
                        } else if (res.diskstats && res.diskstats[fs.dev]) {
                            var stat = res.diskstats[fs.dev];
                            if (self.prevDisk[fs.dev]) {
                                var prev = self.prevDisk[fs.dev];
                                readSpeed = (stat.r - prev.r) * 512;
                                writeSpeed = (stat.w - prev.w) * 512;
                                rIops = (stat.r_io - prev.r_io);
                                wIops = (stat.w_io - prev.w_io);
                            }
                            self.prevDisk[fs.dev] = stat;
                        }
                        var formatSpeed = function(bytes) {
                            if (bytes < 1024) return bytes + ' B/s';
                            if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB/s';
                            return (bytes / 1048576).toFixed(1) + ' MB/s';
                        };
                        var usedPctStr = fs.pct;
                        var pctNum = parseInt(usedPctStr) || 0;
                        var colorDsk = getDynColor(pctNum);
                        var labelStr = fs.mount === '/' ? 'Root FS' : fs.mount.replace(/^\/mnt\//, '');
                        var typeStr = fs.hw_type ? '[' + fs.hw_type + (fs.hw_model ? ' - ' + fs.hw_model : '') + ']' : '';
                        var inodesInfo = res.inodes ? res.inodes[fs.mount] : null;
                        if (isExt && extNode) {
                            var extBars = [E('div', {
                                class: 'hw-progress-header'
                            }, [E('span', {
                                style: 'font-weight: bold; font-size: 1.05em;'
                            }, labelStr), E('span', {
                                style: 'opacity: 0.6; font-size: 0.9em; margin-left: 8px;'
                            }, typeStr)]), E('div', {
                                class: 'hw-bar-bg',
                                style: 'margin: 8px 0;'
                            }, [E('div', {
                                class: 'hw-bar-fill',
                                style: 'width: ' + pctNum + '%; background: ' + colorDsk + ';'
                            })]), E('div', {
                                style: 'width: 100%; display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.9em; opacity: 0.8;'
                            }, [E('span', {}, 'Space Used'), E('span', {
                                class: 'hw-stat-value'
                            }, usedPctStr)]), E('div', {
                                style: 'width: 100%; display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.9em; opacity: 0.8;'
                            }, [E('span', {}, 'Read: ' + formatSpeed(readSpeed)), E('span', {}, 'Write: ' + formatSpeed(writeSpeed))]), E('div', {
                                style: 'width: 100%; display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.9em; opacity: 0.8;'
                            }, [E('span', {}, 'Read IOPS: ' + rIops), E('span', {}, 'Write IOPS: ' + wIops)])];
                            if (inodesInfo && inodesInfo.ipct !== '-') {
                                var ipctNum = parseInt(inodesInfo.ipct) || 0;
                                var icolor = getDynColor(ipctNum);
                                extBars.push(E('div', {
                                    style: 'width: 100%; display: flex; justify-content: space-between; margin-top: 4px; font-size: 0.85em; opacity: 0.7;'
                                }, [E('span', {}, 'Inodes Used'), E('span', {
                                    style: 'color: ' + icolor + ';'
                                }, inodesInfo.ipct)]));
                            }
                            extNode.appendChild(E('div', {
                                class: 'hw-progress-item',
                                style: 'margin-bottom: 25px; background: rgba(128,128,128,0.05); padding: 12px; border-radius: 6px;'
                            }, extBars));
                        } else if (dskNode) {
                            var speedStr = fs.hw_type === 'NAND' && res.ubi_max_ec !== undefined && res.ubi_max_ec != 0 ? 'EC: ' + res.ubi_max_ec + ' | Bad: ' + res.ubi_bad_peb : 'R: ' + formatSpeed(readSpeed) + ' | W: ' + formatSpeed(writeSpeed);
                            var iopsStr = fs.hw_type === 'NAND' && res.ubi_max_ec !== undefined && res.ubi_max_ec != 0 ? 'UBI Wear: ' + (res.ubi_max_ec / 3000 * 100).toFixed(1) + '% (' + res.ubi_max_ec + ' cycles)' : '(' + rIops + 'R / ' + wIops + 'W) IOPS';
                            var bars = [E('div', {
                                class: 'hw-progress-header'
                            }, [E('span', {
                                style: 'display: flex; opacity: 0.8; font-size: 0.95em; flex-shrink: 1; min-width: 0; margin-right: 5px;'
                            }, [E('span', {
                                style: 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
                            }, labelStr), E('span', {
                                style: 'opacity: 0.6; margin-left: 5px; flex-shrink: 0;'
                            }, typeStr)]), E('span', {
                                class: 'hw-stat-value',
                                style: 'color: ' + colorDsk + '; flex-shrink: 0;'
                            }, speedStr)]), E('div', {
                                class: 'hw-bar-bg'
                            }, [E('div', {
                                class: 'hw-bar-fill',
                                style: 'width: ' + pctNum + '%; background: ' + colorDsk + ';'
                            })]), E('div', {
                                style: 'width: 100%; display: flex; justify-content: space-between; margin-top: 5px; font-size: 0.9em; opacity: 0.8;'
                            }, [E('span', {}, iopsStr), E('span', {
                                class: 'hw-stat-value'
                            }, usedPctStr)])];
                            if (inodesInfo && inodesInfo.ipct !== '-') {
                                var ipctNum = parseInt(inodesInfo.ipct) || 0;
                                var icolor = getDynColor(ipctNum);
                                bars.push(E('div', {
                                    class: 'hw-progress-header',
                                    style: 'margin-top: 6px;'
                                }, [E('span', {
                                    class: 'hw-stat-label',
                                    style: 'font-size: 0.8em; opacity: 0.7;'
                                }, 'Inodes Used'), E('span', {
                                    class: 'hw-stat-value',
                                    style: 'font-size: 0.8em; color: ' + icolor + ';'
                                }, inodesInfo.ipct)]), E('div', {
                                    class: 'hw-bar-bg',
                                    style: 'height: 4px;'
                                }, [E('div', {
                                    class: 'hw-bar-fill',
                                    style: 'width: ' + ipctNum + '%; background: ' + icolor + ';'
                                })]));
                            }
                            dskNode.appendChild(E('div', {
                                class: 'hw-progress-item',
                                style: 'margin-bottom: 15px;'
                            }, bars));
                        }
                    });
                    if (totalSpace > 0) {
                        var usedPct = totalSpace > 0 ? (totalUsed / totalSpace) * 100 : 0;
                        updateDial('dsk', usedPct, dskCard.circ);
                        document.getElementById('dial-sub-dsk').textContent = (totalUsed / 1024).toFixed(0) + ' MB';
                        var dskMeta = document.getElementById('dial-meta-dsk');
                        if (!dskMeta) {
                            dskMeta = E('div', {
                                id: 'dial-meta-dsk',
                                style: 'width: 100%; margin-top: 20px; display: flex; flex-direction: column; gap: 8px;'
                            });
                            var dContainer = document.getElementById('dial-txt-dsk').parentNode.parentNode;
                            dContainer.appendChild(dskMeta);
                        }
                        var fmtSize = function(kb) {
                            if (kb > 1048576) return (kb / 1048576).toFixed(2) + ' GB';
                            return (kb / 1024).toFixed(0) + ' MB';
                        };
                        dskMeta.innerHTML = '';
                        dskMeta.appendChild(E('div', {
                            class: 'hw-stat-row'
                        }, [E('span', {
                            class: 'hw-stat-label'
                        }, 'Physical Total'), E('span', {
                            class: 'hw-stat-value'
                        }, fmtSize(totalPhys > 0 ? totalPhys : totalSpace))]));
                        dskMeta.appendChild(E('div', {
                            class: 'hw-stat-row'
                        }, [E('span', {
                            class: 'hw-stat-label'
                        }, 'Usable Total'), E('span', {
                            class: 'hw-stat-value'
                        }, fmtSize(totalSpace))]));
                        dskMeta.appendChild(E('div', {
                            class: 'hw-stat-row'
                        }, [E('span', {
                            class: 'hw-stat-label'
                        }, 'Usable Free'), E('span', {
                            class: 'hw-stat-value'
                        }, fmtSize(totalSpace - totalUsed))]));
                        if (res.mtd_count > 0) {
                            dskMeta.appendChild(E('div', {
                                class: 'hw-stat-row'
                            }, [E('span', {
                                class: 'hw-stat-label'
                            }, 'MTD Partitions'), E('span', {
                                class: 'hw-stat-value'
                            }, res.mtd_count)]));
                        }
                        var extCardNode = document.getElementById('hw-ext-card');
                        var extMetaNode = document.getElementById('hw-ext-meta');
                        if (extCardNode && extMetaNode) {
                            if (extCount > 0) {
                                extCardNode.style.display = 'flex';
                                extMetaNode.innerHTML = '';
                                extMetaNode.appendChild(E('div', {
                                    class: 'hw-stat-row'
                                }, [E('span', {
                                    class: 'hw-stat-label'
                                }, 'Physical Total'), E('span', {
                                    class: 'hw-stat-value'
                                }, fmtSize(extPhys > 0 ? extPhys : extSpace))]));
                                extMetaNode.appendChild(E('div', {
                                    class: 'hw-stat-row'
                                }, [E('span', {
                                    class: 'hw-stat-label'
                                }, 'Usable Total'), E('span', {
                                    class: 'hw-stat-value'
                                }, fmtSize(extSpace))]));
                                extMetaNode.appendChild(E('div', {
                                    class: 'hw-stat-row'
                                }, [E('span', {
                                    class: 'hw-stat-label'
                                }, 'Usable Free'), E('span', {
                                    class: 'hw-stat-value'
                                }, fmtSize(extSpace - extUsed))]));
                            } else {
                                extCardNode.style.display = 'none';
                            }
                        }
                    }
                }

                if (res.block_devs && Array.isArray(res.block_devs)) {
                    var extWrapper = document.getElementById('my-ext-wrapper');
                    var driveGroups = {};
                    var now = Date.now();

                    res.block_devs.forEach(function(bdev) {
                        if (bdev.dev.indexOf('mmcblk') === 0 || bdev.dev.indexOf('mtd') === 0 || bdev.dev.indexOf('ubi') === 0 || bdev.dev.indexOf('loop') === 0 || bdev.dev.indexOf('zram') === 0) return;

                        var parent = bdev.dev.replace(/[0-9]+$/, '');
                        if (bdev.dev.indexOf('nvme') === 0) {
                            parent = bdev.dev.replace(/p[0-9]+$/, '');
                        }

                        if (!driveGroups[parent]) driveGroups[parent] = {
                            main: null,
                            parts: []
                        };

                        if (bdev.dev === parent) {
                            driveGroups[parent].main = bdev;
                        } else {
                            driveGroups[parent].parts.push(bdev);
                        }
                    });

                    var extDrives = [];
                    for (var p in driveGroups) {
                        var grp = driveGroups[p];
                        if (!grp.main && grp.parts.length > 0) {
                            grp.main = grp.parts[0];
                        }
                        if (grp.main) {
                            extDrives.push(grp);
                        }
                    }

                    if (extWrapper) {
                        extWrapper.innerHTML = '';
                        if (extDrives.length > 0) {
                            var formatSpeed = function(bytesSec) {
                                if (bytesSec > 1024 * 1024) return (bytesSec / (1024 * 1024)).toFixed(1) + ' MB/s';
                                if (bytesSec > 1024) return (bytesSec / 1024).toFixed(1) + ' KB/s';
                                return Math.round(bytesSec) + ' B/s';
                            };

                            var getStats = function(devObj) {
                                var devName = devObj.dev;
                                var curRead = parseInt(devObj.read) || 0;
                                var curWrite = parseInt(devObj.write) || 0;
                                var curRIos = parseInt(devObj.read_ios) || 0;
                                var curWIos = parseInt(devObj.write_ios) || 0;
                                var rSpeed = 0,
                                    wSpeed = 0,
                                    rIops = 0,
                                    wIops = 0;

                                if (self.prevDisk[devName]) {
                                    var prev = self.prevDisk[devName];
                                    var tDiff = (now - prev.time) / 1000.0;
                                    if (tDiff > 0) {
                                        rSpeed = Math.max(0, (curRead - prev.read) / tDiff);
                                        wSpeed = Math.max(0, (curWrite - prev.write) / tDiff);
                                        rIops = Math.max(0, (curRIos - prev.rIos) / tDiff);
                                        wIops = Math.max(0, (curWIos - prev.wIos) / tDiff);
                                    }
                                }
                                self.prevDisk[devName] = {
                                    read: curRead,
                                    write: curWrite,
                                    rIos: curRIos,
                                    wIos: curWIos,
                                    time: now
                                };
                                return {
                                    rSpeed: rSpeed,
                                    wSpeed: wSpeed,
                                    rIops: rIops,
                                    wIops: wIops
                                };
                            };

                            // Advanced Layout Engine: Dynamic dial counting!
                            var dialsCount = document.querySelectorAll('.hw-dial').length;
                            var maxColsPerCard = dialsCount > 0 ? dialsCount : 3;

                            var cards = [];
                            var currentCard = {
                                cols: []
                            };
                            var currentCol = {
                                items: [],
                                weight: 0
                            };
                            var maxWeightPerCol = 4;

                            extDrives.forEach(function(grp) {
                                var weight = 1 + grp.parts.length;

                                if (currentCol.items.length > 0 && currentCol.weight + weight > maxWeightPerCol) {
                                    currentCard.cols.push(currentCol);
                                    currentCol = {
                                        items: [],
                                        weight: 0
                                    };
                                }

                                if (currentCard.cols.length >= maxColsPerCard) {
                                    cards.push(currentCard);
                                    currentCard = {
                                        cols: []
                                    };
                                }

                                currentCol.items.push(grp);
                                currentCol.weight += weight;
                            });

                            if (currentCol.items.length > 0) {
                                currentCard.cols.push(currentCol);
                            }
                            if (currentCard.cols.length > 0) {
                                cards.push(currentCard);
                            }

                            cards.forEach(function(cardData, cardIdx) {
                                var colsCount = cardData.cols.length;

                                // Proportional sizing: card grows proportionally to column count
                                var flexStyle = 'flex: ' + colsCount + ' 1 ' + (colsCount * 280) + 'px;';
                                if (colsCount >= maxColsPerCard) {
                                    flexStyle += ' flex-basis: 100%;';
                                }

                                var titleStr = cards.length > 1 ? 'External Storage (' + (cardIdx + 1) + '/' + cards.length + ')' : 'External Storage';

                                var cardContainer = E('div', {
                                    class: 'hw-thermals-container',
                                    style: 'margin-top: 15px;'
                                });
                                var cardNode = E('div', {
                                    class: 'hw-card',
                                    style: 'justify-content: flex-start; overflow: hidden; ' + flexStyle
                                }, [
                                    E('h3', {}, titleStr),
                                    cardContainer
                                ]);

                                var domCols = [];
                                for (var i = 0; i < colsCount; i++) {
                                    // No min-width limit here! It naturally compresses to fit the row!
                                    domCols.push(E('div', {
                                        class: 'hw-thermals-col hw-thermals-col-mid'
                                    }));
                                }
                                if (domCols.length > 0) {
                                    domCols[0].className = 'hw-thermals-col hw-thermals-col-left';
                                    domCols[domCols.length - 1].className = 'hw-thermals-col hw-thermals-col-right';
                                    if (domCols.length === 1) domCols[0].className = 'hw-thermals-col'; // clean if only 1
                                }

                                cardData.cols.forEach(function(colData, colIdx) {
                                    colData.items.forEach(function(grp) {
                                        var main = grp.main;
                                        var sz = main.size ? (parseInt(main.size) / (1024 * 1024 * 1024)).toFixed(2) + ' GB' : 'Unknown';
                                        var isUsb = main.removable === '1' || main.type === 'USB';
                                        var displayType = isUsb ? 'USB' : main.type;
                                        var mStats = getStats(main);

                                        var box = E('div', {
                                            class: 'hw-progress-item',
                                            style: 'background: rgba(128,128,128,0.05); border: 1px solid var(--border-color, rgba(128,128,128,0.1)); border-radius: 8px; padding: 12px; margin-bottom: 12px; overflow: hidden;'
                                        }, [
                                            E('div', {
                                                style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid var(--border-color, rgba(128,128,128,0.2)); padding-bottom: 8px;'
                                            }, [
                                                E('span', {
                                                    style: 'font-weight: bold; font-size: 1.1em;'
                                                }, main.dev.toUpperCase()),
                                                E('span', {
                                                    style: 'color: #ffea00; font-weight: bold;'
                                                }, sz)
                                            ]),
                                            E('div', {
                                                style: 'display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.9em;'
                                            }, [
                                                E('span', {
                                                    style: 'opacity: 0.8;'
                                                }, 'Model:'),
                                                E('span', {
                                                    style: 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; text-align: right;'
                                                }, main.model)
                                            ]),
                                            E('div', {
                                                style: 'display: flex; justify-content: space-between; font-size: 0.9em; margin-bottom: 8px;'
                                            }, [
                                                E('span', {
                                                    style: 'opacity: 0.8;'
                                                }, 'Type:'),
                                                E('span', {}, displayType)
                                            ])
                                        ]);

                                        if (grp.parts.length > 0) {
                                            var partsContainer = E('div', {
                                                style: 'margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-color, rgba(128,128,128,0.3));'
                                            });
                                            grp.parts.forEach(function(part) {
                                                var psz = part.size ? (parseInt(part.size) / (1024 * 1024 * 1024)).toFixed(2) + ' GB' : '';
                                                var formatStr = (part.fs && part.fs !== 'Unknown') ? part.fs : 'Unmounted';
                                                var pStats = getStats(part);

                                                var pRow = E('div', {
                                                    style: 'margin-bottom: 12px;'
                                                }, [
                                                    E('div', {
                                                        style: 'display: flex; justify-content: space-between; font-size: 0.9em; font-weight: bold;'
                                                    }, [
                                                        E('span', {
                                                            style: 'color: #00bcd4;'
                                                        }, part.dev.toUpperCase()),
                                                        E('span', {}, psz)
                                                    ]),
                                                    E('div', {
                                                        style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8; margin-top: 4px;'
                                                    }, [
                                                        E('span', {}, 'Format:'),
                                                        E('span', {
                                                            style: 'color: #00e676;'
                                                        }, formatStr)
                                                    ]),
                                                    E('div', {
                                                        style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.7; margin-top: 6px;'
                                                    }, [
                                                        E('span', {}, 'Speed:'),
                                                        E('span', {}, 'R: ' + formatSpeed(pStats.rSpeed) + ' / W: ' + formatSpeed(pStats.wSpeed))
                                                    ]),
                                                    E('div', {
                                                        style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.6; margin-top: 2px;'
                                                    }, [
                                                        E('span', {}, 'IOPS:'),
                                                        E('span', {}, 'R: ' + Math.round(pStats.rIops) + ' / W: ' + Math.round(pStats.wIops))
                                                    ])
                                                ]);
                                                partsContainer.appendChild(pRow);
                                            });
                                            box.appendChild(partsContainer);
                                        } else {
                                            var footer = E('div', {
                                                style: 'margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-color, rgba(128,128,128,0.3));'
                                            }, [
                                                E('div', {
                                                    style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.7; margin-top: 4px;'
                                                }, [
                                                    E('span', {}, 'Speed:'),
                                                    E('span', {}, 'R: ' + formatSpeed(mStats.rSpeed) + ' / W: ' + formatSpeed(mStats.wSpeed))
                                                ]),
                                                E('div', {
                                                    style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.6; margin-top: 2px;'
                                                }, [
                                                    E('span', {}, 'IOPS:'),
                                                    E('span', {}, 'R: ' + Math.round(mStats.rIops) + ' / W: ' + Math.round(mStats.wIops))
                                                ])
                                            ]);
                                            box.appendChild(footer);
                                        }
                                        domCols[colIdx].appendChild(box);
                                    });
                                });

                                for (var i = 0; i < domCols.length; i++) {
                                    cardContainer.appendChild(domCols[i]);
                                    if (i < domCols.length - 1) {
                                        cardContainer.appendChild(E('div', {
                                            class: 'hw-thermals-divider'
                                        }));
                                    }
                                }

                                extWrapper.appendChild(cardNode);
                            });
                        }
                    }
                }
                if (res.thermals && res.thermals.length > 0) {
                    thermCard.style.display = 'flex';
                    if (res.model) {
                        var title = res.model;
                        if (title.length > 30) title = title.substring(0, 30);
                        var tEl = document.getElementById('title-cpu');
                        if (tEl && tEl.textContent !== title) tEl.textContent = title;
                    }
                    var cpuNode = document.getElementById('hw-thermals-cpu');
                    var wifiNode = document.getElementById('hw-thermals-wifi');
                    var miscNode = document.getElementById('hw-thermals-misc');
                    if (cpuNode) cpuNode.innerHTML = '';
                    if (wifiNode) wifiNode.innerHTML = '';
                    if (miscNode) miscNode.innerHTML = '';
                    var sortedThermals = res.thermals.sort(function(a, b) {
                        return a.type.localeCompare(b.type);
                    });
                    var seenSensors = {};
                    sortedThermals.forEach(function(t) {
                        var tempC = t.temp;
                        if (tempC > 1000) tempC = tempC / 1000;
                        var name = t.type.replace(/_/g, '-').toUpperCase();
                        if (seenSensors[name]) return;
                        seenSensors[name] = true;
                        if (name.length > 20) name = name.substring(0, 20);
                        var color = '#ffea00';
                        var bgCol = 'rgba(255,234,0,0.1)';
                        if (tempC >= 80) {
                            color = '#ff1744';
                            bgCol = 'rgba(255,23,68,0.1)';
                        } else if (tempC <= 60) {
                            color = '#00bcd4';
                            bgCol = 'rgba(0,188,212,0.1)';
                        }
                        var crit = t.crit && t.crit !== 'null' ? parseInt(t.crit) : null;
                        var pass = t.pass && t.pass !== 'null' ? parseInt(t.pass) : null;
                        if (crit && crit > 1000) crit = crit / 1000;
                        if (pass && pass > 1000) pass = pass / 1000;
                        var lowerName = name.toLowerCase();
                        var targetCol = null;
                        if (lowerName.indexOf('cpu') !== -1 || lowerName.indexOf('soc') !== -1 || lowerName.indexOf('cpu_ss') !== -1 || lowerName.indexOf('top-glue') !== -1) {
                            targetCol = cpuNode;
                        } else if (lowerName.indexOf('wifi') !== -1 || lowerName.indexOf('wlan') !== -1 || lowerName.indexOf('wcss') !== -1 || lowerName.indexOf('phy') !== -1 || lowerName.indexOf('radio') !== -1 || lowerName.indexOf('mt798') !== -1 || lowerName.indexOf('ath') !== -1) {
                            targetCol = wifiNode;
                        } else {
                            targetCol = miscNode;
                        }
                        var tempDisplay = tempC.toFixed(1) + ' °C';
                        if (tempC >= 90) tempDisplay += ' ⚠️';
                        var badgeAttrs = {
                            class: 'hw-temp-badge',
                            style: 'color: ' + color + '; background: ' + bgCol + ';'
                        };
                        var rowContent = [E('div', {
                            class: 'hw-stat-row',
                            style: 'border-bottom: none; padding-bottom: 0;'
                        }, [E('span', {
                            class: 'hw-stat-label'
                        }, name), E('span', badgeAttrs, tempDisplay)])];
                        if (pass || crit) {
                            var tripsDiv = E('div', {
                                style: 'display: flex; justify-content: flex-end; gap: 6px; font-size: 0.75em; padding-top: 6px;'
                            });
                            if (pass) {
                                tripsDiv.appendChild(E('span', {
                                    style: 'color: #ffb300; background: rgba(255,179,0,0.15); padding: 2px 6px; border-radius: 4px; font-weight: 600; letter-spacing: 0.5px;'
                                }, 'PASS ' + pass.toFixed(0) + '°'));
                            }
                            if (crit) {
                                tripsDiv.appendChild(E('span', {
                                    style: 'color: #ff1744; background: rgba(255,23,68,0.15); padding: 2px 6px; border-radius: 4px; font-weight: 600; letter-spacing: 0.5px;'
                                }, 'CRIT ' + crit.toFixed(0) + '°'));
                            }
                            rowContent.push(tripsDiv);
                        }
                        var row = E('div', {
                            style: 'padding: 5px 0; border-bottom: 1px solid var(--border-color, rgba(128,128,128,0.1));'
                        }, rowContent);
                        if (targetCol) targetCol.appendChild(row);
                    });
                    if (cpuNode && cpuNode.lastChild) cpuNode.lastChild.style.borderBottom = 'none';
                    if (wifiNode && wifiNode.lastChild) wifiNode.lastChild.style.borderBottom = 'none';
                    if (miscNode && miscNode.lastChild) miscNode.lastChild.style.borderBottom = 'none';
                    var wifiColNode = document.getElementById('hw-thermals-col-wifi');
                    var wifiDivNode = document.getElementById('hw-thermals-divider-wifi');
                    if (wifiNode && wifiNode.children.length === 0) {
                        if (wifiColNode) wifiColNode.style.display = 'none';
                        if (wifiDivNode) wifiDivNode.style.display = 'none';
                    } else {
                        if (wifiColNode) wifiColNode.style.display = 'block';
                        if (wifiDivNode) wifiDivNode.style.display = 'block';
                    }
                    var miscColNode = document.getElementById('hw-thermals-col-misc');
                    var miscDivNode = document.getElementById('hw-thermals-divider-misc');
                    if (miscNode && miscNode.children.length === 0) {
                        if (miscColNode) miscColNode.style.display = 'none';
                        if (miscDivNode) miscDivNode.style.display = 'none';
                    } else {
                        if (miscColNode) miscColNode.style.display = 'block';
                        if (miscDivNode) miscDivNode.style.display = 'block';
                    }
                } else {
                    thermCard.style.display = 'none';
                }
                                if (res.eth_links && res.eth_links.length > 0) {
                    ethCard.style.display = 'flex';
                    var elNode = document.getElementById('hw-eth-links');
                    if (elNode) {
                        elNode.innerHTML = '';
                        res.eth_links.forEach(function(l) {
                            var st = l.speed;
                            var col = '#9e9e9e';
                            if (st.indexOf('10000') >= 0 || st.indexOf('2500') >= 0 || st.indexOf('1000') >= 0) col = '#00e676';
                            else if (st.indexOf('100') >= 0 || st.indexOf('10') >= 0) col = '#ffea00';
                            
                            var rxErr = parseInt(l.rx_err) || 0, txErr = parseInt(l.tx_err) || 0;
                            var rxDrop = parseInt(l.rx_drop) || 0, txDrop = parseInt(l.tx_drop) || 0;
                            
                            var box = E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; border-left: 4px solid ' + col + '; margin-bottom: 4px;' }, [
                                E('div', { style: 'display: flex; justify-content: space-between; align-items: center;' }, [
                                    E('div', { style: 'display: flex; align-items: center; gap: 8px;' }, [
                                        E('div', { style: 'width: 10px; height: 10px; border-radius: 50%; background-color: ' + col + '; box-shadow: 0 0 5px ' + col + '; flex-shrink: 0;' }),
                                        E('span', { style: 'font-weight: bold;' }, l.iface.toUpperCase())
                                    ]),
                                    E('span', { style: 'color:' + col + ';' }, st === 'Down' ? 'Disconnected' : st + ' Mbps (' + l.duplex + ')')
                                ])
                            ]);
                            
                            if (st !== 'Down') {
                                var errColor = (rxErr > 0 || txErr > 0 || rxDrop > 0 || txDrop > 0) ? '#ff5252' : 'currentColor';
                                box.appendChild(E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8; margin-top: 6px; border-top: 1px dashed rgba(128,128,128,0.3); padding-top: 6px;' }, [
                                    E('span', {}, 'Errors/Drops:'),
                                    E('span', { style: 'color:' + errColor + ';' }, 'Rx: ' + rxErr + '/' + rxDrop + ' | Tx: ' + txErr + '/' + txDrop)
                                ]));
                            }
                            elNode.appendChild(box);
                        });
                    }
                } else {
                    ethCard.style.display = 'none';
                }

                var validPcie = [];
                if (res.pcie_devs) {
                    validPcie = res.pcie_devs.filter(function(p){ var n = p.name.toLowerCase(); return p.speed !== 'Unknown' && n !== 'unknown' && n.indexOf('unknown device')===-1 && n.indexOf('controller')===-1 && n.indexOf('bridge')===-1 && n.indexOf('root')===-1; });
                }
                var validUsbControllers = [];
                var validUsbDevices = [];
                var hasUsb = false;
                if (res.usb_devs) {
                    validUsbControllers = res.usb_devs.filter(function(u){ var n = u.name.toLowerCase(); return n !== 'unknown' && n.indexOf('unknown device')===-1 && (n.indexOf('controller')>-1 || n.indexOf('linux')>-1 || n.indexOf('root hub')>-1); });
                    validUsbDevices = res.usb_devs.filter(function(u){ var n = u.name.toLowerCase(); return n !== 'unknown' && n.indexOf('unknown device')===-1 && n.indexOf('controller')===-1 && n.indexOf('linux')===-1 && n.indexOf('root hub')===-1; });
                    if (validUsbControllers.length > 0 || validUsbDevices.length > 0) hasUsb = true;
                }

                if (validPcie.length > 0 || hasUsb) {
                    pcieUsbCard.style.display = 'flex';
                    var puNode = document.getElementById('hw-pcie-usb');
                    if (puNode) {
                        puNode.innerHTML = '';
                        if (validPcie.length > 0) {
                            puNode.appendChild(E('h4', { style: 'margin: 0 0 8px 0; font-size: 0.85em; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px;' }, 'PCI-e Bus'));
                            validPcie.forEach(function(p) {
                                var speedStr = p.speed + ' ' + p.width;
                                if (p.max_speed !== 'Unknown' && p.speed !== p.max_speed) speedStr += ' (Max: ' + p.max_speed + ')';
                                puNode.appendChild(E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; margin-bottom: 6px;' }, [
                                    E('div', { style: 'font-weight: bold; margin-bottom: 4px;' }, p.name),
                                    E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8;' }, [
                                        E('span', {}, 'Link Speed:'),
                                        E('span', { style: p.speed !== p.max_speed ? 'color:#ffea00;' : '' }, speedStr)
                                    ])
                                ]));
                            });
                        }
                        if (hasUsb) {
                            puNode.appendChild(E('h4', { style: 'margin: ' + (validPcie.length > 0 ? '8px' : '0') + ' 0 8px 0; font-size: 0.85em; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px;' }, 'USB Bus'));
                            if (validUsbControllers.length > 0) {
                                var speeds = validUsbControllers.map(function(u){ return parseInt(u.speed) || 0; });
                                var maxSpeed = Math.max.apply(null, speeds);
                                var minSpeed = Math.min.apply(null, speeds);
                                var hwPortStr = '';
                                if (res.model && (res.model.indexOf('JIDU6J01') > -1 || /JIDU6[0-9]01/.test(res.model))) {
                                    hwPortStr = 'USB 2.0 (Physical Port)';
                                } else if (res.model && (res.model.indexOf('JIDU6J11') > -1 || /JIDU6[0-9]11/.test(res.model))) {
                                    hwPortStr = 'USB 3.0 (Physical Port)';
                                } else if (maxSpeed >= 10000) {
                                    hwPortStr = 'USB 3.1 / 3.2 Capable (Physical Port)';
                                } else if (maxSpeed >= 5000) {
                                    hwPortStr = 'USB 3.0 Capable (Physical Port)';
                                } else if (maxSpeed >= 480) {
                                    hwPortStr = 'USB 2.0 Capable (Physical Port)';
                                } else if (maxSpeed > 0) {
                                    hwPortStr = 'USB 1.1 Capable (Physical Port)';
                                }
                                var usbHostRows = [
                                    E('div', { style: 'font-weight: bold; margin-bottom: 4px;' }, 'USB Host Controllers'),
                                    E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8;' }, [
                                        E('span', {}, 'Bus Speeds:'),
                                        E('span', { style: 'color:#00e676;' }, 'Max: ' + maxSpeed + ' Mbps | Min: ' + minSpeed + ' Mbps')
                                    ])
                                ];
                                if (hwPortStr) {
                                    usbHostRows.push(E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8; margin-top: 4px; border-top: 1px dashed rgba(128,128,128,0.3); padding-top: 4px;' }, [
                                        E('span', {}, 'Hardware Port:'),
                                        E('span', { style: 'color:#ffea00;' }, hwPortStr)
                                    ]));
                                }
                                puNode.appendChild(E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; margin-bottom: 6px;' }, usbHostRows));
                            }
                            validUsbDevices.forEach(function(u) {
                                var isSlow = u.speed === '480' || u.speed === '12' || u.speed === '1.5';
                                puNode.appendChild(E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; margin-bottom: 6px;' }, [
                                    E('div', { style: 'font-weight: bold; margin-bottom: 4px;' }, u.name),
                                    E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8;' }, [
                                        E('span', {}, 'Speed & Version:'),
                                        E('span', { style: isSlow ? 'color:#ffea00;' : 'color:#00e676;' }, u.speed + ' Mbps (' + u.version.trim() + ')')
                                    ])
                                ]));
                            });
                        }
                    }
                } else {
                    pcieUsbCard.style.display = 'none';
                }

                if (res.wifi_radios && res.wifi_radios.length > 0) {
                    wifiCard.style.display = 'flex';
                    var wfNode = document.getElementById('hw-wifi-radios');
                    if (wfNode) {
                        wfNode.innerHTML = '';
                        res.wifi_radios.forEach(function(w) {
                            wfNode.appendChild(E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; margin-bottom: 6px;' }, [
                                E('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid rgba(128,128,128,0.2); padding-bottom: 8px;' }, [
                                    E('span', { style: 'font-weight: bold;' }, w.iface.toUpperCase() + ' (' + w.band + ')'),
                                    E('span', { style: 'color:#00e676; font-size: 0.9em;' }, 'Ch: ' + w.channel)
                                ]),
                                w.hardware && w.hardware !== 'Unknown' ? E('div', { class: 'hw-wifi-ssid', style: 'font-size: 0.9em; margin-bottom: 4px;' }, w.hardware) : '',
                                w.hwmode && w.hwmode !== 'Unknown' ? E('div', { class: 'hw-wifi-detail' }, 'HW Mode(s): ' + w.hwmode) : '',
                                w.channel && w.channel !== 'unknown' && w.channel !== '0' ? E('div', { class: 'hw-wifi-detail' }, 'Channel: ' + w.channel) : '',
                                w.txpower && w.txpower !== 'Unknown' ? E('div', { class: 'hw-wifi-detail' }, 'Max TX Power: ' + w.txpower) : ''
                            ]));
                        });
                    }
                } else {
                    wifiCard.style.display = 'none';
                }

            }).catch(function(err) {
                console.error(err);
            });
        }, 3);

        return container;
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
