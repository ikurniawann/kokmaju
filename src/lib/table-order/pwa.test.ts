// Aplikasi pelanggan PWA (owner 2026-10-11): manifest bisa dipasang,
// scan QR meja → kode meja, panduan pasang khusus iPhone Safari.
import { describe, expect, it } from "vitest";
import { customerAppManifest, needsIosInstallHint, tableCodeFromScan } from "./pwa";

describe("customerAppManifest", () => {
  it("syarat pasang: nama, start_url, standalone, ikon 192 & 512 + maskable", () => {
    const m = customerAppManifest("KoMa");
    expect(m.name).toBe("KoMa");
    expect(m.short_name).toBe("KoMa");
    expect(m.start_url).toBe("/pesan?source=pwa");
    expect(m.scope).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.icons.map((i) => i.sizes)).toEqual(["192x192", "512x512", "512x512"]);
    expect(m.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("nama panjang → short_name kata pertama", () => {
    expect(customerAppManifest("Sulu in Wounderland").short_name).toBe("Sulu");
  });
});

describe("tableCodeFromScan", () => {
  it("URL QR meja → kode", () => {
    expect(tableCodeFromScan("https://poskopi.reddie.id/table-order/wit-office-bdg")).toBe("WIT-OFFICE-BDG");
    expect(tableCodeFromScan("https://tedja.reddie.id/table-order/T%2001?x=1")).toBe("T 01");
  });
  it("kode polos diterima; URL lain / QR member ditolak", () => {
    expect(tableCodeFromScan(" t-05 ")).toBe("T-05");
    expect(tableCodeFromScan("https://evil.example/login")).toBeNull();
    expect(tableCodeFromScan("BCD-M:8f1c2e7a")).toBeNull();
    expect(tableCodeFromScan("")).toBeNull();
  });
});

describe("needsIosInstallHint", () => {
  const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
  it("iPhone Safari belum terpasang → tampil", () => expect(needsIosInstallHint(safari, false)).toBe(true));
  it("sudah terpasang / Chrome iOS / Android → tidak", () => {
    expect(needsIosInstallHint(safari, true)).toBe(false);
    expect(needsIosInstallHint(safari.replace("Version/18.0", "CriOS/129.0"), false)).toBe(false);
    expect(needsIosInstallHint("Mozilla/5.0 (Linux; Android 14) Chrome/129.0 Mobile", false)).toBe(false);
  });
});
