-- DropForeignKey
ALTER TABLE "BillingHistory" DROP CONSTRAINT "BillingHistory_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "Role" DROP CONSTRAINT "Role_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_consumer_id_fkey";

-- AddForeignKey
ALTER TABLE "BillingHistory" ADD CONSTRAINT "BillingHistory_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "Consumer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "Consumer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "Consumer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
