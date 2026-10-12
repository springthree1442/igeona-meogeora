"use strict";

const $ = (id) => document.getElementById(id);
const canvas = $("scene");
const ctx = canvas.getContext("2d");

const W = 1000;
const H = 800;
const TAU = Math.PI * 2;
const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value));

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

/* 배경과 자국을 별도 화면에 보관 */
const wall = document.createElement("canvas");
wall.width = W;
wall.height = H;
const wc = wall.getContext("2d");

const stains = document.createElement("canvas");
stains.width = W;
stains.height = H;
const sc = stains.getContext("2d");

/* 같은 자국은 매번 같은 형태로 그리기 */
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;

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
    x - r * 0.3,
    y - r * 0.4,
    r * 0.05,
    x,
    y,
    r
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
    const angle = i / 44 * TAU;
    const distance = r * (0.8 + random() * 0.36);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    if (i === 0) {
      c.moveTo(x, y);
    } else {
      c.lineTo(x, y);
    }
  }

  c.closePath();
  c.fill();
}

/* 날아가는 물건과 선택 버튼의 그림 */
function object(c, type, x, y, r, img) {
  c.save();
  c.translate(x, y);

  c.shadowColor = "#25150940";
  c.shadowBlur = r * 0.2;
  c.shadowOffsetY = r * 0.1;

  if (type === "tomato") {
    ellipse(
      c, 0, 2, r, r * 0.88,
      gradient(c, 0, 0, r, [
        [0, "#ff8058"],
        [0.4, "#e74925"],
        [0.8, "#b32212"],
        [1, "#6d180d"]
      ])
    );

    c.shadowBlur = 0;

    ellipse(
      c,
      -r * 0.32,
      -r * 0.28,
      r * 0.25,
      r * 0.09,
      "#ffffff42"
    );

    c.fillStyle = "#3a5621";
    c.beginPath();

    for (let i = 0; i < 10; i++) {
      const angle = i / 10 * TAU - Math.PI / 2;
      const distance = i % 2 ? r * 0.12 : r * 0.46;
      const px = Math.cos(angle) * distance;
      const py = Math.sin(angle) * distance * 0.6 - r * 0.6;

      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
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
    ellipse(
      c, 0, 0, r * 0.73, r,
      gradient(c, 0, 0, r, [
        [0, "#fff8e8"],
        [0.55, "#e8d2ac"],
        [1, "#ac895e"]
      ])
    );

    c.shadowBlur = 0;

    ellipse(
      c,
      -r * 0.22,
      -r * 0.35,
      r * 0.14,
      r * 0.3,
      "#fffdf63d"
    );
  } else if (type === "ash") {
    const random = rng(730);
    const colors = [
      "#68635e", "#99938b", "#403e39", "#c3bdb3"
    ];

    c.shadowBlur = 0;

    for (let i = 0; i < 145; i++) {
      const angle = random() * TAU;
      const distance = Math.sqrt(random()) * r;

      ellipse(
        c,
        Math.cos(angle) * distance,
        Math.sin(angle) * distance * 0.55,
        1 + random() * r * 0.1,
        1 + random() * r * 0.06,
        colors[i % colors.length]
      );
    }
  } else if (img) {
    /* 업로드한 이미지는 회전하지 않음 */
    c.shadowBlur = r * 0.1;
    const scale = r * 2 / Math.max(img.width, img.height);

    c.drawImage(
      img,
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
    c.font = `${r}px sans-serif`;
    c.textAlign = "center";
    c.fillText("+", 0, r * 0.3);
  }

  c.restore();
}

/* 벽과 업로드한 사진 */
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
      random() * W,
      random() * H,
      1 + random() * 2,
      1 + random() * 2
    );
  }

  wc.fillStyle = "#afa49335";
  wc.fillRect(0, H - 38, W, 38);
  wc.fillStyle = "#ffffff35";
  wc.fillRect(0, H - 38, W, 2);

  if (target) {
    const scale = Math.min(
      830 / target.width,
      650 / target.height
    );

    const width = target.width * scale;
    const height = target.height * scale;
    const x = (W - width) / 2;
    const y = (H - height) / 2;

    wc.save();
    wc.shadowColor = "#42332140";
    wc.shadowBlur = 24;
    wc.shadowOffsetY = 12;
    wc.fillStyle = "#fdfbf5";
    wc.fillRect(x - 10, y - 10, width + 20, height + 20);

    wc.shadowBlur = 0;
    wc.drawImage(target, x, y, width, height);
    wc.restore();
  } else {
    wc.save();
    wc.translate(500, 365);
    wc.strokeStyle = "#8d827344";
    wc.lineWidth = 2;

    [48, 94, 145].forEach((r) => {
      wc.beginPath();
      wc.arc(0, 0, r, 0, TAU);
      wc.stroke();
    });

    wc.fillStyle = "#a5968233";
    wc.fillRect(-1, -168, 2, 336);
    wc.fillRect(-168, -1, 336, 2);
    wc.restore();
  }

  rebuildStains();
}

