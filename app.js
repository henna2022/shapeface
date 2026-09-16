// 도형얼굴 v0. 사진은 저장하지 않고 화면 안에서만 씀.
import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';

const $ = id => document.getElementById(id);
const W = 1000, H = 750;
const cv = $('canvas'), ctx = cv.getContext('2d');
const KIND = { circle: { name: '동그라미', color: '#FF6B6B' }, tri: { name: '세모', color: '#FFD93D' }, rect: { name: '네모', color: '#4D96FF' } };

// ---------- 소리 ----------
let speakOn = true, audio;
function speak(text) {
  if (!speakOn || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.rate = 0.9;
  speechSynthesis.speak(u);
}
function chime(ok = true) {
  if (!speakOn) return;
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  const o = audio.createOscillator(), g = audio.createGain();
  o.connect(g); g.connect(audio.destination);
  o.frequency.value = ok ? 880 : 220; g.gain.value = 0.15;
  o.start(); o.frequency.exponentialRampToValueAtTime(ok ? 1320 : 160, audio.currentTime + 0.15);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.3); o.stop(audio.currentTime + 0.3);
}
document.addEventListener('pointerdown', () => { audio?.resume(); }, { once: true });

// ---------- 도형 ----------
// circle: {kind:'circle', cx, cy, rx, ry, rot}   tri/rect: {kind, pts:[[x,y],...]}
let id = 0;
const circle = (cx, cy, rx, ry = rx, rot = 0, tier = 1) => ({ id: id++, kind: 'circle', cx, cy, rx, ry, rot, tier });
const poly = (kind, pts, tier = 1) => ({ id: id++, kind, pts, tier });
const rectPts = (x, y, w, h, rot = 0) => {
  const cx = x + w / 2, cy = y + h / 2, c = Math.cos(rot), s = Math.sin(rot);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([px, py]) => [cx + px * c - py * s, cy + px * s + py * c]);
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// MediaPipe 468점 → 도형 20개 (tier 1: 3개, 2: 7개, 3: 20개)
function facesToShapes(lm) {
  // 얼굴이 화면 높이의 70%가 되게 확대하고 가운데로 옮김 (아이가 멀리 서도 크게 보이게)
  const raw = i => ({ x: lm[i].x * W, y: lm[i].y * H });
  const k = Math.min(3, Math.max(1, H * 0.7 / dist(raw(10), raw(152)))), c0 = { x: (raw(234).x + raw(454).x) / 2, y: (raw(10).y + raw(152).y) / 2 };
  const P = i => { const p = raw(i); return { x: W / 2 + (p.x - c0.x) * k, y: H / 2 + (p.y - c0.y) * k }; };
  const top = P(10), chin = P(152), L = P(234), R = P(454);
  const oval = { cx: (L.x + R.x) / 2, cy: (top.y + chin.y) / 2, rx: dist(L, R) / 2, ry: dist(top, chin) / 2, rot: Math.atan2(chin.y - top.y, chin.x - top.x) - Math.PI / 2 };
  const eye = (a, b, c, d) => { const p = [P(a), P(b), P(c), P(d)]; return { cx: p.reduce((s, q) => s + q.x, 0) / 4, cy: p.reduce((s, q) => s + q.y, 0) / 4, r: dist(p[0], p[1]) / 2 * 0.8 }; };
  const le = eye(33, 133, 159, 145), re = eye(362, 263, 386, 374), er = (le.r + re.r) / 2;
  const brow = (o, i, t) => { const a = P(o), b = P(i), c = P(t); const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x); return rectPts(x0, c.y - er * 0.3, x1 - x0, er * 0.6); };
  const nb = P(6), n2 = P(2), nl = P(98), nr = P(327);
  const m0 = P(0), m17 = P(17), ml = P(61), mr = P(291);
  const s = [];
  // 뒤에서 앞 순서로 그림
  s.push(circle(L.x - er * 0.9, L.y, er * 0.55, er * 1.2, 0, 3), circle(R.x + er * 0.9, R.y, er * 0.55, er * 1.2, 0, 3)); // 귀
  s.push(poly('rect', rectPts(L.x, top.y - oval.ry * 0.35, R.x - L.x, oval.ry * 0.5), 3)); // 머리카락
  s.push(st.oval = circle(oval.cx, oval.cy, oval.rx, oval.ry, oval.rot, 1)); // 얼굴
  s.push(poly('rect', rectPts(P(70).x, top.y + oval.ry * 0.12, P(300).x - P(70).x, Math.max(20, P(105).y - er * 0.8 - top.y - oval.ry * 0.12)), 3)); // 이마
  s.push(circle(P(50).x, P(50).y, er * 0.8, er * 0.8, 0, 3), circle(P(280).x, P(280).y, er * 0.8, er * 0.8, 0, 3)); // 볼
  s.push(poly('tri', [[P(172).x, P(172).y], [P(397).x, P(397).y], [chin.x, chin.y]], 3)); // 턱
  s.push(poly('rect', brow(70, 107, 105), 2), poly('rect', brow(300, 336, 334), 2)); // 눈썹
  s.push(circle(le.cx, le.cy, le.r, le.r, 0, 1), circle(re.cx, re.cy, re.r, re.r, 0, 1)); // 눈
  if (lm.length > 473) s.push(circle(P(468).x, P(468).y, er * 0.4, er * 0.4, 0, 3), circle(P(473).x, P(473).y, er * 0.4, er * 0.4, 0, 3)); // 눈동자
  s.push(poly('tri', [[nb.x, nb.y], [nr.x + er * 0.2, n2.y], [nl.x - er * 0.2, n2.y]], 2)); // 코
  s.push(circle(nl.x, n2.y - er * 0.1, er * 0.3, er * 0.3, 0, 3), circle(nr.x, n2.y - er * 0.1, er * 0.3, er * 0.3, 0, 3)); // 콧구멍
  s.push(poly('rect', rectPts(ml.x, m0.y, mr.x - ml.x, Math.max(er * 0.6, m17.y - m0.y)), 2)); // 입
  const tw = (mr.x - ml.x) * 0.18, th = Math.max(er * 0.25, (m17.y - m0.y) * 0.35);
  s.push(poly('rect', rectPts(ml.x + (mr.x - ml.x) / 2 - tw - 2, m0.y + 4, tw, th), 3), poly('rect', rectPts(ml.x + (mr.x - ml.x) / 2 + 2, m0.y + 4, tw, th), 3)); // 이
  return s;
}

