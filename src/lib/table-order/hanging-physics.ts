/**
 * Fisika kartu menggantung (kartu member self-order, owner 2026-10-11, ref.
 * "Hanging Cards"): bandul pegas-teredam utk kartu utama, tag anak berayun
 * oleh percepatan sudut induknya, dan pegas jatuh (drop-in) saat dibuka. Murni.
 */

export type Swing = { angle: number; velocity: number };
export type HangingState = { card: Swing; tag: Swing; drop: { y: number; vy: number } };

export const HANGING = {
  stiffness: 14, // pegas sudut kartu (1/s²)
  damping: 1.6, // redaman kartu
  tagStiffness: 22,
  tagDamping: 2.2,
  coupling: 0.9, // seberapa kuat tag "terlempar" oleh percepatan kartu
  dropStiffness: 90,
  dropDamping: 11,
  maxAngle: 0.75, // ±43°
};

export function createHangingState(dropFrom = -900, initialAngle = 0.32): HangingState {
  return { card: { angle: initialAngle, velocity: 0 }, tag: { angle: -initialAngle * 0.6, velocity: 0 }, drop: { y: dropFrom, vy: 0 } };
}

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

/** Satu langkah simulasi; `held` = kartu sedang ditahan jari (sudut dikendalikan luar). */
export function stepHanging(state: HangingState, dt: number, held = false): HangingState {
  const step = Math.min(dt, 1 / 30);
  const { card, tag, drop } = state;
  let cardAccel = 0;
  let nextCard = card;
  if (!held) {
    cardAccel = -HANGING.stiffness * card.angle - HANGING.damping * card.velocity;
    const velocity = card.velocity + cardAccel * step;
    nextCard = { angle: clamp(card.angle + velocity * step, HANGING.maxAngle), velocity };
  }
  const tagAccel = -HANGING.tagStiffness * tag.angle - HANGING.tagDamping * tag.velocity - HANGING.coupling * cardAccel;
  const tagVelocity = tag.velocity + tagAccel * step;
  const nextTag = { angle: clamp(tag.angle + tagVelocity * step, HANGING.maxAngle), velocity: tagVelocity };
  const dropAccel = -HANGING.dropStiffness * drop.y - HANGING.dropDamping * drop.vy;
  const vy = drop.vy + dropAccel * step;
  return { card: nextCard, tag: nextTag, drop: { y: drop.y + vy * step, vy } };
}

/** Sudut kartu saat ditarik jari: geseran horizontal relatif panjang tali+kartu. */
export function dragAngle(dx: number, armLength: number) {
  return clamp(Math.atan2(dx, Math.max(60, armLength)), HANGING.maxAngle);
}

export function isAtRest(state: HangingState) {
  return (
    Math.abs(state.card.angle) < 0.002 &&
    Math.abs(state.card.velocity) < 0.01 &&
    Math.abs(state.tag.angle) < 0.002 &&
    Math.abs(state.drop.y) < 0.5
  );
}
