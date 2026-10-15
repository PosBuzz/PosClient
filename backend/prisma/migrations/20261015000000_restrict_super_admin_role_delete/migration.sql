-- A role that still has admin users can no longer be deleted (it used to delete the users with it).
-- DropForeignKey
ALTER TABLE "super_admins" DROP CONSTRAINT "super_admins_role_id_fkey";

-- AddForeignKey
ALTER TABLE "super_admins" ADD CONSTRAINT "super_admins_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "super_admin_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
