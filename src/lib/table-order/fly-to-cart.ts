/**
 * Lintasan animasi "terbang ke keranjang" self-order (owner 2026-10-11):
 * foto produk melengkung naik lalu turun masuk ke bar keranjang. Murni
 * (tanpa DOM) supaya bisa dites; dipakai features/table-order/fly-to-cart.
 */
export type Point = { x: number; y: number };

/** Titik kendali bezier kuadrat: di tengah, terangkat di atas titik tertinggi. */
export function arcControl(from: Point, to: Point, lift = 0.28): Point {
  const dx = Math.abs(to.x - from.x);
  return {
    x: (from.x + to.x) / 2 + (to.x - from.x) * 0.15,
    y: Math.min(from.y, to.y) - 70 - dx * lift,
  };
}

export function arcPoints(from: Point, to: Point, steps = 16): Point[] {
  const c = arcControl(from, to);
  const n = Math.max(2, Math.floor(steps));
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const d = t * t;
    return { x: a * from.x + b * c.x + d * to.x, y: a * from.y + b * c.y + d * to.y };
  });
}

/**
 * Keyframe Web Animations: posisi = pusat elemen terbang (size px), membesar
 * sedikit di awal ("terangkat") lalu mengecil & memudar saat masuk keranjang.
 */
export function flyKeyframes(from: Point, to: Point, size: number, steps = 16): Keyframe[] {
  const points = arcPoints(from, to, steps);
  const last = points.length - 1;
  return points.map((p, i) => {
    const t = i / last;
    const scale = t < 0.18 ? 1 + (t / 0.18) * 0.18 : 1.18 - ((t - 0.18) / 0.82) * 0.9;
    return {
      offset: t,
      transform: `translate(${(p.x - size / 2).toFixed(1)}px, ${(p.y - size / 2).toFixed(1)}px) scale(${scale.toFixed(3)}) rotate(${(t * 200).toFixed(0)}deg)`,
      opacity: t > 0.88 ? Number((1 - (t - 0.88) / 0.12).toFixed(3)) : 1,
    };
  });
}
