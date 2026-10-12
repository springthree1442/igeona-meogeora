"use strict";

const $ = id => document.getElementById(id);
const canvas = $("scene");
const ctx = canvas.getContext("2d");

const W = 1000;
const H = 800;
const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

let kind = "tomato";
let target = null;
let custom = null;
let marks = [];
let flights = [];
let drag = null;
let total = 0;
let sound = false;
let audio = null;
let raf = 0;
let keyboard = { x: 500, y: 380 };
let keyAim = false;
let targetRequest = 0;
let throwRequest = 0;

const wall = document.createElement("canvas");
wall.width = W;
wall.height = H;
const wc = wall.getContext("2d");

/* 자국마다 고정된 무작위 형태 */
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ellipse(c, x, y, rx, ry, color) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  c.fill();
}

function gradient(c, x, y, r, colors) {
  const g = c.createRadialGradient(
    x - r * 0.3, y - r * 0.4, r * 0.05,
    x, y, r
  );
  colors.forEach(([position, color]) => {
    g.addColorStop(position, color);
  });
  return g;
}

function blob(c, r, random, color) {
  c.fillStyle = color;
  c.beginPath();

  for (let i = 0; i < 44; i++) {
    const a = i / 44 * TAU;
    const d = r * (0.8 + random() * 0.36);
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;

    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }

  c.closePath();
  c.fill();
}

/* 날아가는 물건 */
function object(c, type, x, y, r, img) {
  c.save();
  c.translate(x, y);
  c.shadowColor = "#25150940";
  c.shadowBlur = r * 0.2;
  c.shadowOffsetY = r * 0.1;

  if (type === "tomato") {
    ellipse(c, 0, 2, r, r * 0.88,
      gradient(c, 0, 0, r, [
        [0, "#ff8058"],
        [0.4, "#e74925"],
        [0.8, "#b32212"],
        [1, "#6d180d"]
      ])
    );

    c.shadowBlur = 0;
    ellipse(c, -r * 0.32, -r * 0.28,
      r * 0.25, r * 0.09, "#ffffff42");

    c.fillStyle = "#3a5621";
    c.beginPath();

    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU - Math.PI / 2;
      const d = i % 2 ? r * 0.12 : r * 0.46;
      c.lineTo(
        Math.cos(a) * d,
        Math.sin(a) * d * 0.6 - r * 0.6
      );
    }

    c.closePath();
    c.fill();
    c.strokeStyle = "#567335";
    c.lineWidth = r * 0.11;
    c.beginPath();
    c.moveTo(0, -r * 0.58);
    c.quadraticCurveTo(
      r * 0.1, -r * 0.95,
      r * 0.24, -r * 0.88
    );
    c.stroke();
  } else if (type === "egg") {
    ellipse(c, 0, 0, r * 0.73, r,
      gradient(c, 0, 0, r, [
        [0, "#fff8e8"],
        [0.55, "#e8d2ac"],
        [1, "#ac895e"]
      ])
    );

    c.shadowBlur = 0;
    ellipse(c, -r * 0.22, -r * 0.35,
      r * 0.14, r * 0.3, "#fffdf63d");
  } else if (type === "ash") {
    const random = rng(730);
    const colors = ["#68635e", "#99938b", "#403e39", "#c3bdb3"];
    c.shadowBlur = 0;

    for (let i = 0; i < 145; i++) {
      const a = random() * TAU;
      const d = Math.sqrt(random()) * r;

      ellipse(c,
        Math.cos(a) * d,
        Math.sin(a) * d * 0.55,
        1 + random() * r * 0.1,
        1 + random() * r * 0.06,
        colors[i % 4]
      );
    }
  } else if (img) {
    /* 업로드한 이미지는 회전하지 않음 */
    c.shadowBlur = r * 0.1;
    const scale = r * 2 / Math.max(img.width, img.height);

    c.drawImage(img,
      -img.width * scale / 2,
      -img.height * scale / 2,
      img.width * scale,
      img.height * scale
    );
  } else {
    c.shadowBlur = 0;
    c.strokeStyle = "#b5a898";
    c.lineWidth = 2;
    c.strokeRect(-r * 0.7, -r * 0.65, r * 1.4, r * 1.3);
    c.fillStyle = "#b5a898";
    c.font = r + "px sans-serif";
    c.textAlign = "center";
    c.fillText("+", 0, r * 0.3);
  }

  c.restore();
}

