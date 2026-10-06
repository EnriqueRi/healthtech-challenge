// =====================================================================
// Prototipos HealthTech Challenge · todo se ejecuta en el navegador
// No se guarda ni se envía ningún dato. Los datos de ejemplo son inventados.
// =====================================================================

// Atajo para buscar elementos por id
const $ = id => document.getElementById(id);

// Escapa texto del usuario antes de meterlo en HTML (evita inyección)
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Aviso flotante
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2800);
}

// Número con coma decimal
const dec = (n, d = 1) => n.toFixed(d).replace('.', ',');

// =====================================================================
// NAVEGACIÓN
// =====================================================================
function showView(id) {
  document.querySelectorAll('.top button').forEach(b => b.setAttribute('aria-selected', b.dataset.v === id));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // Guardamos la sección en la URL para poder compartir un enlace directo
  history.replaceState(null, '', '#' + id);
}
document.querySelectorAll('.top button').forEach(b => b.addEventListener('click', () => showView(b.dataset.v)));
document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => showView(b.dataset.goto)));

// Pestañas internas de hidradenitis
document.querySelectorAll('#vA .tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#vA .tabs button').forEach(x => x.setAttribute('aria-selected', x === b));
  document.querySelectorAll('#vA .panel').forEach(p => p.classList.toggle('on', p.id === b.dataset.tab));
}));

// =====================================================================
// RETO B · EPOC (IDIAP)
// =====================================================================
const B = {
  sym: new Set(['Más ahogo que de costumbre']),
  spo2: 94,
  purul: 0,           // 0 = sin registro, 1–5
  coughs: null,       // golpes de tos en 15 s (null = sin grabar)
  coughBase: 3,       // lo habitual de este paciente (inventado)
  pcr: 45,
  // Historial inventado del nivel de alerta (0 verde, 1 ámbar, 2 rojo)
  hist: [0, 0, 0, 1, 0, 0, 1, 0, 1, 1, 1, 2, 1].map((v, i) => ({ l: 'D' + (i + 1), v }))
};
const B_SYM = ['Más ahogo que de costumbre', 'Más cantidad de esputo', 'Fiebre', 'Más tos', 'Pitos al respirar'];
const B_SCALE = [
  { v: 1, n: 'Mucoso',          c: '#F1F0EA' },
  { v: 2, n: 'Blanquecino',     c: '#ECE6C9' },
  { v: 3, n: 'Amarillo pálido', c: '#E5D37C' },
  { v: 4, n: 'Amarillo intenso', c: '#C8B53A' },
  { v: 5, n: 'Verdoso',         c: '#7F8F36' }
];
const LVL = [
  { n: 'Verde', c: 'var(--brand)', hex: '#0F6B5C' },
  { n: 'Ámbar', c: 'var(--warn)',  hex: '#B45309' },
  { n: 'Rojo',  c: 'var(--bad)',   hex: '#B91C1C' }
];

// Clasifica un color RGB medio en la escala de purulencia 1–5 (reglas, sin IA)
function classifyColor(r, g, b) {
  const R = r / 255, G = g / 255, Bl = b / 255;
  const mx = Math.max(R, G, Bl), mn = Math.min(R, G, Bl), d = mx - mn;
  const s = mx ? d / mx : 0, v = mx;
  let h = 0;
  if (d) {
    if (mx === R) h = 60 * (((G - Bl) / d) % 6);
    else if (mx === G) h = 60 * ((Bl - R) / d + 2);
    else h = 60 * ((R - G) / d + 4);
  }
  if (h < 0) h += 360;
  if (s < 0.12 && v > 0.65) return 1;   // blanco o transparente
  if (s < 0.25) return 2;               // blanquecino
  if (h >= 65 && h <= 160) return 5;    // tono verde
  if (v < 0.5 && s > 0.3) return 5;     // oscuro y saturado
  return s > 0.5 ? 4 : 3;               // amarillo intenso o pálido
}

