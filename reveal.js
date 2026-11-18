// The reveal page: reads the person's scrambled token from the link,
// shows a sealed envelope, and plays the reveal when they tap the seal.

import { decodeToken } from './token.js';

const DEMO = {
  g: 'Jamie',
  r: 'Grandma Rose',
  t: 'Family Christmas Gift Exchange',
  d: 'Saturday, December 19',
  b: '$50',
  l: "Grandma's house",
  n: 'Bring your gift wrapped, with the tag left blank!',
  x: 1,
};

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let soundOn = true;
let audio = null;
const $ = (id) => document.getElementById(id);

const hash = decodeURIComponent(location.hash.slice(1));
const draw = hash === 'demo' ? DEMO : decodeToken(hash);

startSky();
hangLights();
setUpSound();

if (!draw || !draw.g || !draw.r) {
  $('intro').hidden = true;
  $('scene').hidden = true;
  $('lost').hidden = false;
} else {
  fillIn(draw);
  buildSeal();
  $('seal').addEventListener('click', openEnvelope, { once: true });
}

function fillIn(draw) {
  document.title = `${draw.t || 'Secret Santa'} 🎁`;
  $('greeting').textContent = `Ho ho ho, ${draw.g}!`;
  $('for-name').textContent = draw.g;
  $('recipient').textContent = draw.r;
  $('test-ribbon').hidden = !draw.x;

  const facts = [
    ['📅', 'When', draw.d],
    ['💰', 'Budget', draw.b],
    ['📍', 'Where', draw.l],
  ].filter(([, , value]) => value);
  for (const [icon, label, value] of facts) {
    const term = document.createElement('dt');
    term.textContent = icon;
    term.title = label;
    term.setAttribute('aria-label', label);
    const detail = document.createElement('dd');
    detail.textContent = value;
    $('facts').append(term, detail);
  }
  $('facts').hidden = facts.length === 0;
  if (draw.n) {
    $('note').textContent = draw.n;
    $('note').hidden = false;
  }
}

// ---------- The opening sequence ----------

function openEnvelope() {
  const envelope = $('envelope');
  const seal = $('seal');
  const speed = reduceMotion ? 0.05 : 1;
  const at = (ms, step) => setTimeout(step, ms * speed);

  $('hint').classList.add('gone');
  seal.classList.add('shaking');
  sounds.crack();

  at(350, () => {
    seal.classList.remove('shaking');
    seal.classList.add('cracked');
    envelope.classList.add('open');
    sounds.whoosh();
  });
  at(760, () => envelope.classList.add('flap-behind'));
  at(1250, () => {
    envelope.classList.add('letter-out');
    sounds.chime();
  });
  at(2350, () => {
    $('scene').classList.add('away');
    $('intro').classList.add('away');
  });
  at(2950, () => {
    $('scene').hidden = true;
    $('intro').hidden = true;
    $('card').hidden = false;
    sounds.sparkle();
    requestAnimationFrame(() => setUpFrost(revealName));
  });
}

function revealName() {
  $('frost').classList.add('melted');
  $('frost-hint').classList.add('gone');
  const recipient = $('recipient');
  recipient.removeAttribute('aria-hidden');
  recipient.classList.add('revealed');
  $('details').hidden = false;
  sounds.jingle();
  celebrate();
}

// ---------- Wax seal ----------

