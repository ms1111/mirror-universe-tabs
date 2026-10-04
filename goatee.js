/**
 * Draw a lumberjack-style moustache + square-jaw beard onto a square canvas.
 * Tuned for 32×32 favicons; scales with size.
 *
 * Thin moustache connected at the mouth corners into a thicker, squarer jaw
 * beard, with an open mouth gap in the middle.
 */
export function drawGoatee(ctx, size = 32) {
  const s = size / 32;

  ctx.save();

  const hair = new Path2D();

  // Connected outer silhouette: thin moustache → square jaw → chin
  // Starts at left moustache tip, across the lip, down the jaw, across the
  // chin as a flat-ish bottom, back up the other side.
  hair.moveTo(6 * s, 17.6 * s);
  // Top of thin moustache
  hair.quadraticCurveTo(9 * s, 15.8 * s, 12.5 * s, 16.2 * s);
  hair.quadraticCurveTo(16 * s, 16.5 * s, 19.5 * s, 16.2 * s);
  hair.quadraticCurveTo(23 * s, 15.8 * s, 26 * s, 17.6 * s);
  // Right connector into jaw (square corner, not round horseshoe)
  hair.lineTo(26.8 * s, 20.2 * s);
  hair.lineTo(27.2 * s, 24.5 * s);
  hair.lineTo(25.5 * s, 28.8 * s);
  // Flat / slightly rounded square chin
  hair.lineTo(20 * s, 31.2 * s);
  hair.lineTo(12 * s, 31.2 * s);
  hair.lineTo(6.5 * s, 28.8 * s);
  // Left jaw up
  hair.lineTo(4.8 * s, 24.5 * s);
  hair.lineTo(5.2 * s, 20.2 * s);
  hair.closePath();

  // Mouth opening — leaves a gap under the thin moustache
  hair.moveTo(10.5 * s, 18.6 * s);
  hair.ellipse(16 * s, 19.6 * s, 5.4 * s, 1.7 * s, 0, 0, Math.PI * 2);
  hair.closePath();

  // Inner cheek hollow so the jaw reads as a thicker band, not a solid bib.
  // Squarer inset than a U: flat-ish top under the mouth, boxy sides.
  hair.moveTo(9.2 * s, 21.4 * s);
  hair.lineTo(22.8 * s, 21.4 * s);
  hair.lineTo(23.4 * s, 24.8 * s);
  hair.lineTo(21.5 * s, 27.6 * s);
  hair.lineTo(10.5 * s, 27.6 * s);
  hair.lineTo(8.6 * s, 24.8 * s);
  hair.closePath();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = 1.15 * s;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke(hair);

  ctx.fillStyle = "#1a100a";
  ctx.fill(hair, "evenodd");

  // Subtle sheen on the thin moustache
  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.beginPath();
  ctx.ellipse(16 * s, 17.2 * s, 6 * s, 0.7 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