// Foto: se dibuja en un canvas y se mide el color del 40 % central
$('bFile').addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  const img = new Image();
  img.onload = () => {
    const cv = $('bCanvas'), ctx = cv.getContext('2d');
    const k = Math.min(cv.width / img.width, cv.height / img.height);
    const w = img.width * k, h = img.height * k;
    ctx.fillStyle = '#E3E7E2';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
    const sx = cv.width * .3, sy = cv.height * .3, sw = cv.width * .4, sh = cv.height * .4;
    const px = ctx.getImageData(sx, sy, sw, sh).data;
    let r = 0, g = 0, bl = 0, n = 0;
    for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; bl += px[i + 2]; n++; }
    ctx.strokeStyle = '#0F6B5C'; ctx.lineWidth = 2; ctx.strokeRect(sx, sy, sw, sh);
    cv.style.display = 'block';
    B.purul = classifyColor(r / n, g / n, bl / n);
    URL.revokeObjectURL(img.src);
    renderB();
    toast('Foto analizada · color ' + B.purul + '/5 (' + B_SCALE[B.purul - 1].n.toLowerCase() + ')');
  };
  img.src = URL.createObjectURL(f);
  e.target.value = '';
});
$('bSwatches').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  B.purul = Number(b.dataset.v); renderB();
});
$('bSym').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const t = b.dataset.t;
  B.sym.has(t) ? B.sym.delete(t) : B.sym.add(t);
  renderB();
});
$('bSpo2').addEventListener('input', e => { B.spo2 = Number(e.target.value); renderB(); });
$('bPcr').addEventListener('input', e => { B.pcr = Number(e.target.value); renderB(); });

// ---------- Grabación de tos con el micrófono ----------
// Medimos la energía del sonido cada fotograma. Un "golpe de tos" es un pico
// fuerte que supera el ruido de fondo, separado del anterior por ≥ 300 ms.
let recState = null;
function drawWave(vals, thr) {
  const cv = $('coughWave'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const n = vals.length, bw = W / Math.max(n, 1);
  ctx.fillStyle = '#0F6B5C';
  vals.forEach((v, i) => { const h = Math.min(1, v * 4) * H; ctx.fillRect(i * bw, H - h, Math.max(bw - .5, .5), h); });
  if (thr) { ctx.strokeStyle = '#B91C1C'; ctx.setLineDash([4, 3]); const y = H - Math.min(1, thr * 4) * H; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]); }
}
async function startRec() {
  if (recState) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('Este navegador no permite usar el micrófono. Usa «Simular».'); return;
  }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (err) { toast('Sin permiso de micrófono. Usa «Simular».'); return; }
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const src = ac.createMediaStreamSource(stream);
  const an = ac.createAnalyser(); an.fftSize = 1024;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  const vals = [], DUR = 15000, t0 = performance.now();
  let count = 0, lastPeak = -1e9, above = false;
  recState = { stream, ac };
  $('bRec').disabled = true; $('bRecSim').disabled = true;
  $('bRecRow').style.display = 'flex';
  const tick = () => {
    const now = performance.now(), el = now - t0;
    an.getFloatTimeDomainData(buf);
    let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    vals.push(rms);
    // Umbral: 4 veces el ruido de fondo (mediana del primer segundo), mínimo 0,04
    const first = vals.slice(0, 60).slice().sort((a, b) => a - b);
    const noise = first[Math.floor(first.length / 2)] || 0.01;
    const thr = Math.max(0.04, noise * 4);
    if (el > 1000) {
      if (rms > thr && !above && now - lastPeak > 300) { count++; lastPeak = now; above = true; }
      if (rms < thr * 0.6) above = false;
    }
    drawWave(vals.slice(-200), thr);
    $('bRecT').textContent = 'Grabando… ' + Math.ceil((DUR - el) / 1000) + ' s · ' + count + ' golpes';
    if (el < DUR) requestAnimationFrame(tick);
    else stopRec(count);
  };
  requestAnimationFrame(tick);
}
function stopRec(count) {
  if (recState) { recState.stream.getTracks().forEach(t => t.stop()); recState.ac.close(); recState = null; }
  $('bRec').disabled = false; $('bRecSim').disabled = false;
  $('bRecRow').style.display = 'none';
  B.coughs = count;
  renderB();
  toast('Grabación analizada · ' + count + ' golpes de tos');
}
$('bRec').addEventListener('click', startRec);
$('bRecSim').addEventListener('click', () => {
  // Simulación: genera una onda con algunos picos
  const n = 4 + Math.floor(Math.random() * 7), vals = [];
  for (let i = 0; i < 200; i++) vals.push(0.01 + Math.random() * 0.01);
  for (let k = 0; k < n; k++) { const p = 15 + Math.floor(Math.random() * 180); for (let j = 0; j < 4; j++) if (vals[p + j] !== undefined) vals[p + j] = 0.12 + Math.random() * 0.1; }
  drawWave(vals, 0.04);
  B.coughs = n; renderB();
  toast('Simulación · ' + n + ' golpes de tos');
});