function buildSeal() {
  const edge = [];
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * Math.PI * 2;
    const radius = 46 + 2.4 * Math.sin(angle * 7) + 1.5 * Math.sin(angle * 13 + 1);
    edge.push(`${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`);
  }

  let flake = '';
  for (let arm = 0; arm < 6; arm++) {
    const a = (arm / 6) * Math.PI * 2 - Math.PI / 2;
    const point = (r, turn = 0) => [50 + r * Math.cos(a + turn), 50 + r * Math.sin(a + turn)];
    const [ex, ey] = point(23);
    const [bx, by] = point(13);
    flake += `M50 50L${ex.toFixed(2)} ${ey.toFixed(2)}`;
    for (const side of [-1, 1]) {
      const tx = bx + 8 * Math.cos(a + side * 0.75);
      const ty = by + 8 * Math.sin(a + side * 0.75);
      flake += `M${bx.toFixed(2)} ${by.toFixed(2)}L${tx.toFixed(2)} ${ty.toFixed(2)}`;
    }
  }

  const svg = (id) => `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="${id}" cx="36%" cy="30%" r="80%">
          <stop offset="0" stop-color="#ffe08a"/>
          <stop offset=".5" stop-color="#d9a33a"/>
          <stop offset="1" stop-color="#7d5410"/>
        </radialGradient>
      </defs>
      <polygon points="${edge.join(' ')}" fill="url(#${id})"/>
      <circle cx="50" cy="50" r="34" fill="none" stroke="#7d5410" stroke-width="2.6" opacity=".75"/>
      <circle cx="49.2" cy="49.2" r="34" fill="none" stroke="#fff4c8" stroke-width="1" opacity=".55"/>
      <path d="${flake}" fill="none" stroke="#fff4c8" stroke-width="3.2" stroke-linecap="round" opacity=".5" transform="translate(-.8 -.8)"/>
      <path d="${flake}" fill="none" stroke="#7d5410" stroke-width="3.2" stroke-linecap="round" opacity=".85"/>
      <circle cx="50" cy="50" r="3.4" fill="#7d5410"/>
    </svg>`;

  document.querySelector('.seal-left').innerHTML = svg('wax-left');
  document.querySelector('.seal-right').innerHTML = svg('wax-right');
}

// ---------- Frost to wipe away ----------

function setUpFrost(onCleared) {
  const canvas = $('frost');
  const box = $('name-box');
  const width = box.offsetWidth;
  const height = box.offsetHeight;
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.scale(scale, scale);
  paintFrost(ctx, width, height);

  let done = false;
  let wiping = false;
  let last = null;
  let moves = 0;

  const pointAt = (event) => {
    const rect = canvas.getBoundingClientRect();
    return [((event.clientX - rect.left) / rect.width) * width, ((event.clientY - rect.top) / rect.height) * height];
  };

  const wipe = (from, to) => {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(34, height * 0.34);
    ctx.beginPath();
    ctx.moveTo(...from);
    ctx.lineTo(...to);
    ctx.stroke();
    ctx.restore();
    if (++moves % 6 === 0) checkCleared();
  };

  const checkCleared = () => {
    if (done) return;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0;
    let total = 0;
    for (let i = 3; i < pixels.length; i += 16) {
      total++;
      if (pixels[i] < 60) clear++;
    }
    if (clear / total > 0.5) finish();
  };

  const finish = () => {
    if (done) return;
    done = true;
    onCleared();
  };

  canvas.addEventListener('pointerdown', (event) => {
    wiping = true;
    canvas.setPointerCapture(event.pointerId);
    last = pointAt(event);
    wipe(last, last);
    sounds.frost();
  });
  canvas.addEventListener('pointermove', (event) => {
    // A mouse wipes just by moving over the frost; a finger wipes while touching.
    if (!wiping && event.pointerType !== 'mouse') return;
    const point = pointAt(event);
    wipe(last ?? point, point);
    last = point;
  });
  const stop = () => {
    wiping = false;
    last = null;
    checkCleared();
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('pointerleave', () => { last = null; });
  $('skip-frost').addEventListener('click', finish, { once: true });
}

function paintFrost(ctx, width, height) {
  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, '#eef7fd');
  base.addColorStop(0.5, '#d5e8f6');
  base.addColorStop(1, '#e8f3fb');
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 12);
  ctx.fill();

  for (let i = 0; i < (width * height) / 18; i++) {
    ctx.fillStyle = Math.random() < 0.6 ? 'rgba(255,255,255,.7)' : 'rgba(140,180,215,.25)';
    const size = Math.random() * 2.2 + 0.4;
    ctx.fillRect(Math.random() * width, Math.random() * height, size, size);
  }

  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineCap = 'round';
  for (let crystal = 0; crystal < (width * height) / 2200; crystal++) {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const size = 6 + Math.random() * 16;
    const turn = Math.random() * Math.PI;
    ctx.lineWidth = 0.8 + Math.random() * 0.8;
    ctx.beginPath();
    for (let arm = 0; arm < 6; arm++) {
      const a = turn + (arm / 6) * Math.PI * 2;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + size * Math.cos(a), cy + size * Math.sin(a));
      const bx = cx + size * 0.55 * Math.cos(a);
      const by = cy + size * 0.55 * Math.sin(a);
      for (const side of [-0.7, 0.7]) {
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + size * 0.3 * Math.cos(a + side), by + size * 0.3 * Math.sin(a + side));
      }
    }
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(70, 115, 155, .85)';
  ctx.font = 'italic 600 19px Lora, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('❄  wipe me  ❄', width / 2, height / 2);
}