// 구별하기용 도형 8개: 목표 종류 4개(모양 변화) + 다른 종류 4개
function sortShapes(target) {
  const cells = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) cells.push([125 + c * 250, 200 + r * 350]);
  cells.sort(() => Math.random() - 0.5);
  const mk = (kind, v, [x, y]) => {
    const S = 80;
    if (kind === 'circle') return [circle(x, y, S, S), circle(x, y, S * 1.3, S * 0.7), circle(x, y, S * 0.6, S * 1.2), circle(x, y, S * 0.5, S * 0.5)][v];
    if (kind === 'rect') return poly('rect', [rectPts(x - S, y - S, S * 2, S * 2), rectPts(x - S * 1.4, y - S * 0.5, S * 2.8, S), rectPts(x - S * 0.5, y - S * 1.2, S, S * 2.4), rectPts(x - S, y - S * 0.7, S * 2, S * 1.4, 0.5)][v]);
    const tris = [[[0, -1], [1, 0.8], [-1, 0.8]], [[0, 1], [1, -0.8], [-1, -0.8]], [[-1, -0.9], [1, 0.3], [-0.6, 1]], [[0, -1.3], [0.45, 1], [-0.45, 1]]];
    return poly('tri', tris[v].map(([px, py]) => [x + px * S, y + py * S]));
  };
  const others = Object.keys(KIND).filter(k => k !== target);
  return [0, 1, 2, 3].map(v => mk(target, v, cells[v])).concat([0, 1, 2, 3].map(v => mk(others[v % 2], v, cells[v + 4])));
}

// ---------- 상태 ----------
const st = { face: [], oval: null, shapes: [], mode: 'name', target: 'circle', level: 3, found: new Set(), example: null, anim: null, drag: null, lesson: 1, step: 0, built: [], voiceLevel: 3 };
const visible = () => st.mode === 'sort' || st.mode === 'build' ? st.shapes : st.shapes.filter(s => s.tier <= (st.mode === 'reward' ? st.level : 2));

