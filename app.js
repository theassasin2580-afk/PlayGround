(() => {
  const $ = (s) => document.querySelector(s);
  const canvas = $('#chart');
  const ctx = canvas.getContext('2d');
  const chartWrap = $('#chart-wrap');
  const startPrice = 18742.5;
  const state = {
    price: startPrice, startPrice, balance: 2000, mode: 'normal', paused: false,
    timeframe: 1, candleElapsed: 0, tickCount: 0, positions: [], history: [],
    candles: [], crosshair: null, sound: false, exchangeSeconds: 9 * 3600 + 30 * 60,
    drift: 0, currentVolume: 0
  };
  const fmtPrice = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtMoney = (n) => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtPoints = (n) => Number(n).toLocaleString('en-US');
  const signedClass = (n) => n > 0.005 ? 'positive' : n < -0.005 ? 'negative' : 'neutral';
  const makeCandle = (open, close, scale = 1) => {
    const wick = Math.random() * 1.3 * scale + .18 * scale;
    return { open, close, high: Math.max(open, close) + wick * Math.random(), low: Math.min(open, close) - wick * Math.random(), volume: Math.round(120 + Math.random() * 800) };
  };
  let seedPrice = startPrice - 17;
  for (let i = 0; i < 68; i++) {
    const close = seedPrice + (Math.random() - .48) * 4.4;
    state.candles.push(makeCandle(seedPrice, close, .9)); seedPrice = close;
  }
  state.price = seedPrice;
  state.startPrice = seedPrice;
  state.candles.push(makeCandle(seedPrice, seedPrice));

  function resizeCanvas() {
    const rect = chartWrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawChart();
  }
  function displayCandles() {
    if (state.timeframe === 1) return state.candles;
    const out = [];
    for (let i = 0; i < state.candles.length; i += state.timeframe) {
      const group = state.candles.slice(i, i + state.timeframe);
      if (!group.length) continue;
      out.push({ open: group[0].open, close: group[group.length - 1].close, high: Math.max(...group.map(c => c.high)), low: Math.min(...group.map(c => c.low)), volume: group.reduce((a, c) => a + c.volume, 0) });
    }
    return out;
  }
  function drawChart() {
    if (!canvas.width || !canvas.height) return;
    const rect = chartWrap.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    const left = 14, right = 76, top = 14, bottom = 25;
    const pw = w - left - right, ph = h - top - bottom;
    if (pw < 80 || ph < 80) return;
    const candles = displayCandles().slice(-Math.max(20, Math.floor(pw / 7.5)));
    let min = Math.min(...candles.map(c => c.low)), max = Math.max(...candles.map(c => c.high));
    const span = Math.max(max - min, 8), pad = span * .13;
    min -= pad; max += pad;
    const y = (price) => top + (max - price) / (max - min) * ph;
    const gap = pw / candles.length, bodyW = Math.max(2, Math.min(9, gap * .57));
    ctx.strokeStyle = '#edf1f3'; ctx.lineWidth = 1; ctx.fillStyle = '#94a1a8'; ctx.font = '9px "DM Mono", monospace';
    for (let i = 0; i <= 5; i++) {
      const gy = top + ph * i / 5;
      ctx.beginPath(); ctx.moveTo(left, gy + .5); ctx.lineTo(w - right + 5, gy + .5); ctx.stroke();
      const label = fmtPrice(max - (max - min) * i / 5);
      ctx.fillText(label, w - right + 10, gy + 3);
    }
    const volH = ph * .13;
    candles.forEach((c, i) => {
      const x = left + gap * i + gap / 2;
      const up = c.close >= c.open, color = up ? '#17a979' : '#b78356';
      ctx.strokeStyle = color; ctx.lineWidth = 1.15;
      ctx.beginPath(); ctx.moveTo(x + .5, y(c.high)); ctx.lineTo(x + .5, y(c.low)); ctx.stroke();
      const oy = y(c.open), cy = y(c.close), bh = Math.max(1.5, Math.abs(oy - cy));
      ctx.fillStyle = color; ctx.fillRect(x - bodyW / 2, Math.min(oy, cy), bodyW, bh);
      ctx.globalAlpha = .24; ctx.fillRect(x - bodyW / 2, top + ph - (c.volume / Math.max(...candles.map(v => v.volume))) * volH, bodyW, (c.volume / Math.max(...candles.map(v => v.volume))) * volH); ctx.globalAlpha = 1;
    });
    const py = y(state.price);
    ctx.setLineDash([4, 3]); ctx.strokeStyle = state.candles.at(-1).close >= state.candles.at(-1).open ? '#29a880' : '#b78356'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(w - right + 1, py); ctx.stroke(); ctx.setLineDash([]);
    const tagColor = state.candles.at(-1).close >= state.candles.at(-1).open ? '#169873' : '#ae7952';
    ctx.fillStyle = tagColor; ctx.fillRect(w - right + 5, py - 9, right - 7, 18);
    ctx.fillStyle = '#fff'; ctx.font = '9px "DM Mono", monospace'; ctx.fillText(fmtPrice(state.price), w - right + 9, py + 3);
    for (let i = 0; i < state.positions.length; i++) {
      const p = state.positions[i], ey = y(p.entry);
      if (ey > top && ey < top + ph) {
        ctx.setLineDash([2, 4]); ctx.strokeStyle = p.side === 'long' ? '#54b79888' : '#c48e6588';
        ctx.beginPath(); ctx.moveTo(left, ey); ctx.lineTo(w - right, ey); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    if (state.crosshair) {
      const { x, y: cy } = state.crosshair;
      if (x >= left && x <= w - right && cy >= top && cy <= top + ph) {
        ctx.strokeStyle = '#96a4aa'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + ph); ctx.moveTo(left, cy); ctx.lineTo(w - right, cy); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }
  function updateOhlc() {
    const c = state.candles.at(-1);
    $('#ohlc-line').innerHTML = `O ${fmtPrice(c.open)}&nbsp;&nbsp; H ${fmtPrice(c.high)}&nbsp;&nbsp; L ${fmtPrice(c.low)}&nbsp;&nbsp; C ${fmtPrice(state.price)}`;
  }
  function unrealized() { return state.positions.reduce((sum, p) => sum + (state.price - p.entry) * (p.side === 'long' ? 1 : -1) * (p.points / 1000) * 10, 0); }
  function updateAccount() {
    const u = unrealized();
    $('#balance').textContent = fmtMoney(state.balance);
    $('#unrealized').textContent = fmtMoney(u);
    $('#unrealized').className = signedClass(u);
    $('#equity').textContent = fmtMoney(state.balance + u);
    $('#top-price').textContent = fmtPrice(state.price);
    $('#order-price').textContent = fmtPrice(state.price);
    const delta = state.price - state.startPrice, percent = delta / state.startPrice * 100;
    $('#top-change').textContent = `${delta >= 0 ? '+' : '−'}${fmtPrice(Math.abs(delta))} (${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%)`;
    $('#top-change').className = signedClass(delta);
    const perMove = Number($('#size-input').value || 0) / 1000 * 10;
    $('#preview-value').textContent = fmtMoney(perMove);
    renderPositions();
  }
  function renderPositions() {
    const list = $('#position-list');
    $('#position-count').textContent = state.positions.length;
    $('#close-all').disabled = !state.positions.length;
    if (!state.positions.length) {
      list.innerHTML = '<div class="empty-state"><span class="empty-icon">↗</span><div><strong>No open positions</strong><span>Place a buy or sell order to get started.</span></div></div>';
      return;
    }
    list.innerHTML = state.positions.map(p => {
      const pnl = (state.price - p.entry) * (p.side === 'long' ? 1 : -1) * (p.points / 1000) * 10;
      return `<div class="position-row"><span class="position-instrument"><span class="${p.side === 'long' ? 'side-long' : 'side-short'}">${p.side === 'long' ? 'LONG' : 'SHORT'}</span> NQ<small>NASDAQ 100 · ${fmtPoints(p.points)} pts</small></span><span>${fmtPoints(p.points)}</span><span>${fmtPrice(p.entry)}</span><span>${fmtPrice(state.price)}</span><span class="pnl ${signedClass(pnl)}">${fmtMoney(pnl)}</span><button class="close-position" data-close="${p.id}">Close</button></div>`;
    }).join('');
    list.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => closePosition(Number(btn.dataset.close))));
  }
  function renderHistory() {
    $('#trade-count').textContent = `${state.history.length} ${state.history.length === 1 ? 'trade' : 'trades'}`;
    const list = $('#activity-list');
    if (!state.history.length) { list.innerHTML = '<div class="activity-empty">Your completed trades will show up here.</div>'; return; }
    list.innerHTML = state.history.slice(0, 8).map(t => `<div class="activity-row"><span class="activity-action ${t.side === 'long' ? 'side-long' : 'side-short'}">${t.side === 'long' ? 'BUY' : 'SELL'} · ${fmtPoints(t.points)} pts</span><span>${fmtPrice(t.entry)} → ${fmtPrice(t.exit)}</span><span>${t.time}</span><strong class="pnl ${signedClass(t.pnl)}">${fmtMoney(t.pnl)}</strong></div>`).join('');
  }
  function addOrder(side) {
    const points = Math.max(1, Math.min(1000000000, Math.round(Number($('#size-input').value) || 1000)));
    $('#size-input').value = points;
    const impact = Math.min(100, points / 100);
    state.price = Math.max(100, state.price + (side === 'long' ? impact : -impact));
    const candle = state.candles.at(-1);
    candle.close = state.price; candle.high = Math.max(candle.high, state.price); candle.low = Math.min(candle.low, state.price);
    state.positions.unshift({ id: Date.now() + Math.random(), side, points, entry: state.price, openedAt: new Date() });
    updateOhlc(); updateAccount(); drawChart(); playSound(660);
    toast(`<b>${side === 'long' ? 'Long' : 'Short'} opened</b> · moved market ${side === 'long' ? '+' : '−'}${fmtPrice(impact)} · filled at ${fmtPrice(state.price)}`);
  }
  function closePosition(id) {
    const idx = state.positions.findIndex(p => p.id === id);
    if (idx < 0) return;
    const p = state.positions.splice(idx, 1)[0];
    const impact = Math.min(100, p.points / 100);
    state.price = Math.max(100, state.price + (p.side === 'long' ? -impact : impact));
    const candle = state.candles.at(-1);
    candle.close = state.price; candle.high = Math.max(candle.high, state.price); candle.low = Math.min(candle.low, state.price);
    const pnl = (state.price - p.entry) * (p.side === 'long' ? 1 : -1) * (p.points / 1000) * 10;
    state.balance += pnl;
    state.history.unshift({ side: p.side, points: p.points, entry: p.entry, exit: state.price, pnl, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) });
    updateAccount(); renderHistory(); drawChart(); playSound(pnl >= 0 ? 780 : 250);
    toast(`<b>Position closed</b> · ${pnl >= 0 ? 'Profit' : 'Loss'} ${fmtMoney(pnl)}`);
  }
  function toast(message) {
    const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = message;
    $('#toast-region').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
  function playSound(freq) {
    if (!state.sound) return;
    try { const audio = new AudioContext(), osc = audio.createOscillator(), gain = audio.createGain(); osc.frequency.value = freq; gain.gain.value = .025; osc.connect(gain); gain.connect(audio.destination); osc.start(); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .12); osc.stop(audio.currentTime + .13); osc.onended = () => audio.close(); } catch (_) {}
  }
  function tick() {
    if (state.paused) return;
    state.tickCount++;
    state.exchangeSeconds++;
    const scale = state.mode === 'volatile' ? 2.45 : 1;
    if (state.tickCount % 10 === 1) state.drift = (Math.random() - .5) * .32 * scale;
    const change = ((Math.random() + Math.random() + Math.random() - 1.5) * .49 + state.drift) * scale;
    state.price = Math.max(100, state.price + change);
    const current = state.candles.at(-1);
    current.close = state.price;
    current.high = Math.max(current.high, state.price);
    current.low = Math.min(current.low, state.price);
    current.volume += Math.round(40 + Math.random() * 150);
    state.candleElapsed++;
    if (state.candleElapsed >= state.timeframe * 60) {
      state.candleElapsed = 0;
      state.candles.push(makeCandle(state.price, state.price, scale));
      if (state.candles.length > 240) state.candles.shift();
    }
    const hours = String(Math.floor(state.exchangeSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor(state.exchangeSeconds % 3600 / 60)).padStart(2, '0');
    const seconds = String(state.exchangeSeconds % 60).padStart(2, '0');
    $('#exchange-time').textContent = `${hours}:${minutes}:${seconds}`;
    updateOhlc(); updateAccount(); drawChart();
  }
  function setSize(value) {
    const points = Math.max(1, Math.min(1000000000, Math.round(Number(value) || 1000)));
    $('#size-input').value = points;
    document.querySelectorAll('.quick-sizes button').forEach(b => b.classList.toggle('selected', Number(b.dataset.size) === points));
    $('#preview-value').textContent = fmtMoney(points / 1000 * 10);
  }
  $('#buy-button').addEventListener('click', () => addOrder('long'));
  $('#sell-button').addEventListener('click', () => addOrder('short'));
  $('#size-input').addEventListener('input', e => setSize(e.target.value));
  $('#size-minus').addEventListener('click', () => setSize(Number($('#size-input').value) - 100));
  $('#size-plus').addEventListener('click', () => setSize(Number($('#size-input').value) + 100));
  document.querySelectorAll('.quick-sizes button').forEach(b => b.addEventListener('click', () => setSize(b.dataset.size)));
  document.querySelectorAll('.mode-option').forEach(b => b.addEventListener('click', () => {
    state.mode = b.dataset.mode;
    document.querySelectorAll('.mode-option').forEach(option => option.classList.toggle('active', option === b));
    toast(`${state.mode === 'normal' ? 'Regular' : 'Volatile'} movement enabled`);
  }));
  $('#pause-button').addEventListener('click', () => {
    state.paused = !state.paused;
    $('#pause-button').innerHTML = state.paused ? '<span class="pause-symbol">▶</span> Resume' : '<span class="pause-symbol">Ⅱ</span> Pause';
    document.querySelector('.chart-live').innerHTML = state.paused ? '<i style="background:#c9a268"></i> PAUSED' : '<i></i> LIVE';
    toast(state.paused ? 'Market simulation paused' : 'Market simulation resumed');
  });
  $('#close-all').addEventListener('click', () => [...state.positions].forEach(p => closePosition(p.id)));
  $('#clear-history').addEventListener('click', () => { state.history = []; renderHistory(); });
  $('#sound-toggle').addEventListener('click', () => { state.sound = !state.sound; $('#sound-toggle').style.color = state.sound ? '#159a72' : ''; toast(state.sound ? 'Order sounds on' : 'Order sounds off'); });
  document.querySelectorAll('.timeframe').forEach(b => b.addEventListener('click', () => {
    state.timeframe = Number(b.textContent.replace('m', ''));
    state.candleElapsed = 0;
    document.querySelectorAll('.timeframe').forEach(x => x.classList.toggle('active', x === b));
    $('#chart-time').textContent = `${state.timeframe}m · LIVE`;
    drawChart();
  }));
  $('#reset-chart').addEventListener('click', () => { state.crosshair = null; state.timeframe = 1; document.querySelectorAll('.timeframe').forEach(b => b.classList.toggle('active', b.textContent === '1m')); $('#chart-time').textContent = '1m · LIVE'; drawChart(); });
  $('#fullscreen').addEventListener('click', () => { if (chartWrap.requestFullscreen) chartWrap.requestFullscreen(); });
  $('#focus-trades').addEventListener('click', () => $('#positions-section').scrollIntoView({ behavior: 'smooth', block: 'center' }));
  chartWrap.addEventListener('mousemove', e => {
    const r = chartWrap.getBoundingClientRect(); state.crosshair = { x: e.clientX - r.left, y: e.clientY - r.top };
    const tip = $('#chart-tooltip'); tip.style.display = 'block'; tip.style.left = `${Math.min(e.clientX - r.left + 12, r.width - 145)}px`; tip.style.top = `${Math.max(8, e.clientY - r.top - 28)}px`; tip.textContent = `NQ  ${fmtPrice(state.price)}`; drawChart();
  });
  chartWrap.addEventListener('mouseleave', () => { state.crosshair = null; $('#chart-tooltip').style.display = 'none'; drawChart(); });
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea')) return;
    if (e.key.toLowerCase() === 'b') addOrder('long');
    if (e.key.toLowerCase() === 's') addOrder('short');
    if (e.key === ' ') { e.preventDefault(); $('#pause-button').click(); }
  });
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas(); updateOhlc(); updateAccount();
  setInterval(tick, 1000);
})();
