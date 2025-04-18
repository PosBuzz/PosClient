/*
  Warnings:

  - A unique constraint covering the columns `[consumer_id,name]` on the table `Role` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `SuperAdminRole` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Role_consumer_id_name_key" ON "Role"("consumer_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdminRole_name_key" ON "SuperAdminRole"("name");
