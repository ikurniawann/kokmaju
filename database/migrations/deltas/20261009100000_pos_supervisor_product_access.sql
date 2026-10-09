-- Owner 2026-10-09: role pos_supervisor (Arip, Riksa) boleh membuka Items →
-- Produk (/dashboard/product/products) untuk MENAMBAH produk. Hak dibatasi
-- read + create (tanpa update/delete). Idempoten.
INSERT INTO iam.role_menu_permissions (role_id, menu_id, granted_actions)
SELECT r.id, m.id, '["read","create"]'::jsonb
FROM iam.roles r
CROSS JOIN iam.menus m
WHERE r.code = 'pos_supervisor'
  AND m.code = 'items.product.master.products'
  AND m.deleted_at IS NULL
ON CONFLICT (role_id, menu_id) DO UPDATE SET
  is_active = true,
  granted_actions = EXCLUDED.granted_actions,
  updated_at = now();

-- Arip: profil (configuration.users.role) = pos_supervisor, tetapi role IAM
-- efektif (iam.user_roles) masih 'pos' — izin dibaca dari user_roles, jadi
-- grant di atas tak berlaku baginya. Samakan dengan profilnya. Grant role
-- pos & pos_supervisor identik (dicek 2026-10-09), jadi akses lain Arip
-- tidak berubah. No-op di database tanpa user ini.
UPDATE iam.user_roles ur
SET role_id = sup.id, assigned_at = now()
FROM configuration.users u, iam.roles pos, iam.roles sup
WHERE ur.user_id = u.id
  AND lower(u.email) = 'arip@bcdcoffee.id'
  AND u.role = 'pos_supervisor'
  AND pos.code = 'pos' AND ur.role_id = pos.id
  AND sup.code = 'pos_supervisor'
  AND NOT EXISTS (
    SELECT 1 FROM iam.user_roles x WHERE x.user_id = u.id AND x.role_id = sup.id
  );