// Evaluación combinada (puntos inventados para la demo)
function evalB() {
  const purulent = B.purul >= 3;
  // Criterios de Anthonisen: más ahogo, más esputo, esputo purulento
  const card = [B.sym.has('Más ahogo que de costumbre'), B.sym.has('Más cantidad de esputo'), purulent].filter(Boolean).length;
  const minor = B.sym.has('Fiebre') || B.sym.has('Más tos') || B.sym.has('Pitos al respirar');
  const anth = card === 3 ? 1 : card === 2 ? 2 : (card === 1 && minor) ? 3 : 0;
  const coughHigh = B.coughs !== null && B.coughs >= B.coughBase * 2;
  const pts = {
    'Ahogo': B.sym.has('Más ahogo que de costumbre') ? 2 : 0,
    'Más esputo': B.sym.has('Más cantidad de esputo') ? 1 : 0,
    'Color del esputo': purulent ? 1 : 0,
    'Tos grabada': coughHigh ? 1 : 0,
    'Fiebre': B.sym.has('Fiebre') ? 1 : 0,
    'Saturación': B.spo2 < 94 ? 1 : 0
  };
  const total = Object.values(pts).reduce((a, b) => a + b, 0);
  let lvl = total >= 4 ? 2 : total >= 2 ? 1 : 0;
  const urgent = B.spo2 < 92;
  if (urgent) lvl = 2;
  return { card, anth, pts, total, lvl, urgent, purulent, coughHigh };
}

function renderB() {
  const ev = evalB(), L = LVL[ev.lvl];
  $('bLvl').textContent = L.n; $('bLvl').style.color = L.c; $('bLvl').style.fontSize = '24px';
  $('bLvlLbl').textContent = ev.total + ' puntos';
  $('bSym').innerHTML = B_SYM.map(t => `<button class="chip" aria-pressed="${B.sym.has(t)}" data-t="${t}">${t}</button>`).join('');
  $('bSpo2V').textContent = B.spo2 + ' %';
  $('bSwatches').innerHTML = B_SCALE.map(s =>
    `<button class="sw" aria-pressed="${B.purul === s.v}" data-v="${s.v}" aria-label="${s.n}"><span style="background:${s.c}"></span><small>${s.v}</small></button>`).join('');
  $('bCoughRes').innerHTML = B.coughs === null ? '<span class="small">Sin grabar todavía.</span>'
    : `<b>${B.coughs}</b> golpes en 15 s · lo habitual en ti: ${B.coughBase}${ev.coughHigh ? ' · <b style="color:var(--flare)">más del doble</b>' : ''}`;

  // Mensaje para el paciente
  let msg;
  if (ev.urgent) msg = 'Saturación baja. Contacta hoy mismo con tu centro de salud o llama al 061.';
  else if (ev.lvl === 2) msg = 'Posible exacerbación. Tu centro de salud recibirá un aviso y te llamará.';
  else if (ev.lvl === 1) msg = 'Algo ha cambiado. Sigue tu plan de acción y repite el control mañana.';
  else msg = 'Sin señales de alarma. Sigue con el control diario.';
  $('bMsg').textContent = msg; $('bMsg').style.color = L.c;

  // Señales combinadas
  $('bSignals').innerHTML = Object.entries(ev.pts).map(([k, v]) =>
    `<div class="sig"><span>${k}</span><b style="color:${v ? 'var(--flare)' : 'var(--muted)'}">${v ? '+' + v : '0'}</b></div>`).join('') +
    `<div class="sig" style="background:var(--dark);color:#fff"><span>Total</span><b>${ev.total} · ${L.n}</b></div>`;
  $('bAnth').textContent = (ev.anth ? 'Criterios de Anthonisen: tipo ' + ev.anth : 'No cumple criterios de Anthonisen') + ' (' + ev.card + ' de 3 principales).';

  // Gráfico de 14 días
  const H = B.hist.slice(-14), W = 560, h = 190, pad = 24, bw = (W - pad * 2) / H.length;
  let svg = `<line x1="${pad}" x2="${W - pad}" y1="${h - pad}" y2="${h - pad}" stroke="#CBD2CD"/>`;
  H.forEach((p, i) => {
    const x = pad + i * bw + 4, bh = 30 + p.v * 55, top = h - pad - bh;
    svg += `<rect x="${x}" y="${top}" width="${bw - 8}" height="${bh}" rx="4" fill="${LVL[p.v].hex}" ${p.l === 'Hoy' ? 'stroke="#16211E" stroke-width="2"' : ''}/>
      <text x="${x + (bw - 8) / 2}" y="${h - 8}" text-anchor="middle" font-size="10" fill="#55625E">${p.l}</text>`;
  });
  $('bChart').innerHTML = svg;

  // Panel del centro de salud
  const bact = ev.purulent && ev.card >= 2;
  $('bAlert').innerHTML = `
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
      <b>Paciente EPOC-0387 · 71 años</b>
      <span class="badge" style="background:${ev.lvl === 2 ? '#FDF1E6' : '#EEF6F3'};color:${ev.lvl === 2 ? '#8A3A0A' : '#0A4D42'}">${ev.lvl === 2 ? 'Aviso: citar hoy' : ev.lvl === 1 ? 'Vigilar' : 'Sin aviso'}</span>
    </div>
    <div class="small" style="font-size:13px;margin-top:6px">${ev.total} puntos · SpO₂ ${B.spo2} % · color ${B.purul || '—'}/5 · tos ${B.coughs ?? '—'} · ${bact ? 'sospecha bacteriana' : 'sin sospecha bacteriana clara'}</div>`;
  $('bPcrV').textContent = B.pcr + ' mg/L';
  let rec, rc;
  if (B.pcr < 20) { rec = 'PCR < 20: beneficio del antibiótico improbable.'; rc = 'var(--brand)'; }
  else if (B.pcr <= 40) { rec = 'PCR 20–40: valorar antibiótico si hay esputo purulento.'; rc = 'var(--warn)'; }
  else { rec = 'PCR > 40: probable beneficio del antibiótico.'; rc = 'var(--bad)'; }
  $('bRec2').textContent = rec; $('bRec2').style.color = rc;
}
$('bSave').addEventListener('click', () => {
  const ev = evalB();
  const last = B.hist[B.hist.length - 1];
  if (last.l === 'Hoy') last.v = ev.lvl; else B.hist.push({ l: 'Hoy', v: ev.lvl });
  renderB();
  toast('Control enviado · nivel ' + LVL[ev.lvl].n.toLowerCase());
});

