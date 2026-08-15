-- Separate management analytics from the ability to process sales.
INSERT INTO "permissions" ("action")
VALUES ('business_insights')
ON CONFLICT ("action") DO NOTHING;

-- Make the permission available to roles on every existing plan.
INSERT INTO "plan_permissions" ("plan_id", "permission_id")
SELECT p."id", permission."id"
FROM "plans" p
CROSS JOIN "permissions" permission
WHERE permission."action" = 'business_insights'
ON CONFLICT ("plan_id", "permission_id") DO NOTHING;

-- Preserve owner/admin access without exposing insights to existing staff roles.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role."id", permission."id"
FROM "roles" role
CROSS JOIN "permissions" permission
WHERE role."is_admin" = true
  AND permission."action" = 'business_insights'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
