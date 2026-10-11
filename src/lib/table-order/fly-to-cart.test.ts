// Animasi "terbang ke keranjang" self-order (owner 2026-10-11): lintasan
// melengkung dari tombol produk ke bar keranjang.
import { describe, expect, it } from "vitest";
import { arcControl, arcPoints, flyKeyframes } from "./fly-to-cart";

const from = { x: 320, y: 400 };
const to = { x: 200, y: 800 };

describe("fly-to-cart", () => {
  it("lintasan mulai & berakhir tepat di titik asal/keranjang", () => {
    const points = arcPoints(from, to, 10);
    expect(points).toHaveLength(11);
    expect(points[0]).toEqual(from);
    expect(points[10].x).toBeCloseTo(to.x);
    expect(points[10].y).toBeCloseTo(to.y);
  });

  it("melengkung naik dulu (di atas titik asal) sebelum turun ke keranjang", () => {
    expect(arcControl(from, to).y).toBeLessThan(from.y);
    const points = arcPoints(from, to, 20);
    expect(Math.min(...points.map((p) => p.y))).toBeLessThan(from.y);
  });

  it("keyframe: offset 0→1, mengecil & memudar di akhir", () => {
    const frames = flyKeyframes(from, to, 56, 12);
    expect(frames[0].offset).toBe(0);
    expect(frames.at(-1)?.offset).toBe(1);
    expect(frames[0].opacity).toBe(1);
    expect(frames.at(-1)?.opacity).toBe(0);
    expect(String(frames.at(-1)?.transform)).toContain("scale(0.280)");
    expect(String(frames[0].transform)).toContain("translate(292.0px, 372.0px)");
  });
});