// =====================================================================
// RETO A · HIDRADENITIS (Almirall)
// =====================================================================
const ZONES = {
  axE: { name: 'Axila izquierda', x: 34, y: 56 },
  axD: { name: 'Axila derecha',   x: 96, y: 56 },
  mam: { name: 'Zona mamaria',    x: 65, y: 72 },
  eng: { name: 'Ingle',           x: 65, y: 114 },
  glu: { name: 'Glúteos / muslos', x: 65, y: 150 }
};
const TYPES = [
  { k: 'n', label: 'Nódulos',           hint: 'Bulto duro, sin pus',    color: 'var(--nod)', w: 1 },
  { k: 'a', label: 'Abscesos',          hint: 'Inflamado, con pus',      color: 'var(--abs)', w: 2 },
  { k: 't', label: 'Túneles que supuran', hint: 'Drenan de forma continua', color: 'var(--tun)', w: 4 }
];
const TRIGGERS = ['Roce', 'Calor / sudor', 'Ciclo menstrual', 'Estrés', 'Dieta'];
const A = {
  zone: 'axD',
  les: { axE: { n: 1, a: 0, t: 0 }, axD: { n: 0, a: 1, t: 0 }, mam: { n: 0, a: 0, t: 0 }, eng: { n: 1, a: 0, t: 1 }, glu: { n: 0, a: 0, t: 0 } },
  pain: 6,
  trig: new Set(['Roce', 'Ciclo menstrual']),
  smoker: true,
  labs: { pcr: 18, vsg: 32, nlr: 3.4, hba1c: 5.9 },
  history: [6, 7, 9, 12, 10, 8, 8, 11, 14, 13, 9, 8].map((v, i) => ({ label: 'S' + (i + 1), v })),
  notes: [
    { d: '14 sep.', t: 'Axila derecha muy inflamada, no he podido ir a trabajar.' },
    { d: '28 sep.', t: 'Ha supurado el túnel de la ingle toda la noche.' }
  ]
};

// IHS4 total = suma de todas las zonas
function ihs4() {
  let s = 0;
  for (const z in A.les) for (const t of TYPES) s += A.les[z][t.k] * t.w;
  return s;
}
function severity(v) {
  if (v <= 3) return { l: 'Leve', c: 'var(--brand)' };
  if (v <= 10) return { l: 'Moderada', c: 'var(--warn)' };
  return { l: 'Grave', c: 'var(--bad)' };
}
const zoneTotal = z => A.les[z].n + A.les[z].a + A.les[z].t;
const recentFlare = () => A.history.slice(-4).some(h => h.v >= 11);

// Modelo de riesgo de juguete (logístico) con pesos inventados
function riskOf(o) {
  const x = -3.6 + 0.25 * o.pain + 0.08 * Math.max(0, o.pcr - 5)
    + (o.menstrual ? 0.6 : 0) + (o.friction ? 0.4 : 0) + (o.smoker ? 0.5 : 0)
    + (o.flare ? 0.5 : 0) + 0.08 * o.ihs4;
  return 1 / (1 + Math.exp(-x));
}
const aInputs = () => ({
  pain: A.pain, pcr: A.labs.pcr, smoker: A.smoker, ihs4: ihs4(), flare: recentFlare(),
  menstrual: A.trig.has('Ciclo menstrual'), friction: A.trig.has('Roce')
});

