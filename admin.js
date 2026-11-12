// AuroraGlass theme patch (loads on all /admin pages): marks the active category in the top menu,
// since the theme does not highlight the active item by itself.
(function () {
	function sync() {
		var top = document.getElementById('topmenu');
		if (!top) return;
		// label of the active category = same text used in the top-menu item
		var g = document.querySelector('.is-active-group .nav-category-label');
		var active = g ? g.textContent.trim() : '';
		var items = top.querySelectorAll('a.menu');
		for (var i = 0; i < items.length; i++) {
			var a = items[i];
			var on = active && a.textContent.trim() === active;
			a.classList.toggle('is-current', !!on);
			var li = a.closest('li');
			if (li) li.classList.toggle('is-current', !!on);
		}
	}
	// Turns each port card (.ifacebox) into a card that flips (hover on desktop,
	// tap on mobile) and shows ALL the info on the back, instead of the tooltip. Idempotent.
	// Reads "Label: value" from a text into {label: [values]} (no repeats), ignoring member ports.
	function parseFields(text) {
		text = (text || '').replace(/\s+/g, ' ').split(/\(\s*Tipo:/)[0];
		// port statistics labels (tooltip) go here; the longer label must come before the shorter one
		var labels = ['Protocolo', 'Protocol', 'Carrier', 'Uptime', 'Operator', 'Tipo da conex[^:]*', 'Tipo', 'Dispositivo', 'Conectado', 'Operadora', 'Tempo de atividade', 'Endere[^:]*MAC', 'MAC', 'IPv4', 'IPv6', 'Gateway', 'DNS', 'Expira[^:]*', 'RX', 'TX', 'Parte das? redes?',
			'Bytes recebidos', 'Pacotes recebidos', 'Multicast recebido', 'Erros de recebimento', 'Receber descartado', 'Bytes transmitidos', 'Pacotes transmitidos e perdidos', 'Pacotes transmitidos', 'Pacotes com erro de envio', 'Colisões registradas'];
		var re = new RegExp('(' + labels.join('|') + ')\\s*:', 'g');
		var segs = text.replace(re, '\u0001$1:').split('\u0001');
		var map = {};
		segs.forEach(function (s) {
			var i = s.indexOf(':'); if (i < 1) return;
			var k = s.slice(0, i).trim().replace(/^Endere.*MAC$/, 'MAC').replace(/^Parte da rede$/, 'Rede');
			var v = s.slice(i + 1).trim();
			if (!v) return; if (!map[k]) map[k] = []; if (map[k].indexOf(v) < 0) map[k].push(v);
		});
		return map;
	}
	var ORDER = ['Protocolo', 'Tipo', 'Dispositivo', 'Conectado', 'Operadora', 'Tempo de atividade', 'MAC', 'IPv4', 'IPv6', 'Gateway', 'DNS', 'Rede', 'RX', 'TX',
		'Bytes recebidos', 'Pacotes recebidos', 'Multicast recebido', 'Erros de recebimento', 'Receber descartado', 'Bytes transmitidos', 'Pacotes transmitidos', 'Pacotes transmitidos e perdidos', 'Pacotes com erro de envio', 'Colisões registradas'];
	// joins the text of ALL the card's tooltips (the port has one with the network and another with the statistics)
	function allTipText(box) {
		return Array.prototype.map.call(box.querySelectorAll('.cbi-tooltip'), function (t) { return t.textContent; }).join(' ');
	}
	// translates a word through LuCI (_), or uses the word itself if that function does not exist
	function lx(s) { return (typeof _ === 'function') ? _(s) : s; }
	// escapes special characters so the text can be used inside a regex
	function reEsc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
	// reads "Connected: yes" / "Conectado: sí" (any language) and returns true/false
	function connectedState(box) {
		var txt = allTipText(box);
		var label = reEsc(lx('Connected'));
		if (new RegExp(label + '\\s*:?\\s*' + reEsc(lx('yes')), 'i').test(txt)) return true;
		if (new RegExp(label + '\\s*:?\\s*' + reEsc(lx('no')), 'i').test(txt)) return false;
		// no network tooltip: uses LuCI's own port icon (port_up / port_down)
		if (box.querySelector('img[src*="port_down"], img[src*="port_pse_down"]')) return false;
		if (box.querySelector('img[src*="port_up"], img[src*="port_pse_up"]')) return true;
		return /\d+\s*h\s*\d+\s*m|\d+\s*m\s*\d+\s*s/.test(txt);   // last resort: uptime
	}
	// type of each bridge member, in the same order as the icons (e.g. Bridge, Switch port); null if it cannot be read
	function memberTypes(text) {
		var t = (text || '').replace(/\s+/g, ' ');
		var parts = t.split(/(?=(?:Tipo|Type)\s*:)/).filter(function (x) { return /^(Tipo|Type)\s*:/.test(x.trim()); });
		if (parts.length < 2) return null;
		return parts.map(function (part) {
			var m = part.match(/(?:Tipo|Type)\s*:\s*(.+?)(?=\s*(?:Dispositivo|Device|Conectado|Connected|MAC|RX|TX)\s*:|$)/);
			return m ? m[1].trim() : '';
		});
	}
	// splits a bridge's text (several members, each starting with "Type:") into blocks and builds one HTML per member
	// bridge back: puts what is the same in all members (MAC, connection) in a header and lists only what changes per member
	function memberGroups(text) {
		var t = (text || '').replace(/\s+/g, ' ');
		var parts = t.split(/(?=(?:Tipo|Type)\s*:)/).filter(function (x) { return /^(Tipo|Type)\s*:/.test(x.trim()); });
		if (parts.length < 2) return null;
		var next = '(?=(?:Tipo|Type|Dispositivo|Device|Conectado|Connected|MAC|RX|TX)\s*:|$)';
		function get(part, re) { var m = part.match(new RegExp(re + '\s*:\s*(.+?)' + next)); return m ? m[1].trim() : ''; }
		var items = parts.map(function (part) {
			return { type: get(part, '(?:Tipo|Type)'), dev: get(part, '(?:Dispositivo|Device)'), conn: get(part, '(?:Conectado|Connected)'),
				mac: get(part, 'MAC'), rx: get(part, 'RX'), tx: get(part, 'TX') };
		});
		function same(k) { return items.every(function (it) { return it[k] && it[k] === items[0][k]; }); }
		var common = [];
		if (same('mac')) common.push('MAC: <b>' + items[0].mac + '</b>');
		var head = common.length ? '<div class="ib-member-common">' + common.map(function (c) { return '<div class="ib-back-line">' + c + '</div>'; }).join('') + '</div>' : '';
		var blocks = items.map(function (it) {
			var rows = '<div class="ib-back-line">Tipo: <b>' + it.type + '</b></div>';
			if (!same('mac')) rows += '<div class="ib-back-line ib-mac">MAC: <b>' + it.mac + '</b></div>';
			if (!same('conn')) rows += '<div class="ib-back-line">Conectado: <b>' + it.conn + '</b></div>';
			rows += '<div class="ib-back-line">RX: <b>' + it.rx + '</b></div><div class="ib-back-line">TX: <b>' + it.tx + '</b></div>';
			return '<div class="ib-member"><div class="ib-member-name">' + it.dev + '</div>' + rows + '</div>';
		});
		return { head: head, blocks: blocks };
	}
	// horizontal prism: rotates the container so face k faces front (each click = 360° / N)
	// even distance between the bottom of the prism (faces, already tilted) and the buttons below
	function prismSpace(box) {
		// buttons and the space below are the same on all cards (CSS): no per-card adjustment
		box.style.marginBottom = '';
		var row = box.closest('tr');
		if (row) [].forEach.call(row.querySelectorAll('button, .cbi-button, a.cbi-button'), function (b) { b.style.position = ''; b.style.top = ''; });
	}
	var PRISM_TILT = -13;   // tilt (degrees) of the prism, to see the base
	function sideDir(el, e) { var r = el.getBoundingClientRect(); return (e.clientX - r.left) / r.width < 0.33 ? 1 : -1; }
	// turns the front/back card 180° per step (continuous: it does not turn back on its own)
	var boxTurn = {};   // turn state of the cards on the current page (kept in memory; reset when the page changes)
	function flipSpin(box, dir) {
		var t = (+box.getAttribute('data-turn') || 0) + dir;
		boxTurn[box.getAttribute('data-flipkey')] = t;
		box.setAttribute('data-turn', t);
		box.setAttribute('data-lastdir', dir);
		box.querySelector('.flip-inner').style.transform = 'rotateY(' + (-t * 180) + 'deg)';
	}
	function sideOf(el, e) { var r = el.getBoundingClientRect(); return (e.clientX - r.left) < r.width / 2 ? 'L' : 'R'; }
	// prism outline drawn in SVG (a single line): computes the silhouette of each face visible in the current turn
	function drawPrismOutline(box, t, n, r, dx, dy, vs) {
		var inner = box.querySelector('.flip-inner');
		var svg = box.querySelector('svg.prism-outline');
		if (!svg) {
			svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('class', 'prism-outline');
			box.appendChild(svg);
		}
		var faces = [].slice.call(inner.querySelectorAll(':scope > div:not(.prism-cap)'));
		var P = 700, step = 360 / n, rad = Math.PI / 180;
		var cx = inner.offsetWidth / 2, cy = 144;   // card center (perspective origin)
		var tilt = PRISM_TILT * rad, spin = -t * step * rad;
		var rotX = function (v) { var c = Math.cos(tilt), s = Math.sin(tilt); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };
		var rotY = function (v, a) { var c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };
		var d = '', k = 0;
		faces.forEach(function (f, i) {
			var a = i * step * rad;
			var n0 = rotX(rotY(rotY([0, 0, 1], a), spin));   // direction of the face after the prism rotation
			if (n0[2] <= 0) return;                          // back face: not shown
			var w = parseFloat(f.style.width) || 0, pts = [[-w / 2, -144], [w / 2, -144], [w / 2, 144], [-w / 2, 144]];
			var seg = pts.map(function (p) {
				var q = rotY([p[0], p[1], r], a);            // face in its place
				q = rotY(q, spin); q = rotX(q);              // prism turn and tilt
				q[2] -= r; q[1] *= vs;                       // same transform as the CSS
				var f2 = P / (P - q[2]);
				return [cx + (q[0] + dx) * f2, cy + (q[1] + dy) * f2];
			});
			d += 'M' + seg.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L') + ' Z ';
		});
		svg.style.left = inner.offsetLeft + 'px';   // aligns the SVG with the card frame (without the inner margin)
		svg.style.top = inner.offsetTop + 'px';
		svg.setAttribute('width', inner.offsetWidth);
		svg.setAttribute('height', 288);
		svg.setAttribute('viewBox', '0 0 ' + inner.offsetWidth + ' 288');
		svg.innerHTML = '<path d="' + d + '"></path>';
	}
	function prismSet(box, inner, t, n, r) {
		// t = accumulated number of turns (may exceed N): the rotation always goes in the same direction
		var k = ((t % n) + n) % n;
		// first time: mounts directly in the right position, without the entry animation (which made the icons drop)
		var first = !box.hasAttribute('data-faces');
		if (first) inner.style.transition = 'none';
		box.setAttribute('data-faces', n);
		box.setAttribute('data-r', r);
		box.setAttribute('data-face', k);
		box.setAttribute('data-turn', t);
		var dx = box._prismDx ? box._prismDx[k] : 0;
		var dy = box._prismDy ? box._prismDy[k] : 0, vs = box._prismV ? box._prismV[k] : 1;   // aligns top and bottom with the card   // centers the prism on this turn
		inner.style.transform = 'translateX(' + dx.toFixed(1) + 'px) translateY(' + dy.toFixed(1) + 'px) scaleY(' + vs.toFixed(3) + ') translateZ(-' + r + 'px) rotateX(' + PRISM_TILT + 'deg) rotateY(' + (-t * 360 / n) + 'deg)';
		if (first) { void inner.offsetWidth; inner.style.transition = ''; }   // releases the animation after mounting
		// the outline turns together with the faces (same duration as the CSS animation)
		var fromT = (box._outT !== undefined) ? box._outT : t;
		var fromDx = (box._outDx !== undefined) ? box._outDx : dx, fromDy = (box._outDy !== undefined) ? box._outDy : dy, fromV = (box._outV !== undefined) ? box._outV : vs;
		box._outT = t; box._outDx = dx; box._outDy = dy; box._outV = vs;
		if (box._outRaf) cancelAnimationFrame(box._outRaf);
		if (first || fromT === t) { drawPrismOutline(box, t, n, r, dx, dy, vs); }
		else {
			var t0 = performance.now();
			var stepOut = function (now) {
				var p = Math.min(1, (now - t0) / 900), e = p;   // linear: same as the CSS transition of the prism (turn, shift and scale)
				drawPrismOutline(box, fromT + (t - fromT) * e, n, r, fromDx + (dx - fromDx) * e, fromDy + (dy - fromDy) * e, fromV + (vs - fromV) * e);
				if (p < 1) box._outRaf = requestAnimationFrame(stepOut);
			};
			box._outRaf = requestAnimationFrame(stepOut);
		}
	}
	// shrinks the prism until, in every turn, the faces are at most 10px from each edge of the card
	function prismFit(box, inner, faces, geo, n, step, r) {
		var card = box.getBoundingClientRect();
		if (!card.width) return 1;                     // card hidden: cannot measure
		var oldT = inner.style.transition;
		inner.style.transition = 'none';               // measures the final position, not the animation
		var s = 1, avail = card.width - 20;            // scale: grows until it reaches the 10px margin on each side
		for (var it = 0; it < 10; it++) {
			geo(s);
			var worst = 0;
			for (var k = 0; k < n; k++) {
				inner.style.transform = 'translateZ(' + (-r * s) + 'px) rotateX(' + PRISM_TILT + 'deg) rotateY(' + (-k * step) + 'deg)';
				var lo = Infinity, hi = -Infinity;
				faces.forEach(function (fc) { var q = fc.getBoundingClientRect(); if (q.left < lo) lo = q.left; if (q.right > hi) hi = q.right; });
				if (hi - lo > worst) worst = hi - lo;
			}
			if (worst > avail) s *= avail / worst * 0.99;          // over the margin: shrinks
			else if (worst < avail * 0.97) s *= avail * 0.985 / worst;   // space left: grows until it reaches the margin
			else break;
		}
		var dxs = [];
		for (var k2 = 0; k2 < n; k2++) {
			inner.style.transform = 'translateZ(' + (-r * s) + 'px) rotateX(' + PRISM_TILT + 'deg) rotateY(' + (-k2 * step) + 'deg)';
			var lo2 = Infinity, hi2 = -Infinity;
			faces.forEach(function (fc) { var q = fc.getBoundingClientRect(); if (q.left < lo2) lo2 = q.left; if (q.right > hi2) hi2 = q.right; });
			dxs.push(card.left + card.width / 2 - (lo2 + hi2) / 2);
		}
		box._prismDx = dxs;
		// height: the tilted silhouette may go past the card; reduces the vertical scale and centers it on the card height
		var setT = function (k, dyy, vv) { inner.style.transform = 'translateX(' + (box._prismDx ? box._prismDx[k] : 0) + 'px) translateY(' + dyy + 'px) scaleY(' + vv + ') translateZ(' + (-r * s) + 'px) rotateX(' + PRISM_TILT + 'deg) rotateY(' + (-k * step) + 'deg)'; };
		var hs = [], k3;
		for (k3 = 0; k3 < n; k3++) {
			setT(k3, 0, 1);
			var t1 = Infinity, b1 = -Infinity;
			Array.prototype.forEach.call(faces, function (fc) { var q = fc.getBoundingClientRect(); if (q.top < t1) t1 = q.top; if (q.bottom > b1) b1 = q.bottom; });
			hs.push(b1 - t1);
		}
		var dys = [], vss = [];   // height of each turn: its own vertical scale (grows or shrinks)
		for (k3 = 0; k3 < n; k3++) {
			// sets the scale by direct measurement (repeats a few times, since the tilt changes the projected height)
			var vs = card.height / hs[k3];
			for (var itv = 0; itv < 4; itv++) {
				setT(k3, 0, vs);
				var tt = Infinity, bb = -Infinity;
				Array.prototype.forEach.call(faces, function (fc) { var q = fc.getBoundingClientRect(); if (q.top < tt) tt = q.top; if (q.bottom > bb) bb = q.bottom; });
				if (bb - tt > 0) vs *= card.height / (bb - tt);
			}
			vs *= 1.023;   // measured correction: the tilt shortens the silhouette by about 2%
			vss.push(vs);
			setT(k3, 0, vs);
			var t2 = Infinity, b2 = -Infinity;
			Array.prototype.forEach.call(faces, function (fc) { var q = fc.getBoundingClientRect(); if (q.top < t2) t2 = q.top; if (q.bottom > b2) b2 = q.bottom; });
			dys.push(card.top + card.height / 2 - 5 - (t2 + b2) / 2);   // moves up 5px
		}
		box._prismDy = dys; box._prismV = vss;
		inner.style.transition = oldT;
		return s;
	}
	function flipify() {
		var boxes = document.querySelectorAll('.ifacebox');
		for (let i = 0; i < boxes.length; i++) {
			let box = boxes[i];
			if (box.getAttribute('data-flip')) continue;
			let body = box.querySelector('.ifacebox-body');
			let tip = box.querySelector('.cbi-tooltip');
			// needs a chart (body) + info on hover (tooltip)
			if (!body || !tip || !(tip.textContent || '').trim()) continue;
			// only real cards: the Interfaces page OR port cards (Status ports).
			// Excludes small inline badges (e.g. IPv4/IPv6 upstream status), which mess up the layout.
			let onInterfaces = (document.body.getAttribute('data-page') || '') === 'admin-network-network';
			let isPortCard = !!body.querySelector('img[src*="port"]');
			if (!onInterfaces && !isPortCard) continue;
			let nameHead = box.querySelector('.ifacebox-head');       // 1st head = name
			let name = nameHead ? (nameHead.textContent || '').trim().split('\n')[0].trim() : '';
			let status = (body.textContent || '').trim().replace(/\s+/g, ' ');
			// Back fields. On the Interfaces page, MERGES the tooltip (Type/Device/Connected)
			// + the details block (Protocol, Carrier, Uptime, MAC, RX, TX, IPv4, IPv6), without repeats,
			// and HIDES the details block (only the chart stays on the card, plus the buttons below).
			let m;
			if (onInterfaces) {
				let row = box.closest('tr');
				let det = row ? Array.prototype.slice.call(row.children).filter(function (c) { return /Protocolo:|Protocol:/.test(c.textContent); })[0] : null;
				if (det) {
					m = parseFields(det.textContent);
					let tm = parseFields(tip.textContent);
					['Tipo', 'Dispositivo', 'Conectado'].forEach(function (lab) { if (tm[lab] && !m[lab]) m[lab] = tm[lab]; });
					det.style.display = 'none';
					row.classList.add('iface-flip-row');
				} else {
					m = tipMap(box, allTipText(box));
				}
			} else {
				m = tipMap(box, allTipText(box));
			}
			let lines = [];
			ORDER.forEach(function (lab) { (m[lab] || []).forEach(function (v) { lines.push(lab + ': ' + v); }); });
			for (let mk in m) { if (ORDER.indexOf(mk) < 0) m[mk].forEach(function (v) { lines.push(mk + ': ' + v); }); }
			// FRONT = chart; BACK = text (sets the height, no scrolling)
			let tipAllText = allTipText(box);   // keeps the tooltips before moving the content to the front
			let front = document.createElement('div');
			front.className = 'flip-front';
			while (box.firstChild) front.appendChild(box.firstChild);
			// cards with several member icons (e.g. bridge "lan"): builds its own figure,
			// with the icon size calculated from the count, in a centered layout.
			let visImgs = Array.prototype.filter.call(front.querySelectorAll('.ifacebox-body img'), function (im) { return !im.closest('.cbi-tooltip'); });
			let memberSrcs = null;   // icons of each member (kept for the faces)
			if (visImgs.length > 1 && !front.querySelector('.flip-figure')) {
				front.classList.add('front-multi');
				let srcs = visImgs.map(function (im) { return (im.getAttribute('src') || '').replace(/"/g, ''); });
				memberSrcs = srcs;
				let n = srcs.length;
				// pyramid: one row per member type; the type with fewer items goes on top
				let mtypes = memberTypes(tipAllText);
				let layers = [srcs];
				if (mtypes && mtypes.length === n) {
					let groups = {}, order = [];
					mtypes.forEach(function (t, i) { if (!groups[t]) { groups[t] = []; order.push(t); } groups[t].push(srcs[i]); });
					layers = order.map(function (t) { return groups[t]; }).sort(function (a, b) { return a.length - b.length; });
				}
				let widest = Math.max.apply(null, layers.map(function (l) { return l.length; }));
				// the more icons in a row, the smaller they are (between 26 and 54 px)
				let iso = Math.max(26, Math.min(54, Math.round(170 / Math.max(widest, layers.length))));
				let fig = document.createElement('div');
				fig.className = 'flip-figure flip-pyramid';
				fig.style.setProperty('--iso', iso + 'px');
				fig.innerHTML = layers.map(function (l) {
					return '<div class="fig-row">' + l.map(function (s) { return '<img src="' + s + '" alt="">'; }).join('') + '</div>';
				}).join('');
				front.appendChild(fig);   // the original figure (.ifacebox-body) is hidden by CSS
				// device name (e.g. br-lan) below the icons
				let dev = (((tip.textContent || '').match(/Dispositivo:\s*([a-z0-9._+-]+)/)) || [])[1] || '';
				if (dev) { let lbl = document.createElement('div'); lbl.className = 'fig-label'; lbl.textContent = dev; front.appendChild(lbl); }
			}
			// device name always at the bottom, on all cards (aligned with each other)
			if (!front.querySelector('.fig-label')) {
				let devName = (((tip.textContent || '').match(/Dispositivo:\s*([a-z0-9._+-]+)/)) || [])[1] || name;
				let lbl2 = document.createElement('div');
				lbl2.className = 'fig-label';
				lbl2.textContent = devName;
				if (devName !== name) front.appendChild(lbl2);   // without repeating the name already at the top of the card
				// removes the original name text (next to the icon), to avoid duplication
				Array.prototype.forEach.call(front.querySelectorAll('.ifacebox-body'), function (b) {
					Array.prototype.forEach.call(b.childNodes, function (c) { if (c.nodeType === 3) c.nodeValue = ''; });
				});
			}
			let back = document.createElement('div');
			back.className = 'flip-back';
			// details without repeats: removes the per-member fields (type, device, connection, RX, TX) and identical lines
			// details without member-field repeats; the network (IPs, gateway, DNS) goes to its own face
			let firstMac = true;
			let detLines = lines.filter(function (p) { return !/^(Tipo|Dispositivo|Conectado|RX|TX|Type|Device|Connected)\s*:/i.test(p); })
				.filter(function (p) { if (/^MAC\s*:/i.test(p)) { if (!firstMac) return false; firstMac = false; } return true; })
				.filter(function (p, i, a) { return a.indexOf(p) === i; });
			let toHtml = function (arr) {
				return arr.map(function (p) {
					let i = p.indexOf(':');
					return i > 0
						? '<div class="ib-back-line">' + p.slice(0, i + 1) + ' <b>' + p.slice(i + 1).trim() + '</b></div>'
						: '<div class="ib-back-line">' + p + '</div>';
				}).join('');
			};
			let isNet = function (p) { return /^(IPv4|IPv6|Gateway|DNS)\s*:/i.test(p); };
			let detailsHtml = toHtml(detLines.filter(function (p) { return !isNet(p); }));
			let netHtml = toHtml(detLines.filter(isNet));
			let sub = (status && status.length <= 24) ? '<div class="ib-back-status">' + status + '</div>' : '';
				// bridge with several members: horizontal prism. Faces: chart (front), one member per face, and the back (details + network)
				let parts = memberGroups(tipAllText);
				// bridge: the title above the chart is the device name (br-lan), not the interface name (lan)
				if (parts) {
					let hd = front.querySelector('.ifacebox-head');
					let bm = (tip.textContent || '').match(/Bridge[^]{0,120}?(?:Dispositivo|Device):\s*([a-z0-9._+-]+)/) || (tip.textContent || '').match(/(?:Dispositivo|Device):\s*([a-z0-9._+-]+)/);
					if (hd && bm) hd.textContent = bm[1];
				}
				let faces = [front];
				// prism: bridge cards (one member per face) and interface cards (chart, details, network)
				let prismMode = !!parts;   // only bridge cards with members; the others are front + back
				if (prismMode) box.classList.add('prism');
				if (parts) {
					parts.blocks.forEach(function (blk, bi) {
						let mf = document.createElement('div');
						mf.className = 'flip-mem';
						let head = (memberSrcs && memberSrcs[bi]) ? '<img class="ib-member-icon" src="' + memberSrcs[bi] + '" alt="">' : '<div class="ib-back-title">' + name + '</div>';
						mf.innerHTML = head + parts.head + blk;
						faces.push(mf);
					});
				}
				let backNet = netHtml ? '<div class="ib-back-title">Rede</div>' + netHtml : '';   // all the details (including the network) stay together on the back
				let redeFace = null;
				if (!parts && prismMode) {   // card without members: the network goes to its own face
					redeFace = document.createElement('div');
					redeFace.className = 'flip-mem';
					redeFace.innerHTML = '<div class="ib-back-title">' + name + '</div><div class="ib-back-title">Rede</div>' + netHtml;
				}
				back.innerHTML = '<div class="ib-back-title">' + name + '</div>' + sub + detailsHtml + backNet;
				faces.push(back);
				if (redeFace) faces.push(redeFace);
				// N faces (prism sides); side = 320px, so the radius to the center of each face = 160 / tan(180° / N)
				// radius capped (the prism does not grow too much); the face is narrow so the ring closes with N sides
				let N = faces.length, R = Math.min(150, 160 / Math.tan(Math.PI / N)), W = 2 * R * Math.tan(Math.PI / N), STEP = 360 / N;
				let FW = W;   // the front has the same width as the other faces
				let capTop = null, capBot = null;   // caps (created later, in the arrows section)
				let geo = function (s) {
					if (typeof capGeo === 'function') capGeo(s);
					faces.forEach(function (fc, i) {
						let w = (fc === front ? FW : W) * s;
						// pyramid icons fit the face width: fewer icons per row = bigger icons
						let fg = fc.querySelector('.flip-pyramid');
						if (fg) {
							let wide = Math.max.apply(null, [1].concat([].map.call(fg.querySelectorAll('.fig-row'), function (rw) { return rw.children.length; })));
							fg.style.setProperty('--iso', Math.max(16, Math.min(54, Math.floor((w - 16) / wide) - 8)) + 'px');
						}
						fc.style.width = w + 'px'; fc.style.left = '50%'; fc.style.marginLeft = (-w / 2) + 'px';
						fc.style.transform = 'rotateY(' + (i * STEP) + 'deg) translateZ(' + (R * s) + 'px)';
					});
				};
				// caps: radius to the vertices = apothem / cos(180° / N); polygon points in % of the box
				let capGeo = function (s) {
					if (!capTop) return;
					let rv = R * s / Math.cos(Math.PI / N), pts = [];
					for (let j = 0; j < N; j++) {
						let a = (j + 0.5) * STEP * Math.PI / 180;
						pts.push((50 + 50 * Math.sin(a)).toFixed(2) + '% ' + (50 + 50 * Math.cos(a)).toFixed(2) + '%');
					}
					[capTop, capBot].forEach(function (c, t) {
						c.style.setProperty('width', (2 * rv) + 'px', 'important'); c.style.setProperty('height', (2 * rv) + 'px', 'important');
						c.style.left = '50%'; c.style.marginLeft = (-rv) + 'px';
						c.style.top = (t === 0 ? -rv : 288 - rv) + 'px';
						c.style.clipPath = 'polygon(' + pts.join(', ') + ')';
					});
				};
				capGeo(1);
				if (prismMode) geo(1);   // after the caps: geo also updates them
				// inner layer that turns (the .ifacebox container stays still -> stable hover, no jitter)
				let inner = document.createElement('div');
				inner.className = 'flip-inner';
				faces.forEach(function (fc) { inner.appendChild(fc); });
				if (prismMode) {   // bottom and top: regular N-sided polygon (same number of sides as the faces)
					capTop = document.createElement('div'); capBot = document.createElement('div');
					capTop.className = capBot.className = 'prism-cap';
					inner.appendChild(capTop); inner.appendChild(capBot);
				}
			box.appendChild(inner);
			box.setAttribute('data-flip', '1');
				box.setAttribute('data-flipkey', name);
					if (parts) {
						let S = prismFit(box, inner, faces, geo, N, STEP, R);
						geo(S);
						prismSet(box, inner, 0, N, R * S);
					}
					// the card changes width (phone, zoom): redoes the fit and centering of the prism
					if (prismMode) setTimeout(function () { box.classList.add('prism-ready'); }, 1500);   // safety: shows even if the measurement fails
				if (prismMode && window.ResizeObserver) {
						new ResizeObserver(function () {
							let cur = +box.getAttribute('data-face') || 0;
							let sc = prismFit(box, inner, faces, geo, N, STEP, R);
							geo(sc);
							prismSet(box, inner, cur, N, R * sc);
							setTimeout(function () { prismSpace(box); box.classList.add('prism-ready'); }, 700);   // waits for the turn animation to end; only then shows the card
						}).observe(box);
					}
				else { var t0 = (boxTurn[name] !== undefined) ? boxTurn[name] : 0; box.setAttribute('data-turn', t0); if (t0) box.setAttribute('data-latched', '1'); box.querySelector('.flip-inner').style.transform = 'rotateY(' + (-t0 * 180) + 'deg)'; }   // comes back flipped if it was flipped
			// green border when the device is connected
			// blue = connected; red = disconnected (port "no link" or device/network without connection)
				// Link state in ANY language: LuCI translates the labels with the global _() function
				// (e.g. _('Connected') -> "Conectado", _('yes') -> "sí"). We build the search with these translations.
				let linked = connectedState(box);
				box.classList.add(linked ? 'ifc-connected' : 'ifc-disconnected');
			// tap/click flips the card (there is no hover on phones)
			box.addEventListener('click', function (e) {
				if (e.target.closest('a, button, input')) return;
					if (this.classList.contains('prism')) {   // prism: each click turns to the next face
						let pn = +this.getAttribute('data-faces') || 1;
						let cur = +this.getAttribute('data-turn') || +this.getAttribute('data-face') || 0;
						// a click on the left side turns left; on the right (or in the middle) turns right
						let rc = this.getBoundingClientRect(), px = (e.clientX - rc.left) / rc.width;
						let pf = cur + (px < 0.33 ? 1 : -1);   // no limit: from the last face it turns on to the first, in the same direction
						prismSet(this, this.querySelector('.flip-inner'), pf, pn, +this.getAttribute('data-r') || 0);
						var pbox = this;
						setTimeout(function () { prismSpace(pbox); }, 650);   // waits for the animation to end
						flipFaceSet(location.pathname + '|' + this.getAttribute('data-flipkey'), ((pf % pn) + pn) % pn);
					return;
				}
				var d = sideDir(this, e), hovered = this.hasAttribute('data-hover');
				if (this.hasAttribute('data-latched')) this.removeAttribute('data-latched'); else this.setAttribute('data-latched', '1');   // click toggles locked/unlocked
				if (!hovered) flipSpin(this, d);   // if it already turned with the mouse, it only locks; otherwise it turns on the clicked side
				flipSet(location.pathname + '|' + this.getAttribute('data-flipkey'), this.hasAttribute('data-latched'));
			});
		}
	}
	// Makes all cards the SAME size: width = the widest, height = the tallest.
	function equalize() {
		var boxes = Array.prototype.slice.call(document.querySelectorAll('.ifacebox[data-flip]'));
		if (boxes.length < 2) return;
		// returns to natural size (content) to measure
		boxes.forEach(function (b) { b.style.minWidth = ''; b.style.minHeight = ''; });
		var maxW = 0, maxH = 0;
		boxes.forEach(function (b) {
			var r = b.getBoundingClientRect();
			if (r.width > maxW) maxW = r.width;
			if (r.height > maxH) maxH = r.height;
		});
		if (maxW > 0) boxes.forEach(function (b) {
			b.style.minWidth = Math.ceil(maxW) + 'px';
			b.style.minHeight = Math.ceil(maxH) + 'px';
		});
	}
	// The page description ("Aqui você pode...") becomes a hint on the title of the 1st section:
	// leaves the body and appears only when the mouse passes over the title.
	// Pages without a card (e.g. Restart): wraps the content in a card, to receive the title bar
	function wrapPage(mc) {
		var h2 = Array.prototype.filter.call(mc.querySelectorAll('h2'), function (e) {
			return !e.closest('.cbi-tabmenu') && e.textContent.trim();
		})[0];
		if (!h2 || h2.parentElement === mc) return null;
		var host = h2.parentElement;
		var sec = document.createElement('div');
		sec.className = 'cbi-section page-card';
		host.insertBefore(sec, h2);
		// moves the title and content into the card (button events stay attached)
		Array.prototype.slice.call(host.childNodes).forEach(function (n) {
			if (n !== sec && n.nodeName !== 'SCRIPT' && n.nodeName !== 'NOSCRIPT') sec.appendChild(n);
		});
		return sec;
	}
	function hintify() {
		var mc = document.getElementById('maincontent');
		var sec = mc && mc.querySelector('.cbi-section');
		if (mc && !sec) sec = wrapPage(mc);               // no card: creates one for the title bar
		if (!sec) return;                                  // page without a card: nothing to do
		// 1) a large loose page title (h2 outside the cards) is removed: the name goes to the card bar
		var big = Array.prototype.filter.call(mc.querySelectorAll('h2'), function (e) {
			return !(e.closest('.cbi-section') && !e.closest('.page-card')) && !e.closest('.cbi-tabmenu') && e.textContent.trim();
		});
		var pageName = big.length ? big[0].textContent.trim() : '';
		big.forEach(function (e) { e.style.display = 'none'; });
		var d = mc.querySelector('.cbi-map-descr');
		// loose text block on the page (e.g. "The load average..." on Load): no title, table or form inside
		if (!d) {
			d = Array.prototype.find.call(mc.querySelectorAll('p, div'), function (e) {
				var t = (e.textContent || '').trim();
				// only text with simple formatting: never a block that contains tabs, links or controls
				var plain = Array.prototype.every.call(e.children, function (c) { return /^(SPAN|B|STRONG|EM|I|BR)$/.test(c.tagName); });
				return plain && !e.closest('.cbi-section, .cbi-tabmenu, footer') && t.length > 20 && t.length < 300;
			}) || null;
		}
		// without the class: the paragraph right below the page title is also the description (e.g. Routing)
		if (!d && big.length && big[0].nextElementSibling && big[0].nextElementSibling.tagName === 'P' && !big[0].nextElementSibling.querySelector('.cbi-section')) {
			d = big[0].nextElementSibling;
		}
		// LuCI warnings (e.g. "No password set!") are not the page description: leave them alone
		if (d && d.closest('.alert-message')) return;
		if (big.length && big[0].closest('.alert-message')) return;
		// 2) card title: the existing h3, or a new one with the page name from the menu (e.g. "Administration")
		var h = sec.querySelector(':scope > h3');
		// only creates a title if the card has no title bar yet (e.g. Overview already has "System", "Memory"...)
		// (Firewall chains, class nft-chain, have their own title and stay as they are)
		if (!h && !sec.querySelector(':scope > .cbi-title, :scope > legend') && !sec.classList.contains('nft-chain')) {
			var act = document.querySelector('.desktop-nav a.is-active-page, a.is-active-page');
			var name = (act && act.textContent.trim()) || pageName;
			if (name) {
				h = sec.querySelector(':scope > h3.page-title') || document.createElement('h3');
				h.className = 'page-title';
				h.textContent = name;
				if (!h.parentElement) sec.insertBefore(h, sec.firstChild);   // inside the card, in the glass strip at the top
			}
		}
		// 3) page description becomes a hint on the title
		if (!h || !d) return;
		var text = (d.textContent || '').trim();
		if (text) {
			var span = document.createElement('span');
			span.className = 'page-hint';
			span.textContent = text;
			h.appendChild(span);
			h.classList.add('has-hint');
		}
		d.remove();
	}
	// Old tabs (ul.tabs, e.g. System/kernel log) become the theme's standard (cbi-tabmenu):
	// the open tab gets a dark background, as on the other pages.
	function tabsify() {
		// tab bar inside a top-level card (e.g. DNS) moves up to before the card, like elsewhere
		var inCards = document.querySelectorAll('#maincontent .cbi-section > ul.cbi-tabmenu');
		for (var k = 0; k < inCards.length; k++) {
			var card = inCards[k].parentElement;
			if (card.parentElement && !card.parentElement.closest('.cbi-section')) card.parentElement.insertBefore(inCards[k], card);
		}
		var uls = document.querySelectorAll('#maincontent ul.tabs');
		for (var i = 0; i < uls.length; i++) {
			var ul = uls[i];
			if (ul.classList.contains('cbi-tabmenu')) continue;
			ul.classList.remove('tabs');
			ul.classList.add('cbi-tabmenu');
			for (var j = 0; j < ul.children.length; j++) {
				var li = ul.children[j];
				li.classList.add(li.classList.contains('active') ? 'cbi-tab' : 'cbi-tab-disabled');
			}
		}
	}
	// When the tab bar was moved out of the card (e.g. DNS), LuCI cannot find the panels.
	// This function switches panels: the clicked tab shows the panel with the same data-tab.
	// bars already wired. Uses a WeakSet (not data-*) because LuCI clones the elements and the clone would copy the mark without the events
	var wiredBars = new WeakSet();
	function wireTabPanes() {
		var box = document.querySelector('#maincontent .cbi-section-node-tabbed');
		if (!box) return;
		var bars = document.querySelectorAll('#maincontent ul.cbi-tabmenu');
		for (var i = 0; i < bars.length; i++) {
			var ul = bars[i];
			if (wiredBars.has(ul) || ul.parentElement.querySelector(':scope > [data-tab]')) continue;   // already wired, or LuCI finds the panels
			var lis = Array.prototype.filter.call(ul.children, function (l) { return l.hasAttribute('data-tab'); });
			if (!lis.length) continue;
			wiredBars.add(ul);
			var keys = lis.map(function (l) { return l.getAttribute('data-tab'); });   // keys of the top-level tabs
			var show = function (key) {
				// top-level panels of the page (nested ones, tabs inside tabs, stay as they are)
				Array.prototype.forEach.call(document.querySelectorAll('#maincontent div[data-tab]'), function (p) {
					if (keys.indexOf(p.getAttribute('data-tab')) < 0) return;   // nested sub-tabs stay with LuCI
					if (p.hasAttribute('data-tab')) p.setAttribute('data-tab-active', p.getAttribute('data-tab') === key ? 'true' : 'false');
				});
			};
			var first = lis.filter(function (l) { return l.classList.contains('cbi-tab'); })[0] || lis[0];
			show(first.getAttribute('data-tab'));
			// a single listener on the document (survives LuCI's clones); runs in the capture phase, before LuCI
			if (!document.documentElement.dataset.tabDelegated) {
				document.documentElement.dataset.tabDelegated = '1';
				document.addEventListener('click', function (e) {
					var li = e.target.closest('#maincontent ul.cbi-tabmenu > li[data-tab]');
					if (!li) return;
					var bar = li.parentElement;
					if (bar.parentElement.querySelector(':scope > [data-tab]')) return;   // LuCI finds the panels: leave it to LuCI
					e.preventDefault();
					e.stopImmediatePropagation();
					Array.prototype.forEach.call(bar.children, function (l) { l.className = (l === li) ? 'cbi-tab' : 'cbi-tab-disabled'; });
					var keysNow = Array.prototype.map.call(bar.children, function (l) { return l.getAttribute('data-tab'); });
					Array.prototype.forEach.call(document.querySelectorAll('#maincontent div[data-tab]'), function (p) {
						if (keysNow.indexOf(p.getAttribute('data-tab')) < 0) return;
						p.setAttribute('data-tab-active', p.getAttribute('data-tab') === li.getAttribute('data-tab') ? 'true' : 'false');
					});
				}, true);
			}
		}
	}
	// ---- Traffic per device (Overview) ----
	// Reads /cgi-bin/aurora-bw every second and draws, per device, the current speed and a history line.
	var bwHist = {};            // mac -> {name, ip, via, rx, tx, last, down[], up[], active}
	var bwBusy = false;         // true while the router read has not returned (avoids stacked requests)
	var bwTimer = null;
	function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
	function bwFmt(bps) {       // readable speed
		if (bps < 1024) return Math.round(bps) + ' B/s';
		if (bps < 1048576) return (bps / 1024).toFixed(1) + ' KB/s';
		return (bps / 1048576).toFixed(2) + ' MB/s';
	}
	function bwTotal(n) {       // readable total
		if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
		if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
		return (n / 1073741824).toFixed(2) + ' GB';
	}
	function bwSpark(down, up) { // speed line (download blue, upload grey)
		var W = 240, H = 52, n = Math.max(down.length, 2), max = Math.max.apply(null, down.concat(up).concat([1]));
		function pts(arr) {
			return arr.map(function (v, i) { return ((i / (n - 1)) * W).toFixed(1) + ',' + (H - (v / max) * (H - 4) - 2).toFixed(1); }).join(' ');
		}
		return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" class="bw-svg">' +
			'<polyline class="ln-up" points="' + pts(up) + '"/><polyline class="ln-down" points="' + pts(down) + '"/></svg>';
	}
	// average of the last readings (4 samples): shows a stable value, close to the recent average
	function bwAvg(a) {
		var n = Math.min(4, a.length), s = 0;
		if (!n) return 0;
		for (var i = a.length - n; i < a.length; i++) s += a[i];
		return s / n;
	}
	// plain speed text (no animation)
		function bwSpan(cls, key, v) {
			return '<span class="' + cls + '">' + (cls === 'bw-down' ? '↓ ' : '↑ ') + bwFmt(v) + '</span>';
		}
		function bwRender() {
		var box = document.querySelector('#maincontent .bw-grid');
		if (!box) return;
		box.innerHTML = Object.keys(bwHist).filter(function (m) { return bwHist[m].via === 'lan'; }).map(function (m) {
			var h = bwHist[m], d = bwAvg(h.down), u = bwAvg(h.up);
			return '<div class="bw-card' + (h.active ? '' : ' bw-off') + '">' +
				'<div class="bw-head"><b>' + esc(h.name) + '</b><span>' + esc(h.ip) + ' · ' + (h.via === 'wifi' ? 'Wi-Fi' : 'Cabo') + '</span></div>' +
				'<div class="bw-now">' + bwSpan('bw-down', m + '|d', d) + bwSpan('bw-up', m + '|u', u) + '</div>' +
				bwSpark(h.down, h.up) +
				'<div class="bw-tot">Total: ↓ ' + bwTotal(h.rx) + ' · ↑ ' + bwTotal(h.tx) + '</div></div>';
		}).join('');
	}
	function bwPoll() {
		// stops reading when the section is not on screen (e.g. the user changed page)
		if (!document.querySelector('.bw-section, #wifi_assoclist_table')) { clearInterval(bwTimer); bwTimer = null; return; }
		// does not stack requests: while one has not returned, the next waits (avoids jerky updates)
			if (bwBusy) return;
			bwBusy = true;
			// if the router takes too long, cancels after 3 s so the page does not freeze
			var ctl = typeof AbortController === 'function' ? new AbortController() : null;
			var to = ctl ? setTimeout(function () { ctl.abort(); }, 3000) : null;
			fetch('/cgi-bin/aurora-bw', { cache: 'no-store', signal: ctl ? ctl.signal : undefined }).then(function (r) { return r.json(); }).then(function (list) {
				if (to) clearTimeout(to);
				bwBusy = false;
			var now = Date.now(), seen = {};
			list.forEach(function (d) {
				seen[d.mac] = true;
				var h = bwHist[d.mac] || (bwHist[d.mac] = { down: [], up: [], rx: 0, tx: 0, last: null });
				h.name = d.name; h.ip = d.ip; h.via = d.via; h.port = d.port || ''; h.active = d.up !== false;   // wired without link = disconnected
				// same reading from the collector (not changed yet): not counted again, otherwise it shows 0 and then double
				if (h.last && d.ts !== undefined && d.ts === h.last.ts) return;
				if (h.last) {                       // speed = change in bytes / time (never negative)
					// real time of the router reading (ts), more precise than the browser clock
						var dt = (d.ts !== undefined && h.last.ts !== undefined) ? (d.ts - h.last.ts) : (now - h.last.t) / 1000;
					h.down.push(Math.max(0, d.rx - h.last.rx) / dt);
					h.up.push(Math.max(0, d.tx - h.last.tx) / dt);
					if (h.down.length > 60) { h.down.shift(); h.up.shift(); }
				}
				h.rx = d.rx; h.tx = d.tx; h.last = { rx: d.rx, tx: d.tx, t: now, ts: d.ts };
			});
			Object.keys(bwHist).forEach(function (m) { if (!seen[m]) bwHist[m].active = false; });
			bwRender(); devRender(); portLabels(); zoneColors(); iconifyWifiButtons(); sysCard();
			bwInject();
		}).catch(function () { bwBusy = false; }).then(function () { bwBusy = false; });
	}
	// Wi-Fi device usage: a new column in the "Associated stations" table (matched by MAC)
	function bwInject() {
		var table = document.getElementById('wifi_assoclist_table');
		if (!table) return;
		var head = table.querySelector('tr.table-titles');
		if (head && !head.querySelector('.bw-th')) {
			var th = document.createElement('th');
			th.className = 'th bw-th';
			th.textContent = 'Consumo';
			head.appendChild(th); head.appendChild(document.createElement('th')); head.appendChild(document.createElement('th'));   // before the actions column
		}
		Array.prototype.forEach.call(table.querySelectorAll('tr'), function (tr) {
			if (tr === head || !tr.children[1]) return;
			var h = bwHist[(tr.children[1].textContent || '').trim().toLowerCase()];
			if (!h) return;
			var td = tr.querySelector('td.bw-td');
			if (!td) {
				td = document.createElement('td');
				td.className = 'td bw-td';
				var act = tr.querySelector('.cbi-button');    // before the button cell (Disconnect)
				tr.insertBefore(td, act ? act.closest('td') : tr.lastElementChild);
			}
			var d = bwAvg(h.down), u = bwAvg(h.up);
			var wk = 'wt|' + (tr.children[1].textContent || '').trim().toLowerCase();
				var html = '<div class="bw-mini">' + bwSpan('bw-down', wk + '|d', d) + bwSpan('bw-up', wk + '|u', u) + '</div>' +
				bwSpark(h.down, h.up).replace('class="bw-svg"', 'class="bw-svg bw-mini-svg"');
			// writes only when it changed: otherwise the write itself triggers the observer and creates a loop
			if (td._bwHtml !== html) { td._bwHtml = html; td.innerHTML = html; }
		});
	}
	function bandwidthify() {
		var mc = document.getElementById('maincontent');
		var page = document.body.getAttribute('data-page') || '';
		// Status: builds the devices section only after LuCI stops building the page (or after 6 s)
		if (page === 'admin-status-overview' && Date.now() - pageStart < 6000 && (Date.now() - quietAt < 1500 || document.querySelectorAll('#maincontent .cbi-section').length < 2)) { setTimeout(bandwidthify, 500); return; }
		if (!mc) return;
		if (page === 'admin-network-wireless') {       // Wi-Fi page: only the column and the reading (no card of its own)
			bwInject();
			if (!bwTimer && document.getElementById('wifi_assoclist_table')) { bwPoll(); bwTimer = setInterval(bwPoll, 1000); }
			devRender();
			return;
		}
		if (page !== 'admin-status-overview') return;
		bwInject();
		devRender();
		if (mc.querySelector('.bw-section')) return;
		var sec = document.createElement('div');
		sec.className = 'cbi-section bw-section';
		sec.innerHTML = '<h3>' + L('Dispositivos Cabeados') + '</h3><div class="dev-wrap"><ul class="cbi-tabmenu dev-sort">' +
			[['name', 'Nome'], ['ip', 'IP'], ['mac', 'MAC'], ['usage', 'Consumo'], ['total', 'Total'], ['type', 'Tipo']].map(function (s) {
				return '<li class="' + (s[0] === devSort ? 'cbi-tab' : 'cbi-tab-disabled') + '" data-sort="' + s[0] + '"><a href="#">' + L(s[1]) + '</a></li>';
			}).join('') + '</ul><div class="dev-grid"></div></div>';
		mc.insertBefore(sec, mc.querySelector('footer'));
		if (!bwTimer) { bwPoll(); bwTimer = setInterval(bwPoll, 1000); }
	}
	// ---- Wi-Fi devices as cards (they replace the "Associated stations" table on the Wi-Fi page) ----
	var devSort = 'name';        // sort of the Wi-Fi list tabs
	var devSortC = 'name';       // sort of the wired list tabs (independent)
	var devFlipped = {};
	// turns the device card 180° per step (continuous, like the other cards)
	// the turn is kept in devTurn (and in the card's --t attribute), so a page refresh does not undo it
	var devTurn = {};
	// cards go back to the default when the page changes (they are not kept between pages)
	document.addEventListener('click', function (e) {
		if (e.target.closest && e.target.closest('header a, nav a, .main-left a, .desktop-nav a, .nav a, #tabmenu a, ul.cbi-tabmenu a')) { devTurn = {}; devFlipped = {}; boxTurn = {}; }
	}, true);
	function devSpin(card, dir) {
		var m = card.getAttribute('data-mac');
		var t = (devTurn[m] || 0) + dir;
		devTurn[m] = t;
		card.setAttribute('data-turn', t);
		card.setAttribute('data-lastdir', dir);
		card.style.setProperty('--t', t);
	}         // mac -> card flipped?
	// comparators for each tab (key = data-sort)
	var devCmp = {
		name: function (a, b) { return (a.name || '').localeCompare(b.name || ''); },
		ip: function (a, b) { return ipNum(a.ip) - ipNum(b.ip); },
		mac: function (a, b) { return a.mac.localeCompare(b.mac); },
		net: function (a, b) { return (a.net || '').localeCompare(b.net || ''); },
		signal: function (a, b) { return b.signalNum - a.signalNum; },                       // strongest first
		rate: function (a, b) { return rateNum(b.rate) - rateNum(a.rate); },                // highest RX rate first
		usage: function (a, b) { return (b.down + b.up) - (a.down + a.up) || (a.name || '').localeCompare(b.name || ''); },
		total: function (a, b) { return (b.rx + b.tx) - (a.rx + a.tx); },                   // largest total first
		type: function (a, b) { return a.type.localeCompare(b.type) || (a.name || '').localeCompare(b.name || ''); }
	};
	function ipNum(ip) { return (ip || '').split('.').reduce(function (acc, p) { return acc * 256 + (parseInt(p, 10) || 0); }, 0); }
	function rateNum(s) { var m = (s || '').match(/([\d.]+)\s*Mbit/); return m ? parseFloat(m[1]) : 0; }
	var devIcons = {
		phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
		tv: '<rect x="2" y="5" width="20" height="13" rx="2"/><path d="M8 21h8M12 18v3"/>',
		computer: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/>',
		other: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M9.5 8.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><path d="M12 14.5h.01"/>'
	};
	var devTypeLabel = { phone: 'Celular', tv: 'TV', computer: 'Computador', other: 'Desconhecido' };
	// Type from the device name (DHCP). Heuristic: may be wrong.
	function devType(name) {
		if (/iphone|android|redmi|galaxy|xiaomi|moto|pixel|phone|celular|sm-/i.test(name)) return 'phone';
		if (/\btv\b|roku|chromecast|firetv|bravia/i.test(name)) return 'tv';
		if (/desktop|laptop|notebook|\bpc\b|macbook|imac/i.test(name)) return 'computer';
		return 'other';
	}
	// rows of the original table, by MAC (signal, rate, network and the Disconnect button)
	function devRows() {
		var t = document.getElementById('wifi_assoclist_table'), map = {};
		if (!t) return map;
		Array.prototype.forEach.call(t.querySelectorAll('tr'), function (tr) {
			if (!tr.children[1]) return;
			var mac = (tr.children[1].textContent || '').trim().toLowerCase();
			if (/^([0-9a-f]{2}:){5}/.test(mac)) map[mac] = tr;
		});
		return map;
	}
	function devCardHtml(it, flipped) {
		var sp = bwSpark(it.hist.down, it.hist.up).replace('class="bw-svg"', 'class="bw-svg dev-spark"');
		var fl = !!flipped;
		var t0 = (devTurn[it.mac] !== undefined) ? devTurn[it.mac] : (fl ? 1 : 0);
		return '<div class="dev-card' + (it.active ? '' : ' bw-off') + (fl ? ' flipped' : '') + '" data-mac="' + it.mac + '" style="--t:' + t0 + '">' +
			'<div class="dev-inner">' +
			'<div class="dev-front">' +
				'<div class="dev-top"><b>' + esc(it.name) + '</b><span>' + L(devTypeLabel[it.type]) + '</span></div>' +
				(it.port ? '<div class="dev-port">' + L('Porta') + ': <b>' + esc(it.port.toUpperCase()) + '</b></div>' : '') +
				'<svg class="dev-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + '<g class="dl-out">' + devIcons[it.type] + '</g><g class="dl-in">' + devIcons[it.type] + '</g></svg>' +
				(it.btn ? '<button type="button" class="cbi-button ico-btn dev-disc" data-ico="power" data-mac="' + it.mac + '" data-tip="Desconectar"></button>' : '') + '<div class="bw-now">' + bwSpan('bw-down', it.mac + '|d', it.down) + bwSpan('bw-up', it.mac + '|u', it.up) + '</div>' +
				sp +
			'</div>' +
			'<div class="dev-back">' +
				'<div class="dev-top"><b>' + esc(it.name) + '</b><span>' + L(devTypeLabel[it.type]) + '</span></div>' +
				'<div class="dev-line">' + L('IP') + ': <b>' + esc(it.ip) + '</b></div>' +
				'<div class="dev-line">' + L('MAC') + ': <b>' + it.mac.toUpperCase() + '</b></div>' +
				'<div class="dev-line">' + L('Rede') + ': <b>' + esc(it.net) + '</b></div>' +
				'<div class="dev-line">' + L('Fabricante') + ': <b>' + esc(it.vendor) + '</b></div>' +
				'<div class="dev-line">' + L('Sinal') + ': <b>' + esc(it.sig) + '</b></div>' +
				'<div class="dev-line">' + L('Taxas') + ': <b>' + esc(it.rate) + '</b></div>' +
				'<div class="dev-line">' + L('Total') + ': <b>↓ ' + bwTotal(it.rx) + ' · ↑ ' + bwTotal(it.tx) + '</b></div>' +
							'</div></div></div>';
	}
	function devRender() {
		var page = document.body.getAttribute('data-page') || '';
		var t = document.getElementById('wifi_assoclist_table');
		if ((page !== 'admin-network-wireless' && page !== 'admin-status-overview') || !t) return;
		devLoadOui();
		if (!document.documentElement.dataset.devWired) { document.documentElement.dataset.devWired = '1'; devWire(); }
		t.classList.add('dev-hidden');
		var h3 = t.previousElementSibling;   // section title: "Associated stations" -> "WiFi devices"
		if (h3 && h3.tagName === 'H3' && /Estações associadas|Associated Stations|Estaciones asociadas/.test(h3.textContent)) h3.textContent = L('Dispositivos WiFi');
		var wrap = t.parentElement.querySelector(':scope > .dev-wrap');
		if (!wrap) {
			wrap = document.createElement('div');
			wrap.className = 'dev-wrap';
			var tabs = [['name', 'Nome'], ['ip', 'IP'], ['mac', 'MAC'], ['net', 'Rede'], ['signal', 'Sinal'], ['rate', 'Taxas'], ['usage', 'Consumo'], ['total', 'Total'], ['type', 'Tipo']];
			wrap.innerHTML = '<ul class="cbi-tabmenu dev-sort">' + tabs.map(function (s) {
				return '<li class="' + (s[0] === devSort ? 'cbi-tab' : 'cbi-tab-disabled') + '" data-sort="' + s[0] + '"><a href="#">' + L(s[1]) + '</a></li>';
			}).join('') + '</ul><div class="dev-grid"></div>';
			t.parentElement.insertBefore(wrap, t.nextSibling);
		}
		var grid = wrap.querySelector('.dev-grid');
		var rows = devRows();
		var items = Object.keys(bwHist).filter(function (m) { return bwHist[m].via === 'wifi'; }).map(function (m) {
			var h = bwHist[m], tr = rows[m];
			var sig = tr ? (tr.children[3] || {}).textContent || '' : '';
			var rate = tr ? (tr.children[4] || {}).textContent || '' : '';
			var net = tr ? (tr.children[0] || {}).textContent || '' : '';
			return {
				mac: m, name: h.name, ip: h.ip, type: devType(h.name || ''), hist: h, active: h.active, vendor: devVendor(m),
				down: bwAvg(h.down), up: bwAvg(h.up), rx: h.rx, tx: h.tx,
				sig: sig.trim(), rate: rate.trim(), net: net.trim(), signalNum: parseInt(sig, 10) || -200,
				btn: tr ? tr.querySelector('.cbi-button') : null
			};
		});
		items.sort(function (a, b) {
			if (devCmp[devSort]) return devCmp[devSort](a, b);
			if (devSort === 'usage') return (b.down + b.up) - (a.down + a.up) || a.name.localeCompare(b.name);
			if (devSort === 'type') return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
			if (devSort === 'signal') return b.signalNum - a.signalNum;
			return (a.name || '').localeCompare(b.name || '');
		});
		var html = items.map(function (it) { return devCardHtml(it, !!devFlipped[it.mac]); }).join('');
		if (grid._html !== html && (grid._html == null || !grid.matches(':hover'))) { grid._html = html; grid.innerHTML = html; }   // only when it changed and with the mouse not over the list (avoids the card jittering)
		devRenderWired();
	}
	// events for the tabs, the Disconnect button and the card flip (a single listener)
	function devWire() {
		document.addEventListener('click', function (e) {
			var li = e.target.closest('#maincontent .dev-sort li[data-sort]');
			if (li) {
				e.preventDefault();
				if (li.closest('.bw-section')) devSortC = li.getAttribute('data-sort');   // wired
				else devSort = li.getAttribute('data-sort');                              // Wi-Fi
				Array.prototype.forEach.call(li.parentElement.children, function (l) { l.className = (l === li) ? 'cbi-tab' : 'cbi-tab-disabled'; });
				var g = document.querySelector('#maincontent .dev-grid');
				if (g) g._html = null;
				devRender();
				return;
			}
			var dis = e.target.closest('#maincontent .dev-disc');
			if (dis) {
				e.preventDefault(); e.stopPropagation();
				var tr = devRows()[dis.getAttribute('data-mac')];
				var b = tr && tr.querySelector('.cbi-button');
				if (b) b.click();
				return;
			}
			var card = e.target.closest('#maincontent .dev-card');
			if (card) {
				var m = card.getAttribute('data-mac');
				var hovered = card.hasAttribute('data-hover');
				devFlipped[m] = !devFlipped[m];   // click locks/unlocks
				if (!hovered) devSpin(card, sideDir(card, e));   // same turn as the other cards
			}
		}, true);
	}
	// Vendor from the MAC prefix (IEEE list, loaded once from the router)
	var ouiMap = null, ouiLoading = false;
	function devLoadOui() {
		if (ouiMap || ouiLoading) return;
		ouiLoading = true;
		fetch('/luci-static/aurora/data/oui.tsv', { cache: 'force-cache' }).then(function (r) { return r.text(); }).then(function (txt) {
			var m = {};
			txt.split('\n').forEach(function (l) { var i = l.indexOf('\t'); if (i > 0) m[l.slice(0, i)] = l.slice(i + 1); });
			ouiMap = m;
			var g = document.querySelector('#maincontent .dev-grid');
			if (g) g._html = null;
			devRender();
		}).catch(function () { ouiLoading = false; });
	}
	function devVendor(mac) {
		if (!ouiMap) return '…';
		var p = mac.replace(/:/g, '').slice(0, 6).toUpperCase();
		if (ouiMap[p]) return ouiMap[p];                                  // local list (IEEE)
		if (parseInt(mac.slice(0, 2), 16) & 2) return L('MAC aleatório (privado)');   // "locally administered" bit
		if (ouiOnline[p]) return ouiOnline[p];                            // result from an alternative server
		devOnlineLookup(p);
		return L('Consultando…');
	}
	// Fallback: prefixes missing from the local list go to /cgi-bin/aurora-oui (which queries alternative servers)
	var ouiOnline = {}, ouiPending = {};
	function devOnlineLookup(p) {
		if (ouiPending[p]) return;
		ouiPending[p] = true;
		fetch('/cgi-bin/aurora-oui?p=' + p, { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) {
			ouiOnline[p] = (t || '').trim() || 'Desconhecido';
			var g = document.querySelector('#maincontent .dev-grid');
			if (g) g._html = null;
			devRender();
		}).catch(function () { ouiOnline[p] = 'Desconhecido'; });
	}
	// Wired devices (section on the Devices page): same cards, without signal/rate (they do not exist on cable)
	function devRenderWired() {
		var page = document.body.getAttribute('data-page') || '';
		var grid = document.querySelector('#maincontent .bw-section .dev-grid');
		if (page !== 'admin-status-overview' || !grid) return;
		// sort: the signal and rate tabs do not apply to cable
		var key = (devSortC === 'signal' || devSortC === 'rate' || devSortC === 'net') ? 'name' : devSortC;
		var items = Object.keys(bwHist).filter(function (m) { return bwHist[m].via === 'lan'; }).map(function (m) {
			var h = bwHist[m];
			return {
				mac: m, name: h.name, ip: h.ip, type: devType(h.name || ''), hist: h, active: h.active, vendor: devVendor(m),
				down: bwAvg(h.down), up: bwAvg(h.up), rx: h.rx, tx: h.tx,
				sig: '—', rate: '—', port: bwHist[m].port || '', signalNum: -200, btn: null,
				// network line on the card back: "LAN2 · Cabo" (the port first, when known)
				net: (bwHist[m].port ? bwHist[m].port.toUpperCase() + ' · ' : '') + L('Cabo')
			};
		});
		items.sort(devCmp[key]);
		var html = items.map(function (it) { return devCardHtml(it, !!devFlipped[it.mac]); }).join('');
		if (grid._html !== html && (grid._html == null || !grid.matches(':hover'))) { grid._html = html; grid.innerHTML = html; }
		// highlights the chosen tab on the wired list too
		document.querySelectorAll('#maincontent .bw-section .dev-sort li[data-sort]').forEach(function (l) {
			var c = l.getAttribute('data-sort') === devSortC ? 'cbi-tab' : 'cbi-tab-disabled';
			if (l.className !== c) l.className = c;
		});
	}
	// memory of flipped cards: kept in the tab session, so it survives a page refresh
	function flipFaceGet(k) { try { return +(sessionStorage.getItem('aurora-face') ? JSON.parse(sessionStorage.getItem('aurora-face'))[k] : 0) || 0; } catch (e) { return 0; } }
	function flipFaceSet(k, v) { try { var o = JSON.parse(sessionStorage.getItem('aurora-face') || '{}'); o[k] = v; sessionStorage.setItem('aurora-face', JSON.stringify(o)); } catch (e) {} }
	function flipGet(k) {
		try { return JSON.parse(sessionStorage.getItem('aurora-flip') || '{}')[k] === true; } catch (e) { return false; }
	}
	function flipSet(k, v) {
		try {
			var o = JSON.parse(sessionStorage.getItem('aurora-flip') || '{}');
			if (v) o[k] = true; else delete o[k];
			sessionStorage.setItem('aurora-flip', JSON.stringify(o));
		} catch (e) { /* sem armazenamento: só não lembra */ }
	}
	// Port status: "no link" becomes "Disconnected" (only changes the text, leaves the structure alone)
	function portLabels() {
		var walker = document.createTreeWalker(document.querySelector('#maincontent') || document.body, NodeFilter.SHOW_TEXT);
		var n;
		while ((n = walker.nextNode())) {
			if (/^\s*(sem link|no link)\s*$/i.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/sem link|no link/i, L('Desconectado'));
		}
	}
	// Wi-Fi text buttons (Restart, Search, Add...) become icon buttons; the original action is kept
	function iconifyWifiButtons() {
		var names = {
			'Reiniciar': ['reconnect', 'refresh'], 'Procurar': ['ico-search', 'search'], 'Adicionar': ['ico-add', 'plus'],
			'Restart': ['reconnect', 'refresh'], 'Scan': ['ico-search', 'search'], 'Add': ['ico-add', 'plus'],
			'Desativar': ['down', 'power'], 'Editar': ['cbi-button-edit', 'pencil'], 'Remover': ['cbi-button-remove', 'trash'],
			'Disable': ['down', 'power'], 'Edit': ['cbi-button-edit', 'pencil'], 'Remove': ['cbi-button-remove', 'trash']
		};
		document.querySelectorAll('#maincontent .cbi-button').forEach(function (b) {
			if (b.dataset.ico || b.closest('tr.iface-flip-row, .dev-card, .dev-wrap, .bw-section')) return;
			var t = (b.textContent || '').trim();
			if (!names[t]) return;
			b.dataset.ico = names[t][1];
			b.setAttribute('data-tip', t);
			b.classList.add('ico-btn');
			b.textContent = '';
		});
	}
	// Firewall zone strip: LAN in blue, WAN in purple
	function zoneColors() {
		document.querySelectorAll('#maincontent .zonebadge').forEach(function (z) {
			var card = z.closest('.ifacebox'), head = card && card.querySelector('.ifacebox-head');
			var c = head && /^\s*wan/i.test(head.textContent) ?'rgba(108, 92, 255, .75)' : 'rgba(59, 130, 246, .75)';
			if (z.style.getPropertyValue('background-color') !== c) z.style.setProperty('background-color', c, 'important');
		});
	}
	// System card: router image on the left (centered) and the info table on the right
	function sysCard() {
		var t = Array.prototype.filter.call(document.querySelectorAll('#maincontent .cbi-title'), function (e) { return /^\s*(Sistema|System)/.test(e.textContent); })[0];
		var sec = t && t.closest('.cbi-section');
		if (!sec || sec.querySelector('.sys-img')) return;
		var tbl = sec.querySelector('table');
		if (!tbl) return;
		sec.classList.add('sys-card');
		tbl.parentElement.classList.add('sys-body');
		var img = document.createElement('img');
		img.className = 'sys-img';
		img.src = '/luci-static/aurora/images/modelo.png';
		img.onerror = function () { img.onerror = null; img.src = '/luci-static/aurora/images/modelo.svg'; };   // model image (PNG or generic SVG)
		img.alt = '';
		tbl.parentElement.insertBefore(img, tbl);
	}
	// "Logout" leaves the top menu and becomes an icon button in the corner of the bar (next to search)
	function sairToolbar() {
		document.querySelectorAll('a.menu[href$="/admin/logout"]').forEach(function (a) {
			var li = a.closest('li');
			if (li && li.style.display !== 'none') li.style.display = 'none';
		});
		var cmdk = document.querySelector('header .cmdk-trigger');
		if (!cmdk || document.querySelector('.logout-btn')) return;
		var b = document.createElement('a');
		b.className = 'logout-btn';
		b.href = '/cgi-bin/luci/admin/logout';
		b.setAttribute('data-tip', L('Sair'));
		b.setAttribute('aria-label', 'Sair');
		cmdk.parentElement.insertBefore(b, cmdk.nextSibling);
	}
	// Theme texts in English (when LuCI is in English): the Portuguese text is the key
	var EN = { 'Nome': 'Name', 'IP': 'IP', 'MAC': 'MAC', 'Rede': 'Network', 'Sinal': 'Signal', 'Taxas': 'Rates', 'Consumo': 'Usage',
		'Total': 'Total', 'Tipo': 'Type', 'Fabricante': 'Vendor', 'Desconectar': 'Disconnect', 'Desconectado': 'Disconnected',
		'Desconhecido': 'Unknown', 'Celular': 'Phone', 'Computador': 'Computer', 'TV': 'TV', 'Outro': 'Other', 'Cabo': 'Cable',
		'Dispositivos WiFi': 'Wi-Fi devices', 'Dispositivos Cabeados': 'Wired devices', 'Sair': 'Logout',
		'MAC aleatório (privado)': 'Random MAC (private)', 'Consultando…': 'Looking up…' };
	// Portuguese: original texts; any other language: English (fallback for all languages)
	function isPt() { return /lang_pt/.test(document.body.className); }
	// Translations per language (key = Portuguese text). A language without a translation uses English.
	var TR = {
		es: { 'Nome': 'Nombre', 'Rede': 'Red', 'Sinal': 'Señal', 'Taxas': 'Tasas', 'Consumo': 'Consumo', 'Total': 'Total', 'Tipo': 'Tipo', 'Fabricante': 'Fabricante', 'Desconectar': 'Desconectar', 'Desconectado': 'Desconectado', 'Desconhecido': 'Desconocido', 'Celular': 'Teléfono', 'Computador': 'Computadora', 'Outro': 'Otro', 'Cabo': 'Cable', 'Dispositivos WiFi': 'Dispositivos Wi-Fi', 'Dispositivos Cabeados': 'Dispositivos con cable', 'Sair': 'Salir', 'MAC aleatório (privado)': 'MAC aleatoria (privada)', 'Consultando…': 'Consultando…' },
		fr: { 'Nome': 'Nom', 'Rede': 'Réseau', 'Sinal': 'Signal', 'Taxas': 'Débits', 'Consumo': 'Utilisation', 'Total': 'Total', 'Tipo': 'Type', 'Fabricante': 'Fabricant', 'Desconectar': 'Déconnecter', 'Desconectado': 'Déconnecté', 'Desconhecido': 'Inconnu', 'Celular': 'Téléphone', 'Computador': 'Ordinateur', 'Outro': 'Autre', 'Cabo': 'Câble', 'Dispositivos WiFi': 'Appareils Wi-Fi', 'Dispositivos Cabeados': 'Appareils filaires', 'Sair': 'Déconnexion', 'MAC aleatório (privado)': 'Adresse MAC aléatoire', 'Consultando…': 'Recherche…' },
		de: { 'Nome': 'Name', 'Rede': 'Netzwerk', 'Sinal': 'Signal', 'Taxas': 'Raten', 'Consumo': 'Verbrauch', 'Total': 'Gesamt', 'Tipo': 'Typ', 'Fabricante': 'Hersteller', 'Desconectar': 'Trennen', 'Desconectado': 'Getrennt', 'Desconhecido': 'Unbekannt', 'Celular': 'Handy', 'Computador': 'Computer', 'Outro': 'Andere', 'Cabo': 'Kabel', 'Dispositivos WiFi': 'WLAN-Geräte', 'Dispositivos Cabeados': 'Kabelgebundene Geräte', 'Sair': 'Abmelden', 'MAC aleatório (privado)': 'Zufällige MAC (privat)', 'Consultando…': 'Abfrage läuft…' },
		it: { 'Nome': 'Nome', 'Rede': 'Rete', 'Sinal': 'Segnale', 'Taxas': 'Velocità', 'Consumo': 'Consumo', 'Total': 'Totale', 'Tipo': 'Tipo', 'Fabricante': 'Produttore', 'Desconectar': 'Disconnetti', 'Desconectado': 'Disconnesso', 'Desconhecido': 'Sconosciuto', 'Celular': 'Telefono', 'Computador': 'Computer', 'Outro': 'Altro', 'Cabo': 'Cavo', 'Dispositivos WiFi': 'Dispositivi Wi-Fi', 'Dispositivos Cabeados': 'Dispositivi cablati', 'Sair': 'Esci', 'MAC aleatório (privado)': 'MAC casuale (privato)', 'Consultando…': 'Ricerca…' },
		ru: { 'Nome': 'Имя', 'Rede': 'Сеть', 'Sinal': 'Сигнал', 'Taxas': 'Скорости', 'Consumo': 'Трафик', 'Total': 'Всего', 'Tipo': 'Тип', 'Fabricante': 'Производитель', 'Desconectar': 'Отключить', 'Desconectado': 'Отключено', 'Desconhecido': 'Неизвестно', 'Celular': 'Телефон', 'Computador': 'Компьютер', 'Outro': 'Другое', 'Cabo': 'Кабель', 'Dispositivos WiFi': 'Устройства Wi-Fi', 'Dispositivos Cabeados': 'Проводные устройства', 'Sair': 'Выход', 'MAC aleatório (privado)': 'Случайный MAC (приватный)', 'Consultando…': 'Поиск…' },
		zh: { 'Nome': '名称', 'Rede': '网络', 'Sinal': '信号', 'Taxas': '速率', 'Consumo': '用量', 'Total': '总计', 'Tipo': '类型', 'Fabricante': '厂商', 'Desconectar': '断开', 'Desconectado': '已断开', 'Desconhecido': '未知', 'Celular': '手机', 'Computador': '电脑', 'Outro': '其他', 'Cabo': '有线', 'Dispositivos WiFi': 'Wi-Fi 设备', 'Dispositivos Cabeados': '有线设备', 'Sair': '退出', 'MAC aleatório (privado)': '随机 MAC（隐私）', 'Consultando…': '查询中…' },
		ja: { 'Nome': '名前', 'Rede': 'ネットワーク', 'Sinal': '信号', 'Taxas': '速度', 'Consumo': '使用量', 'Total': '合計', 'Tipo': '種類', 'Fabricante': 'メーカー', 'Desconectar': '切断', 'Desconectado': '切断済み', 'Desconhecido': '不明', 'Celular': 'スマートフォン', 'Computador': 'パソコン', 'Outro': 'その他', 'Cabo': '有線', 'Dispositivos WiFi': 'Wi-Fi 機器', 'Dispositivos Cabeados': '有線機器', 'Sair': 'ログアウト', 'MAC aleatório (privado)': 'ランダム MAC（プライバシー）', 'Consultando…': '照会中…' },
		ar: { 'Nome': 'الاسم', 'Rede': 'الشبكة', 'Sinal': 'الإشارة', 'Taxas': 'المعدلات', 'Consumo': 'الاستهلاك', 'Total': 'الإجمالي', 'Tipo': 'النوع', 'Fabricante': 'الشركة المصنّعة', 'Desconectar': 'قطع الاتصال', 'Desconectado': 'غير متصل', 'Desconhecido': 'غير معروف', 'Celular': 'هاتف', 'Computador': 'حاسوب', 'Outro': 'أخرى', 'Cabo': 'سلكي', 'Dispositivos WiFi': 'أجهزة Wi-Fi', 'Dispositivos Cabeados': 'الأجهزة السلكية', 'Sair': 'تسجيل الخروج', 'MAC aleatório (privado)': 'عنوان MAC عشوائي (خاص)', 'Consultando…': 'جارٍ البحث…' },
		hi: { 'Nome': 'नाम', 'Rede': 'नेटवर्क', 'Sinal': 'सिग्नल', 'Taxas': 'दरें', 'Consumo': 'उपयोग', 'Total': 'कुल', 'Tipo': 'प्रकार', 'Fabricante': 'निर्माता', 'Desconectar': 'डिस्कनेक्ट करें', 'Desconectado': 'डिस्कनेक्टेड', 'Desconhecido': 'अज्ञात', 'Celular': 'फ़ोन', 'Computador': 'कंप्यूटर', 'Outro': 'अन्य', 'Cabo': 'केबल', 'Dispositivos WiFi': 'Wi-Fi डिवाइस', 'Dispositivos Cabeados': 'वायर्ड डिवाइस', 'Sair': 'लॉग आउट', 'MAC aleatório (privado)': 'रैंडम MAC (निजी)', 'Consultando…': 'खोज रहा है…' }
	};
	function langOf() { var m = document.body.className.match(/lang_([a-z]{2})/i); return m ? m[1].toLowerCase() : 'en'; }
	function L(s) { var g = langOf(); if (g === 'pt') return s; if (TR[g] && TR[g][s]) return TR[g][s]; return EN[s] || s; }
	// "Label: value" pairs read from the tooltip structure (each value is in <strong>): works in any language
	function tipMap(box, txt) {
		var m = {}, pairs = [];
		box.querySelectorAll('.cbi-tooltip').forEach(function (tip) {
			var c = tip.cloneNode(true);   // marks each value in bold with \u0001 ... \u0002
			c.querySelectorAll('strong').forEach(function (s) { s.textContent = '\u0001' + s.textContent.trim() + '\u0002'; });
			c.textContent.split('\u0001').slice(1).forEach(function (part) {
				var i = part.indexOf('\u0002');
				if (i < 0) return;
				var lab = part.slice(0, i).replace(/\s+/g, ' ').trim().replace(/:$/, '').trim();
				var val = part.slice(i + 1).trim();
				if (lab && val) pairs.push([lab, val]);
			});
		});
		if (pairs.length) pairs.forEach(function (p) { (m[p[0]] = m[p[0]] || []).push(p[1]); });
		else m = parseFields(txt);
		return m;
	}
	function tipMapOld(box, txt) {
		var m = {}, pairs = [];
		Array.prototype.forEach.call(box.querySelectorAll('.cbi-tooltip'), function (tip) {
			var buf = '';
			Array.prototype.forEach.call(tip.childNodes, function (n) {
				if (n.nodeType === 3) buf += n.nodeValue;
				else if (n.nodeName === 'STRONG') {
					var lab = buf.replace(/\s+/g, ' ').trim().replace(/:$/, '').trim();
					if (lab) pairs.push([lab, n.textContent.trim()]);
					buf = '';
				} else buf += n.textContent;
			});
		});
		if (pairs.length) pairs.forEach(function (p) { (m[p[0]] = m[p[0]] || []).push(p[1]); });
		else m = parseFields(txt);
		return m;
	}
	var deb;
	function schedule() { clearTimeout(deb); deb = setTimeout(function () { sync(); tabsify(); hintify(); flipify(); equalize(); sairToolbar(); }, 120); }
	var devLastY = 0;            // the user's last scroll position
	var quietAt = 0, pageStart = Date.now();   // last time LuCI changed the page (to wait for it to finish)
	var mo = new MutationObserver(schedule);
	function start() {
		var top = document.getElementById('topmenu');
		var main = document.getElementById('maincontent');
		if (top) mo.observe(top, { childList: true, subtree: true });
		// subtree: the port widget and automatic updates live deep in the content
		if (main) mo.observe(main, { childList: true, subtree: true });
		// tabs are converted right after each page change (before painting), without the schedule delay
		// if a LuCI update pushes the page up, it goes back to where the user was
		if (main) new MutationObserver(function () {
			quietAt = Date.now();
			if (Math.abs(window.scrollY - devLastY) > 40) window.scrollTo(0, devLastY);
			tabsify(); hintify(); wireTabPanes(); bandwidthify(); flipify(); equalize(); portLabels(); zoneColors(); iconifyWifiButtons(); sysCard();
		}).observe(main, { childList: true, subtree: true });
		mo.observe(document.body, { attributes: true, attributeFilter: ['data-page'] });
		schedule();
	}
	window.addEventListener('hashchange', schedule);
	window.addEventListener('popstate', schedule);
	window.addEventListener('resize', schedule);
	window.addEventListener('scroll', function () { devLastY = window.scrollY; }, { passive: true });
	if (document.readyState !== 'loading') start();
	else document.addEventListener('DOMContentLoaded', start);
})();

// Runs now, and again whenever the content changes (without a fixed-interval delay)
function keepFitted(fn) {
	var pending = false;
	var run = function () { pending = false; fn(); };
	var schedule = function () { if (!pending) { pending = true; requestAnimationFrame(run); } };
	run();
	var root = document.querySelector('#maincontent') || document.body;
	new MutationObserver(schedule).observe(root, { childList: true, subtree: true, characterData: true });
}
// Back of the device cards: the text shrinks until it fits the card (no scrolling)
(function fitDeviceBacks() {
	function fit() {
		document.querySelectorAll('#maincontent .dev-card .dev-back, #maincontent .ifacebox[data-flip] .flip-back').forEach(function (el) {
			el.style.fontSize = '';
			var fs = parseFloat(getComputedStyle(el).fontSize);
			while (el.scrollHeight > el.clientHeight + 1 && fs > 5) {
				fs -= 0.5;
				el.style.fontSize = fs + 'px';
			}
		});
	}
	keepFitted(fit);   // adjusts as soon as it appears and whenever the page updates the data
})();

// Device cards: the "Access Point" text (from LuCI) is shown as "AP"
(function shortenApLabel() {
	function fix() {
		var walker = document.createTreeWalker(document.querySelector('#maincontent') || document.body, NodeFilter.SHOW_TEXT);
		var n;
		while ((n = walker.nextNode())) {
			if (n.nodeValue.indexOf('Access Point') !== -1) n.nodeValue = n.nodeValue.replace(/Access Point/g, 'AP');
			// rates: joined entries (e.g. "20 MHz65 Mbit/s") get a separator
			if (/(MHz|Mbit\/s)\d/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/(MHz|Mbit\/s)(?=\d)/g, '$1, ');
		}
	}
	keepFitted(fix);
})();

// "Wi-Fi devices" title: shows how many devices are connected to Wi-Fi
(function countWifiDevices() {
	function fix() {
		document.querySelectorAll('#maincontent *').forEach(function (h) {
			if (h.children.length || !/^Wi-Fi devices/.test((h.textContent || '').trim())) return;
			if (!h.dataset.orig) h.dataset.orig = h.textContent.trim();
			var section = h.closest('.dev-wrap, .cbi-section, section') || h.parentElement;
			var n = [].filter.call(section.querySelectorAll('.dev-card'), function (c) {
				return /phy\d+-ap\d+|Access Point|\bAP\b/.test(c.textContent);
			}).length;
			var txt = h.dataset.orig + ' (' + n + ')';
			if (h.textContent !== txt) h.textContent = txt;
		});
	}
	keepFitted(fix);
})();

// Device name on the cards: shrinks the font until it fits on one line (e.g. android-a8b2a225bbbe5bb3)
(function fitDeviceNames() {
	function fit() {
		document.querySelectorAll('#maincontent .dev-card .dev-top b').forEach(function (b) {
			b.style.whiteSpace = 'nowrap';
			b.style.fontSize = '';
			// available space = header width minus the device type
			var par = b.parentElement, sp = par.querySelector('span');
			// usable width of the face (without padding) minus the device type
			var face = b.closest('.dev-front, .dev-back') || par;
			var fcs = getComputedStyle(face);
			var useful = face.clientWidth - parseFloat(fcs.paddingLeft) - parseFloat(fcs.paddingRight);
			var avail = useful - (sp ? sp.offsetWidth + 6 : 0) - 2;
			b.style.maxWidth = avail + 'px';
			var fs = parseFloat(getComputedStyle(b).fontSize);
			while (b.scrollWidth > avail && fs > 5) {
				fs -= 0.5;
				b.style.fontSize = fs + 'px';
			}
		});
	}
	keepFitted(fit);
	window.addEventListener('resize', fit);   // redoes it when the window changes size
})();

// Status > Overview: the WAN port appears before the LANs (WAN, LAN2, LAN3, LAN4)
(function wanFirst() {
	function order() {
		if ((document.body.getAttribute('data-page') || '') !== 'admin-status-overview') return;
		var cards = [].slice.call(document.querySelectorAll('.ifacebox[data-flip]'));
		var nameOf = function (c) { var h = c.querySelector('.ifacebox-head'); return h ? h.textContent.trim().split('\n')[0].trim() : ''; };
		var wan = cards.filter(function (c) { return nameOf(c) === 'wan'; })[0];
		if (!wan || !cards.length || cards[0] === wan) return;
		// the cards stay in the same row: only the WAN card is moved to the start
		if (wan.parentElement === cards[0].parentElement) wan.parentElement.insertBefore(wan, cards[0]);
	}
	keepFitted(order);
})();

// Devices: the section appears only when the list is ready (or after 2 s, if there is no data)
(function showDevicesTogether() {
	var t0 = Date.now();
	function check() {
		document.querySelectorAll('#maincontent .dev-wrap:not(.ready)').forEach(function (w) {
			if (w.querySelector('.dev-card') || Date.now() - t0 > 2000) w.classList.add('ready');
		});
	}
	keepFitted(check);
	setTimeout(check, 2100);
})();

// The "Powered by ..." footer appears together with the rest of the page (after the devices load)
(function footerTogether() {
	var t0 = Date.now();
	function check() {
		var ready = !document.querySelector('#maincontent .cbi-section:has(.dev-wrap:not(.ready))') || Date.now() - t0 > 2000;
		var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n;
		while ((n = w.nextNode())) {
			if (/^\s*Powered by/.test(n.nodeValue) && n.parentElement) {
				var el = n.parentElement.closest('footer, .footer, .main-footer, div, p') || n.parentElement;
				el.classList.toggle('pb-hide', !ready);
				break;
			}
		}
	}
	keepFitted(check);
	setTimeout(check, 2100);
})();

// Diagnostics (only when enabled in the browser: localStorage.setItem('aurora-debug','1')): logs the loading times to the console
(function debugTimeline() {
	var on = false;
	try { on = localStorage.getItem('aurora-debug') === '1'; } catch (e) {}
	if (!on) return;
	var t0 = performance.now();
	var log = function (m) { console.log('[aurora]', Math.round(performance.now() - t0) + ' ms', m); };
	var seenCards = false, seenReady = false;
	log('script carregado (' + location.pathname + ')');
	keepFitted(function () {
		var c = document.querySelectorAll('.dev-card').length;
		if (c && !seenCards) { seenCards = true; log('cards de dispositivos na tela: ' + c); }
		if (document.querySelector('.dev-wrap.ready') && !seenReady) { seenReady = true; log('seção de dispositivos liberada'); }
	});
	window.addEventListener('load', function () { log('página carregada (load)'); });
})();

// Tables whose rows have an action column (e.g. Repo Public Keys: Delete button) but whose header
// has no cell for it: adds an empty header cell with the same width, so the header bar reaches the right edge.
(function alignActionHeaders() {
	function fix() {
		document.querySelectorAll('#maincontent .cbi-section-table-titles').forEach(function (head) {
			var table = head.closest('table, .table'), row = table && table.querySelector('.cbi-section-table-row');   // first data row of the same table (the header may sit in a thead)
			if (!row) return;
			var cells = row.children, heads = head.children;
			if (cells.length <= heads.length) return;   // nothing missing
			var last = cells[cells.length - 1];
			if (!last.classList.contains('cbi-section-actions')) return;
			var spacer = head.querySelector('.aurora-action-spacer');
			if (!spacer) { spacer = document.createElement('th'); spacer.className = 'th cbi-section-table-cell aurora-action-spacer'; head.appendChild(spacer); }
			spacer.style.width = last.offsetWidth + 'px';   // same width as the action column below
			spacer.style.flex = '0 0 auto';
		});
	}
	keepFitted(fix);
})();