/* 충돌 자국 */
function paintMark(c, m, age = 2) {
  const random = rng(m.seed);
  const r = m.r;

  c.save();
  c.translate(m.x, m.y);

  if (m.kind === "custom") {
    c.globalAlpha = 0.97;
    object(c, "custom", 0, Math.min(12, age * 8), r, m.img);
  } else if (m.kind === "ash") {
    const colors = [
      "#34312db0", "#625b5099",
      "#aaa29590", "#e5dfd488"
    ];

    for (let i = 0; i < 400; i++) {
      const angle = random() * TAU;
      const distance = Math.sqrt(random()) * r * 2.1;

      ellipse(
        c,
        Math.cos(angle) * distance,
        Math.sin(angle) * distance * 0.7,
        random() * 2.8 + 0.3,
        random() * 1.5 + 0.3,
        colors[i % colors.length]
      );
    }
  } else {
    const egg = m.kind === "egg";

    c.save();
    c.scale(1, egg ? 0.78 : 0.85);

    blob(
      c,
      r * (egg ? 1.7 : 1.25),
      random,
      egg ? "#fffdf375" : "#921b0cd9"
    );

    blob(
      c,
      r * (egg ? 1.5 : 1.05),
      random,
      egg ? "#eee8d940" : "#e14417e0"
    );

    c.restore();

    /* 주변에 튄 작은 방울 */
    for (let i = 0; i < 26; i++) {
      const angle = random() * TAU;
      const distance = r * (1.2 + random() * 1.45);
      const size = 1 + random() * r * 0.1;

      ellipse(
        c,
        Math.cos(angle) * distance,
        Math.sin(angle) * distance * 0.8,
        size,
        size * 0.7,
        egg ? "#fffbe4a0" : "#ba2c12b8"
      );
    }

    /* 천천히 흘러내리는 자국 */
    for (let i = 0; i < 5; i++) {
      const x = (random() - 0.5) * r * 1.5;
      const y = random() * r * 0.5;
      const width = 2 + random() * 5;
      const length =
        (20 + random() * 95) * Math.min(1, age / 1.7);

      c.strokeStyle = egg ? "#fff9e56b" : "#b72c12b0";
      c.lineWidth = width;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(x, y);

      c.bezierCurveTo(
        x + 2, y + length * 0.3,
        x - 3, y + length * 0.7,
        x, y + length
      );

      c.stroke();

      ellipse(
        c,
        x, y + length,
        width * 0.6,
        width * 0.85,
        egg ? "#fff8dc9e" : "#b42e17bf"
      );
    }

    if (egg) {
      ellipse(
        c,
        -r * 0.08, 0,
        r * 0.65, r * 0.48,
        gradient(c, 0, 0, r * 0.7, [
          [0, "#ffe66c"],
          [0.55, "#f7b10c"],
          [1, "#df7911"]
        ])
      );

      ellipse(
        c,
        -r * 0.25, -r * 0.16,
        r * 0.18, r * 0.065,
        "#fffaca9c"
      );
    } else {
      for (let i = 0; i < 34; i++) {
        const angle = random() * TAU;
        const distance = Math.sqrt(random()) * r * 0.9;

        ellipse(
          c,
          Math.cos(angle) * distance,
          Math.sin(angle) * distance * 0.75,
          random() * 3 + 1,
          random() * 1.6 + 1,
          i % 3 ? "#ff8c3466" : "#fee18b9c"
        );
      }

      ellipse(
        c,
        -r * 0.2, -r * 0.25,
        r * 0.28, r * 0.045,
        "#fff4d946"
      );
    }
  }

  c.restore();
}