function renderA1() {
  const v = ihs4(), sv = severity(v);
  $('aIhs4').textContent = v; $('aIhs4').style.color = sv.c;
  $('aSev').textContent = sv.l; $('aSev').style.color = sv.c;

  // Zonas del mapa: círculo clicable + punto con tamaño según nº de lesiones
  const g = $('aZonesSvg');
  g.innerHTML = '';
  for (const z in ZONES) {
    const Z = ZONES[z], tot = zoneTotal(z), L = A.les[z];
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    el.setAttribute('class', 'zone' + (A.zone === z ? ' sel' : ''));
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', Z.name + ', ' + tot + ' lesiones');
    let inner = `<circle class="hit" cx="${Z.x}" cy="${Z.y}" r="13"/>`;
    if (tot) {
      const col = L.t ? '#581C87' : L.a ? '#C2410C' : '#1D4ED8';
      inner += `<circle cx="${Z.x}" cy="${Z.y}" r="${Math.min(4 + tot * 2, 10)}" fill="${col}"/>`;
    }
    el.innerHTML = inner;
    const pick = () => { A.zone = z; renderA1(); };
    el.addEventListener('click', pick);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    g.appendChild(el);
  }
  $('aZoneTitle').textContent = ZONES[A.zone].name;
  $('aZoneSummary').innerHTML = Object.keys(ZONES).filter(z => zoneTotal(z)).map(z => {
    const L = A.les[z], p = [];
    if (L.n) p.push(L.n + ' nód.'); if (L.a) p.push(L.a + ' absc.'); if (L.t) p.push(L.t + ' túnel');
    return `<div>${ZONES[z].name} · ${p.join(', ')}</div>`;
  }).join('') || '<div class="small">Ninguna lesión registrada</div>';

  $('aLesTitle').textContent = 'Lesiones · ' + ZONES[A.zone].name;
  $('aLesions').innerHTML = TYPES.map(t => `
    <div class="les">
      <div class="l"><span class="dot" style="background:${t.color}"></span>
        <div><div style="font-weight:500">${t.label}</div><div class="small">${t.hint}</div></div></div>
      <div class="step">
        <button class="m" data-k="${t.k}" data-d="-1" aria-label="Restar ${t.label}">−</button>
        <span>${A.les[A.zone][t.k]}</span>
        <button class="p" data-k="${t.k}" data-d="1" aria-label="Sumar ${t.label}">+</button>
      </div>
    </div>`).join('');
  $('aPainV').textContent = A.pain + '/10';
  $('aPain').value = A.pain;
  $('aTrigs').innerHTML = TRIGGERS.map(t => `<button class="chip" aria-pressed="${A.trig.has(t)}" data-t="${t}">${t}</button>`).join('');
}

const LAB_ROWS = [
  { k: 'pcr',   n: 'PCR (mg/L)',  ref: '< 5',   hi: 5 },
  { k: 'vsg',   n: 'VSG (mm/h)',  ref: '< 20',  hi: 20 },
  { k: 'nlr',   n: 'Ratio N/L',   ref: '1–3',   hi: 3 },
  { k: 'hba1c', n: 'HbA1c (%)',   ref: '< 5,7', hi: 5.7 }
];
$('aLabs').innerHTML = LAB_ROWS.map(r => `<tr><td>${r.n}</td>
  <td><input type="number" step="0.1" inputmode="decimal" data-k="${r.k}" aria-label="${r.n}" value="${A.labs[r.k]}"></td>
  <td class="small">${r.ref}</td></tr>`).join('');
$('aLabs').addEventListener('input', e => {
  const k = e.target.dataset.k; if (!k) return;
  A.labs[k] = Number(e.target.value) || 0; renderA();
});

