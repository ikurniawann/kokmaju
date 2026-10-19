#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- seeder Node CommonJS, sama seperti seeder lain */
/**
 * Seeder: menu CONTOH Gerobak KoMa (2026-10-19) — supaya kasir mobile
 * (/pos/kasir) bisa langsung dicoba. Menu & harga asli KoMa belum diterima;
 * nama/harga di bawah hanya asumsi gerobak ayam & minuman. Ganti isi MENU
 * dengan menu asli lalu jalankan ulang (produk yang tidak ada di MENU akan
 * dinonaktifkan, bukan dihapus).
 *
 * Diturunkan dari bcdcoffee-menu.js: mengisi item.products + pos.pos_products
 * (tertaut lewat source_product_id, wajib agar POS mau menjual), kategori,
 * dan add-on. Produk dijual dari stall SEED_STALL_CODE (default GEROBAK-01).
 *
 * Usage:
 *   node database/seeders/kokmaju-demo-menu.js
 *   npm run db:seed:kokmaju-demo-menu
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { sslForUrl, assertLocalTarget } = require("../scripts/pg-utils");
const { resolveSeedBusinessScope } = require("../scripts/items-business-scope");

const ROOT = path.join(__dirname, "..", "..");

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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!shellKeys.has(k)) process.env[k] = v;
    }
  }
}

/** Belum ada foto produk KoMa — kartu menu tampil tanpa foto. */
function productImageUrl() {
  return null;
}

/**
 * Urutan kategori = urutan di kasir. `sku` = prefiks SKU produk, `station` =
 * tujuan KDS (kitchen/bar). Harga dalam rupiah — CONTOH, bukan harga asli.
 */
const MENU = [
  {
    code: "AYAM",
    name: "Ayam",
    sku: "AYAM",
    station: "kitchen",
    unit: "PORSI",
    description: "Menu contoh — ganti dengan menu ayam asli KoMa.",
    items: [
      { name: "Ayam Geprek", price: 18000, description: "Ayam goreng tepung digeprek sambal bawang." },
      { name: "Ayam Goreng Kremes", price: 20000, description: "Ayam goreng bumbu kuning dengan kremesan." },
      { name: "Ayam Bakar Madu", price: 22000, description: "Ayam bakar olesan madu, lalapan & sambal." },
      { name: "Nasi Ayam Sambal Matah", price: 22000, description: "Nasi + ayam goreng + sambal matah." },
    ],
  },
  {
    code: "NASI-MIE",
    name: "Nasi & Mie",
    sku: "NASI",
    station: "kitchen",
    unit: "PORSI",
    description: "Menu contoh.",
    items: [
      { name: "Nasi Goreng Ayam", price: 17000 },
      { name: "Mie Goreng Ayam", price: 16000 },
      { name: "Nasi Putih", price: 5000 },
    ],
  },
  {
    code: "CAMILAN",
    name: "Camilan",
    sku: "SNACK",
    station: "kitchen",
    unit: "PORSI",
    description: "Menu contoh.",
    items: [
      { name: "Kulit Ayam Crispy", price: 12000 },
      { name: "Tahu Tempe Goreng", price: 8000 },
      { name: "Kentang Goreng", price: 12000 },
    ],
  },
  {
    code: "MINUMAN",
    name: "Minuman",
    sku: "MINUM",
    station: "bar",
    unit: "CUP",
    description: "Menu contoh.",
    items: [
      { name: "Es Teh Manis", price: 5000 },
      { name: "Es Jeruk", price: 8000 },
      { name: "Kopi Susu Gula Aren", price: 15000 },
      { name: "Air Mineral", price: 4000, unit: "BTL" },
    ],
  },
];

