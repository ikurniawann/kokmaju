// OTP self-order beranimasi (owner 2026-10-11): kotak per digit, tempel kode,
// selesai otomatis di digit ke-6, status sukses/salah tercermin di kelas.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OtpInput, sanitizeOtp } from "./otp-input";

afterEach(cleanup);

describe("sanitizeOtp", () => {
  it("hanya angka, maksimal 6 digit (tempel 'Kode: 123 456 7')", () => {
    expect(sanitizeOtp("Kode: 123 456 7")).toBe("123456");
    expect(sanitizeOtp("12a3")).toBe("123");
  });
});

describe("OtpInput", () => {
  it("6 kotak; digit tampil per kotak; selesai otomatis saat 6 digit", () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    const { container, rerender } = render(<OtpInput value="" onChange={onChange} onComplete={onComplete} autoFocus={false} />);
    expect(container.querySelectorAll(".otp-box")).toHaveLength(6);
    fireEvent.change(screen.getByLabelText("Kode OTP 6 digit"), { target: { value: "48 29 15" } });
    expect(onChange).toHaveBeenCalledWith("482915");
    expect(onComplete).toHaveBeenCalledWith("482915");
    rerender(<OtpInput value="482" onChange={onChange} autoFocus={false} />);
    const boxes = container.querySelectorAll(".otp-box");
    expect(boxes[0].textContent).toBe("4");
    expect(boxes[3].textContent).toBe("");
    expect(boxes[3].className).toContain("active");
  });

  it("status sukses/salah: kelas animasi & input terkunci saat memeriksa/sukses", () => {
    const { container, rerender } = render(<OtpInput value="482915" onChange={() => {}} status="verifying" autoFocus={false} />);
    expect(container.querySelector(".otp")?.className).toContain("verifying");
    expect((screen.getByLabelText("Kode OTP 6 digit") as HTMLInputElement).disabled).toBe(true);
    rerender(<OtpInput value="482915" onChange={() => {}} status="success" autoFocus={false} />);
    expect(screen.getByRole("status").textContent).toContain("Berhasil masuk");
    rerender(<OtpInput value="111111" onChange={() => {}} status="error" autoFocus={false} />);
    expect(container.querySelector(".otp")?.className).toContain("error");
    expect((screen.getByLabelText("Kode OTP 6 digit") as HTMLInputElement).disabled).toBe(false);
  });
});
