/* 배경과 타겟 사진 */
function rebuildWall() {
  const g = wc.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#e8e4dc");
  g.addColorStop(1, "#c4bdb1");

  wc.clearRect(0, 0, W, H);
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

    wc.save();

    /* 흰색 사각형 없이 사진만 그리기 */
    wc.drawImage(
      target,
      (W - width) / 2,
      (H - height) / 2,
      width,
      height
    );

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