/* 배경 */
function rebuildWall() {
  const g = wc.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#e8e4dc");
  g.addColorStop(1, "#c4bdb1");

  wc.fillStyle = g;
  wc.fillRect(0, 0, W, H);

  const random = rng(57);

  for (let i = 0; i < 18000; i++) {
    wc.fillStyle = i % 2 ? "#fff8ee13" : "#51432e0a";
    wc.fillRect(
      random() * W, random() * H,
      1 + random() * 2, 1 + random() * 2
    );
  }

  wc.fillStyle = "#afa49335";
  wc.fillRect(0, H - 38, W, 38);
  wc.fillStyle = "#ffffff35";
  wc.fillRect(0, H - 38, W, 2);

  if (target) {
    const scale = Math.min(830 / target.width, 650 / target.height);
    const w = target.width * scale;
    const h = target.height * scale;

    wc.save();
    wc.shadowColor = "#42332140";
    wc.shadowBlur = 24;
    wc.shadowOffsetY = 12;
    wc.fillStyle = "#fdfbf5";
    wc.fillRect((W - w) / 2 - 10, (H - h) / 2 - 10, w + 20, h + 20);

    wc.shadowBlur = 0;
    wc.drawImage(target, (W - w) / 2, (H - h) / 2, w, h);
    wc.restore();
  } else {
    wc.save();
    wc.translate(500, 365);
    wc.strokeStyle = "#8d827344";
    wc.lineWidth = 2;

    [48, 94, 145].forEach(r => {
      wc.beginPath();
      wc.arc(0, 0, r, 0, TAU);
      wc.stroke();
    });

    wc.fillStyle = "#a5968233";
    wc.fillRect(-1, -168, 2, 336);
    wc.fillRect(-168, -1, 336, 2);
    wc.restore();
  }

  start();
}

/* 끝부분이 둥글고 두꺼운 점성 액체 */
function drip(c, x, y, width, length, color) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x - width * 0.42, y);

  c.bezierCurveTo(
    x - width * 0.3, y + length * 0.4,
    x - width * 0.14, y + length * 0.6,
    x - width * 0.6, y + length - width
  );

  c.bezierCurveTo(
    x - width, y + length + width * 0.8,
    x + width, y + length + width * 0.8,
    x + width * 0.6, y + length - width
  );

  c.bezierCurveTo(
    x + width * 0.14, y + length * 0.6,
    x + width * 0.3, y + length * 0.4,
    x + width * 0.42, y
  );

  c.closePath();
  c.fill();

  c.strokeStyle = "#fffbe740";
  c.lineWidth = Math.max(1, width * 0.09);
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(x - width * 0.17, y + 4);
  c.quadraticCurveTo(
    x - width * 0.08, y + length * 0.6,
    x - width * 0.25, y + length - width * 0.2
  );
  c.stroke();
}

/* 충돌 후 사라지기까지의 시간: 초 */
function lifetime(type) {
  if (type === "egg") return 16;
  if (type === "tomato") return 14;
  if (type === "ash") return 9;
  return 13;
}

