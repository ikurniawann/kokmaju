import { describe, expect, it } from "vitest";
import { createHangingState, dragAngle, HANGING, isAtRest, stepHanging } from "./hanging-physics";

const run = (state: ReturnType<typeof createHangingState>, seconds: number, held = false) => {
  let s = state;
  for (let t = 0; t < seconds; t += 1 / 60) s = stepHanging(s, 1 / 60, held);
  return s;
};

describe("kartu menggantung", () => {
  it("jatuh dari atas lalu berayun & akhirnya diam", () => {
    const start = createHangingState();
    expect(start.drop.y).toBeLessThan(0);
    const mid = run(start, 0.6);
    expect(Math.abs(mid.drop.y)).toBeLessThan(Math.abs(start.drop.y));
    expect(isAtRest(run(start, 8))).toBe(true);
  });

  it("berayun bolak-balik (melewati titik nol) sebelum diam", () => {
    let s = createHangingState(0, 0.4);
    let crossed = 0;
    for (let i = 0; i < 120; i++) {
      const next = stepHanging(s, 1 / 60);
      if (Math.sign(next.card.angle) !== Math.sign(s.card.angle)) crossed++;
      s = next;
    }
    expect(crossed).toBeGreaterThanOrEqual(2);
  });

  it("tag anak ikut terlempar oleh ayunan kartu", () => {
    const s = run({ card: { angle: 0.4, velocity: 0 }, tag: { angle: 0, velocity: 0 }, drop: { y: 0, vy: 0 } }, 0.2);
    expect(Math.abs(s.tag.angle)).toBeGreaterThan(0.01);
  });

  it("saat ditahan jari, sudut kartu tidak diubah simulasi; sudut dibatasi", () => {
    const held = run({ card: { angle: 0.3, velocity: 0 }, tag: { angle: 0, velocity: 0 }, drop: { y: 0, vy: 0 } }, 0.5, true);
    expect(held.card.angle).toBe(0.3);
    expect(dragAngle(10_000, 300)).toBeLessThanOrEqual(HANGING.maxAngle);
    expect(dragAngle(-60, 300)).toBeLessThan(0);
  });

  it("dt besar (tab tidak aktif) tetap stabil", () => {
    const s = stepHanging(createHangingState(), 5);
    expect(Number.isFinite(s.card.angle)).toBe(true);
    expect(Math.abs(s.card.angle)).toBeLessThanOrEqual(HANGING.maxAngle);
  });
});