// ---------- 그리기 ----------
function pathOf(s) {
  ctx.beginPath();
  if (s.kind === 'circle') ctx.ellipse(s.cx, s.cy, s.rx, s.ry, s.rot, 0, Math.PI * 2);
  else { s.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }
}
function draw(t) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  if (st.mode === 'build') {
    const f = st.oval;
    if (f) { ctx.save(); ctx.setLineDash([14, 10]); ctx.strokeStyle = '#bbb'; ctx.lineWidth = 3; pathOf(f); ctx.stroke(); ctx.restore(); }
    drawPalette();
  }
  for (const s of visible()) {
    const pulse = st.example === s.id ? 0.5 + 0.5 * Math.sin(t / 180) : 0;
    const found = st.found.has(s.id);
    ctx.save();
    if (s.shake) { ctx.translate(Math.sin(t / 20) * 8, 0); if (t > s.shake) delete s.shake; }
    pathOf(s);
    ctx.fillStyle = KIND[s.kind].color; ctx.globalAlpha = found || st.mode !== 'find' && st.mode !== 'sort' ? 1 : 0.35 + pulse * 0.6;
    ctx.fill(); ctx.globalAlpha = 1;
    ctx.lineWidth = found ? 8 : 4; ctx.strokeStyle = found ? '#2B2B2B' : '#555'; ctx.stroke();
    if (st.example === s.id) { ctx.lineWidth = 6 + pulse * 6; ctx.strokeStyle = '#1F4E79'; ctx.stroke(); }
    ctx.restore();
  }
  if (st.anim) st.anim(t);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// 만들기 팔레트 (캔버스 왼쪽 세로)
const PAL = [{ kind: 'circle', y: 130, s: circle(75, 130, 45) }, { kind: 'tri', y: 375, s: poly('tri', [[75, 325], [125, 415], [25, 415]]) }, { kind: 'rect', y: 620, s: poly('rect', rectPts(30, 575, 90, 90)) }];
function drawPalette() {
  ctx.fillStyle = '#f2f2f2'; ctx.fillRect(0, 0, 150, H);
  for (const p of PAL) { pathOf(p.s); ctx.fillStyle = KIND[p.kind].color; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#555'; ctx.stroke(); }
}

// ---------- 터치 ----------
function hit(s, x, y) {
  if (s.kind === 'circle') { const c = Math.cos(-s.rot), n = Math.sin(-s.rot), dx = x - s.cx, dy = y - s.cy, px = dx * c - dy * n, py = dx * n + dy * c; return (px / s.rx) ** 2 + (py / s.ry) ** 2 <= 1; }
  let inside = false; const p = s.pts;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
  return inside;
}
const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
cv.addEventListener('pointerdown', e => {
  const [x, y] = pos(e);
  if (st.mode === 'build') {
    if (x < 150) { const p = PAL.reduce((a, b) => Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a); addBuilt(p.kind); return; }
    const s = [...st.shapes].reverse().find(s => hit(s, x, y));
    if (s) { st.drag = { s, x, y }; cv.setPointerCapture(e.pointerId); }
    return;
  }
  const s = [...visible()].reverse().find(s => hit(s, x, y));
  if (s) tap(s);
});
cv.addEventListener('pointermove', e => {
  if (!st.drag) return;
  const [x, y] = pos(e), d = st.drag, dx = x - d.x, dy = y - d.y; d.x = x; d.y = y;
  if (d.s.kind === 'circle') { d.s.cx += dx; d.s.cy += dy; } else d.s.pts = d.s.pts.map(([px, py]) => [px + dx, py + dy]);
});
cv.addEventListener('pointerup', () => { st.drag = null; });
function addBuilt(kind) {
  const x = 500 + (Math.random() - 0.5) * 200, y = 375 + (Math.random() - 0.5) * 200, S = 60;
  const s = kind === 'circle' ? circle(x, y, S) : kind === 'tri' ? poly('tri', [[x, y - S], [x + S, y + S * 0.8], [x - S, y + S * 0.8]]) : poly('rect', rectPts(x - S, y - S, S * 2, S * 2));
  st.shapes.push(s); speak(KIND[kind].name);
}

function tap(s) {
  const name = KIND[s.kind].name;
  if (st.mode === 'find' || st.mode === 'sort') {
    if (s.kind === st.target) {
      if (st.found.has(s.id)) return;
      st.found.add(s.id); chime(true);
      const total = visible().filter(v => v.kind === st.target).length;
      if (st.found.size >= total) { speak(`다 찾았어! ${name}가 ${total}개 있었어.`); celebrate(); }
      else speak(`맞아, ${name}!`);
    } else { chime(false); s.shake = performance.now() + 400; speak(`그건 ${name}야. ${KIND[st.target].name}를 찾아 봐.`); }
  } else if (st.mode === 'name') {
    chime(true); speak(name); st.example = s.id;
    setTimeout(() => speak('따라 말해 봐'), 1500);
  } else if (st.mode === 'props') {
    props(s);
  } else if (st.mode === 'reward') {
    speak(name);
  }
}

// 속성 보기: 꼭짓점 하나씩 깜빡이며 세기
function props(s) {
  const name = KIND[s.kind].name;
  if (s.kind === 'circle') { speak('뾰족한 곳이 없어. 동글동글 동그라미!'); st.example = s.id; return; }
  const n = s.pts.length, words = ['하나', '둘', '셋', '넷'];
  let i = 0; st.example = s.id;
  st.anim = t => { for (let k = 0; k <= Math.min(i, n - 1); k++) { const [x, y] = s.pts[k]; ctx.beginPath(); ctx.arc(x, y, k === i ? 14 + 6 * Math.sin(t / 80) : 12, 0, Math.PI * 2); ctx.fillStyle = '#1F4E79'; ctx.fill(); } };
  const step = () => { if (i < n) { speak(words[i]); i++; setTimeout(step, 1100); } else { speak(`뾰족한 곳이 ${n}개. ${name}!`); setTimeout(() => { st.anim = null; }, 2500); } };
  step();
}
function celebrate() {
  const end = performance.now() + 1800, dots = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: -20 - Math.random() * 300, v: 2 + Math.random() * 3, c: Object.values(KIND)[Math.floor(Math.random() * 3)].color }));
  st.anim = t => { for (const d of dots) { d.y += d.v * 2; ctx.fillStyle = d.c; ctx.fillRect(d.x, d.y, 12, 12); } if (t > end) st.anim = null; };
}