/* 반투명 자국, 점성 변형, 아래로 이동, 서서히 사라짐 */
function paintMark(c, m, age = 0) {
  const random = rng(m.seed);
  const r = m.r;
  const life = lifetime(m.kind);
  const progress = clamp((age - 1.2) / (life - 1.2), 0, 1);

  const fade = clamp((progress - 0.32) / 0.68, 0, 1);
  const opacity = 1 - fade * fade * (3 - 2 * fade);
  const fall = Math.pow(progress, 1.5) *
    Math.max(0, H - 34 - r * 0.8 - m.y);

  c.save();
  c.translate(m.x, m.y + fall);
  c.globalAlpha = opacity;

  if (m.kind === "custom") {
    object(c, "custom", 0, 0, r, m.img);
  } else if (m.kind === "ash") {
    c.globalAlpha *= 0.8;
    const colors = ["#34312db0", "#625b5099", "#aaa29590", "#e5dfd488"];

    for (let i = 0; i < 400; i++) {
      const a = random() * TAU;
      const d = Math.sqrt(random()) * r * 2.1;

      ellipse(c,
        Math.cos(a) * d,
        Math.sin(a) * d * 0.7,
        random() * 2.8 + 0.3,
        random() * 1.5 + 0.3,
        colors[i % 4]
      );
    }
  } else if (m.kind === "egg") {
    c.globalAlpha *= 0.72;

    const stretch = Math.min(1, age / 2.6);
    const sag = stretch * r * 0.55;

    /* 흰자의 넓고 반투명한 덩어리 */
    c.save();
    c.scale(1, 0.82);

    blob(c, r * 1.55, random,
      gradient(c, 0, 0, r * 1.65, [
        [0, "#fffae7b8"],
        [0.65, "#f3e6c68c"],
        [1, "#c7af7370"]
      ])
    );
    c.restore();

    /* 두꺼운 흰자가 늘어지며 흐름 */
    for (let i = 0; i < 4; i++) {
      const x = (random() - 0.5) * r * 1.9;
      const y = r * (0.15 + random() * 0.3);
      const width = r * (0.12 + random() * 0.18);
      const length = r * (0.4 + random() * 1.5) * stretch;

      drip(c, x, y, width, length, "#fff7dfaf");
    }

    /* 노른자 덩어리 */
    ellipse(c,
      -r * 0.12, sag,
      r * 0.62, r * (0.39 + 0.16 * stretch),
      gradient(c, -r * 0.12, sag, r * 0.7, [
        [0, "#ffe378ec"],
        [0.6, "#ffc52ddb"],
        [1, "#e78b18cf"]
      ])
    );

    drip(c,
      r * 0.02,
      sag + r * 0.16,
      r * 0.29,
      r * (0.2 + 0.9 * stretch),
      "#f6b426d9"
    );

    ellipse(c,
      -r * 0.3, sag - r * 0.14,
      r * 0.17, r * 0.055,
      "#fff9bfa0"
    );

    /* 작게 찢어진 노른자 덩어리 */
    for (let i = 0; i < 5; i++) {
      const a = random() * TAU;
      const d = r * (0.75 + random() * 0.6);

      ellipse(c,
        Math.cos(a) * d,
        Math.sin(a) * d + sag,
        r * (0.06 + random() * 0.1),
        r * (0.08 + random() * 0.13),
        "#f4b723b0"
      );
    }

    for (let i = 0; i < 12; i++) {
      const a = random() * TAU;
      const d = r * (1.4 + random());

      ellipse(c,
        Math.cos(a) * d,
        Math.sin(a) * d * 0.72,
        1 + random() * 3,
        1 + random() * 2,
        "#fff6da85"
      );
    }

    /* 흰자 표면의 윤기 */
    c.strokeStyle = "#fffdf87a";
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(
      -r * 0.22, -r * 0.15,
      r * 0.95, r * 0.3,
      -0.18, Math.PI, Math.PI * 1.8
    );
    c.stroke();

    /* 깨진 껍데기 조각 */
    for (let i = 0; i < 3; i++) {
      const x = (random() - 0.5) * r * 2.6;
      const y = (random() - 0.5) * r * 1.2;

      c.fillStyle = "#e7d4b7d9";
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + r * 0.18, y - r * 0.13);
      c.lineTo(x + r * 0.3, y + r * 0.08);
      c.lineTo(x + r * 0.12, y + r * 0.18);
      c.closePath();
      c.fill();
      c.strokeStyle = "#fff8e9";
      c.lineWidth = 1;
      c.stroke();
    }
  } else {
    /* 반투명 토마토 */
    c.globalAlpha *= 0.64;
    c.save();
    c.scale(1, 0.85);
    blob(c, r * 1.25, random, "#9a230fee");
    blob(c, r * 1.05, random, "#e4481be8");
    c.restore();

    for (let i = 0; i < 26; i++) {
      const a = random() * TAU;
      const d = r * (1.2 + random() * 1.45);
      const size = 1 + random() * r * 0.1;

      ellipse(c,
        Math.cos(a) * d,
        Math.sin(a) * d * 0.8,
        size, size * 0.7,
        "#bf3016cb"
      );
    }

    for (let i = 0; i < 5; i++) {
      const x = (random() - 0.5) * r * 1.5;
      const y = random() * r * 0.5;
      const width = 3 + random() * 5;
      const length = (20 + random() * 65) * Math.min(1, age / 2);
      drip(c, x, y, width, length, "#be331ad9");
    }

    for (let i = 0; i < 34; i++) {
      const a = random() * TAU;
      const d = Math.sqrt(random()) * r * 0.9;

      ellipse(c,
        Math.cos(a) * d,
        Math.sin(a) * d * 0.75,
        random() * 3 + 1,
        random() * 1.6 + 1,
        i % 3 ? "#ff8c3480" : "#fee18bb0"
      );
    }

    ellipse(c, -r * 0.2, -r * 0.25,
      r * 0.28, r * 0.045, "#fff4d975");
  }

  c.restore();
}

