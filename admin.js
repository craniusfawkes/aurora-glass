// Patch do tema Aurora (carrega em todas as paginas /admin): marca no menu de cima
// qual categoria esta aberta, ja que o tema nao destaca o item ativo sozinho.
(function () {
	function sync() {
		var top = document.getElementById('topmenu');
		if (!top) return;
		// rotulo da categoria ativa = mesmo texto usado no item do menu de cima
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
	// Transforma cada card de porta (.ifacebox) num cartao que "vira" (hover no desktop,
	// toque no celular) e mostra TODAS as infos no verso, no lugar do tooltip. Idempotente.
	// Lê "Rótulo: valor" de um texto, em {rótulo: [valores]} (sem repetir), ignorando portas-membro.
	function parseFields(text) {
		text = (text || '').replace(/\s+/g, ' ').split(/\(\s*Tipo:/)[0];
		// rótulos das estatísticas da porta (tooltip) entram aqui; "Pacotes transmitidos e perdidos" antes de "Pacotes transmitidos"
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
	// junta o texto de TODOS os tooltips do card (a porta tem um com a rede e outro com as estatísticas)
	function allTipText(box) {
		return Array.prototype.map.call(box.querySelectorAll('.cbi-tooltip'), function (t) { return t.textContent; }).join(' ');
	}
	// traduz uma palavra pelo LuCI (_), ou usa a propria palavra se a funcao nao existir
	function lx(s) { return (typeof _ === 'function') ? _(s) : s; }
	// escapa caracteres especiais para usar o texto dentro de uma regex
	function reEsc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
	// le "Conectado: sí" / "Connected: yes" (qualquer idioma) e devolve true/false
	function connectedState(box) {
		var txt = allTipText(box);
		var label = reEsc(lx('Connected'));
		if (new RegExp(label + '\\s*:?\\s*' + reEsc(lx('yes')), 'i').test(txt)) return true;
		if (new RegExp(label + '\\s*:?\\s*' + reEsc(lx('no')), 'i').test(txt)) return false;
		// sem tooltip de rede: usa o icone de porta do proprio LuCI (port_up / port_down)
		if (box.querySelector('img[src*="port_down"], img[src*="port_pse_down"]')) return false;
		if (box.querySelector('img[src*="port_up"], img[src*="port_pse_up"]')) return true;
		return /\d+\s*h\s*\d+\s*m|\d+\s*m\s*\d+\s*s/.test(txt);   // ultimo recurso: tempo de atividade
	}
	// tipo de cada membro da ponte, na mesma ordem dos ícones (ex.: Bridge, Switch port); null se não der para ler
	function memberTypes(text) {
		var t = (text || '').replace(/\s+/g, ' ');
		var parts = t.split(/(?=(?:Tipo|Type)\s*:)/).filter(function (x) { return /^(Tipo|Type)\s*:/.test(x.trim()); });
		if (parts.length < 2) return null;
		return parts.map(function (part) {
			var m = part.match(/(?:Tipo|Type)\s*:\s*(.+?)(?=\s*(?:Dispositivo|Device|Conectado|Connected|MAC|RX|TX)\s*:|$)/);
			return m ? m[1].trim() : '';
		});
	}
	// separa o texto de uma ponte (vários membros, cada um começa com "Tipo:") em blocos e monta um HTML por membro
	// verso da ponte: junta o que é igual em todos os membros (MAC, conexão) num cabeçalho e lista só o que muda por membro
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
	// prisma horizontal: gira o container para a face k ficar de frente (cada clique = 360° / N)
	// distância uniforme entre a parte de baixo do prisma (faces, já inclinadas) e os botões abaixo
	function prismSpace(box) {
		// botões e espaço embaixo ficam iguais em todos os cartões (CSS): sem ajuste por cartão
		box.style.marginBottom = '';
		var row = box.closest('tr');
		if (row) [].forEach.call(row.querySelectorAll('button, .cbi-button, a.cbi-button'), function (b) { b.style.position = ''; b.style.top = ''; });
	}
	var PRISM_TILT = -13;   // inclinação (graus) do prisma para ver a base
	function sideDir(el, e) { var r = el.getBoundingClientRect(); return (e.clientX - r.left) / r.width < 0.33 ? 1 : -1; }
	// gira o card de frente/verso em 180° por passo (contínuo: não volta para trás por conta própria)
	var boxTurn = {};   // giro dos cards na página atual (guardado na memória; zera ao trocar de página)
	function flipSpin(box, dir) {
		var t = (+box.getAttribute('data-turn') || 0) + dir;
		boxTurn[box.getAttribute('data-flipkey')] = t;
		box.setAttribute('data-turn', t);
		box.setAttribute('data-lastdir', dir);
		box.querySelector('.flip-inner').style.transform = 'rotateY(' + (-t * 180) + 'deg)';
	}
	function sideOf(el, e) { var r = el.getBoundingClientRect(); return (e.clientX - r.left) < r.width / 2 ? 'L' : 'R'; }
	// contorno do prisma desenhado em SVG (uma linha só): calcula a silhueta de cada face visível no giro atual
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
		var cx = inner.offsetWidth / 2, cy = 144;   // centro do cartão (origem da perspectiva)
		var tilt = PRISM_TILT * rad, spin = -t * step * rad;
		var rotX = function (v) { var c = Math.cos(tilt), s = Math.sin(tilt); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };
		var rotY = function (v, a) { var c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };
		var d = '', k = 0;
		faces.forEach(function (f, i) {
			var a = i * step * rad;
			var n0 = rotX(rotY(rotY([0, 0, 1], a), spin));   // direção da face após a rotação do prisma
			if (n0[2] <= 0) return;                          // face de trás: não aparece
			var w = parseFloat(f.style.width) || 0, pts = [[-w / 2, -144], [w / 2, -144], [w / 2, 144], [-w / 2, 144]];
			var seg = pts.map(function (p) {
				var q = rotY([p[0], p[1], r], a);            // face no seu lugar
				q = rotY(q, spin); q = rotX(q);              // giro do prisma e inclinação
				q[2] -= r; q[1] *= vs;                       // mesma transformação do CSS
				var f2 = P / (P - q[2]);
				return [cx + (q[0] + dx) * f2, cy + (q[1] + dy) * f2];
			});
			d += 'M' + seg.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L') + ' Z ';
		});
		svg.style.left = inner.offsetLeft + 'px';   // alinha o SVG com o mesmo quadro do cartão (sem a margem interna)
		svg.style.top = inner.offsetTop + 'px';
		svg.setAttribute('width', inner.offsetWidth);
		svg.setAttribute('height', 288);
		svg.setAttribute('viewBox', '0 0 ' + inner.offsetWidth + ' 288');
		svg.innerHTML = '<path d="' + d + '"></path>';
	}
	function prismSet(box, inner, t, n, r) {
		// t = número de giros acumulado (pode passar de N): a rotação segue sempre no mesmo sentido
		var k = ((t % n) + n) % n;
		// primeira vez: monta direto na posição certa, sem a animação de entrada (que fazia os ícones descerem)
		var first = !box.hasAttribute('data-faces');
		if (first) inner.style.transition = 'none';
		box.setAttribute('data-faces', n);
		box.setAttribute('data-r', r);
		box.setAttribute('data-face', k);
		box.setAttribute('data-turn', t);
		var dx = box._prismDx ? box._prismDx[k] : 0;
		var dy = box._prismDy ? box._prismDy[k] : 0, vs = box._prismV ? box._prismV[k] : 1;   // alinha topo e base com o cartão   // centraliza o prisma neste giro
		inner.style.transform = 'translateX(' + dx.toFixed(1) + 'px) translateY(' + dy.toFixed(1) + 'px) scaleY(' + vs.toFixed(3) + ') translateZ(-' + r + 'px) rotateX(' + PRISM_TILT + 'deg) rotateY(' + (-t * 360 / n) + 'deg)';
		if (first) { void inner.offsetWidth; inner.style.transition = ''; }   // libera a animação depois de montar
		// o contorno gira junto com as faces (mesma duração da animação do CSS)
		var fromT = (box._outT !== undefined) ? box._outT : t;
		var fromDx = (box._outDx !== undefined) ? box._outDx : dx, fromDy = (box._outDy !== undefined) ? box._outDy : dy, fromV = (box._outV !== undefined) ? box._outV : vs;
		box._outT = t; box._outDx = dx; box._outDy = dy; box._outV = vs;
		if (box._outRaf) cancelAnimationFrame(box._outRaf);
		if (first || fromT === t) { drawPrismOutline(box, t, n, r, dx, dy, vs); }
		else {
			var t0 = performance.now();
			var stepOut = function (now) {
				var p = Math.min(1, (now - t0) / 900), e = p;   // linear: igual à transição do CSS do prisma (giro, deslocamento e escala)
				drawPrismOutline(box, fromT + (t - fromT) * e, n, r, fromDx + (dx - fromDx) * e, fromDy + (dy - fromDy) * e, fromV + (vs - fromV) * e);
				if (p < 1) box._outRaf = requestAnimationFrame(stepOut);
			};
			box._outRaf = requestAnimationFrame(stepOut);
		}
	}
	// encolhe o prisma até que, em todos os giros, as faces fiquem a no máximo 10px de cada borda do cartão
	function prismFit(box, inner, faces, geo, n, step, r) {
		var card = box.getBoundingClientRect();
		if (!card.width) return 1;                     // cartão escondido: não dá para medir
		var oldT = inner.style.transition;
		inner.style.transition = 'none';               // mede a posição final, não a animação
		var s = 1, avail = card.width - 20;            // escala: cresce até encostar na folga de 10px em cada lado
		for (var it = 0; it < 10; it++) {
			geo(s);
			var worst = 0;
			for (var k = 0; k < n; k++) {
				inner.style.transform = 'translateZ(' + (-r * s) + 'px) rotateX(' + PRISM_TILT + 'deg) rotateY(' + (-k * step) + 'deg)';
				var lo = Infinity, hi = -Infinity;
				faces.forEach(function (fc) { var q = fc.getBoundingClientRect(); if (q.left < lo) lo = q.left; if (q.right > hi) hi = q.right; });
				if (hi - lo > worst) worst = hi - lo;
			}
			if (worst > avail) s *= avail / worst * 0.99;          // passou da folga: encolhe
			else if (worst < avail * 0.97) s *= avail * 0.985 / worst;   // sobrou espaço: cresce até encostar na folga
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
		// altura: a silhueta inclinada pode passar do cartão; reduz a escala vertical e centraliza na altura do cartão
		var setT = function (k, dyy, vv) { inner.style.transform = 'translateX(' + (box._prismDx ? box._prismDx[k] : 0) + 'px) translateY(' + dyy + 'px) scaleY(' + vv + ') translateZ(' + (-r * s) + 'px) rotateX(' + PRISM_TILT + 'deg) rotateY(' + (-k * step) + 'deg)'; };
		var hs = [], k3;
		for (k3 = 0; k3 < n; k3++) {
			setT(k3, 0, 1);
			var t1 = Infinity, b1 = -Infinity;
			Array.prototype.forEach.call(faces, function (fc) { var q = fc.getBoundingClientRect(); if (q.top < t1) t1 = q.top; if (q.bottom > b1) b1 = q.bottom; });
			hs.push(b1 - t1);
		}
		var dys = [], vss = [];   // altura de cada giro: escala vertical própria (cresce ou encolhe)
		for (k3 = 0; k3 < n; k3++) {
			// acerta a escala por medição direta (repete algumas vezes, pois a inclinação muda a altura projetada)
			var vs = card.height / hs[k3];
			for (var itv = 0; itv < 4; itv++) {
				setT(k3, 0, vs);
				var tt = Infinity, bb = -Infinity;
				Array.prototype.forEach.call(faces, function (fc) { var q = fc.getBoundingClientRect(); if (q.top < tt) tt = q.top; if (q.bottom > bb) bb = q.bottom; });
				if (bb - tt > 0) vs *= card.height / (bb - tt);
			}
			vs *= 1.023;   // correção medida: a inclinação encurta a silhueta cerca de 2%
			vss.push(vs);
			setT(k3, 0, vs);
			var t2 = Infinity, b2 = -Infinity;
			Array.prototype.forEach.call(faces, function (fc) { var q = fc.getBoundingClientRect(); if (q.top < t2) t2 = q.top; if (q.bottom > b2) b2 = q.bottom; });
			dys.push(card.top + card.height / 2 - 5 - (t2 + b2) / 2);   // sobe 5px
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
			// precisa ter grafico (corpo) + info no hover (tooltip)
			if (!body || !tip || !(tip.textContent || '').trim()) continue;
			// so cards "de verdade": pagina de Interfaces OU cards de porta (Status das portas).
			// Exclui badges pequenos inline (ex.: status de upstream IPv4/IPv6), que bagunçam o layout.
			let onInterfaces = (document.body.getAttribute('data-page') || '') === 'admin-network-network';
			let isPortCard = !!body.querySelector('img[src*="port"]');
			if (!onInterfaces && !isPortCard) continue;
			let nameHead = box.querySelector('.ifacebox-head');       // 1o head = nome
			let name = nameHead ? (nameHead.textContent || '').trim().split('\n')[0].trim() : '';
			let status = (body.textContent || '').trim().replace(/\s+/g, ' ');
			// Campos do verso. Na pagina de Interfaces, UNE tooltip (Tipo/Dispositivo/Conectado)
			// + o bloco de detalhes (Protocolo, Operadora, Tempo, MAC, RX, TX, IPv4, IPv6), sem repetir,
			// e ESCONDE o bloco de detalhes (fica so o grafico no card e os botoes abaixo).
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
			// FRENTE = grafico; VERSO = texto (define a altura, sem rolagem)
			let tipAllText = allTipText(box);   // guarda os tooltips antes de mover o conteúdo para a frente
			let front = document.createElement('div');
			front.className = 'flip-front';
			while (box.firstChild) front.appendChild(box.firstChild);
			// cards com varios icones de membros (ex.: ponte "lan"): monta uma figura propria,
			// com tamanho dos icones calculado pela quantidade e formacao centralizada.
			let visImgs = Array.prototype.filter.call(front.querySelectorAll('.ifacebox-body img'), function (im) { return !im.closest('.cbi-tooltip'); });
			let memberSrcs = null;   // ícones de cada membro (guardados para as faces)
			if (visImgs.length > 1 && !front.querySelector('.flip-figure')) {
				front.classList.add('front-multi');
				let srcs = visImgs.map(function (im) { return (im.getAttribute('src') || '').replace(/"/g, ''); });
				memberSrcs = srcs;
				let n = srcs.length;
				// pirâmide: uma linha por tipo de membro; o tipo com menos itens fica em cima
				let mtypes = memberTypes(tipAllText);
				let layers = [srcs];
				if (mtypes && mtypes.length === n) {
					let groups = {}, order = [];
					mtypes.forEach(function (t, i) { if (!groups[t]) { groups[t] = []; order.push(t); } groups[t].push(srcs[i]); });
					layers = order.map(function (t) { return groups[t]; }).sort(function (a, b) { return a.length - b.length; });
				}
				let widest = Math.max.apply(null, layers.map(function (l) { return l.length; }));
				// quanto mais ícones na linha mais larga, menores (entre 26 e 54 px)
				let iso = Math.max(26, Math.min(54, Math.round(170 / Math.max(widest, layers.length))));
				let fig = document.createElement('div');
				fig.className = 'flip-figure flip-pyramid';
				fig.style.setProperty('--iso', iso + 'px');
				fig.innerHTML = layers.map(function (l) {
					return '<div class="fig-row">' + l.map(function (s) { return '<img src="' + s + '" alt="">'; }).join('') + '</div>';
				}).join('');
				front.appendChild(fig);   // a figura original (.ifacebox-body) é escondida por CSS
				// nome do dispositivo (ex.: br-lan) abaixo dos ícones
				let dev = (((tip.textContent || '').match(/Dispositivo:\s*([a-z0-9._+-]+)/)) || [])[1] || '';
				if (dev) { let lbl = document.createElement('div'); lbl.className = 'fig-label'; lbl.textContent = dev; front.appendChild(lbl); }
			}
			// nome do dispositivo sempre embaixo, em todos os cards (alinhados entre si)
			if (!front.querySelector('.fig-label')) {
				let devName = (((tip.textContent || '').match(/Dispositivo:\s*([a-z0-9._+-]+)/)) || [])[1] || name;
				let lbl2 = document.createElement('div');
				lbl2.className = 'fig-label';
				lbl2.textContent = devName;
				if (devName !== name) front.appendChild(lbl2);   // sem repetir o nome que já está no topo do cartão
				// tira o texto original do nome (ao lado do ícone), para não duplicar
				Array.prototype.forEach.call(front.querySelectorAll('.ifacebox-body'), function (b) {
					Array.prototype.forEach.call(b.childNodes, function (c) { if (c.nodeType === 3) c.nodeValue = ''; });
				});
			}
			let back = document.createElement('div');
			back.className = 'flip-back';
			// detalhes sem repetir: tira os campos de cada membro (tipo, dispositivo, conexão, RX, TX) e linhas iguais
			// detalhes sem repetir campos de membros; a rede (IPs, gateway, DNS) vai para uma face própria
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
				// ponte com vários membros: prisma horizontal. Faces: gráfico (frente), um membro por face e o verso (detalhes + rede)
				let parts = memberGroups(tipAllText);
				// ponte: o título acima do gráfico é o nome do dispositivo (br-lan), não o nome da interface (lan)
				if (parts) {
					let hd = front.querySelector('.ifacebox-head');
					let bm = (tip.textContent || '').match(/Bridge[^]{0,120}?(?:Dispositivo|Device):\s*([a-z0-9._+-]+)/) || (tip.textContent || '').match(/(?:Dispositivo|Device):\s*([a-z0-9._+-]+)/);
					if (hd && bm) hd.textContent = bm[1];
				}
				let faces = [front];
				// prisma: cartões de ponte (um membro por face) e cartões de interface (gráfico, detalhes, rede)
				let prismMode = !!parts;   // só cartões de ponte com membros; os demais são frente + verso
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
				let backNet = netHtml ? '<div class="ib-back-title">Rede</div>' + netHtml : '';   // todos os detalhes (inclusive rede) ficam juntos no verso
				let redeFace = null;
				if (!parts && prismMode) {   // cartão sem membros: a rede vai para uma face própria
					redeFace = document.createElement('div');
					redeFace.className = 'flip-mem';
					redeFace.innerHTML = '<div class="ib-back-title">' + name + '</div><div class="ib-back-title">Rede</div>' + netHtml;
				}
				back.innerHTML = '<div class="ib-back-title">' + name + '</div>' + sub + detailsHtml + backNet;
				faces.push(back);
				if (redeFace) faces.push(redeFace);
				// N faces (lados do prisma); lado = 320px, então o raio até o centro de cada face = 160 / tan(180° / N)
				// raio limitado (prisma não cresce demais); a face fica estreita para o anel fechar com N lados
				let N = faces.length, R = Math.min(150, 160 / Math.tan(Math.PI / N)), W = 2 * R * Math.tan(Math.PI / N), STEP = 360 / N;
				let FW = W;   // a frente tem a mesma largura das outras faces
				let capTop = null, capBot = null;   // tampas (criadas depois, em setas)
				let geo = function (s) {
					if (typeof capGeo === 'function') capGeo(s);
					faces.forEach(function (fc, i) {
						let w = (fc === front ? FW : W) * s;
						// ícones da pirâmide cabem na largura da face: menos ícones por linha = ícones maiores
						let fg = fc.querySelector('.flip-pyramid');
						if (fg) {
							let wide = Math.max.apply(null, [1].concat([].map.call(fg.querySelectorAll('.fig-row'), function (rw) { return rw.children.length; })));
							fg.style.setProperty('--iso', Math.max(16, Math.min(54, Math.floor((w - 16) / wide) - 8)) + 'px');
						}
						fc.style.width = w + 'px'; fc.style.left = '50%'; fc.style.marginLeft = (-w / 2) + 'px';
						fc.style.transform = 'rotateY(' + (i * STEP) + 'deg) translateZ(' + (R * s) + 'px)';
					});
				};
				// tampas: raio até os vértices = apótema / cos(180° / N); pontos do polígono em % da caixa
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
				if (prismMode) geo(1);   // depois das tampas: geo também as atualiza
				// camada interna que gira (o container .ifacebox fica parado -> hover estavel, sem tremor)
				let inner = document.createElement('div');
				inner.className = 'flip-inner';
				faces.forEach(function (fc) { inner.appendChild(fc); });
				if (prismMode) {   // base e topo: polígono regular de N lados (mesmo número de lados das faces)
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
					// o cartão muda de largura (celular, zoom): refaz o encaixe e a centralização do prisma
					if (prismMode) setTimeout(function () { box.classList.add('prism-ready'); }, 1500);   // segurança: mostra mesmo se a medição falhar
				if (prismMode && window.ResizeObserver) {
						new ResizeObserver(function () {
							let cur = +box.getAttribute('data-face') || 0;
							let sc = prismFit(box, inner, faces, geo, N, STEP, R);
							geo(sc);
							prismSet(box, inner, cur, N, R * sc);
							setTimeout(function () { prismSpace(box); box.classList.add('prism-ready'); }, 700);   // espera a animação do giro terminar; só então mostra o cartão
						}).observe(box);
					}
				else { var t0 = (boxTurn[name] !== undefined) ? boxTurn[name] : 0; box.setAttribute('data-turn', t0); if (t0) box.setAttribute('data-latched', '1'); box.querySelector('.flip-inner').style.transform = 'rotateY(' + (-t0 * 180) + 'deg)'; }   // volta virado se estava virado
			// borda verde quando o dispositivo está conectado
			// azul = conectado; vermelho = desconectado (porta "sem link" ou dispositivo/rede sem conexão)
				// Estado do link em QUALQUER idioma: o LuCI traduz os rotulos com a funcao global _()
				// (ex.: _('Connected') -> "Conectado", _('yes') -> "sí"). Montamos a busca com essas traducoes.
				let linked = connectedState(box);
				box.classList.add(linked ? 'ifc-connected' : 'ifc-disconnected');
			// toque/clique vira o card (no celular nao ha hover)
			box.addEventListener('click', function (e) {
				if (e.target.closest('a, button, input')) return;
					if (this.classList.contains('prism')) {   // prisma: cada clique gira para a próxima face
						let pn = +this.getAttribute('data-faces') || 1;
						let cur = +this.getAttribute('data-turn') || +this.getAttribute('data-face') || 0;
						// clique na lateral esquerda gira para a esquerda; na direita (ou no meio) gira para a direita
						let rc = this.getBoundingClientRect(), px = (e.clientX - rc.left) / rc.width;
						let pf = cur + (px < 0.33 ? 1 : -1);   // sem limite: do último volta a girar para o primeiro no mesmo sentido
						prismSet(this, this.querySelector('.flip-inner'), pf, pn, +this.getAttribute('data-r') || 0);
						var pbox = this;
						setTimeout(function () { prismSpace(pbox); }, 650);   // espera a animação terminar
						flipFaceSet(location.pathname + '|' + this.getAttribute('data-flipkey'), ((pf % pn) + pn) % pn);
					return;
				}
				var d = sideDir(this, e), hovered = this.hasAttribute('data-hover');
				if (this.hasAttribute('data-latched')) this.removeAttribute('data-latched'); else this.setAttribute('data-latched', '1');   // clique alterna travado/destravado
				if (!hovered) flipSpin(this, d);   // se já girou pelo mouse, só trava; senão gira no lado clicado
				flipSet(location.pathname + '|' + this.getAttribute('data-flipkey'), this.hasAttribute('data-latched'));
			});
		}
	}
	// Deixa todos os cards do MESMO tamanho: largura = a do mais largo, altura = a do mais alto.
	function equalize() {
		var boxes = Array.prototype.slice.call(document.querySelectorAll('.ifacebox[data-flip]'));
		if (boxes.length < 2) return;
		// volta ao tamanho natural (conteúdo) para medir
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
	// A descrição da página ("Aqui você pode...") vira dica do título da 1ª seção:
	// some do corpo e aparece só quando o mouse passa pelo título.
	// Páginas sem cartão (ex.: Reiniciar): envolve o conteúdo num cartão, para receber a barra de título
	function wrapPage(mc) {
		var h2 = Array.prototype.filter.call(mc.querySelectorAll('h2'), function (e) {
			return !e.closest('.cbi-tabmenu') && e.textContent.trim();
		})[0];
		if (!h2 || h2.parentElement === mc) return null;
		var host = h2.parentElement;
		var sec = document.createElement('div');
		sec.className = 'cbi-section page-card';
		host.insertBefore(sec, h2);
		// move o título e o conteúdo para dentro do cartão (os eventos dos botões continuam ligados)
		Array.prototype.slice.call(host.childNodes).forEach(function (n) {
			if (n !== sec && n.nodeName !== 'SCRIPT' && n.nodeName !== 'NOSCRIPT') sec.appendChild(n);
		});
		return sec;
	}
	function hintify() {
		var mc = document.getElementById('maincontent');
		var sec = mc && mc.querySelector('.cbi-section');
		if (mc && !sec) sec = wrapPage(mc);               // sem cartão: cria um para a barra de título
		if (!sec) return;                                  // página sem cartão: nada a fazer
		// 1) título grande solto da página (h2 fora dos cartões) some: o nome vai para a barra do cartão
		var big = Array.prototype.filter.call(mc.querySelectorAll('h2'), function (e) {
			return !(e.closest('.cbi-section') && !e.closest('.page-card')) && !e.closest('.cbi-tabmenu') && e.textContent.trim();
		});
		var pageName = big.length ? big[0].textContent.trim() : '';
		big.forEach(function (e) { e.style.display = 'none'; });
		var d = mc.querySelector('.cbi-map-descr');
		// bloco de texto solto da página (ex.: "A média de carga..." em Carga): sem título, tabela ou formulário dentro
		if (!d) {
			d = Array.prototype.find.call(mc.querySelectorAll('p, div'), function (e) {
				var t = (e.textContent || '').trim();
				// só texto com formatação simples: nunca um bloco que contenha abas, links ou controles
				var plain = Array.prototype.every.call(e.children, function (c) { return /^(SPAN|B|STRONG|EM|I|BR)$/.test(c.tagName); });
				return plain && !e.closest('.cbi-section, .cbi-tabmenu, footer') && t.length > 20 && t.length < 300;
			}) || null;
		}
		// sem a classe: o parágrafo logo abaixo do título da página também é a descrição (ex.: Roteamento)
		if (!d && big.length && big[0].nextElementSibling && big[0].nextElementSibling.tagName === 'P' && !big[0].nextElementSibling.querySelector('.cbi-section')) {
			d = big[0].nextElementSibling;
		}
		// avisos do LuCI (ex.: "No password set!") não são descrição da página: não mexe neles
		if (d && d.closest('.alert-message')) return;
		if (big.length && big[0].closest('.alert-message')) return;
		// 2) título do cartão: o h3 que já existe, ou um novo com o nome da página no menu (ex.: "Administração")
		var h = sec.querySelector(':scope > h3');
		// só cria título se o cartão ainda não tem barra de título (ex.: Visão geral já tem "Sistema", "Memória"...)
		// (cadeias do Firewall, classe nft-chain, têm título próprio e ficam como estão)
		if (!h && !sec.querySelector(':scope > .cbi-title, :scope > legend') && !sec.classList.contains('nft-chain')) {
			var act = document.querySelector('.desktop-nav a.is-active-page, a.is-active-page');
			var name = (act && act.textContent.trim()) || pageName;
			if (name) {
				h = sec.querySelector(':scope > h3.page-title') || document.createElement('h3');
				h.className = 'page-title';
				h.textContent = name;
				if (!h.parentElement) sec.insertBefore(h, sec.firstChild);   // dentro do cartão, na faixa de vidro do topo
			}
		}
		// 3) descrição da página vira dica do título
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
	// Abas antigas (ul.tabs, ex.: Registro do sistema/kernel) viram o padrão do tema (cbi-tabmenu):
	// a aba aberta fica com fundo escuro, como nas outras páginas.
	function tabsify() {
		// barra de abas dentro de um cartão de primeiro nível (ex.: DNS) sobe para antes do cartão, como no resto
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
	// Quando a barra de abas foi movida para fora do cartão (ex.: DNS), o LuCI não acha os painéis.
	// Esta função faz a troca de painel: a aba clicada mostra o painel com o mesmo data-tab.
	// barras já ligadas. Usa WeakSet (e não data-*) porque o LuCI clona os elementos e o clone copiaria a marca sem os eventos
	var wiredBars = new WeakSet();
	function wireTabPanes() {
		var box = document.querySelector('#maincontent .cbi-section-node-tabbed');
		if (!box) return;
		var bars = document.querySelectorAll('#maincontent ul.cbi-tabmenu');
		for (var i = 0; i < bars.length; i++) {
			var ul = bars[i];
			if (wiredBars.has(ul) || ul.parentElement.querySelector(':scope > [data-tab]')) continue;   // já ligada, ou o LuCI acha os painéis
			var lis = Array.prototype.filter.call(ul.children, function (l) { return l.hasAttribute('data-tab'); });
			if (!lis.length) continue;
			wiredBars.add(ul);
			var keys = lis.map(function (l) { return l.getAttribute('data-tab'); });   // chaves das abas de primeiro nível
			var show = function (key) {
				// painéis de primeiro nível da página (os aninhados, de abas dentro de abas, ficam como estão)
				Array.prototype.forEach.call(document.querySelectorAll('#maincontent div[data-tab]'), function (p) {
					if (keys.indexOf(p.getAttribute('data-tab')) < 0) return;   // sub-abas aninhadas ficam com o LuCI
					if (p.hasAttribute('data-tab')) p.setAttribute('data-tab-active', p.getAttribute('data-tab') === key ? 'true' : 'false');
				});
			};
			var first = lis.filter(function (l) { return l.classList.contains('cbi-tab'); })[0] || lis[0];
			show(first.getAttribute('data-tab'));
			// um único ouvinte no documento (sobrevive aos clones do LuCI); roda na captura, antes do LuCI
			if (!document.documentElement.dataset.tabDelegated) {
				document.documentElement.dataset.tabDelegated = '1';
				document.addEventListener('click', function (e) {
					var li = e.target.closest('#maincontent ul.cbi-tabmenu > li[data-tab]');
					if (!li) return;
					var bar = li.parentElement;
					if (bar.parentElement.querySelector(':scope > [data-tab]')) return;   // o LuCI acha os painéis: deixa com ele
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
	// ---- Consumo por dispositivo (Visão geral) ----
	// Lê /cgi-bin/aurora-bw a cada 5s e desenha, por dispositivo, a velocidade atual e uma linha do histórico.
	var bwHist = {};            // mac -> {name, ip, via, rx, tx, last, down[], up[], active}
	var bwBusy = false;         // true enquanto a leitura do roteador não voltou (evita pedidos empilhados)
	var bwTimer = null;
	function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
	function bwFmt(bps) {       // velocidade legível
		if (bps < 1024) return Math.round(bps) + ' B/s';
		if (bps < 1048576) return (bps / 1024).toFixed(1) + ' KB/s';
		return (bps / 1048576).toFixed(2) + ' MB/s';
	}
	function bwTotal(n) {       // total legível
		if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
		if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
		return (n / 1073741824).toFixed(2) + ' GB';
	}
	function bwSpark(down, up) { // linha de velocidade (download azul, upload cinza)
		var W = 240, H = 52, n = Math.max(down.length, 2), max = Math.max.apply(null, down.concat(up).concat([1]));
		function pts(arr) {
			return arr.map(function (v, i) { return ((i / (n - 1)) * W).toFixed(1) + ',' + (H - (v / max) * (H - 4) - 2).toFixed(1); }).join(' ');
		}
		return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" class="bw-svg">' +
			'<polyline class="ln-up" points="' + pts(up) + '"/><polyline class="ln-down" points="' + pts(down) + '"/></svg>';
	}
	// média das últimas leituras (4 amostras): mostra um valor estável, perto da média recente
	function bwAvg(a) {
		var n = Math.min(4, a.length), s = 0;
		if (!n) return 0;
		for (var i = a.length - n; i < a.length; i++) s += a[i];
		return s / n;
	}
	// texto simples da velocidade (sem animação)
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
		// para a leitura quando a seção não está na tela (ex.: o usuário trocou de página)
		if (!document.querySelector('.bw-section, #wifi_assoclist_table')) { clearInterval(bwTimer); bwTimer = null; return; }
		// não empilha pedidos: enquanto um não volta, o próximo espera (evita atualização em solavancos)
			if (bwBusy) return;
			bwBusy = true;
			// se o roteador demorar demais, cancela após 3 s para a página não ficar travada
			var ctl = typeof AbortController === 'function' ? new AbortController() : null;
			var to = ctl ? setTimeout(function () { ctl.abort(); }, 3000) : null;
			fetch('/cgi-bin/aurora-bw', { cache: 'no-store', signal: ctl ? ctl.signal : undefined }).then(function (r) { return r.json(); }).then(function (list) {
				if (to) clearTimeout(to);
				bwBusy = false;
			var now = Date.now(), seen = {};
			list.forEach(function (d) {
				seen[d.mac] = true;
				var h = bwHist[d.mac] || (bwHist[d.mac] = { down: [], up: [], rx: 0, tx: 0, last: null });
				h.name = d.name; h.ip = d.ip; h.via = d.via; h.port = d.port || ''; h.active = d.up !== false;   // cabo sem link = desconectado
				// mesma leitura do coletor (ainda não mudou): não conta de novo, senão aparece 0 e depois o dobro
				if (h.last && d.ts !== undefined && d.ts === h.last.ts) return;
				if (h.last) {                       // velocidade = variação dos bytes / tempo (nunca negativa)
					// tempo real da leitura do roteador (ts), mais preciso que o relógio do navegador
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
	// Consumo dos dispositivos Wi-Fi: uma coluna nova na tabela "Estações associadas" (casada pelo MAC)
	function bwInject() {
		var table = document.getElementById('wifi_assoclist_table');
		if (!table) return;
		var head = table.querySelector('tr.table-titles');
		if (head && !head.querySelector('.bw-th')) {
			var th = document.createElement('th');
			th.className = 'th bw-th';
			th.textContent = 'Consumo';
			head.appendChild(th); head.appendChild(document.createElement('th')); head.appendChild(document.createElement('th'));   // antes da coluna de ações
		}
		Array.prototype.forEach.call(table.querySelectorAll('tr'), function (tr) {
			if (tr === head || !tr.children[1]) return;
			var h = bwHist[(tr.children[1].textContent || '').trim().toLowerCase()];
			if (!h) return;
			var td = tr.querySelector('td.bw-td');
			if (!td) {
				td = document.createElement('td');
				td.className = 'td bw-td';
				var act = tr.querySelector('.cbi-button');    // antes da célula do botão (Desconectar)
				tr.insertBefore(td, act ? act.closest('td') : tr.lastElementChild);
			}
			var d = bwAvg(h.down), u = bwAvg(h.up);
			var wk = 'wt|' + (tr.children[1].textContent || '').trim().toLowerCase();
				var html = '<div class="bw-mini">' + bwSpan('bw-down', wk + '|d', d) + bwSpan('bw-up', wk + '|u', u) + '</div>' +
				bwSpark(h.down, h.up).replace('class="bw-svg"', 'class="bw-svg bw-mini-svg"');
			// escreve só quando mudou: senão a própria escrita dispara o observador e vira um laço
			if (td._bwHtml !== html) { td._bwHtml = html; td.innerHTML = html; }
		});
	}
	function bandwidthify() {
		var mc = document.getElementById('maincontent');
		var page = document.body.getAttribute('data-page') || '';
		if (!mc) return;
		if (page === 'admin-network-wireless') {       // página Wi-Fi: só a coluna e a leitura (sem cartão próprio)
			bwInject();
			if (!bwTimer && document.getElementById('wifi_assoclist_table')) { bwPoll(); bwTimer = setInterval(bwPoll, 1000); }
			devRender();
			return;
		}
		if (page === 'admin-status-aurora-devices') {
			var host = document.getElementById('aurora-devices');
			if (!host || host.querySelector('.bw-section')) return;   // page container missing, or section already built
			// on first load, wait for LuCI to stop building the page (at most 6 s)
			if (Date.now() - pageStart < 6000 && Date.now() - quietAt < 1500) { setTimeout(bandwidthify, 500); return; }
			var sec = document.createElement('div');
			sec.className = 'cbi-section bw-section';
			sec.innerHTML = '<h3>' + L('Dispositivos Cabeados') + '</h3><div class="dev-wrap"><ul class="cbi-tabmenu dev-sort">' +
				[['name', 'Nome'], ['ip', 'IP'], ['mac', 'MAC'], ['usage', 'Consumo'], ['total', 'Total'], ['type', 'Tipo']].map(function (s) {
					return '<li class="' + (s[0] === devSort ? 'cbi-tab' : 'cbi-tab-disabled') + '" data-sort="' + s[0] + '"><a href="#">' + L(s[1]) + '</a></li>';
				}).join('') + '</ul><div class="dev-grid"></div></div>';
			host.appendChild(sec);
			devRenderWired();
			if (!bwTimer) { bwPoll(); bwTimer = setInterval(bwPoll, 1000); }
		}
	}
	// ---- Dispositivos Wi-Fi em cards (substituem a tabela "Estações associadas" na página Wi-Fi) ----
	var devSort = 'name';        // ordenação das abas da lista Wi-Fi
	var devSortC = 'name';       // ordenação das abas da lista de cabeados (independente)
	var devFlipped = {};
	// gira o card de dispositivo 180° por passo (contínuo, como os demais cards)
	// o giro fica guardado em devTurn (e no atributo --t do card), assim a atualização da página não o desfaz
	var devTurn = {};
	// os cards voltam ao padrão ao trocar de página (não são guardados entre páginas)
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
	}         // mac -> card virado?
	// comparadores de cada aba (chave = data-sort)
	var devCmp = {
		name: function (a, b) { return (a.name || '').localeCompare(b.name || ''); },
		ip: function (a, b) { return ipNum(a.ip) - ipNum(b.ip); },
		mac: function (a, b) { return a.mac.localeCompare(b.mac); },
		net: function (a, b) { return (a.net || '').localeCompare(b.net || ''); },
		signal: function (a, b) { return b.signalNum - a.signalNum; },                       // mais forte primeiro
		rate: function (a, b) { return rateNum(b.rate) - rateNum(a.rate); },                // maior taxa RX primeiro
		usage: function (a, b) { return (b.down + b.up) - (a.down + a.up) || (a.name || '').localeCompare(b.name || ''); },
		total: function (a, b) { return (b.rx + b.tx) - (a.rx + a.tx); },                   // maior total primeiro
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
	// Tipo pelo nome do dispositivo (DHCP). Heurística: pode errar.
	function devType(name) {
		if (/iphone|android|redmi|galaxy|xiaomi|moto|pixel|phone|celular|sm-/i.test(name)) return 'phone';
		if (/\btv\b|roku|chromecast|firetv|bravia/i.test(name)) return 'tv';
		if (/desktop|laptop|notebook|\bpc\b|macbook|imac/i.test(name)) return 'computer';
		return 'other';
	}
	// linhas da tabela original, por MAC (dados de sinal, taxa, rede e o botão Desconectar)
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
		// Devices page: only the wired grid (there is no Wi-Fi table here)
		if (page === 'admin-status-aurora-devices') { devLoadOui(); devRenderWired(); return; }
		if ((page !== 'admin-network-wireless' && page !== 'admin-status-overview') || !t) return;
		devLoadOui();
		if (!document.documentElement.dataset.devWired) { document.documentElement.dataset.devWired = '1'; devWire(); }
		t.classList.add('dev-hidden');
		var h3 = t.previousElementSibling;   // título da seção: "Estações associadas" -> "Dispositivos WiFi"
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
		if (grid._html !== html && (grid._html == null || !grid.matches(':hover'))) { grid._html = html; grid.innerHTML = html; }   // só quando mudou e sem o mouse sobre a lista (evita o card tremer)
		devRenderWired();
	}
	// eventos das abas, do botão Desconectar e do virar do card (um único ouvinte)
	function devWire() {
		document.addEventListener('click', function (e) {
			var li = e.target.closest('#maincontent .dev-sort li[data-sort]');
			if (li) {
				e.preventDefault();
				if (li.closest('.bw-section')) devSortC = li.getAttribute('data-sort');   // cabeados
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
				devFlipped[m] = !devFlipped[m];   // clique trava/destrava
				if (!hovered) devSpin(card, sideDir(card, e));   // mesmo giro dos outros cards
			}
		}, true);
	}
	// Fabricante pelo prefixo do MAC (lista IEEE, carregada uma vez do roteador)
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
		if (ouiMap[p]) return ouiMap[p];                                  // lista local (IEEE)
		if (parseInt(mac.slice(0, 2), 16) & 2) return L('MAC aleatório (privado)');   // bit "localmente administrado"
		if (ouiOnline[p]) return ouiOnline[p];                            // resultado de servidor alternativo
		devOnlineLookup(p);
		return L('Consultando…');
	}
	// Fallback: prefixos que a lista local não tem vão para /cgi-bin/aurora-oui (que consulta servidores alternativos)
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
	// Dispositivos cabeados (seção da Visão geral): mesmos cards, sem sinal/taxa (não existem em cabo)
	function devRenderWired() {
		var page = document.body.getAttribute('data-page') || '';
		var grid = document.querySelector('#maincontent .bw-section .dev-grid');
		if (page !== 'admin-status-aurora-devices' || !grid) return;
		// ordenação: as abas de sinal e taxa não se aplicam a cabo
		var key = (devSortC === 'signal' || devSortC === 'rate' || devSortC === 'net') ? 'name' : devSortC;
		var items = Object.keys(bwHist).filter(function (m) { return bwHist[m].via === 'lan'; }).map(function (m) {
			var h = bwHist[m];
			return {
				mac: m, name: h.name, ip: h.ip, type: devType(h.name || ''), hist: h, active: h.active, vendor: devVendor(m),
				down: bwAvg(h.down), up: bwAvg(h.up), rx: h.rx, tx: h.tx,
				sig: '—', rate: '—', net: 'Cabo', port: bwHist[m].port || '', signalNum: -200, btn: null
			};
		});
		items.sort(devCmp[key]);
		var html = items.map(function (it) { return devCardHtml(it, !!devFlipped[it.mac]); }).join('');
		if (grid._html !== html && (grid._html == null || !grid.matches(':hover'))) { grid._html = html; grid.innerHTML = html; }
		// destaca a aba escolhida também na lista de cabeados
		document.querySelectorAll('#maincontent .bw-section .dev-sort li[data-sort]').forEach(function (l) {
			var c = l.getAttribute('data-sort') === devSortC ? 'cbi-tab' : 'cbi-tab-disabled';
			if (l.className !== c) l.className = c;
		});
	}
	// memória dos cartões virados: fica na sessão da aba, então sobrevive à atualização da página
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
	// Status das portas: "sem link" passa a ser "Desconectado" (só troca o texto, sem mexer na estrutura)
	function portLabels() {
		var walker = document.createTreeWalker(document.querySelector('#maincontent') || document.body, NodeFilter.SHOW_TEXT);
		var n;
		while ((n = walker.nextNode())) {
			if (/^\s*(sem link|no link)\s*$/i.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/sem link|no link/i, L('Desconectado'));
		}
	}
	// Botões de texto do Wi-Fi (Reiniciar, Procurar, Adicionar...) viram botões de ícone; a ação original é mantida
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
	// Faixa de zona do firewall: LAN em azul, WAN em roxo
	function zoneColors() {
		document.querySelectorAll('#maincontent .zonebadge').forEach(function (z) {
			var card = z.closest('.ifacebox'), head = card && card.querySelector('.ifacebox-head');
			var c = head && /^\s*wan/i.test(head.textContent) ?'rgba(108, 92, 255, .75)' : 'rgba(59, 130, 246, .75)';
			if (z.style.getPropertyValue('background-color') !== c) z.style.setProperty('background-color', c, 'important');
		});
	}
	// Cartão Sistema: imagem do roteador à esquerda (centralizada) e a tabela de informações à direita
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
		img.onerror = function () { img.onerror = null; img.src = '/luci-static/aurora/images/modelo.svg'; };   // imagem do modelo (PNG ou genérica SVG)
		img.alt = '';
		tbl.parentElement.insertBefore(img, tbl);
	}
	// "Sair" sai do menu de cima e vira um botão de ícone no canto da barra (ao lado da busca)
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
	// Textos do tema em inglês (quando o LuCI está em inglês): o texto em português é a chave
	var EN = { 'Nome': 'Name', 'IP': 'IP', 'MAC': 'MAC', 'Rede': 'Network', 'Sinal': 'Signal', 'Taxas': 'Rates', 'Consumo': 'Usage',
		'Total': 'Total', 'Tipo': 'Type', 'Fabricante': 'Vendor', 'Desconectar': 'Disconnect', 'Desconectado': 'Disconnected',
		'Desconhecido': 'Unknown', 'Celular': 'Phone', 'Computador': 'Computer', 'TV': 'TV', 'Outro': 'Other', 'Cabo': 'Cable',
		'Dispositivos WiFi': 'Wi-Fi devices', 'Dispositivos Cabeados': 'Wired devices', 'Sair': 'Logout',
		'MAC aleatório (privado)': 'Random MAC (private)', 'Consultando…': 'Looking up…' };
	// português: textos originais; qualquer outro idioma: inglês (fallback para todos os idiomas)
	function isPt() { return /lang_pt/.test(document.body.className); }
	// Traduções por idioma (chave = texto em português). Idioma sem tradução usa o inglês.
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
	// Pares "Rótulo: valor" lidos da estrutura do tooltip (cada valor fica em <strong>): funciona em qualquer idioma
	function tipMap(box, txt) {
		var m = {}, pairs = [];
		box.querySelectorAll('.cbi-tooltip').forEach(function (tip) {
			var c = tip.cloneNode(true);   // marca cada valor em negrito com \u0001 ... \u0002
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
	var devLastY = 0;            // última posição de rolagem do usuário
	var quietAt = 0, pageStart = Date.now();   // último momento em que a LuCI mudou a página (para esperar ela terminar)
	var mo = new MutationObserver(schedule);
	function start() {
		var top = document.getElementById('topmenu');
		var main = document.getElementById('maincontent');
		if (top) mo.observe(top, { childList: true, subtree: true });
		// subtree: o widget de portas e as atualizacoes automaticas ficam fundo no conteudo
		if (main) mo.observe(main, { childList: true, subtree: true });
		// abas são convertidas logo após cada troca de página (antes de pintar), sem o atraso do schedule
		// se a atualização do LuCI empurrar a página para cima, volta para a posição em que o usuário estava
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

// Roda já e de novo sempre que o conteúdo muda (sem o atraso de um intervalo fixo)
function keepFitted(fn) {
	var pending = false;
	var run = function () { pending = false; fn(); };
	var schedule = function () { if (!pending) { pending = true; requestAnimationFrame(run); } };
	run();
	var root = document.querySelector('#maincontent') || document.body;
	new MutationObserver(schedule).observe(root, { childList: true, subtree: true, characterData: true });
}
// Verso dos cards de dispositivos: o texto diminui até caber inteiro no card (sem rolagem)
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
	keepFitted(fit);   // ajusta logo que aparece e sempre que a página atualiza os dados
})();

// Cards de dispositivos: o texto "Access Point" (da LuCI) aparece como "AP"
(function shortenApLabel() {
	function fix() {
		var walker = document.createTreeWalker(document.querySelector('#maincontent') || document.body, NodeFilter.SHOW_TEXT);
		var n;
		while ((n = walker.nextNode())) {
			if (n.nodeValue.indexOf('Access Point') !== -1) n.nodeValue = n.nodeValue.replace(/Access Point/g, 'AP');
			// taxas: entradas coladas (ex.: "20 MHz65 Mbit/s") ganham separador
			if (/(MHz|Mbit\/s)\d/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/(MHz|Mbit\/s)(?=\d)/g, '$1, ');
		}
	}
	keepFitted(fix);
})();

// Título "Wi-Fi devices": mostra quantos dispositivos estão conectados ao Wi-Fi
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

// Nome do dispositivo nos cards: diminui a fonte até caber em uma linha (ex.: android-a8b2a225bbbe5bb3)
(function fitDeviceNames() {
	function fit() {
		document.querySelectorAll('#maincontent .dev-card .dev-top b').forEach(function (b) {
			b.style.whiteSpace = 'nowrap';
			b.style.fontSize = '';
			// espaço disponível = largura do cabeçalho menos o tipo do dispositivo
			var par = b.parentElement, sp = par.querySelector('span');
			// largura útil da face (sem o preenchimento) menos o tipo do dispositivo
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
	window.addEventListener('resize', fit);   // refaz quando a janela muda de tamanho
})();

// Status > Overview: a porta WAN aparece antes das LAN (WAN, LAN2, LAN3, LAN4)
(function wanFirst() {
	function order() {
		if ((document.body.getAttribute('data-page') || '') !== 'admin-status-overview') return;
		var cards = [].slice.call(document.querySelectorAll('.ifacebox[data-flip]'));
		var nameOf = function (c) { var h = c.querySelector('.ifacebox-head'); return h ? h.textContent.trim().split('\n')[0].trim() : ''; };
		var wan = cards.filter(function (c) { return nameOf(c) === 'wan'; })[0];
		if (!wan || !cards.length || cards[0] === wan) return;
		// os cards ficam na mesma linha: move só o card da WAN para o começo
		if (wan.parentElement === cards[0].parentElement) wan.parentElement.insertBefore(wan, cards[0]);
	}
	keepFitted(order);
})();

// Dispositivos: a seção só aparece quando a lista estiver pronta (ou após 2 s, se não houver dados)
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

// Rodapé "Powered by ..." aparece junto com o resto da página (depois que os dispositivos carregam)
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

// Diagnóstico (só quando ativado no navegador: localStorage.setItem('aurora-debug','1')): mostra no console os tempos de carregamento
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