// ---------- Night sky: stars and falling snow ----------

function startSky() {
  const canvas = $('sky');
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let stars = [];
  let flakes = [];

  const resize = () => {
    const scale = window.devicePixelRatio || 1;
    width = innerWidth;
    height = innerHeight;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    stars = Array.from({ length: Math.round((width * height) / 9000) }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * 0.6,
      r: Math.random() * 1.3 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1.5,
    }));
    flakes = Array.from({ length: Math.min(180, Math.round((width * height) / 7000)) }, () => newFlake(true));
  };

  const newFlake = (anywhere) => {
    const depth = Math.random();
    return {
      x: Math.random() * width,
      y: anywhere ? Math.random() * height : -10,
      r: 1 + depth * 3.2,
      fall: 0.4 + depth * 1.3,
      sway: Math.random() * Math.PI * 2,
      alpha: 0.35 + depth * 0.6,
    };
  };

  const frame = (time) => {
    ctx.clearRect(0, 0, width, height);
    for (const star of stars) {
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(time / 1000 * star.speed + star.phase));
      ctx.fillStyle = '#fff6d6';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const flake of flakes) {
      flake.y += flake.fall;
      flake.sway += 0.012;
      flake.x += Math.sin(flake.sway) * 0.45;
      if (flake.y > height + 10) Object.assign(flake, newFlake(false));
      ctx.globalAlpha = flake.alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!reduceMotion) requestAnimationFrame(frame);
  };

  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
}

// ---------- String of lights ----------

function hangLights() {
  const holder = $('lights');
  const colors = ['#ff3b3b', '#ffd23f', '#3ddc84', '#4aa3ff', '#ff6bd6'];

  const draw = () => {
    const width = innerWidth;
    const spacing = width < 500 ? 38 : 48;
    const count = Math.ceil(width / spacing) + 1;
    let wire = 'M0 6';
    let bulbs = '';
    for (let i = 0; i < count; i++) {
      const x = i * spacing;
      const mid = x + spacing / 2;
      wire += ` Q${mid} 30 ${x + spacing} 6`;
      const color = colors[i % colors.length];
      const delay = ((i * 0.37) % 2.4).toFixed(2);
      bulbs += `<rect class="socket" x="${mid - 4}" y="15" width="8" height="7" rx="1.5"/>`;
      bulbs += `<ellipse class="bulb" cx="${mid}" cy="30" rx="6" ry="9.5" style="color:${color};fill:${color};animation-delay:-${delay}s"/>`;
    }
    holder.innerHTML = `<svg viewBox="0 0 ${width} 56" preserveAspectRatio="none"><path class="wire" d="${wire}"/>${bulbs}</svg>`;
  };

  addEventListener('resize', draw);
  draw();
}

// ---------- Confetti ----------

