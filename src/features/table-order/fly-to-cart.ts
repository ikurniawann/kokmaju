import { flyKeyframes, type Point } from "@/lib/table-order/fly-to-cart";

const FLY_SIZE = 56;
const FLY_MS = 720;

function prefersReducedMotion() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function center(rect: DOMRect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Putar ulang animasi CSS berbasis kelas (hapus → reflow → pasang). */
export function replayClass(el: Element | null | undefined, className: string) {
  if (!el) return;
  el.classList.remove(className);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(className);
}

function bumpCart(target: HTMLElement | null) {
  if (!target) return;
  replayClass(target, "tor-cart-bump");
  replayClass(target.querySelector("[data-cart-count]"), "tor-count-pop");
  const plus = document.createElement("span");
  plus.className = "tor-plus-one";
  plus.textContent = "+1";
  const rect = target.getBoundingClientRect();
  plus.style.left = `${rect.left + 44}px`;
  plus.style.top = `${rect.top - 4}px`;
  document.body.appendChild(plus);
  window.setTimeout(() => plus.remove(), 900);
}

/**
 * Animasi tambah ke keranjang (owner 2026-10-11): salinan foto produk
 * terbang melengkung dari tombol/foto ke bar keranjang, lalu bar memantul,
 * jumlah item "pop" dan muncul "+1". Bar belum ada (item pertama) → tujuan
 * bawah-tengah layar tempat bar akan muncul. Kurangi-animasi → hanya pantul.
 */
export function flyToCart({
  source,
  image,
  label,
  getTarget,
}: {
  source: HTMLElement | null;
  image: string | null;
  label: string;
  getTarget: () => HTMLElement | null;
}) {
  if (typeof window === "undefined") return;
  navigator.vibrate?.(12);
  const finish = () => bumpCart(getTarget());
  if (!source || prefersReducedMotion() || typeof document.body.animate !== "function") {
    window.setTimeout(finish, 60);
    return;
  }
  const from = center(source.getBoundingClientRect());
  const targetEl = getTarget();
  const to = targetEl
    ? { x: targetEl.getBoundingClientRect().left + 40, y: center(targetEl.getBoundingClientRect()).y }
    : { x: window.innerWidth / 2, y: window.innerHeight - 44 };

  const fly = document.createElement("div");
  fly.className = "tor-fly";
  fly.setAttribute("aria-hidden", "true");
  if (image) fly.style.backgroundImage = `url("${image.replace(/"/g, "%22")}")`;
  else fly.textContent = label.trim().charAt(0).toUpperCase();
  document.body.appendChild(fly);
  const animation = fly.animate(flyKeyframes(from, to, FLY_SIZE), {
    duration: FLY_MS,
    easing: "cubic-bezier(0.45, 0, 0.25, 1)",
    fill: "forwards",
  });
  const done = () => {
    fly.remove();
    finish();
  };
  animation.onfinish = done;
  animation.oncancel = () => fly.remove();
}