/** Add-on per kategori/produk (satu modifier per grup, opsional). Harga CONTOH. */
const ADDONS = [
  { group: "Tambahan Nasi", modifier: "Extra Nasi", price: 5000, appliesTo: { categories: ["AYAM"] } },
  { group: "Tambahan Sambal", modifier: "Extra Sambal", price: 2000, appliesTo: { categories: ["AYAM", "NASI-MIE"] } },
  { group: "Topping Telur", modifier: "Telur Ceplok", price: 5000, appliesTo: { categories: ["NASI-MIE"] } },
  { group: "Ukuran Es", modifier: "Jumbo", price: 3000, appliesTo: { products: ["Es Teh Manis", "Es Jeruk"] } },
];

const UPSERT_ITEM_PRODUCT_SQL = `
  INSERT INTO item.products
    (kode, nama, deskripsi, kategori, satuan_id, harga_jual, harga_modal, station,
     production_output_type, warehouse_id, company_id, branch_id, is_active)
  VALUES ($1, $2, $3, $4, $5, $6, 0, $10, 'FINISHED_GOOD', $7, $8, $9, true)
  ON CONFLICT (
    COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    warehouse_id,
    kode
  ) WHERE deleted_at IS NULL
  DO UPDATE SET
    nama = EXCLUDED.nama,
    deskripsi = EXCLUDED.deskripsi,
    kategori = EXCLUDED.kategori,
    satuan_id = EXCLUDED.satuan_id,
    harga_jual = EXCLUDED.harga_jual,
    station = EXCLUDED.station,
    is_active = true,
    deleted_at = NULL,
    updated_at = NOW()
  RETURNING id
`;

const UPSERT_POS_PRODUCT_SQL = `
  INSERT INTO pos.pos_products
    (sku, name, description, category_id, base_price, station, source_product_id, image_url, is_active, is_available)
  VALUES ($1, $2, $3, $4, $5, $8, $6, $7, true, true)
  ON CONFLICT (sku) DO UPDATE SET
    name = EXCLUDED.name,
    image_url = EXCLUDED.image_url,
    description = EXCLUDED.description,
    category_id = EXCLUDED.category_id,
    base_price = EXCLUDED.base_price,
    station = EXCLUDED.station,
    source_product_id = EXCLUDED.source_product_id,
    is_active = true,
    is_available = true,
    updated_at = NOW()
  RETURNING id
`;

const STALL_CODE = process.env.SEED_STALL_CODE || "GEROBAK-01";

/** Stall penjual: SEED_STALL_CODE bila ada, selain itu stall aktif pertama cabang. */
async function resolveStall(c, branchId) {
  const { rows } = await c.query(
    `SELECT id, code, name FROM configuration.warehouses
     WHERE branch_id = $1 AND is_active
     ORDER BY (code = $2) DESC, created_at
     LIMIT 1`,
    [branchId, STALL_CODE]
  );
  if (!rows[0]) throw new Error("Belum ada stall/gudang aktif untuk cabang ini.");
  return rows[0];
}

async function unitIds(c) {
  const { rows } = await c.query(`SELECT id, upper(kode) AS kode FROM item.units WHERE upper(kode) IN ('CUP', 'BTL', 'PORSI')`);
  const map = new Map(rows.map((r) => [r.kode, r.id]));
  return { CUP: map.get("CUP") ?? null, BTL: map.get("BTL") ?? null, PORSI: map.get("PORSI") ?? null };
}

/** pos_categories tidak punya kunci unik — cocokkan per nama. */
async function upsertPosCategory(c, name, order) {
  const { rows } = await c.query(`SELECT id FROM pos.pos_categories WHERE lower(name) = lower($1) ORDER BY created_at LIMIT 1`, [name]);
  if (rows[0]) {
    await c.query(
      `UPDATE pos.pos_categories SET name = $2, display_order = $3, is_active = true, parent_id = NULL, updated_at = NOW() WHERE id = $1`,
      [rows[0].id, name, order]
    );
    return rows[0].id;
  }
  const ins = await c.query(
    `INSERT INTO pos.pos_categories (name, display_order, is_active) VALUES ($1, $2, true) RETURNING id`,
    [name, order]
  );
  return ins.rows[0].id;
}

