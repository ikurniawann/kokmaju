// Owner 2026-10-01: member login di self-order melihat harga reguler dicoret
// + harga diskon member; tamu tetap melihat harga biasa.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { normalizeTableOrderProduct } from "@/lib/table-order/menu";
import { MenuItemRow } from "./menu-item-row";

afterEach(cleanup);

const latte = normalizeTableOrderProduct({ id: "latte", name: "Iced Latte", base_price: 28000, station: "bar" });

function renderRow(memberDiscountPercent?: number) {
  return render(
    <MenuItemRow
      product={latte}
      quantity={0}
      locked={false}
      memberDiscountPercent={memberDiscountPercent}
      onAdd={vi.fn()}
      onIncrement={vi.fn()}
      onDecrement={vi.fn()}
    />
  );
}

describe("MenuItemRow — harga member", () => {
  it("member 10%: harga reguler dicoret + harga diskon + badge", () => {
    renderRow(10);
    const regular = screen.getByText(/28[.,]000/);
    expect(regular.className).toContain("line-through");
    expect(screen.getByText(/25[.,]200/)).toBeTruthy();
    expect(screen.getByText("Member −10%")).toBeTruthy();
  });

  it("tamu: hanya harga biasa, tanpa coret", () => {
    renderRow();
    expect(screen.getByText(/28[.,]000/).className).not.toContain("line-through");
    expect(screen.queryByText(/Member −/)).toBeNull();
  });
});

// Owner 2026-10-11: animasi tambah ke keranjang — foto produk jadi titik awal
// terbang, tombol "ditekan", angka stepper pop.
describe("MenuItemRow — animasi tambah", () => {
  it("Tambah & + mengirim elemen foto sebagai sumber animasi", () => {
    const onAdd = vi.fn();
    const onIncrement = vi.fn();
    const props = { product: latte, locked: false, onAdd, onIncrement, onDecrement: vi.fn() };
    const { rerender } = render(<MenuItemRow {...props} quantity={0} />);
    const add = screen.getByRole("button", { name: "Tambah" });
    fireEvent.click(add);
    expect(onAdd.mock.calls[0][0]).toBeInstanceOf(HTMLElement);
    expect(add.className).toContain("tor-add-press");
    rerender(<MenuItemRow {...props} quantity={2} />);
    fireEvent.click(screen.getByLabelText("Tambah Iced Latte"));
    expect(onIncrement.mock.calls[0][0]).toBe(onAdd.mock.calls[0][0]);
    expect(screen.getByText("2").className).toContain("tor-qty");
  });
});