function sync() {
  $("count").textContent = total;
  $("undo").disabled = !marks.length && !flights.length;
}

function ping(text) {
  $("message").textContent = text;
}

function start() {
  if (!raf) raf = requestAnimationFrame(frame);
}

function aim(d) {
  return {
    x: clamp(d.x + (d.ex - d.x) * 3, 45, W - 45),
    y: clamp(d.y + (d.ey - d.y) * 3, 45, H - 45)
  };
}

function reticle(x, y) {
  ctx.save();
  ctx.strokeStyle = "#a9402cbf";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(x, y, 21, 0, TAU);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x - 30, y);
  ctx.lineTo(x - 13, y);
  ctx.moveTo(x + 13, y);
  ctx.lineTo(x + 30, y);
  ctx.moveTo(x, y - 30);
  ctx.lineTo(x, y - 13);
  ctx.moveTo(x, y + 13);
  ctx.lineTo(x, y + 30);
  ctx.stroke();
  ctx.restore();
}

/* 全물건을 시간에 따라 다시 그리기 */
function frame(now) {
  raf = 0;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(wall, 0, 0);

  for (let i = flights.length - 1; i >= 0; i--) {
    const f = flights[i];

    if (now - f.born >= f.duration) {
      f.hit = true;
      f.impact = now;
      marks.push(f);
      flights.splice(i, 1);
      playSound(f.kind);
    }
  }

  marks = marks.filter(m =>
    (now - m.impact) / 1000 < lifetime(m.kind)
  );

  const ordered = marks.concat(flights)
    .sort((a, b) => a.born - b.born);

  for (const f of ordered) {
    if (!f.hit) {
      const u = clamp((now - f.born) / f.duration, 0, 1);
      const ease = 1 - Math.pow(1 - u, 2);
      const x = f.sx + (f.x - f.sx) * ease;
      const y = f.sy + (f.y - f.sy) * ease -
        Math.sin(u * Math.PI) * 85;

      object(ctx, f.kind, x, y, f.r * (1.7 - 0.7 * u), f.img);
    } else {
      const age = (now - f.impact) / 1000;
      paintMark(ctx, f, age);

      if (age < 0.5 && f.kind !== "custom") {
        const random = rng(f.seed + 1);
        ctx.save();
        ctx.globalAlpha = (1 - age * 2) * 0.6;

        for (let j = 0; j < 22; j++) {
          const a = random() * TAU;
          const speed = 40 + random() * 155;
          const d = speed * age * 2;
          const color =
            f.kind === "ash" ? "#7b726c80" :
            f.kind === "egg" ? "#f3d15ccc" : "#d84922cc";

          ellipse(ctx,
            f.x + Math.cos(a) * d,
            f.y + Math.sin(a) * d + age * age * 120,
            (f.kind === "ash" ? 8 : 3) * (1 - age * 1.8),
            2, color
          );
        }

        ctx.restore();
      }
    }
  }

  if (drag) {
    const destination = aim(drag);
    ctx.save();
    ctx.strokeStyle = "#a9402c88";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.moveTo(drag.x, drag.y);
    ctx.lineTo(destination.x, destination.y);
    ctx.stroke();
    ctx.restore();

    reticle(destination.x, destination.y);
    object(ctx, kind, drag.ex, drag.ey, Number($("size").value), custom);
  } else if (keyAim) {
    reticle(keyboard.x, keyboard.y);
  }

  sync();

  if (marks.length || flights.length || drag) start();
}