function renderA2() {
  const v = ihs4(), sv = severity(v);
  const peak = Math.max(...A.history.map(h => h.v));
  const flares = A.history.filter(h => h.v >= 11).length;
  const kpis = [
    { l: 'IHS4 actual', v, tr: sv.l + ' · pico ' + peak, c: sv.c },
    { l: 'Brotes registrados', v: flares, tr: 'IHS4 ≥ 11', c: 'var(--bad)' },
    { l: 'Dolor hoy', v: A.pain + '/10', tr: A.pain >= 7 ? 'Alto' : 'Escala 0–10', c: A.pain >= 7 ? 'var(--bad)' : 'var(--muted)' },
    { l: 'Registros', v: A.history.length, tr: 'Entre visitas', c: 'var(--brand)' }
  ];
  $('aKpis').innerHTML = kpis.map(k => `<div class="card kpi"><div class="small" style="font-size:13px">${k.l}</div>
    <div class="v">${k.v}</div><div class="tr" style="color:${k.c}">${k.tr}</div></div>`).join('');
  $('aSmokerTxt').textContent = A.smoker ? 'fumadora' : 'no fumadora';

  // Gráfico de barras SVG
  const H = A.history.slice(-14), W = 640, h = 240, pad = 28, max = 18, bw = (W - pad * 2) / H.length;
  const y = val => h - pad - (Math.min(val, max) / max) * (h - pad * 2);
  let svg = `<line x1="${pad}" x2="${W - pad}" y1="${h - pad}" y2="${h - pad}" stroke="#CBD2CD"/>
    <line x1="${pad}" x2="${W - pad}" y1="${y(11)}" y2="${y(11)}" stroke="#B91C1C" stroke-dasharray="5 4"/>
    <text x="${W - pad}" y="${y(11) - 6}" text-anchor="end" font-size="11" fill="#B91C1C">grave ≥ 11</text>`;
  H.forEach((p, i) => {
    const x = pad + i * bw + 4, top = y(p.v), today = p.label.startsWith('Hoy');
    svg += `<rect x="${x}" y="${top}" width="${bw - 8}" height="${h - pad - top}" rx="4" fill="${p.v >= 11 ? '#C2410C' : '#0F6B5C'}" ${today ? 'stroke="#16211E" stroke-width="2"' : ''}/>
      <text x="${x + (bw - 8) / 2}" y="${top - 5}" text-anchor="middle" font-size="11" fill="#55625E">${p.v}</text>
      <text x="${x + (bw - 8) / 2}" y="${h - 10}" text-anchor="middle" font-size="10" fill="#55625E">${p.label}</text>`;
  });
  $('aChart').innerHTML = svg;

  // Colorea los valores fuera de rango
  $('aLabs').querySelectorAll('input').forEach(inp => {
    const r = LAB_ROWS.find(x => x.k === inp.dataset.k);
    inp.style.color = A.labs[r.k] > r.hi ? '#B91C1C' : '#16211E';
    if (document.activeElement !== inp) inp.value = A.labs[r.k];
  });

  const maxZ = Math.max(1, ...Object.keys(ZONES).map(zoneTotal));
  $('aZbars').innerHTML = Object.keys(ZONES).map(z => `
    <div class="zrow"><span>${ZONES[z].name}</span><div class="bar"><i style="width:${zoneTotal(z) / maxZ * 100}%"></i></div>
    <span class="mono" style="width:24px;text-align:right">${zoneTotal(z)}</span></div>`).join('');
  $('aNotes').innerHTML = A.notes.map(n => `<div>«${esc(n.t)}» <span class="small">· ${n.d}</span></div>`).join('');
}

function renderA3() {
  const inp = aInputs(), r = riskOf(inp), pct = Math.round(r * 100);
  const lvl = pct >= 60 ? { l: 'Alto', c: '#FDBA74', a: 'Adelantar la visita de control y revisar la adherencia al tratamiento.' }
            : pct >= 30 ? { l: 'Moderado', c: '#FDE68A', a: 'Seguimiento habitual; avisar si el dolor sube 2 días seguidos.' }
            : { l: 'Bajo', c: '#8FD3C4', a: 'Sin acción. Seguir registrando.' };
  $('aRisk').textContent = pct + '%';
  $('aRiskLbl').textContent = lvl.l; $('aRiskLbl').style.color = lvl.c;
  $('aRiskBar').style.width = pct + '%'; $('aRiskBar').style.background = lvl.c;
  $('aRiskAdvice').textContent = 'Sugerencia: ' + lvl.a;

  // Contribución de cada factor: riesgo actual menos riesgo sin ese factor
  const f = [
    ['Dolor (' + inp.pain + '/10)', { pain: 0 }],
    ['PCR (' + inp.pcr + ' mg/L)', { pcr: 5 }],
    ['Ciclo menstrual', { menstrual: false }],
    ['Roce', { friction: false }],
    ['Tabaco', { smoker: false }],
    ['Brote reciente', { flare: false }],
    ['Carga de lesiones (IHS4 ' + inp.ihs4 + ')', { ihs4: 0 }]
  ].map(([n, off]) => [n, Math.round((r - riskOf({ ...inp, ...off })) * 100)])
   .filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  const mx = Math.max(1, ...f.map(x => x[1]));
  $('aFactors').innerHTML = f.map(([n, p]) => `<div class="frow"><span>${n}</span><div class="bar"><i style="width:${p / mx * 100}%"></i></div>
    <span class="mono" style="width:40px;text-align:right">+${p}</span></div>`).join('') || '<div class="small">Ningún factor activo.</div>';

  $('aWPcr').value = A.labs.pcr; $('aWPcrV').textContent = A.labs.pcr + ' mg/L';
  $('aWPain').value = A.pain; $('aWPainV').textContent = A.pain + '/10';
  $('aWSmoke').checked = A.smoker;

  // Perfil según dónde se concentran las lesiones
  const tot = Object.keys(ZONES).reduce((s, z) => s + zoneTotal(z), 0) || 1;
  const axMam = (zoneTotal('axE') + zoneTotal('axD') + zoneTotal('mam')) / tot;
  const glu = zoneTotal('glu') / tot;
  const mine = axMam >= 0.5 ? 'ax' : glu >= 0.4 ? 'glu' : 'fol';
  const cl = [
    { id: 'ax',  n: 'Axilar-mamario', size: 84, fl: '5,1', ih: '9,2', d: 'Axilas y zona mamaria, más inflamatorio, PCR alta.' },
    { id: 'fol', n: 'Folicular',      size: 61, fl: '3,4', ih: '5,8', d: 'Lesiones foliculares, inicio precoz, antecedentes familiares.' },
    { id: 'glu', n: 'Glúteo',         size: 55, fl: '2,9', ih: '6,7', d: 'Predominio glúteo, IMC más bajo, más fumadores.' }
  ];
  $('aClusters').innerHTML = cl.map(c => `
    <div class="cl ${c.id === mine ? 'mine' : ''}">
      <div style="display:flex;justify-content:space-between"><b>${c.n}</b><span class="mono small">n = ${c.size}</span></div>
      <div style="font-size:13px">${c.d}</div>
      <div class="small">Brotes/año: ${c.fl} · IHS4 medio: ${c.ih}</div>
      ${c.id === mine ? '<div style="font-size:12px;font-weight:600;color:var(--brand)">← HS-0142 encaja en este grupo</div>' : ''}
    </div>`).join('');
}
function renderA() { renderA1(); renderA2(); renderA3(); }

