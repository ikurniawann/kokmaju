// Kartu member layar penuh (owner 2026-10-11): nama, HP, QR member (dipindai
// kasir), total belanja; tutup & keluar akun.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemberCardScreen } from "./member-card-screen";
import type { MemberProfile } from "../api";

afterEach(cleanup);

const member: MemberProfile = {
  id: "8f1c2e7a-0000-4000-8000-000000000001",
  name: "Banu Rusman",
  phone: "085720405305",
  ark_coin_balance: 0,
  ark_rate: 1000,
  total_xp: 1250,
  tier: { code: "gold", name: "Gold", discount_percent: 10 },
  total_spent: 1_250_000,
  visit_count: 14,
  member_since: "2026-03-05T03:00:00.000Z",
};

function renderCard(overrides: Partial<Parameters<typeof MemberCardScreen>[0]> = {}) {
  const props = {
    open: true,
    member,
    brandName: "BCD Coffee",
    arkEnabled: false,
    xpEnabled: true,
    busy: false,
    onClose: vi.fn(),
    onLogout: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<MemberCardScreen {...props} />) };
}

describe("MemberCardScreen", () => {
  it("menampilkan nama, HP, QR member & total belanja", () => {
    const { container } = renderCard();
    expect(screen.getByRole("dialog", { name: "Kartu member" })).toBeTruthy();
    expect(screen.getByText("Banu Rusman")).toBeTruthy();
    expect(screen.getByText("085720405305")).toBeTruthy();
    expect(screen.getByText("GOLD")).toBeTruthy();
    expect(screen.getByText("BCD COFFEE · MEMBER")).toBeTruthy();
    expect(container.querySelector(".mcs-qr svg")).toBeTruthy();
    expect(container.querySelector(".mcs-tag")?.textContent).toMatch(/TOTAL BELANJA.*1\.250\.000.*14 kunjungan/);
    expect(screen.getByText(/Member sejak Maret 2026/)).toBeTruthy();
    expect(screen.getByText("Total XP")).toBeTruthy();
    expect(screen.queryByText("Saldo ARK Coin")).toBeNull();
  });

  it("tutup (X / Escape) & keluar akun", () => {
    const { props } = renderCard();
    fireEvent.click(screen.getByLabelText("Tutup kartu member"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText("Keluar dari akun member"));
    expect(props.onLogout).toHaveBeenCalled();
  });

  it("tidak dirender saat tertutup / tanpa member", () => {
    renderCard({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
    cleanup();
    renderCard({ member: null });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