function playSound(type) {
  if (!sound) return;

  try {
    audio = audio ||
      new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();

    const n = Math.floor(audio.sampleRate * 0.15);
    const buffer = audio.createBuffer(1, n, audio.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < n; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    }

    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();

    filter.type = "lowpass";
    filter.frequency.value =
      type === "ash" ? 4000 : type === "custom" ? 300 : 1000;

    gain.gain.value = 0.35;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    source.start();
  } catch {
    sound = false;
    $("sound").textContent = "효과음을 사용할 수 없어요";
    $("sound").setAttribute("aria-pressed", "false");
  }
}

function throwAt(x, y) {
  if (kind === "custom" && !custom) return;

  if (flights.length >= 16) {
    ping("잠깐! 날아가는 물건이 도착하면 다시 던져주세요.");
    return;
  }

  flights.push({
    x, y,
    sx: W * 0.5,
    sy: H + 70,
    r: Number($("size").value),
    kind,
    img: kind === "custom" ? custom : null,
    seed: Math.floor(Math.random() * 2147483647),
    born: performance.now(),
    duration: 430,
    hit: false
  });

  total++;
  sync();
  start();
}

function point(e) {
  const b = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - b.left) / b.width * W,
    y: (e.clientY - b.top) / b.height * H
  };
}

/* 터치와 마우스 */
canvas.addEventListener("pointerdown", e => {
  if (drag || e.isPrimary === false || e.button > 0) return;

  e.preventDefault();
  canvas.focus({ preventScroll: true });

  const p = point(e);
  drag = { x: p.x, y: p.y, ex: p.x, ey: p.y, id: e.pointerId };
  keyAim = false;
  canvas.setPointerCapture(e.pointerId);

  if (sound) {
    try {
      audio = audio ||
        new (window.AudioContext || window.webkitAudioContext)();
      audio.resume();
    } catch {}
  }

  start();
});

canvas.addEventListener("pointermove", e => {
  if (!drag || drag.id !== e.pointerId) return;
  const p = point(e);
  drag.ex = p.x;
  drag.ey = p.y;
  start();
});

canvas.addEventListener("pointerup", e => {
  if (!drag || drag.id !== e.pointerId) return;

  const p = point(e);
  drag.ex = p.x;
  drag.ey = p.y;

  const previous = drag;
  const destination = aim(drag);
  drag = null;

  if (canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }

  if (Math.hypot(
    previous.ex - previous.x,
    previous.ey - previous.y
  ) >= 5) {
    throwAt(destination.x, destination.y);
  } else {
    ping("살짝 끌어서 놓으면 던져져요.");
    start();
  }
});

function cancelDrag(e) {
  if (drag && drag.id === e.pointerId) {
    drag = null;
    start();
  }
}

canvas.addEventListener("pointercancel", cancelDrag);
canvas.addEventListener("lostpointercapture", cancelDrag);

canvas.addEventListener("keydown", e => {
  if (![
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter"
  ].includes(e.key)) return;

  e.preventDefault();
  keyAim = true;

  if (e.key === "ArrowUp") keyboard.y -= 25;
  if (e.key === "ArrowDown") keyboard.y += 25;
  if (e.key === "ArrowLeft") keyboard.x -= 25;
  if (e.key === "ArrowRight") keyboard.x += 25;

  keyboard.x = clamp(keyboard.x, 45, W - 45);
  keyboard.y = clamp(keyboard.y, 45, H - 45);

  if (e.key === " " || e.key === "Enter") {
    throwAt(keyboard.x, keyboard.y);
  }

  start();
});