function celebrate() {
  const canvas = $('confetti');
  const ctx = canvas.getContext('2d');
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * scale);
  canvas.height = Math.round(innerHeight * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const colors = ['#c41e2b', '#17693f', '#f2c14e', '#ffffff', '#e8483f', '#2fae6a'];
  const pieces = [];
  const burst = (x, y, count, angle, spread, power) => {
    for (let i = 0; i < count; i++) {
      const direction = angle + (Math.random() - 0.5) * spread;
      const speed = power * (0.5 + Math.random() * 0.7);
      pieces.push({
        x, y,
        vx: Math.cos(direction) * speed,
        vy: Math.sin(direction) * speed,
        spin: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 0.3,
        flip: Math.random() * Math.PI * 2,
        size: 6 + Math.random() * 7,
        color: colors[(Math.random() * colors.length) | 0],
        star: Math.random() < 0.15,
      });
    }
  };

  const width = innerWidth;
  const height = innerHeight;
  burst(width / 2, height * 0.45, reduceMotion ? 40 : 140, -Math.PI / 2, Math.PI * 1.1, 14);
  if (!reduceMotion) {
    setTimeout(() => burst(0, height * 0.75, 70, -Math.PI / 3, 0.7, 17), 250);
    setTimeout(() => burst(width, height * 0.75, 70, (-2 * Math.PI) / 3, 0.7, 17), 450);
  }

  const started = performance.now();
  const frame = (now) => {
    ctx.clearRect(0, 0, width, height);
    for (const piece of pieces) {
      piece.vy += 0.28;
      piece.vx *= 0.985;
      piece.vy *= 0.985;
      piece.x += piece.vx;
      piece.y += piece.vy;
      piece.spin += piece.spinSpeed;
      piece.flip += 0.12;
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.spin);
      ctx.fillStyle = piece.color;
      if (piece.star) {
        drawStar(ctx, piece.size * 0.8);
      } else {
        ctx.scale(1, Math.cos(piece.flip));
        ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
      }
      ctx.restore();
    }
    if (now - started < 6000) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, width, height);
  };
  requestAnimationFrame(frame);
}

function drawStar(ctx, radius) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  ctx.closePath();
  ctx.fill();
}

// ---------- Sound (made in the browser, no audio files) ----------

function setUpSound() {
  try {
    soundOn = localStorage.getItem('northPoleSound') !== 'off';
  } catch {
    soundOn = true;
  }
  const button = $('sound');
  const show = () => {
    button.textContent = soundOn ? '🔔' : '🔕';
    button.setAttribute('aria-pressed', String(soundOn));
    button.setAttribute('aria-label', soundOn ? 'Sound on' : 'Sound off');
  };
  button.addEventListener('click', () => {
    soundOn = !soundOn;
    try {
      localStorage.setItem('northPoleSound', soundOn ? 'on' : 'off');
    } catch {
      // Storage can be blocked; the toggle still works for this visit.
    }
    show();
    if (soundOn) sounds.chime();
  });
  show();
}

function audioContext() {
  if (!soundOn) return null;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    return audio;
  } catch {
    return null;
  }
}

function bell(ac, frequency, start, length = 1.8, volume = 0.16) {
  for (const [ratio, level] of [[1, 1], [2.76, 0.35], [5.4, 0.12]]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency * ratio;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume * level, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length / ratio);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + length);
  }
}

function noise(ac, start, length, { type = 'bandpass', frequency = 2000, q = 1, volume = 0.2 } = {}) {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * length), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  source.connect(filter).connect(gain).connect(ac.destination);
  source.start(start);
  return filter;
}

const sounds = {
  crack() {
    const ac = audioContext();
    if (!ac) return;
    const now = ac.currentTime;
    noise(ac, now, 0.12, { frequency: 2400, q: 2, volume: 0.35 });
    noise(ac, now + 0.33, 0.18, { frequency: 1500, q: 1.5, volume: 0.45 });
  },
  whoosh() {
    const ac = audioContext();
    if (!ac) return;
    const now = ac.currentTime;
    const filter = noise(ac, now, 0.6, { frequency: 400, q: 0.8, volume: 0.18 });
    filter.frequency.exponentialRampToValueAtTime(3000, now + 0.5);
  },
  chime() {
    const ac = audioContext();
    if (!ac) return;
    bell(ac, 1046.5, ac.currentTime, 1.4, 0.1);
  },
  sparkle() {
    const ac = audioContext();
    if (!ac) return;
    const now = ac.currentTime;
    [1318.5, 1568, 2093].forEach((f, i) => bell(ac, f, now + i * 0.07, 1, 0.06));
  },
  frost() {
    const ac = audioContext();
    if (!ac) return;
    noise(ac, ac.currentTime, 0.25, { type: 'highpass', frequency: 5000, volume: 0.05 });
  },
  jingle() {
    const ac = audioContext();
    if (!ac) return;
    const now = ac.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(ac, f, now + i * 0.12, 2, 0.14));
    [523.25, 659.25, 783.99].forEach((f) => bell(ac, f * 2, now + 0.62, 2.6, 0.08));
    for (let i = 0; i < 10; i++) {
      noise(ac, now + i * 0.11, 0.09, { type: 'highpass', frequency: 7000, volume: 0.12 });
    }
  },
};
