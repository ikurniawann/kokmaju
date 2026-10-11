import { describe, expect, it } from "vitest";
import { matchesCustomerQuery, normalizePhoneDigits } from "./customer-search";

const budi = { name: "Budi Santoso", phone: "081234567890", nfc_uid: "04A1B2C3" };

describe("normalizePhoneDigits", () => {
  it("62 / +62 / spasi / strip → format 08", () => {
    expect(normalizePhoneDigits("+62 812-3456-7890")).toBe("081234567890");
    expect(normalizePhoneDigits("6281234567890")).toBe("081234567890");
    expect(normalizePhoneDigits("0812 3456 7890")).toBe("081234567890");
  });
});

describe("matchesCustomerQuery", () => {
  it("nomor diketik dgn format apa pun tetap ketemu (data tersimpan 08…)", () => {
    for (const q of ["0812", "62812345", "+62 812 3456", "0812-3456-7890", "4567890", " 081234567890 "]) {
      expect(matchesCustomerQuery(budi, q)).toBe(true);
    }
  });

  it("nama tidak peka huruf besar & spasi di ujung; kartu NFC", () => {
    expect(matchesCustomerQuery(budi, "budi ")).toBe(true);
    expect(matchesCustomerQuery(budi, "SANTOSO")).toBe(true);
    expect(matchesCustomerQuery(budi, "04a1")).toBe(true);
  });

  it("tidak cocok → false; kosong → semua", () => {
    expect(matchesCustomerQuery(budi, "0857")).toBe(false);
    expect(matchesCustomerQuery(budi, "andi")).toBe(false);
    expect(matchesCustomerQuery(budi, "  ")).toBe(true);
  });
});

describe("QR kartu member", () => {
  it("isi QR 'BCD-M:<id>' menemukan member tepat (bukan sebagian)", async () => {
    const { memberQrValue } = await import("./customer-search");
    const member = { ...budi, id: "5a1f0000-1111-4222-8333-444455556666" };
    expect(matchesCustomerQuery(member, memberQrValue(member.id))).toBe(true);
    expect(matchesCustomerQuery(member, ` ${memberQrValue(member.id).toUpperCase()} `)).toBe(true);
    expect(matchesCustomerQuery(member, "BCD-M:5a1f")).toBe(false);
    expect(matchesCustomerQuery({ ...member, id: "lain" }, memberQrValue(member.id))).toBe(false);
  });
});
