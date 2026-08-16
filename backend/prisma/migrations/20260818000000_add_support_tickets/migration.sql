-- Support ticketing between consumers and the super admin dashboard.
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "SupportTicketCategory" AS ENUM ('BILLING', 'TECHNICAL', 'FEATURE_REQUEST', 'ACCOUNT', 'OTHER');
CREATE TYPE "SupportAuthorType" AS ENUM ('CONSUMER', 'SUPER_ADMIN');

CREATE TABLE "support_tickets" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "assigned_to_id" INTEGER,
    "subject" TEXT NOT NULL,
    "category" "SupportTicketCategory" NOT NULL DEFAULT 'OTHER',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "last_reply_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_ticket_messages" (
    "id" SERIAL NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "author_type" "SupportAuthorType" NOT NULL,
    "consumer_user_id" INTEGER,
    "super_admin_id" INTEGER,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_tickets_consumer_id_status_idx" ON "support_tickets"("consumer_id", "status");
CREATE INDEX "support_tickets_status_last_reply_at_idx" ON "support_tickets"("status", "last_reply_at");
CREATE INDEX "support_tickets_assigned_to_id_idx" ON "support_tickets"("assigned_to_id");
CREATE INDEX "support_tickets_created_by_id_idx" ON "support_tickets"("created_by_id");
CREATE INDEX "support_ticket_messages_ticket_id_created_at_idx" ON "support_ticket_messages"("ticket_id", "created_at");
CREATE INDEX "support_ticket_messages_consumer_user_id_idx" ON "support_ticket_messages"("consumer_user_id");
CREATE INDEX "support_ticket_messages_super_admin_id_idx" ON "support_ticket_messages"("super_admin_id");

ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_consumer_user_id_fkey" FOREIGN KEY ("consumer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_super_admin_id_fkey" FOREIGN KEY ("super_admin_id") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Consumer-side permission: who inside a tenant may raise and answer tickets.
INSERT INTO "permissions" ("action")
VALUES ('support')
ON CONFLICT ("action") DO NOTHING;

INSERT INTO "plan_permissions" ("plan_id", "permission_id")
SELECT p."id", permission."id"
FROM "plans" p
CROSS JOIN "permissions" permission
WHERE permission."action" = 'support'
ON CONFLICT ("plan_id", "permission_id") DO NOTHING;

-- Owner/admin roles get it immediately; other staff roles stay unchanged.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role."id", permission."id"
FROM "roles" role
CROSS JOIN "permissions" permission
WHERE role."is_admin" = true
  AND permission."action" = 'support'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Super-admin-side permission: who may work the support queue.
INSERT INTO "super_admin_permissions" ("action")
VALUES ('support')
ON CONFLICT ("action") DO NOTHING;

INSERT INTO "super_admin_role_permissions" ("role_id", "permission_id")
SELECT role."id", permission."id"
FROM "super_admin_roles" role
CROSS JOIN "super_admin_permissions" permission
WHERE role."name" = 'admin'
  AND permission."action" = 'support'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