async function upsertModifierGroup(c, group, modifier, price, order) {
  let groupId;
  const { rows } = await c.query(`SELECT id FROM pos.pos_modifier_groups WHERE lower(name) = lower($1) ORDER BY created_at LIMIT 1`, [group]);
  if (rows[0]) {
    groupId = rows[0].id;
    await c.query(
      `UPDATE pos.pos_modifier_groups SET min_selection = 0, max_selection = 1, display_order = $2, is_active = true WHERE id = $1`,
      [groupId, order]
    );
  } else {
    const ins = await c.query(
      `INSERT INTO pos.pos_modifier_groups (name, min_selection, max_selection, display_order, is_active)
       VALUES ($1, 0, 1, $2, true) RETURNING id`,
      [group, order]
    );
    groupId = ins.rows[0].id;
  }
  const mod = await c.query(`SELECT id FROM pos.pos_modifiers WHERE group_id = $1 AND lower(name) = lower($2) LIMIT 1`, [groupId, modifier]);
  if (mod.rows[0]) {
    await c.query(`UPDATE pos.pos_modifiers SET price_adjustment = $2, is_active = true WHERE id = $1`, [mod.rows[0].id, price]);
  } else {
    await c.query(
      `INSERT INTO pos.pos_modifiers (group_id, name, price_adjustment, display_order, is_active) VALUES ($1, $2, $3, 0, true)`,
      [groupId, modifier, price]
    );
  }
  return groupId;
}