$('aLesions').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const L = A.les[A.zone], k = b.dataset.k;
  L[k] = Math.max(0, L[k] + Number(b.dataset.d));
  renderA();
});
$('aTrigs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const t = b.dataset.t; A.trig.has(t) ? A.trig.delete(t) : A.trig.add(t);
  renderA();
});
$('aPain').addEventListener('input', e => { A.pain = Number(e.target.value); renderA(); });
$('aWPcr').addEventListener('input', e => { A.labs.pcr = Number(e.target.value); renderA(); });
$('aWPain').addEventListener('input', e => { A.pain = Number(e.target.value); renderA(); });
$('aWSmoke').addEventListener('change', e => { A.smoker = e.target.checked; renderA(); });
$('aPhoto').addEventListener('click', () => toast('Aquí se abriría la cámara con una guía para encuadrar la zona.'));
$('aSave').addEventListener('click', () => {
  const n = A.history.filter(h => h.label.startsWith('Hoy')).length;
  A.history.push({ label: n ? 'Hoy ' + (n + 1) : 'Hoy', v: ihs4() });
  const txt = $('aNote').value.trim();
  if (txt) A.notes.unshift({ d: 'Hoy', t: txt });
  $('aNote').value = '';
  renderA();
  toast('Registro guardado · IHS4 ' + ihs4() + ' · enviado al dermatólogo');
});

// =====================================================================
// RETO C · CÁNCER INFANTIL (AFANOC)
// =====================================================================
const C = {
  energy: 2,
  temp: 36.8,
  tasks: [
    { h: '08:00', t: 'Medicación de la mañana', done: true },
    { h: '10:30', t: 'Hospital de día · analítica', done: false },
    { h: '13:00', t: 'Comer (aunque sea poco)', done: false },
    { h: '16:00', t: 'Clase online con el instituto', done: false },
    { h: '21:00', t: 'Medicación de la noche', done: false }
  ],
  questions: ['¿Por qué me duele la barriga después de la medicación?'],
  week: [3, 2, 2, 4, 3, 2],
  fam: [
    { t: 'Llevarla al hospital de día', who: 'Madre' },
    { t: 'Recoger la medicación en la farmacia', who: 'Padre' },
    { t: 'Hablar con la tutora del instituto', who: '' },
    { t: 'Pedir ayudas y becas', who: '' },
    { t: 'Cuidar del hermano pequeño el martes', who: 'Abuela' },
    { t: 'Preparar la comida del jueves', who: 'Madre' },
    { t: 'Llamar al seguro', who: 'Madre' }
  ]
};
const C_ENERGY = ['Agotada', 'Cansada', 'Normal', 'Bien', 'Con energía'];
const C_PEOPLE = ['Madre', 'Padre', 'Abuela'];

