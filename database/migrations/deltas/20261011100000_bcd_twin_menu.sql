-- BCD Twin (owner 2026-10-11): halaman visual 3D coffee shop — tiap divisi
-- (Kasir/POS, Bar & Dapur, Meja, GoFood, Gudang, Procurement, HRD, Marketing,
-- Finance) sebagai area di peta dengan angka live + mode demo.
-- Hanya owner/admin (super_admin, admin).
INSERT INTO iam.menus (code, menu_name, route_path, icon, menu_type, order_number, permission_context, module, level, parent_id, is_visible, is_active)
VALUES ('bcd-twin', 'BCD Twin', '/dashboard/bcd-twin', 'map', 'sidebar', 1,
        '{"actions":["read"]}'::jsonb, 'bcd-twin', 1, NULL, true, true)
ON CONFLICT (code) DO UPDATE SET
  menu_name = EXCLUDED.menu_name,
  route_path = EXCLUDED.route_path,
  icon = EXCLUDED.icon,
  is_active = true,
  deleted_at = NULL,
  updated_at = now();

INSERT INTO iam.role_menu_permissions (role_id, menu_id, granted_actions)
SELECT r.id, m.id, '["read","create","update","delete","approve","export","import","execute"]'::jsonb
FROM iam.roles r
CROSS JOIN iam.menus m
WHERE m.code = 'bcd-twin' AND r.code IN ('super_admin', 'admin')
ON CONFLICT (role_id, menu_id) DO UPDATE SET
  is_active = true,
  granted_actions = EXCLUDED.granted_actions,
  updated_at = now();