async function main() {
  loadEnv();
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("ERROR: Set MIGRATE_DATABASE_URL / DATABASE_URL di .env / .env.local");
    process.exit(1);
  }
  try {
    assertLocalTarget(url, "MIGRATE_DATABASE_URL");
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const c = new Client({ connectionString: url, ssl: sslForUrl(url) });
  await c.connect();
  try {
    await c.query("BEGIN");
    const scope = await resolveSeedBusinessScope(c);
    const stall = await resolveStall(c, scope.branch_id);
    const units = await unitIds(c);
    console.log(`Menu → ${scope.company_name} / ${scope.branch_name} / stall ${stall.name}`);

    const menuSkus = [];
    const menuItemCodes = [];
    const menuCategoryCodes = [];
    const menuPosCategoryIds = [];
    const productIdsByCategory = new Map();
    const productIdsByName = new Map();

    for (const [ci, cat] of MENU.entries()) {
      await c.query(
        `INSERT INTO item.product_categories (code, nama, deskripsi, company_id, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (company_id, code) WHERE deleted_at IS NULL AND company_id IS NOT NULL
         DO UPDATE SET nama = EXCLUDED.nama, deskripsi = EXCLUDED.deskripsi, is_active = true,
                       deleted_at = NULL, updated_at = NOW()`,
        [cat.code, cat.name, cat.description, scope.company_id]
      );
      menuCategoryCodes.push(cat.code);
      const posCategoryId = await upsertPosCategory(c, cat.name, ci + 1);
      menuPosCategoryIds.push(posCategoryId);
      productIdsByCategory.set(cat.code, []);

      for (const [pi, item] of cat.items.entries()) {
        const sku = `KOMA-${cat.sku}-${String(pi + 1).padStart(2, "0")}`;
        const description = item.description ?? null;
        const unitId = units[item.unit ?? cat.unit ?? "PORSI"];
        const { rows } = await c.query(UPSERT_ITEM_PRODUCT_SQL, [
          sku,
          item.name,
          description,
          cat.code,
          unitId,
          item.price,
          stall.id,
          scope.company_id,
          scope.branch_id,
          cat.station,
        ]);
        const itemId = rows[0].id;
        const pos = await c.query(UPSERT_POS_PRODUCT_SQL, [
          sku,
          item.name,
          description,
          posCategoryId,
          item.price,
          itemId,
          productImageUrl(sku),
          cat.station,
        ]);
        const posId = pos.rows[0].id;
        productIdsByCategory.get(cat.code).push(posId);
        productIdsByName.set(item.name, posId);
        menuSkus.push(sku);
        menuItemCodes.push(sku);
        console.log(`  ✓ ${sku.padEnd(16)} ${item.name.padEnd(24)} Rp ${item.price.toLocaleString("id-ID")}`);
      }
    }

    console.log("Add-on:");
    for (const [ai, addon] of ADDONS.entries()) {
      const groupId = await upsertModifierGroup(c, addon.group, addon.modifier, addon.price, ai + 1);
      const targets = new Set();
      for (const code of addon.appliesTo.categories ?? []) {
        for (const id of productIdsByCategory.get(code) ?? []) targets.add(id);
      }
      for (const name of addon.appliesTo.products ?? []) {
        const id = productIdsByName.get(name);
        if (!id) throw new Error(`Add-on "${addon.modifier}" menunjuk produk yang tidak ada: ${name}`);
        targets.add(id);
      }
      // Tautan grup ini disusun ulang persis sesuai menu.
      await c.query(`DELETE FROM pos.pos_product_modifiers WHERE modifier_group_id = $1`, [groupId]);
      for (const productId of targets) {
        await c.query(
          `INSERT INTO pos.pos_product_modifiers (product_id, modifier_group_id) VALUES ($1, $2)
           ON CONFLICT (product_id, modifier_group_id) DO NOTHING`,
          [productId, groupId]
        );
      }
      console.log(`  ✓ ${addon.modifier.padEnd(24)} +Rp ${addon.price.toLocaleString("id-ID")} → ${targets.size} produk`);
    }

    // "Replace": yang tidak ada di menu dinonaktifkan, bukan dihapus.
    const offPos = await c.query(
      `UPDATE pos.pos_products SET is_active = false, is_available = false, updated_at = NOW()
       WHERE is_active AND NOT (sku = ANY($1::text[]))`,
      [menuSkus]
    );
    const offItem = await c.query(
      `UPDATE item.products SET is_active = false, updated_at = NOW()
       WHERE is_active AND company_id = $1 AND production_output_type = 'FINISHED_GOOD'
         AND NOT (kode = ANY($2::text[]))`,
      [scope.company_id, menuItemCodes]
    );
    const offCat = await c.query(
      `UPDATE item.product_categories SET is_active = false, updated_at = NOW()
       WHERE is_active AND company_id = $1 AND NOT (code = ANY($2::text[]))`,
      [scope.company_id, menuCategoryCodes]
    );
    const offPosCat = await c.query(
      `UPDATE pos.pos_categories SET is_active = false, updated_at = NOW()
       WHERE is_active AND NOT (id = ANY($1::uuid[]))`,
      [menuPosCategoryIds]
    );
    const offGroups = await c.query(
      `UPDATE pos.pos_modifier_groups SET is_active = false
       WHERE is_active AND NOT (lower(name) = ANY($1::text[]))`,
      [ADDONS.map((a) => a.group.toLowerCase())]
    );
    console.log(
      `Dinonaktifkan (tidak ada di menu): ${offPos.rowCount} produk POS, ${offItem.rowCount} produk katalog, ` +
        `${offCat.rowCount + offPosCat.rowCount} kategori, ${offGroups.rowCount} grup add-on.`
    );

    await c.query("COMMIT");
    const total = MENU.reduce((n, cat) => n + cat.items.length, 0);
    console.log(`Selesai: ${MENU.length} kategori, ${total} produk, ${ADDONS.length} add-on.`);
  } catch (err) {
    await c.query("ROLLBACK").catch(() => {});
    console.error("GAGAL, semua perubahan di-rollback:", err.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

main();
