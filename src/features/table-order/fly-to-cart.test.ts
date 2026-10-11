// Animasi tambah ke keranjang (owner 2026-10-11): tanpa Web Animations /
// kurangi-animasi → langsung bar keranjang memantul + "+1".
import { afterEach, describe, expect, it, vi } from "vitest";
import { flyToCart } from "./fly-to-cart";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("flyToCart", () => {
  it("bar keranjang memantul, jumlah pop, '+1' muncul lalu hilang", () => {
    vi.useFakeTimers();
    const bar = document.createElement("button");
    bar.innerHTML = '<span data-cart-count>3</span> item';
    document.body.appendChild(bar);
    flyToCart({ source: null, image: null, label: "Latte", getTarget: () => bar });
    vi.advanceTimersByTime(80);
    expect(bar.className).toContain("tor-cart-bump");
    expect(bar.querySelector("[data-cart-count]")?.className).toContain("tor-count-pop");
    expect(document.querySelector(".tor-plus-one")?.textContent).toBe("+1");
    vi.advanceTimersByTime(1000);
    expect(document.querySelector(".tor-plus-one")).toBeNull();
  });

  it("bar belum ada (item pertama) tidak error", () => {
    vi.useFakeTimers();
    expect(() => {
      flyToCart({ source: null, image: "/x.jpg", label: "Latte", getTarget: () => null });
      vi.advanceTimersByTime(100);
    }).not.toThrow();
  });
});