function rebuildStains() {
  sc.clearRect(0, 0, W, H);
  marks.forEach((mark) => paintMark(sc, mark));
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

/* 짧은 드래그 거리를 확대해 조준 */
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

/* 이동과 충돌 애니메이션 */
function frame(now) {
  raf = 0;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(wall, 0, 0);
  ctx.drawImage(stains, 0, 0);

  let changing = false;

  for (let i = 0; i < flights.length; i++) {
    const f = flights[i];
    const t = (now - f.born) / f.duration;

    if (t < 1) {
      const u = clamp(t, 0, 1);
      const ease = 1 - Math.pow(1 - u, 2);
      const x = f.sx + (f.x - f.sx) * ease;
      const y =
        f.sy + (f.y - f.sy) * ease -
        Math.sin(u * Math.PI) * 85;

      object(
        ctx,
        f.kind,
        x,
        y,
        f.r * (1.7 - 0.7 * u),
        f.img
      );

      changing = true;
      continue;
    }

    if (!f.hit) {
      f.hit = true;
      f.impact = now;
      playSound(f.kind);
    }

    const age = (now - f.impact) / 1000;
    paintMark(ctx, f, age);

    if (age < 1.8) {
      /* 충돌 순간에 퍼지는 입자 */
      if (age < 0.5 && f.kind !== "custom") {
        const random = rng(f.seed + 1);
        ctx.save();

        for (let j = 0; j < 22; j++) {
          const angle = random() * TAU;
          const speed = 40 + random() * 155;
          const distance = speed * age * 2;

          const color =
            f.kind === "ash" ? "#7b726c45" :
            f.kind === "egg" ? "#f3d15cbb" :
            "#d84922b0";

          ellipse(
            ctx,
            f.x + Math.cos(angle) * distance,
            f.y + Math.sin(angle) * distance + age * age * 120,
            (f.kind === "ash" ? 8 : 3) * (1 - age * 1.8),
            2,
            color
          );
        }

        ctx.restore();
      }

      changing = true;
    } else {
      marks.push(f);
      flights.splice(i--, 1);

      /* 자국이 지나치게 쌓여 느려지는 것 방지 */
      if (marks.length > 120) marks.shift();

      rebuildStains();
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

    object(
      ctx,
      kind,
      drag.ex,
      drag.ey,
      Number($("size").value),
      custom
    );
  } else if (keyAim) {
    reticle(keyboard.x, keyboard.y);
  }

  sync();
  if (changing || drag) start();
}

/* 외부 파일 없이 만드는 짧은 효과음 */
function playSound(type) {
  if (!sound) return;

  try {
    audio = audio ||
      new (window.AudioContext || window.webkitAudioContext)();

    audio.resume();

    const length = Math.floor(audio.sampleRate * 0.15);
    const buffer = audio.createBuffer(
      1, length, audio.sampleRate
    );
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      data[i] =
        (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    }

    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();

    filter.type = "lowpass";
    filter.frequency.value =
      type === "ash" ? 4000 :
      type === "custom" ? 300 : 1000;

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
    x,
    y,
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

/* 실제 화면 좌표를 캔버스 좌표로 변환 */
function point(e) {
  const bounds = canvas.getBoundingClientRect();

  return {
    x: (e.clientX - bounds.left) / bounds.width * W,
    y: (e.clientY - bounds.top) / bounds.height * H
  };
}

/* 손가락과 마우스 조작 */
canvas.addEventListener("pointerdown", (e) => {
  if (drag || e.isPrimary === false || e.button > 0) return;

  e.preventDefault();
  canvas.focus({ preventScroll: true });

  const p = point(e);

  drag = {
    x: p.x,
    y: p.y,
    ex: p.x,
    ey: p.y,
    id: e.pointerId
  };

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

canvas.addEventListener("pointermove", (e) => {
  if (!drag || drag.id !== e.pointerId) return;

  const p = point(e);
  drag.ex = p.x;
  drag.ey = p.y;
  start();
});

canvas.addEventListener("pointerup", (e) => {
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

  const distance = Math.hypot(
    previous.ex - previous.x,
    previous.ey - previous.y
  );

  if (distance >= 5) {
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

/* 키보드 조작 */
canvas.addEventListener("keydown", (e) => {
  const allowed = [
    "ArrowUp", "ArrowDown",
    "ArrowLeft", "ArrowRight",
    " ", "Enter"
  ];

  if (!allowed.includes(e.key)) return;

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

/* 물건 선택 */
function icons() {
  document.querySelectorAll(".item").forEach((button) => {
    const icon = button.querySelector("canvas");
    const c = icon.getContext("2d");

    c.clearRect(0, 0, icon.width, icon.height);

    object(
      c,
      button.dataset.kind,
      62,
      54,
      35,
      button.dataset.kind === "custom" ? custom : null
    );
  });
}

function select(type) {
  kind = type;

  document.querySelectorAll(".item").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.kind === type)
    );
  });

  start();
}

document.querySelectorAll(".item").forEach((button) => {
  button.addEventListener("click", () => {
    select(button.dataset.kind);
  });
});

/* 큰 사진은 축소하여 메모리 사용 줄이기 */
async function readImage(file) {
  if (!file) throw new Error("파일을 선택해주세요.");

  if (file.size > 25 * 1024 * 1024) {
    throw new Error("25MB 이하의 사진을 선택해주세요.");
  }

  const url = URL.createObjectURL(file);

  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    if (!img.naturalWidth) throw new Error();

    const scale = Math.min(
      1,
      2000 / Math.max(img.naturalWidth, img.naturalHeight)
    );

    const out = document.createElement("canvas");
    out.width = Math.max(
      1, Math.round(img.naturalWidth * scale)
    );
    out.height = Math.max(
      1, Math.round(img.naturalHeight * scale)
    );

    out.getContext("2d").drawImage(
      img, 0, 0, out.width, out.height
    );

    return out;
  } catch {
    throw new Error(
      "이 이미지를 열 수 없어요. JPG, PNG 또는 WebP로 다시 선택해주세요."
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* 맞힐 사진 업로드 */
$("targetFile").addEventListener("change", async (e) => {
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

/* 던질 이미지 업로드 */
$("throwFile").addEventListener("change", async (e) => {
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

/* 모두 지우기 */
$("clear").onclick = () => {
  marks = [];
  flights = [];
  drag = null;
  total = 0;

  rebuildStains();
  sync();
  start();

  ping("깨끗해졌어요. 다시 던져보세요.");
};

/* 가장 최근에 던진 물건 지우기 */
$("undo").onclick = () => {
  const latest = marks
    .concat(flights)
    .sort((a, b) => b.born - a.born)[0];

  if (!latest) return;

  marks = marks.filter((mark) => mark !== latest);
  flights = flights.filter((flight) => flight !== latest);
  total = Math.max(0, total - 1);

  rebuildStains();
  sync();
  start();
};

/* 물건 크기 */
$("size").oninput = (e) => {
  const size = Number(e.target.value);

  $("sizeText").textContent =
    size < 35 ? "작게" :
    size > 53 ? "크게" : "보통";
};

/* 효과음 켜기와 끄기 */
$("sound").onclick = () => {
  sound = !sound;

  $("sound").textContent =
    sound ? "효과음 켜짐" : "효과음 꺼짐";

  $("sound").setAttribute("aria-pressed", String(sound));

  if (sound) playSound("tomato");
};

/* 사진과 자국을 PNG로 저장 */
$("save").onclick = () => {
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;

  const c = out.getContext("2d");
  c.drawImage(wall, 0, 0);
  c.drawImage(stains, 0, 0);

  flights
    .filter((flight) => flight.hit)
    .forEach((flight) => paintMark(c, flight));

  out.toBlob((blob) => {
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

    ping(
      "이미지 저장을 요청했어요. iPad에서는 다운로드 또는 새 이미지 탭을 확인해주세요."
    );
  }, "image/png");
};

/* 시작 */
rebuildWall();
icons();
start();
