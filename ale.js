// =====================================================================
// Alè · llamada con IA que analiza la voz del paciente con EPOC
// Todo se calcula en el navegador. El audio no se guarda ni se envía.
// Las medidas son reales (micrófono); los umbrales y la "voz normal"
// por defecto son inventados para la demostración.
// =====================================================================
(() => {
  const $ = id => document.getElementById(id);

  // ---------------------------------------------------------------
  // Guion de la llamada en los dos idiomas
  // ---------------------------------------------------------------
  const SCRIPT = {
    es: {
      voice: 'es-ES',
      greet: 'Buenos días, Josep. Soy Alè, tu asistente del centro de salud. ¿Cómo has dormido esta noche?',
      aaa: 'Gracias. Ahora coge aire y di «aaaa» todo el rato que puedas, en una sola respiración. Empieza después del pitido.',
      read: 'Muy bien. Ahora lee en voz alta la frase que ves en la pantalla.',
      phrase: 'Cada mañana salgo al balcón a regar las plantas y a mirar la calle.',
      q: ['¿Hoy tienes más ahogo que de costumbre?', '¿Estás sacando más flemas de lo normal?', '¿Las flemas han cambiado de color, más amarillas o verdes?'],
      ok: 'Todo parece como siempre. Que tengas un buen día, Josep. Hasta mañana.',
      amber: 'He notado algún cambio pequeño. Mañana te vuelvo a llamar, y si empeoras, llama a tu centro de salud.',
      alert: 'He notado cambios respecto a otros días. Hoy te llamarán del centro de salud para verte. Si te ahogas mucho, llama al 061.',
      calib: 'Perfecto, ya tengo tu voz de referencia. Hasta mañana.',
      yes: /\b(s[ií]|sip|claro|un poco|bastante|mucho|algo)\b/i,
      no: /\b(no|nada|para nada)\b/i
    },
    ca: {
      voice: 'ca-ES',
      greet: 'Bon dia, Josep. Sóc l’Alè, el teu assistent del centre de salut. Com has dormit aquesta nit?',
      aaa: 'Gràcies. Ara agafa aire i digues «aaaa» tanta estona com puguis, d’una sola respirada. Comença després del xiulet.',
      read: 'Molt bé. Ara llegeix en veu alta la frase que veus a la pantalla.',
      phrase: 'Cada matí surto al balcó a regar les plantes i a mirar el carrer.',
      q: ['Avui tens més ofec que de costum?', 'Treus més esput del normal?', 'L’esput ha canviat de color, més groc o verd?'],
      ok: 'Tot sembla com sempre. Que tinguis un bon dia, Josep. Fins demà.',
      amber: 'He notat algun canvi petit. Demà et torno a trucar, i si empitjores, truca al teu centre de salut.',
      alert: 'He notat canvis respecte a altres dies. Avui et trucaran del centre de salut per veure’t. Si t’ofegues molt, truca al 061.',
      calib: 'Perfecte, ja tinc la teva veu de referència. Fins demà.',
      yes: /\b(s[ií]|una mica|bastant|molt|clar)\b/i,
      no: /\b(no|gens|res)\b/i
    }
  };

  // ---------------------------------------------------------------
  // Medidas: nombre, unidad, desviación típica y qué dirección es "peor"
  // ---------------------------------------------------------------
  const METRICS = [
    { k: 'phon',   n: 'Duración del «aaaa»',        u: 's',  sd: 1.5, worse: -1, d: 1 },
    { k: 'pitch',  n: 'Tono medio de la voz',        u: 'Hz', sd: null, worse: 1, d: 0 },
    { k: 'jitter', n: 'Inestabilidad del tono',      u: '%',  sd: 0.4, worse: 1,  d: 1 },
    { k: 'read',   n: 'Tiempo leyendo la frase',     u: 's',  sd: 0.6, worse: 1,  d: 1 },
    { k: 'pauses', n: 'Pausas para respirar',        u: '',   sd: 0.7, worse: 1,  d: 0 },
    { k: 'coughs', n: 'Golpes de tos',               u: '',   sd: 1.0, worse: 1,  d: 0 }
  ];
  // Voz normal por defecto de "Josep" (inventada)
  const DEFAULT_BASE = { phon: 13, pitch: 120, jitter: 1.2, read: 4.5, pauses: 1, coughs: 0.5 };
  // Valores de los modos de demostración
  const PRESETS = {
    normal: { m: { phon: 12.6, pitch: 122, jitter: 1.3, read: 4.6, pauses: 1, coughs: 0 }, a: [false, false, false], said: ['He dormido bien, como siempre.', 'No', 'No', 'No'] },
    crisis: { m: { phon: 8.2, pitch: 131, jitter: 2.1, read: 6.2, pauses: 3, coughs: 3 }, a: [true, true, false], said: ['Mal… me he despertado… varias veces… tosiendo.', 'Sí, bastante', 'Sí', 'No, creo que no'] }
  };

  // Estado general
  const S = {
    mode: 'mic', lang: 'es', running: false, abort: false,
    base: loadBase() || { ...DEFAULT_BASE }, baseIsUser: !!loadBase(),
    today: null, answers: [null, null, null], idx: null, lvl: null,
    // Historial inventado del índice (13 días) para el gráfico
    hist: [12, 15, 10, 14, 18, 11, 16, 20, 24, 22, 30, 38, 41]
  };

  // Guardar / cargar la voz normal del usuario (si el navegador lo permite)
  function loadBase() {
    try { const v = JSON.parse(localStorage.getItem('ale-base')); return v && v.phon ? v : null; } catch (e) { return null; }
  }
  function saveBase(b) { try { localStorage.setItem('ale-base', JSON.stringify(b)); } catch (e) { /* sin almacenamiento: no pasa nada */ } }

  // ---------------------------------------------------------------
  // Audio: contexto, micrófono, tono por autocorrelación
  // ---------------------------------------------------------------
  let AC = null, analyser = null, stream = null, buf = null, noiseThr = 0.02;
  const live = []; // últimos fotogramas para el dibujo en directo

  // Estima el tono (Hz) de un trozo de audio. Devuelve 0 si no hay voz clara.
  function detectPitch(b, sr) {
    let e = 0;
    for (let i = 0; i < b.length; i++) e += b[i] * b[i];
    if (Math.sqrt(e / b.length) < noiseThr) return 0;
    const minLag = Math.floor(sr / 400), maxLag = Math.floor(sr / 70), N = b.length - maxLag;
    let best = 0, bestLag = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0, e1 = 0, e2 = 0;
      for (let i = 0; i < N; i += 2) { s += b[i] * b[i + lag]; e1 += b[i] * b[i]; e2 += b[i + lag] * b[i + lag]; }
      const c = s / Math.sqrt(e1 * e2 + 1e-12);
      if (c > best) { best = c; bestLag = lag; }
    }
    return best > 0.6 ? sr / bestLag : 0;
  }

  // Un fotograma de audio: volumen (rms) y tono
  function frame() {
    analyser.getFloatTimeDomainData(buf);
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    const rms = Math.sqrt(s / buf.length);
    const f0 = detectPitch(buf, AC.sampleRate);
    const fr = { t: performance.now(), rms, f0: f0 > 400 ? 0 : f0 };
    live.push(fr); if (live.length > 300) live.shift();
    return fr;
  }

  // Escucha durante un tiempo. Opciones:
  //  endOnSilence: corta si hay X ms de silencio después de haber hablado
  //  yesno: índice de pregunta (activa botones y reconocimiento de voz)
  function listen(ms, opt = {}) {
    return new Promise(resolve => {
      const frames = [], t0 = performance.now();
      let started = false, lastVoice = 0, done = false, rec = null;
      const finish = (answer) => {
        if (done) return; done = true;
        clearInterval(iv);
        if (rec) try { rec.abort(); } catch (e) {}
        $('eYesNo').style.display = 'none';
        setRing('idle');
        resolve({ frames, answer });
      };
      // Botones Sí / No
      if (opt.yesno !== undefined) {
        $('eYesNo').style.display = 'flex';
        $('eYesNo').onclick = e => { const b = e.target.closest('button'); if (b) finish(b.dataset.a === 'yes'); };
        rec = startRecognition(txt => {
          const L = SCRIPT[S.lang];
          if (L.yes.test(txt)) finish(true); else if (L.no.test(txt)) finish(false);
        });
      }
      setRing('listen');
      const iv = setInterval(() => {
        if (S.abort) return finish(null);
        const now = performance.now();
        if (analyser) {
          const fr = frame();
          frames.push(fr);
          if (fr.rms > noiseThr) { started = true; lastVoice = now; }
          if (opt.endOnSilence && started && now - lastVoice > opt.endOnSilence) return finish(null);
        }
        drawLive();
        if (now - t0 > ms) finish(null);
      }, 25);
    });
  }

  // Reconocimiento de voz del navegador (solo algunos navegadores, p. ej. Chrome)
  function startRecognition(onText) {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R || S.mode !== 'mic') return null;
    try {
      const r = new R();
      r.lang = SCRIPT[S.lang].voice;
      r.interimResults = true;
      r.onresult = e => {
        const txt = Array.from(e.results).map(x => x[0].transcript).join(' ');
        lastHeard = txt;
        onText(txt);
      };
      r.onerror = () => {};
      r.start();
      return r;
    } catch (e) { return null; }
  }
  let lastHeard = '';

  // Pitido antes del «aaaa»
  function beep() {
    if (!AC) return;
    const o = AC.createOscillator(), g = AC.createGain();
    o.frequency.value = 880; g.gain.value = 0.15;
    o.connect(g); g.connect(AC.destination);
    o.start(); o.stop(AC.currentTime + 0.25);
  }

  // ---------------------------------------------------------------
  // Voz de Alè (síntesis del navegador)
  // ---------------------------------------------------------------
  function pickVoice(lang) {
    const vs = speechSynthesis.getVoices();
    return vs.find(v => v.lang === lang) || vs.find(v => v.lang && v.lang.startsWith(lang.slice(0, 2))) || null;
  }
  function say(text) {
    bubble('ale', text);
    return new Promise(resolve => {
      if (!('speechSynthesis' in window)) { setTimeout(resolve, 1200); return; }
      const u = new SpeechSynthesisUtterance(text);
      const lang = SCRIPT[S.lang].voice;
      u.lang = lang;
      const v = pickVoice(lang); if (v) u.voice = v;
      u.rate = 0.95;
      setRing('talk');
      // Seguridad: si el navegador no avisa del final, seguimos igualmente
      const fallback = setTimeout(() => { setRing('idle'); resolve(); }, 1500 + text.length * 75);
      u.onend = () => { clearTimeout(fallback); setRing('idle'); resolve(); };
      u.onerror = () => { clearTimeout(fallback); setRing('idle'); resolve(); };
      speechSynthesis.speak(u);
    });
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ---------------------------------------------------------------
  // Análisis de cada parte de la llamada
  // ---------------------------------------------------------------
  // «aaaa»: tramo más largo con voz (tolera cortes < 150 ms), tono e inestabilidad
  function analyseAaa(frames) {
    let best = [], cur = [], gap = 0;
    for (const f of frames) {
      if (f.rms > noiseThr) { cur.push(f); gap = 0; }
      else if (cur.length) { gap += 25; if (gap > 150) { if (cur.length > best.length) best = cur; cur = []; gap = 0; } }
    }
    if (cur.length > best.length) best = cur;
    const phon = best.length ? (best[best.length - 1].t - best[0].t) / 1000 : 0;
    const f0s = best.map(f => f.f0).filter(x => x > 0);
    const sorted = f0s.slice().sort((a, b) => a - b);
    const pitch = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    let dsum = 0, n = 0;
    for (let i = 1; i < f0s.length; i++) { const d = Math.abs(f0s[i] - f0s[i - 1]); if (d < pitch * 0.3) { dsum += d; n++; } }
    const jitter = n && pitch ? (dsum / n) / pitch * 100 : 0;
    return { phon, pitch, jitter };
  }
  // Lectura: tiempo desde la primera a la última voz y pausas > 300 ms
  function analyseRead(frames) {
    const v = frames.filter(f => f.rms > noiseThr);
    if (!v.length) return { read: 0, pauses: 0 };
    let pauses = 0;
    for (let i = 1; i < v.length; i++) if (v[i].t - v[i - 1].t > 300) pauses++;
    return { read: (v[v.length - 1].t - v[0].t) / 1000, pauses };
  }
  // Tos: golpes fuertes y cortos (60–400 ms) que superan 3 veces el umbral
  function countCoughs(frames) {
    let c = 0, run = 0, quiet = 999;
    for (const f of frames) {
      if (f.rms > noiseThr * 3) run += 25;
      else { if (run >= 50 && run <= 400 && quiet >= 150) c++; if (run) quiet = 0; run = 0; quiet += 25; }
    }
    return c;
  }

  // ---------------------------------------------------------------
  // Índice de cambio: cuánto se aleja hoy de la voz normal (0–100)
  // ---------------------------------------------------------------
  function zOf(m, val) {
    const base = S.base[m.k];
    const sd = m.sd || Math.max(4, base * 0.05);
    return Math.max(0, Math.min(4, ((val - base) / sd) * m.worse));
  }
  function computeIndex(today, answers) {
    const zs = METRICS.map(m => zOf(m, today[m.k]));
    const voice = zs.reduce((a, b) => a + b, 0) / zs.length * 25;          // 0–100
    const sym = answers.filter(Boolean).length;
    const idx = Math.round(Math.min(100, voice * 0.8 + sym * 12));
    const lvl = idx >= 55 ? 2 : idx >= 30 ? 1 : 0;
    return { idx, lvl, zs };
  }

  // ---------------------------------------------------------------
  // La llamada completa
  // ---------------------------------------------------------------
  async function runCall() {
    if (S.running) return;
    S.running = true; S.abort = false;
    const L = SCRIPT[S.lang];
    const demo = S.mode !== 'mic' ? PRESETS[S.mode] : null;
    $('eChat').innerHTML = '';
    $('eAnswer').disabled = true;
    S.answers = [null, null, null];

    // Desbloquea la voz en móviles (tiene que ocurrir dentro del clic)
    try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) {}

    if (!demo) {
      try {
        AC = AC || new (window.AudioContext || window.webkitAudioContext)();
        if (AC.state === 'suspended') await AC.resume();
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
        const src = AC.createMediaStreamSource(stream);
        analyser = AC.createAnalyser(); analyser.fftSize = 2048;
        buf = new Float32Array(analyser.fftSize);
        src.connect(analyser);
      } catch (e) {
        bubble('sys', 'No hay acceso al micrófono. Prueba un modo de demostración.');
        return endCall(true);
      }
    } else { analyser = null; }

    startTimer();
    $('eStatus').textContent = 'En llamada';
    setStep('Midiendo el ruido de fondo');

    // 1) Ruido de fondo durante 0,8 s para ajustar el umbral de voz
    if (!demo) {
      const quiet = [];
      const t0 = performance.now();
      while (performance.now() - t0 < 800) { quiet.push(frame().rms); await wait(25); }
      quiet.sort((a, b) => a - b);
      noiseThr = Math.max(0.012, (quiet[Math.floor(quiet.length / 2)] || 0.005) * 3);
    }
    if (S.abort) return endCall();

    const today = {};
    let coughFrames = [];

    // 2) Saludo y respuesta libre
    setStep('Conversación');
    await say(L.greet); if (S.abort) return endCall();
    let r = demo ? await fakeListen(4000, demo.said[0], 'speech') : await listen(7000, { endOnSilence: 1500 });
    if (!demo) { coughFrames = coughFrames.concat(r.frames); bubble('me', lastHeard || '(respuesta)'); lastHeard = ''; }
    if (S.abort) return endCall();

    // 3) «aaaa» sostenido
    setStep('Fonación sostenida «aaaa»');
    await say(L.aaa); if (S.abort) return endCall();
    beep(); await wait(300);
    r = demo ? await fakeListen(demo.m.phon * 1000 + 600, 'Aaaaaaaa…', 'aaa') : await listen(25000, { endOnSilence: 1200 });
    if (!demo) { Object.assign(today, analyseAaa(r.frames)); bubble('me', 'Aaaaaaaa… (' + today.phon.toFixed(1) + ' s)'); }
    else { today.phon = demo.m.phon; today.pitch = demo.m.pitch; today.jitter = demo.m.jitter; }
    partial(today);
    if (S.abort) return endCall();

    // 4) Lectura de una frase
    setStep('Lectura en voz alta');
    $('ePhrase').textContent = '«' + L.phrase + '»'; $('ePhrase').style.display = 'block';
    await say(L.read); if (S.abort) return endCall();
    r = demo ? await fakeListen(demo.m.read * 1000 + 500, L.phrase, 'speech') : await listen(12000, { endOnSilence: 1600 });
    $('ePhrase').style.display = 'none';
    if (!demo) { Object.assign(today, analyseRead(r.frames)); coughFrames = coughFrames.concat(r.frames); bubble('me', lastHeard || '(lectura)'); lastHeard = ''; }
    else { today.read = demo.m.read; today.pauses = demo.m.pauses; }
    partial(today);
    if (S.abort) return endCall();

    // 5) Tres preguntas de Anthonisen
    for (let i = 0; i < 3; i++) {
      setStep('Pregunta ' + (i + 1) + ' de 3');
      await say(L.q[i]); if (S.abort) return endCall();
      let a;
      if (demo) { await fakeListen(1600, demo.said[i + 1], 'speech'); a = demo.a[i]; }
      else {
        const res = await listen(8000, { yesno: i });
        coughFrames = coughFrames.concat(res.frames);
        a = res.answer;
        bubble('me', lastHeard ? lastHeard : a === null ? '(sin respuesta)' : a ? 'Sí' : 'No');
        lastHeard = '';
      }
      S.answers[i] = !!a;
      if (S.abort) return endCall();
    }

    // 6) Tos contada en toda la llamada (excepto el «aaaa»)
    today.coughs = demo ? demo.m.coughs : countCoughs(coughFrames);
    S.today = today;

    // 7) Resultado
    setStep('Calculando');
    if ($('eCalib').checked && !demo && today.phon < 2) {
      bubble('sys', 'No se ha oído bien el «aaaa» (menos de 2 s). No se guarda como voz normal: repite la llamada en un sitio tranquilo.');
      renderAll();
      return endCall();
    }
    if ($('eCalib').checked && !demo) {
      S.base = { ...today, coughs: Math.max(0.5, today.coughs) };
      S.baseIsUser = true; saveBase(S.base);
      $('eCalib').checked = false;
      renderAll();
      await say(L.calib);
      bubble('sys', 'Voz normal guardada. Ahora repite la llamada para compararte.');
      return endCall();
    }
    const res = computeIndex(today, S.answers);
    S.idx = res.idx; S.lvl = res.lvl;
    S.hist.push(res.idx); if (S.hist.length > 14) S.hist.shift();
    renderAll();
    await say(res.lvl === 2 ? L.alert : res.lvl === 1 ? L.amber : L.ok);
    endCall();
  }

  // Simulación de escucha para los modos de demostración
  async function fakeListen(ms, text, kind) {
    setRing('listen');
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      if (S.abort) break;
      // Señal inventada para que el gráfico se mueva
      const el = performance.now() - t0;
      const on = kind === 'aaa' ? el < ms - 500 : Math.sin(el / 140) > -0.3;
      const crisis = S.mode === 'crisis';
      live.push({ t: performance.now(), rms: on ? 0.08 + Math.random() * 0.05 : 0.004, f0: on ? (crisis ? 135 : 122) + (Math.random() - 0.5) * (crisis ? 14 : 5) : 0 });
      if (live.length > 300) live.shift();
      drawLive();
      await wait(25);
    }
    setRing('idle');
    bubble('me', text);
    return { frames: [] };
  }

  // Fin de la llamada: libera el micrófono y recoloca los botones
  function endCall(error) {
    S.running = false;
    try { speechSynthesis.cancel(); } catch (e) {}
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    analyser = null;
    stopTimer();
    $('eStatus').textContent = error ? 'Llamada no disponible' : 'Llamada finalizada';
    $('eAnswer').disabled = false;
    $('eAnswer').textContent = 'Repetir';
    $('eYesNo').style.display = 'none';
    $('ePhrase').style.display = 'none';
    setRing('idle');
    setStep(error ? 'Sin micrófono' : 'Llamada terminada');
  }

  // ---------------------------------------------------------------
  // Interfaz
  // ---------------------------------------------------------------
  function bubble(who, text) {
    const d = document.createElement('div');
    d.className = 'bubble ' + who;
    d.textContent = text;
    $('eChat').appendChild(d);
    $('eChat').scrollTop = $('eChat').scrollHeight;
  }
  function setRing(state) { const r = $('eRing'); r.classList.remove('talk', 'listen', 'idle'); if (state) r.classList.add(state); }
  function setStep(t) { $('eStep').textContent = t; }
  let timerIv = null, timerT0 = 0;
  function startTimer() { timerT0 = Date.now(); timerIv = setInterval(() => { const s = Math.floor((Date.now() - timerT0) / 1000); $('eTimer').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 500); }
  function stopTimer() { clearInterval(timerIv); }

  // Dibujo en directo: volumen (verde) y tono (naranja)
  function drawLive() {
    const cv = $('eWave'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const n = 300, bw = W / n, off = n - live.length;
    ctx.fillStyle = '#0F6B5C';
    live.forEach((f, i) => { const h = Math.min(1, f.rms * 6) * (H - 10); ctx.fillRect((off + i) * bw, H - h, Math.max(bw - 0.6, 0.6), h); });
    ctx.fillStyle = '#C2410C';
    live.forEach((f, i) => { if (f.f0) { const y = H - ((f.f0 - 70) / 330) * H; ctx.fillRect((off + i) * bw, y - 1.5, Math.max(bw, 1.5), 3); } });
  }

  // Muestra medidas a medida que se calculan
  function partial(today) { S.today = { ...(S.today || {}), ...today }; renderMetrics(); }

  function fmt(v, d) { return v === undefined || v === null ? '—' : v.toFixed(d).replace('.', ','); }
  function renderMetrics() {
    const t = S.today || {};
    $('eMetrics').innerHTML = METRICS.map(m => {
      const has = t[m.k] !== undefined;
      const z = has ? zOf(m, t[m.k]) : 0;
      const col = z >= 2 ? 'var(--bad)' : z >= 1 ? 'var(--warn)' : 'var(--brand)';
      return `<tr><td>${m.n}</td>
        <td class="mono" style="font-weight:600;color:${has ? col : 'inherit'}">${has ? fmt(t[m.k], m.d) + (m.u ? ' ' + m.u : '') : '—'}</td>
        <td class="mono small">${fmt(S.base[m.k], m.d)}${m.u ? ' ' + m.u : ''}</td>
        <td><div class="zbar"><i style="width:${z / 4 * 100}%;background:${col}"></i></div></td></tr>`;
    }).join('');
    $('eBaseInfo').textContent = S.baseIsUser
      ? 'Voz normal: la tuya, guardada en este navegador.'
      : 'Voz normal: la de «Josep», inventada. Guarda la tuya marcando la casilla de arriba antes de llamar.';
  }

  const LVL = [
    { n: 'Sin cambios', c: '#8FD3C4', hex: '#0F6B5C', t: 'Todo dentro de lo normal para este paciente.' },
    { n: 'Vigilar', c: '#FDE68A', hex: '#B45309', t: 'Pequeño cambio. Alè vuelve a llamar mañana.' },
    { n: 'Alerta', c: '#FDBA74', hex: '#B91C1C', t: 'Cambio claro. Aviso al centro de salud para citar hoy.' }
  ];
  function renderAll() {
    renderMetrics();
    // Índice
    if (S.idx !== null) {
      const L = LVL[S.lvl];
      $('eIdx').textContent = S.idx;
      $('eLvl').textContent = L.n; $('eLvl').style.color = L.c;
      $('eIdxBar').style.width = S.idx + '%'; $('eIdxBar').style.background = L.c;
      $('eIdxTxt').textContent = L.t;
    }
    // Historial
    const H = S.hist, W = 420, h = 150, pad = 18, bw = (W - pad * 2) / H.length;
    let svg = `<line x1="${pad}" x2="${W - pad}" y1="${h - pad}" y2="${h - pad}" stroke="#CBD2CD"/>
      <line x1="${pad}" x2="${W - pad}" y1="${h - pad - 55 / 100 * (h - pad * 2)}" y2="${h - pad - 55 / 100 * (h - pad * 2)}" stroke="#B91C1C" stroke-dasharray="4 3"/>`;
    H.forEach((v, i) => {
      const x = pad + i * bw + 3, bh = Math.max(3, v / 100 * (h - pad * 2)), last = i === H.length - 1 && S.idx !== null;
      const c = v >= 55 ? '#B91C1C' : v >= 30 ? '#B45309' : '#0F6B5C';
      svg += `<rect x="${x}" y="${h - pad - bh}" width="${bw - 6}" height="${bh}" rx="3" fill="${c}" ${last ? 'stroke="#16211E" stroke-width="2"' : ''}/>`;
    });
    svg += `<text x="${W - pad}" y="${h - 4}" text-anchor="end" font-size="10" fill="#55625E">${S.idx !== null ? 'hoy' : ''}</text>`;
    $('eHist').innerHTML = svg;

    // Panel del centro de salud
    const sym = S.answers.filter(Boolean).length;
    const L = S.idx !== null ? LVL[S.lvl] : null;
    $('eCap').innerHTML = `
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;align-items:center">
        <b>Josep M. · 74 años · EPOC grave</b>
        <span class="badge" style="background:${L && S.lvl === 2 ? '#FDF1E6' : '#EEF6F3'};color:${L && S.lvl === 2 ? '#8A3A0A' : '#0A4D42'}">${L ? (S.lvl === 2 ? 'Citar hoy · PCR capilar' : S.lvl === 1 ? 'Vigilar' : 'Sin aviso') : 'Sin llamada hoy'}</span>
      </div>
      <div class="small" style="font-size:13px;margin-top:6px">${S.idx !== null ? `Índice ${S.idx} · ${sym}/3 síntomas · tendencia de 3 días: ${H.slice(-3).join(' → ')}` : 'Las llamadas se hacen cada mañana a la misma hora.'}</div>
      ${S.idx !== null && S.lvl === 2 ? '<div style="font-size:14px;margin-top:8px"><b>Siguiente paso:</b> visita hoy con PCR capilar. Si &lt; 20 mg/L, antibiótico poco probable; si &gt; 40 mg/L, probable beneficio.</div>' : ''}`;
  }

  // ---------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------
  $('eAnswer').addEventListener('click', runCall);
  $('eHang').addEventListener('click', () => { if (S.running) { S.abort = true; try { speechSynthesis.cancel(); } catch (e) {} } });
  $('eMode').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || S.running) return;
    S.mode = b.dataset.m;
    document.querySelectorAll('#eMode button').forEach(x => x.setAttribute('aria-pressed', x === b));
    // En demo usamos la voz normal de Josep para que la comparación tenga sentido
    if (S.mode !== 'mic') { S.base = { ...DEFAULT_BASE }; S.baseIsUser = false; }
    else { const u = loadBase(); S.base = u || { ...DEFAULT_BASE }; S.baseIsUser = !!u; }
    S.today = null; renderAll();
  });
  $('eLang').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || S.running) return;
    S.lang = b.dataset.l;
    document.querySelectorAll('#eLang button').forEach(x => x.setAttribute('aria-pressed', x === b));
  });
  // Algunas voces se cargan tarde
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};

  renderAll();
  drawLive();
})();
