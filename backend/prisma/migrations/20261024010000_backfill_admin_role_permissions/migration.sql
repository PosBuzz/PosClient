-- Every shop Admin role holds every permission its plan includes, and the
-- built-in super admin admin role holds every admin permission. Roles created
-- before a permission existed, or before a plan gained it, may be missing rows.
-- Insert-only and idempotent: nothing is removed and existing rows are kept.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", pp."permission_id"
FROM "roles" r
JOIN "consumers" c ON c."id" = r."consumer_id"
JOIN "plan_permissions" pp ON pp."plan_id" = c."plan_id"
WHERE r."is_admin" = true
ON CONFLICT DO NOTHING;

INSERT INTO "super_admin_role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "super_admin_roles" r
CROSS JOIN "super_admin_permissions" p
WHERE lower(r."name") = 'admin'
ON CONFLICT DO NOTHING;