$('cEnergy').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; C.energy = Number(b.dataset.v); renderC(); });
$('cTemp').addEventListener('input', e => { C.temp = Number(e.target.value); renderC(); });
$('cTasks').addEventListener('change', e => { const i = e.target.dataset.i; if (i == null) return; C.tasks[i].done = e.target.checked; renderC(); });
const addQ = () => {
  const v = $('cQ').value.trim(); if (!v) return;
  C.questions.push(v); $('cQ').value = ''; renderC(); toast('Pregunta añadida al resumen para la visita');
};
$('cAddQ').addEventListener('click', addQ);
$('cQ').addEventListener('keydown', e => { if (e.key === 'Enter') addQ(); });
$('cFam').addEventListener('change', e => { const i = e.target.dataset.i; if (i == null) return; C.fam[i].who = e.target.value; renderC(); });

function renderC() {
  $('cEnergy').innerHTML = C_ENERGY.map((n, i) => `<button class="chip" aria-pressed="${C.energy === i}" data-v="${i}">${n}</button>`).join('');
  $('cTempV').textContent = dec(C.temp) + ' °C';
  const fever = C.temp >= 38;
  $('cFever').style.display = fever ? 'block' : 'none';
  const done = C.tasks.filter(t => t.done).length;
  $('cProg').style.width = (done / C.tasks.length * 100) + '%';
  $('cProgT').textContent = done + ' de ' + C.tasks.length + ' hechas';
  $('cTasks').innerHTML = C.tasks.map((t, i) => `
    <label class="task ${t.done ? 'done' : ''}"><input type="checkbox" data-i="${i}" ${t.done ? 'checked' : ''}>
      <span class="mono small" style="width:44px">${t.h}</span><span>${t.t}</span></label>`).join('');
  $('cQs').innerHTML = C.questions.map(q => `<li>${esc(q)}</li>`).join('');

  // Carga por persona
  const load = {}; C_PEOPLE.forEach(p => load[p] = 0);
  C.fam.forEach(f => { if (f.who) load[f.who]++; });
  const un = C.fam.filter(f => !f.who).length, mx = Math.max(1, ...Object.values(load));
  $('cLoad').innerHTML = C_PEOPLE.map(p => `
    <div class="zrow"><span>${p}</span><div class="bar"><i style="width:${load[p] / mx * 100}%;background:${load[p] >= 4 ? 'var(--flare)' : 'var(--brand)'}"></i></div>
    <span class="mono" style="width:24px;text-align:right">${load[p]}</span></div>`).join('') +
    (Math.max(...Object.values(load)) >= 4 ? '<div style="color:var(--flare);font-size:13px;margin-top:6px">Una persona lleva demasiada carga: conviene repartir tareas.</div>' : '') +
    (un ? `<div class="small" style="font-size:13px;margin-top:4px">${un} tareas sin responsable</div>` : '');
  $('cFam').innerHTML = C.fam.map((f, i) => `
    <div class="famrow ${f.who ? '' : 'un'}"><span>${f.t}</span>
      <select data-i="${i}" aria-label="Responsable de: ${f.t}">
        <option value="" ${!f.who ? 'selected' : ''}>Sin asignar</option>
        ${C_PEOPLE.map(p => `<option ${f.who === p ? 'selected' : ''}>${p}</option>`).join('')}
      </select></div>`).join('');

  // Energía de la semana + hoy
  const wk = [...C.week, C.energy], days = ['L', 'M', 'X', 'J', 'V', 'S', 'Hoy'];
  $('cWeek').innerHTML = wk.map((v, i) => `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="width:100%;height:${20 + v * 22}px;border-radius:6px 6px 0 0;background:${v <= 1 ? 'var(--flare)' : 'var(--brand)'}"></div>
      <span class="small">${days[i]}</span></div>`).join('');

  // Resumen automático para la visita
  const low = wk.filter(v => v <= 1).length;
  $('cSummary').innerHTML = `
    <li>Energía baja ${low} de 7 días${C.energy <= 1 ? ' (incluido hoy)' : ''}.</li>
    <li>Temperatura hoy: ${dec(C.temp)} °C${fever ? ' · <b style="color:var(--bad)">fiebre</b>' : ''}.</li>
    <li>Rutina de hoy: ${done}/${C.tasks.length} completada.</li>
    ${C.questions.map(q => `<li>Pregunta: «${esc(q)}»</li>`).join('')}`;
}

// =====================================================================
// ARRANQUE
// =====================================================================
$('aToday').textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
renderA();
renderB();
renderC();
drawWave([], 0);
// Si la URL trae una sección (#vB…), la abrimos directamente
const startView = location.hash.slice(1);
if (['vHome', 'vA', 'vB', 'vC'].includes(startView)) showView(startView);