// ---------- 차시와 활동 ----------
const LESSONS = {
  1: [['name', 'circle', '눈은 동그라미야. 도형을 눌러 봐.'], ['find', 'circle', '동그라미를 모두 찾아 봐.']],
  2: [['name', 'tri', '코는 세모야. 도형을 눌러 봐.'], ['sort', 'tri', '이 중에서 세모만 골라 봐.'], ['find', 'tri', '내 얼굴에서 세모를 찾아 봐.']],
  3: [['name', 'rect', '입은 네모야. 도형을 눌러 봐.'], ['find', 'rect', '네모를 모두 찾아 봐.'], ['find', 'circle', '이번엔 동그라미를 찾아 봐.'], ['find', 'tri', '이번엔 세모를 찾아 봐.']],
  4: [['props', 'tri', '도형을 누르면 뾰족한 곳을 같이 세어 보자.']],
  5: [['build', 'circle', '도형을 끌어다 내 얼굴을 만들어 봐.'], ['reward', 'circle', '도형이 몇 개일까? 다음을 누르면 더 많아져.']],
};
const MODES = { name: '이름 듣기', find: '찾기', sort: '구별하기', props: '속성 보기', build: '만들기', reward: '보상 화면' };
function setMode(mode, target = st.target, prompt = '') {
  st.mode = mode; st.target = target; st.found.clear(); st.example = null; st.anim = null;
  if (mode === 'sort') st.shapes = sortShapes(target);
  else if (mode === 'build') st.shapes = [];
  else st.shapes = st.face;
  if (mode === 'find') { const ex = visible().find(s => s.kind === target); st.example = ex?.id ?? null; }
  $('hint').textContent = `${st.lesson}차시 · ${MODES[mode]}`;
  if (prompt) speak(prompt);
  syncPanel();
}
function setLesson(n, step = 0) {
  st.lesson = n; st.step = step;
  const [mode, target, prompt] = LESSONS[n][step];
  setMode(mode, target, prompt);
}
$('btnNext').onclick = () => {
  if (st.mode === 'reward') { st.level = st.level === 3 ? 7 : st.level === 7 ? 20 : 3; speak(`도형 ${visible().length}개`); syncPanel(); return; }
  const steps = LESSONS[st.lesson];
  if (st.step + 1 < steps.length) setLesson(st.lesson, st.step + 1);
  else { speak('오늘 활동 끝! 잘했어.'); setMode('reward', st.target); }
};
$('btnAgain').onclick = () => {
  if (st.mode === 'build') { st.shapes.pop(); return; }
  setLesson(st.lesson, st.step);
};

