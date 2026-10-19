#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- seeder Node CommonJS, sama seperti seeder lain */
/**
 * Seeder: akun kasir KoMa — satu akun per gerobak, role POS Cashier ("pos"),
 * dibatasi ke cabang KoMa Pusat & stall gerobaknya. Login dari HP langsung
 * mendarat di kasir mobile (/pos/kasir).
 *
 * Password: KOKMAJU_KASIR_PASSWORD (sama utk semua akun) atau acak per akun
 * (dicetak sekali di konsol). Akun yang sudah ada TIDAK diganti password-nya
 * kecuali --reset-passwords.
 *
 * Usage:
 *   node database/seeders/kokmaju-kasir-users.js [--reset-passwords]
 *   npm run db:seed:kokmaju-kasir
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Client } = require("pg");
const { sslForUrl, assertLocalTarget } = require("../scripts/pg-utils");

const ROOT = path.join(__dirname, "..", "..");
const ROLE = "pos";
const BRANCH_CODE = process.env.SEED_BRANCH_CODE || "KOMA-PUSAT";

// phone wajib di hris.employees — nomor placeholder, ganti di HRIS.
const ACCOUNTS = [
  { email: "kasir1@kokmaju.id", fullName: "Kasir Gerobak 1", stallCode: "GEROBAK-01", nip: "KOMA-K01", phone: "081200000001" },
  // Akun kasir utama permintaan owner (2026-10-19).
  { email: "kasir@kokmaju.id", fullName: "Kasir KoMa", stallCode: "GEROBAK-01", nip: "KOMA-K00", phone: "081200000000" },
];

function loadEnv() {
  const shellKeys = new Set(Object.keys(process.env));
  for (const name of [".env", ".env.local"]) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!shellKeys.has(k)) process.env[k] = v;
    }
  }
}

function randomPassword() {
  return crypto.randomBytes(9).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
}

async function main() {
  loadEnv();
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Set MIGRATE_DATABASE_URL / DATABASE_URL di .env / .env.local");
  assertLocalTarget(url, "MIGRATE_DATABASE_URL");
  const resetPasswords = process.argv.includes("--reset-passwords");
  const fixedPassword = process.env.KOKMAJU_KASIR_PASSWORD || "";

  const c = new Client({ connectionString: url, ssl: sslForUrl(url) });
  await c.connect();
  try {
    await c.query("BEGIN");
    const scope = (
      await c.query(
        `SELECT b.id AS branch_id, b.company_id, co.holding_id
         FROM configuration.branches b JOIN configuration.companies co ON co.id = b.company_id
         WHERE b.code = $1 LIMIT 1`,
        [BRANCH_CODE]
      )
    ).rows[0];
    if (!scope) throw new Error(`Cabang ${BRANCH_CODE} tidak ada — jalankan init-kokmaju-master.sql dulu.`);
    const role = (await c.query(`SELECT id FROM iam.roles WHERE code = $1 AND deleted_at IS NULL LIMIT 1`, [ROLE])).rows[0];
    if (!role) throw new Error(`IAM role "${ROLE}" belum ada — jalankan npm run db:seed:iam dulu.`);

    for (const account of ACCOUNTS) {
      const stall = (
        await c.query(`SELECT id, name FROM configuration.warehouses WHERE branch_id = $1 AND code = $2 LIMIT 1`, [
          scope.branch_id,
          account.stallCode,
        ])
      ).rows[0];
      if (!stall) throw new Error(`Stall ${account.stallCode} tidak ada di ${BRANCH_CODE}.`);

      const meta = JSON.stringify({ role: ROLE, full_name: account.fullName });
      const appMeta = JSON.stringify({ role: ROLE });
      const existing = (await c.query(`SELECT id FROM auth.users WHERE lower(email) = lower($1)`, [account.email])).rows[0];
      let userId = existing?.id;
      let password = null;
      if (!existing || resetPasswords) password = fixedPassword || randomPassword();
      const hash = password ? await bcrypt.hash(password, 10) : null;
      if (existing) {
        await c.query(
          `UPDATE auth.users SET password_hash = COALESCE($1, password_hash), email_verified_at = NOW(), banned_until = NULL,
             raw_user_meta_data = $2::jsonb, raw_app_meta_data = $3::jsonb, updated_at = NOW() WHERE id = $4`,
          [hash, meta, appMeta, userId]
        );
      } else {
        userId = (
          await c.query(
            `INSERT INTO auth.users (email, password_hash, email_verified_at, raw_user_meta_data, raw_app_meta_data)
             VALUES ($1, $2, NOW(), $3::jsonb, $4::jsonb) RETURNING id`,
            [account.email, hash, meta, appMeta]
          )
        ).rows[0].id;
      }

      await c.query(
        `INSERT INTO configuration.users (id, full_name, role, email, status, business_scope, holding_id, company_id, branch_id, default_warehouse_id)
         VALUES ($1, $2, $3, $4, 'active', 'branch', $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, email = EXCLUDED.email,
           status = 'active', business_scope = 'branch', holding_id = EXCLUDED.holding_id, company_id = EXCLUDED.company_id,
           branch_id = EXCLUDED.branch_id, default_warehouse_id = EXCLUDED.default_warehouse_id, updated_at = NOW()`,
        [userId, account.fullName, ROLE, account.email, scope.holding_id, scope.company_id, scope.branch_id, stall.id]
      );
      await c.query(
        `INSERT INTO iam.user_roles (user_id, role_id, is_primary) VALUES ($1, $2, true)
         ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = true`,
        [userId, role.id]
      );
      await c.query(
        `UPDATE configuration.user_warehouses SET is_active = false, updated_at = NOW() WHERE user_id = $1 AND warehouse_id <> $2`,
        [userId, stall.id]
      );
      await c.query(
        `INSERT INTO configuration.user_warehouses (user_id, warehouse_id, is_active) VALUES ($1, $2, true)
         ON CONFLICT (user_id, warehouse_id) DO UPDATE SET is_active = true, updated_at = NOW()`,
        [userId, stall.id]
      );
      const employee = (
        await c.query(`SELECT id FROM hris.employees WHERE user_id = $1 OR lower(email) = lower($2) OR nip = $3 LIMIT 1`, [
          userId,
          account.email,
          account.nip,
        ])
      ).rows[0];
      if (employee) {
        await c.query(
          `UPDATE hris.employees SET user_id = $1, full_name = $2, email = $3, nip = $4, is_active = true, is_access_app = true,
             updated_at = NOW() WHERE id = $5`,
          [userId, account.fullName, account.email, account.nip, employee.id]
        );
      } else {
        await c.query(
          `INSERT INTO hris.employees (user_id, full_name, nip, email, phone, join_date, employment_status, is_active, is_access_app)
           VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'permanent', true, true)`,
          [userId, account.fullName, account.nip, account.email, account.phone]
        );
      }
      console.log(
        `  ✓ ${account.email.padEnd(22)} ${stall.name}${password ? `  password: ${password}` : "  (password tidak diubah)"}`
      );
    }
    await c.query("COMMIT");
  } catch (err) {
    await c.query("ROLLBACK").catch(() => {});
    console.error("GAGAL, semua perubahan di-rollback:", err.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

main();
