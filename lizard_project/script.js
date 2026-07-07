const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
window.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
window.addEventListener('touchmove', e => {
  if (e.touches.length > 0) {
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
  }
}, { passive: true });

const SEGMENT_COUNT = 9;
const SEGMENT_LENGTH = 16;
const HEAD_EASE = 0.2;

const spine = [];
for (let i = 0; i < SEGMENT_COUNT; i++) {
  spine.push({ x: mouse.x, y: mouse.y + i * SEGMENT_LENGTH });
}

function updateSpine() {
  spine[0].x += (mouse.x - spine[0].x) * HEAD_EASE;
  spine[0].y += (mouse.y - spine[0].y) * HEAD_EASE;
  for (let i = 1; i < spine.length; i++) {
    const dx = spine[i - 1].x - spine[i].x;
    const dy = spine[i - 1].y - spine[i].y;
    const angle = Math.atan2(dy, dx);
    spine[i].x = spine[i - 1].x - Math.cos(angle) * SEGMENT_LENGTH;
    spine[i].y = spine[i - 1].y - Math.sin(angle) * SEGMENT_LENGTH;
  }
}

function tangentAt(i) {
  const a = spine[Math.max(0, i - 1)];
  const b = spine[Math.min(spine.length - 1, i + 1)];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: dx / len, y: dy / len };
}

const UPPER_LEN = 15;
const LOWER_LEN = 18;
const HIP_OFFSET = 5;
const SIDE_REACH = 30;
const FORWARD_REACH = 12;
const STEP_THRESHOLD = 26;

const legDefs = [
  { idx: 2, side: -1, group: 0 },
  { idx: 2, side: 1, group: 1 },
  { idx: 4, side: -1, group: 1 },
  { idx: 4, side: 1, group: 0 },
  { idx: 6, side: -1, group: 0 },
  { idx: 6, side: 1, group: 1 },
];

const legs = legDefs.map(def => {
  const p = spine[def.idx];
  const t = tangentAt(def.idx);
  const perp = { x: -t.y, y: t.x };
  const rest = {
    x: p.x + perp.x * SIDE_REACH * def.side,
    y: p.y + perp.y * SIDE_REACH * def.side
  };
  return { ...def, foot: { x: rest.x, y: rest.y } };
});

let gaitPhase = 0;
let prevHead = { x: spine[0].x, y: spine[0].y };

function solveKnee(hip, foot, l1, l2, bendSign) {
  let dx = foot.x - hip.x;
  let dy = foot.y - hip.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  dist = Math.min(dist, l1 + l2 - 0.01);
  dist = Math.max(dist, Math.abs(l1 - l2) + 0.01);
  const a1 = Math.atan2(dy, dx);
  const a2 = Math.acos((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist));
  const kneeAngle = a1 + bendSign * a2;
  return {
    x: hip.x + Math.cos(kneeAngle) * l1,
    y: hip.y + Math.sin(kneeAngle) * l1
  };
}

function updateLegs() {
  const dx = spine[0].x - prevHead.x;
  const dy = spine[0].y - prevHead.y;
  const speed = Math.sqrt(dx * dx + dy * dy);
  prevHead = { x: spine[0].x, y: spine[0].y };
  gaitPhase += speed * 0.06;
  const activeGroup = Math.sin(gaitPhase) > 0 ? 0 : 1;

  for (const leg of legs) {
    const p = spine[leg.idx];
    const t = tangentAt(leg.idx);
    const perp = { x: -t.y, y: t.x };
    const forwardBias = (leg.group === activeGroup ? 1 : -1) * FORWARD_REACH * 0.4;
    const rest = {
      x: p.x + perp.x * SIDE_REACH * leg.side + t.x * forwardBias,
      y: p.y + perp.y * SIDE_REACH * leg.side + t.y * forwardBias
    };
    const restDist = Math.hypot(rest.x - leg.foot.x, rest.y - leg.foot.y);
    if (leg.group === activeGroup && restDist > STEP_THRESHOLD) {
      leg.foot.x += (rest.x - leg.foot.x) * 0.6;
      leg.foot.y += (rest.y - leg.foot.y) * 0.6;
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#f2f2f2';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  for (const leg of legs) {
    const hip = spine[leg.idx];
    const bendSign = leg.side;
    const knee = solveKnee(hip, leg.foot, UPPER_LEN, LOWER_LEN, bendSign);
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(knee.x, knee.y);
    ctx.lineTo(leg.foot.x, leg.foot.y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(spine[0].x, spine[0].y);
  for (let i = 1; i < spine.length; i++) {
    ctx.lineTo(spine[i].x, spine[i].y);
  }
  ctx.stroke();

  const head = spine[0];
  const t = tangentAt(0);
  const perp = { x: -t.y, y: t.x };
  const eyeSpread = 5;
  const eyeForward = 4;
  ctx.beginPath();
  ctx.moveTo(head.x + perp.x * eyeSpread, head.y + perp.y * eyeSpread);
  ctx.lineTo(head.x + t.x * eyeForward + perp.x * eyeSpread, head.y + t.y * eyeForward + perp.y * eyeSpread);
  ctx.moveTo(head.x - perp.x * eyeSpread, head.y - perp.y * eyeSpread);
  ctx.lineTo(head.x + t.x * eyeForward - perp.x * eyeSpread, head.y + t.y * eyeForward - perp.y * eyeSpread);
  ctx.stroke();
}

function loop() {
  updateSpine();
  updateLegs();
  draw();
  requestAnimationFrame(loop);
}

loop();