// ---------- 교사 패널 ----------
$('gear').onclick = () => $('panel').classList.toggle('on');
document.addEventListener('pointerdown', e => { if (!$('panel').contains(e.target) && e.target !== $('gear')) $('panel').classList.remove('on'); });
for (const n of [1, 2, 3, 4, 5]) { const b = document.createElement('button'); b.textContent = `${n}차시`; b.dataset.lesson = n; b.onclick = () => setLesson(n); $('lessons').append(b); }
for (const [m, label] of Object.entries(MODES)) { const b = document.createElement('button'); b.textContent = label; b.dataset.mode = m; b.onclick = () => setMode(m); $('modes').append(b); }
for (const l of [3, 7, 20]) { const b = document.createElement('button'); b.textContent = `${l}개`; b.dataset.level = l; b.onclick = () => { st.level = l; if (st.mode !== 'reward') setMode('reward'); syncPanel(); }; $('levels').append(b); }
function syncPanel() {
  for (const b of $('panel').querySelectorAll('button[data-lesson]')) b.classList.toggle('sel', +b.dataset.lesson === st.lesson);
  for (const b of $('panel').querySelectorAll('button[data-mode]')) b.classList.toggle('sel', b.dataset.mode === st.mode);
  for (const b of $('panel').querySelectorAll('button[data-level]')) b.classList.toggle('sel', +b.dataset.level === st.level);
}
$('btnSpeak').onclick = () => { speakOn = !speakOn; $('btnSpeak').textContent = speakOn ? '소리 켜짐' : '소리 꺼짐'; if (!speakOn) speechSynthesis.cancel(); };
$('btnRetake').onclick = () => { show('start'); startCamera(); };
$('btnPrint').onclick = () => {
  $('printArea').innerHTML = `<img src="${cv.toDataURL('image/png')}">
    <div class="sheet"><h2>도형얼굴 활동지</h2>
    <p>오늘 내 얼굴에서 찾은 도형: 동그라미 ○ &nbsp; 세모 △ &nbsp; 네모 □</p>
    <p>집에서 해 보기</p>
    <p>1. 집에서 동그라미를 3개 찾아 보세요. (예: 시계, 접시, 단추)</p>
    <p>2. 세모는 어디에 있을까요? 함께 찾아 보세요.</p>
    <p>3. 네모를 손가락으로 따라 그려 보세요. 뾰족한 곳은 몇 개인가요?</p>
    <p style="color:#666;font-size:14px">보호자께: 아이가 이름을 말하면 "맞아, 동그라미!"처럼 이름을 한 번 더 들려 주세요.</p></div>`;
  window.print();
};

// ---------- 촬영과 인식 ----------
function show(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id); }
let landmarker, stream;
async function loadModel() {
  if (landmarker) return landmarker;
  $('status').textContent = '준비 중이에요...';
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate: 'GPU' },
    runningMode: 'IMAGE', numFaces: 1,
  });
  if ($('status').textContent.startsWith('준비')) $('status').textContent = '';
  return landmarker;
}
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false });
    $('video').srcObject = stream; show('cam');
  } catch { $('status').textContent = '카메라를 못 열었어요. 사진 파일로 해 보세요.'; }
}
function stopCamera() { stream?.getTracks().forEach(t => t.stop()); stream = null; }
// 원본을 1000×750에 contain으로 넣음(얼굴이 잘리지 않게). 카메라 영상은 거울처럼 좌우 반전.
function frameToCanvas(src, sw, sh, mirror) {
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  const c = off.getContext('2d'), k = Math.min(W / sw, H / sh), dw = sw * k, dh = sh * k;
  c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
  if (mirror) { c.translate(W, 0); c.scale(-1, 1); }
  c.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  return off;
}
async function recognize(off) {
  $('status').textContent = '얼굴을 찾는 중...';
  const lm = (await loadModel()).detect(off).faceLandmarks?.[0];
  if (!lm) { $('status').textContent = ''; speak('얼굴이 안 보여요. 다시 찍어 볼까?'); return false; }
  id = 0; st.face = facesToShapes(lm);
  // 사진 → 도형 전환 연출 후 원본은 버림
  show('play'); setLesson(1);
  const start = performance.now();
  st.anim = t => { const a = 1 - Math.min(1, (t - start) / 1800); if (a <= 0) { st.anim = null; off.width = 0; return; } ctx.globalAlpha = a; ctx.drawImage(off, 0, 0); ctx.globalAlpha = 1; };
  return true;
}
$('btnStart').onclick = async () => { loadModel(); await startCamera(); };
$('btnShot').onclick = async () => {
  const v = $('video'), off = frameToCanvas(v, v.videoWidth, v.videoHeight, true);
  stopCamera(); show('start');
  if (!await recognize(off)) startCamera();
};
$('btnFile').onclick = () => $('file').click();
$('file').onchange = async () => {
  const f = $('file').files[0]; if (!f) return;
  const img = new Image(); img.src = URL.createObjectURL(f); await img.decode();
  await recognize(frameToCanvas(img, img.naturalWidth, img.naturalHeight, false));
  URL.revokeObjectURL(img.src); $('file').value = '';
};
