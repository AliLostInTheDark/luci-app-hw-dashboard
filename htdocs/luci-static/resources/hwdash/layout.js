'use strict';
'require baseclass';
'require hwdash.ui as ui';

// Drag-to-reorder and a three-step width (small, half, full) for every card.
// Both are staged and saved like the other settings.

var SIZES = ['small', 'half', 'wide'];

return baseclass.extend({
	create: function(dash, container, cards) {
		var keys = Object.keys(cards), defaultSize = {};
		keys.forEach(function(k) {
			cards[k].node.__hwCardKey = k;
			defaultSize[k] = cards[k].node.classList.contains('wide') ? 'wide' : 'small';
		});

		function domOrder() {
			var order = [];
			Array.prototype.forEach.call(container.children, function(n) {
				if (n.__hwCardKey && order.indexOf(n.__hwCardKey) === -1)
					order.push(n.__hwCardKey);
			});
			return order;
		}

		// An empty saved order means the order the cards render in now, so no
		// one who never moved a card sees anything reshuffle.
		var defaultOrder = domOrder();

		function sizeOf(k) {
			return dash.cardSize[k] || defaultSize[k];
		}

		function applySizes() {
			keys.forEach(function(k) {
				var n = cards[k].node, size = sizeOf(k);
				n.classList.toggle('wide', size === 'wide');
				n.classList.toggle('half', size === 'half');
				ui.setText(n.__hwSizeBtn, size.charAt(0).toUpperCase());
			});
		}

		function apply() {
			var seen = {};
			var order = dash.cardOrder.filter(function(k) { return cards[k] && !seen[k] && (seen[k] = true); });
			defaultOrder.forEach(function(k) { if (!seen[k]) order.push(k); });
			// appendChild moves the live node, so nothing is rebuilt.
			order.forEach(function(k) { container.appendChild(cards[k].node); });
			applySizes();
		}

		// A fixed-position clone follows the pointer while the real card,
		// dimmed, moves through the grid. The clone takes no pointer events,
		// so hit-testing always finds the card underneath. The listeners go on
		// document: without reliable pointer capture the handle stops getting
		// events the moment the pointer leaves it.
		function drag(ev, card) {
			ev.preventDefault();
			var rect = card.getBoundingClientRect(), dx = ev.clientX - rect.left, dy = ev.clientY - rect.top;
			var ghost = card.cloneNode(true);
			ghost.querySelector('.hw-card-editbar').remove();
			ghost.classList.add('hw-card-ghost');
			ghost.style.width = rect.width + 'px';
			ghost.style.height = rect.height + 'px';
			ghost.style.left = rect.left + 'px';
			ghost.style.top = rect.top + 'px';
			document.body.appendChild(ghost);
			card.classList.add('hw-card-placeholder');

			var over = null;
			var move = function(mv) {
				ghost.style.left = mv.clientX - dx + 'px';
				ghost.style.top = mv.clientY - dy + 'px';
				var target = document.elementFromPoint(mv.clientX, mv.clientY);
				while (target && target.parentNode !== container)
					target = target.parentNode;
				if (!target || target === card || target === over || !target.__hwCardKey)
					return;
				over = target;
				var r = target.getBoundingClientRect();
				container.insertBefore(card, mv.clientY < r.top + r.height / 2 ? target : target.nextSibling);
			};
			var drop = function() {
				ghost.remove();
				card.classList.remove('hw-card-placeholder');
				document.removeEventListener('pointermove', move);
				document.removeEventListener('pointerup', drop);
				document.removeEventListener('pointercancel', drop);
				dash.cardOrder = domOrder();
				dash.settings.markDirty();
			};
			document.addEventListener('pointermove', move);
			document.addEventListener('pointerup', drop);
			document.addEventListener('pointercancel', drop);
		}

		keys.forEach(function(k) {
			var card = cards[k].node;
			var handle = E('span', { class: 'hw-card-handle', title: _('Drag to reorder') }, ['☰']);
			var sizeBtn = E('button', { type: 'button', class: 'hw-card-sizebtn', title: _('Card width: Small / Half / Full — click to cycle') });
			sizeBtn.addEventListener('click', function() {
				dash.cardSize[k] = SIZES[(SIZES.indexOf(sizeOf(k)) + 1) % SIZES.length];
				applySizes();
				dash.settings.markDirty();
			});
			handle.addEventListener('pointerdown', function(ev) { drag(ev, card); });
			card.__hwSizeBtn = sizeBtn;
			card.insertBefore(E('div', { class: 'hw-card-editbar' }, [handle, sizeBtn]), card.firstChild);
		});

		var button = E('button', { type: 'button', class: 'cbi-button' }, [_('⇕ Rearrange Cards')]);
		button.addEventListener('click', function() {
			var on = container.classList.toggle('hw-rearranging');
			ui.setText(button, on ? _('✓ Done Arranging') : _('⇕ Rearrange Cards'));
		});

		apply();
		return { button: button, apply: apply };
	}
});