/* 선택 버튼 */
function icons() {
  document.querySelectorAll(".item").forEach(button => {
    const icon = button.querySelector("canvas");
    const c = icon.getContext("2d");
    c.clearRect(0, 0, icon.width, icon.height);

    object(c, button.dataset.kind, 62, 54, 35,
      button.dataset.kind === "custom" ? custom : null);
  });
}

function select(type) {
  kind = type;

  document.querySelectorAll(".item").forEach(button => {
    button.setAttribute("aria-pressed",
      String(button.dataset.kind === type));
  });

  start();
}

document.querySelectorAll(".item").forEach(button => {
  button.addEventListener("click", () => select(button.dataset.kind));
});

/* 이미지 읽기 */
async function readImage(file) {
  if (!file) throw Error("파일을 선택해주세요.");
  if (file.size > 25 * 1024 * 1024) {
    throw Error("25MB 이하의 사진을 선택해주세요.");
  }

  const url = URL.createObjectURL(file);

  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    if (!img.naturalWidth) throw Error();

    const scale = Math.min(
      1, 2000 / Math.max(img.naturalWidth, img.naturalHeight)
    );

    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(img.naturalWidth * scale));
    out.height = Math.max(1, Math.round(img.naturalHeight * scale));
    out.getContext("2d").drawImage(img, 0, 0, out.width, out.height);

    return out;
  } catch {
    throw Error("이 이미지를 열 수 없어요. JPG, PNG 또는 WebP로 다시 선택해주세요.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

$("targetFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  const request = ++targetRequest;
  ping("사진을 불러오는 중…");

  try {
    const img = await readImage(file);
    if (request !== targetRequest) return;

    target = img;
    marks = [];
    flights = [];
    total = 0;
    drag = null;

    rebuildWall();
    sync();
    start();
    ping("사진 준비 완료. 화면을 짧게 밀어 던져보세요.");
  } catch (err) {
    if (request === targetRequest) ping(err.message);
  } finally {
    e.target.value = "";
  }
});

$("throwFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  const request = ++throwRequest;

  try {
    const img = await readImage(file);
    if (request !== throwRequest) return;

    custom = img;
    document.querySelector('[data-kind="custom"]').disabled = false;
    icons();
    select("custom");
    ping("던질 이미지 준비 완료. 회전 없이 날아갑니다.");
  } catch (err) {
    if (request === throwRequest) ping(err.message);
  } finally {
    e.target.value = "";
  }
});

/* 초기화와 되돌리기 */
$("clear").onclick = () => {
  marks = [];
  flights = [];
  drag = null;
  total = 0;
  sync();
  start();
  ping("깨끗해졌어요. 다시 던져보세요.");
};

$("undo").onclick = () => {
  const latest = marks.concat(flights)
    .sort((a, b) => b.born - a.born)[0];

  if (!latest) return;

  marks = marks.filter(m => m !== latest);
  flights = flights.filter(f => f !== latest);
  total = Math.max(0, total - 1);
  sync();
  start();
};

$("size").oninput = e => {
  const size = Number(e.target.value);
  $("sizeText").textContent =
    size < 35 ? "작게" : size > 53 ? "크게" : "보통";
};

$("sound").onclick = () => {
  sound = !sound;
  $("sound").textContent = sound ? "효과음 켜짐" : "효과음 꺼짐";
  $("sound").setAttribute("aria-pressed", String(sound));
  if (sound) playSound("tomato");
};

/* 현재 남아 있는 자국을 사진에 저장 */
$("save").onclick = () => {
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const c = out.getContext("2d");
  c.drawImage(wall, 0, 0);

  const now = performance.now();
  marks.slice().sort((a, b) => a.born - b.born).forEach(m => {
    paintMark(c, m, (now - m.impact) / 1000);
  });

  out.toBlob(blob => {
    if (!blob) {
      ping("저장하지 못했어요. 다시 시도해주세요.");
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "igeona-meogeora.png";
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 60000);
    ping("이미지 저장을 요청했어요. 다운로드 또는 새 이미지 탭을 확인해주세요.");
  }, "image/png");
};

rebuildWall();
icons();
start();
