-- Portfolio marketing-site CMS, managed from the super admin dashboard.
CREATE TYPE "PortfolioLeadType" AS ENUM ('CONTACT', 'DEMO');
CREATE TYPE "PortfolioLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST');

CREATE TABLE "portfolio_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "site_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "og_image" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "sales_email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "keywords" TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "portfolio_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "portfolio_solutions" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "icon_name" TEXT NOT NULL,
    "badge" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "features" TEXT[],
    "benefits" TEXT[],
    "metric_label" TEXT NOT NULL,
    "metric_value" TEXT NOT NULL,
    "image_key" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "portfolio_solutions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "portfolio_features" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "highlights" TEXT[],
    "icon" TEXT NOT NULL,
    "badge" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "portfolio_features_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "portfolio_pricing_plans" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "badge" TEXT,
    "description" TEXT NOT NULL,
    "price_monthly" DECIMAL(10,2) NOT NULL,
    "price_annual_monthly" DECIMAL(10,2) NOT NULL,
    "is_popular" BOOLEAN NOT NULL DEFAULT false,
    "features" TEXT[],
    "not_included" TEXT[],
    "cta" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "portfolio_pricing_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "portfolio_faqs" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "aeo_summary" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "portfolio_faqs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "portfolio_testimonials" (
    "id" SERIAL NOT NULL,
    "quote" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "metrics" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "portfolio_testimonials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "portfolio_demo_products" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "wholesale_price" DECIMAL(10,2) NOT NULL,
    "category" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "tax" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "serial" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "portfolio_demo_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "portfolio_leads" (
    "id" SERIAL NOT NULL,
    "type" "PortfolioLeadType" NOT NULL,
    "status" "PortfolioLeadStatus" NOT NULL DEFAULT 'NEW',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "business_name" TEXT,
    "industry" TEXT,
    "locations" TEXT,
    "message" TEXT,
    "source_page" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "portfolio_leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "portfolio_solutions_slug_key" ON "portfolio_solutions"("slug");
CREATE UNIQUE INDEX "portfolio_features_slug_key" ON "portfolio_features"("slug");
CREATE UNIQUE INDEX "portfolio_pricing_plans_slug_key" ON "portfolio_pricing_plans"("slug");
CREATE UNIQUE INDEX "portfolio_demo_products_sku_key" ON "portfolio_demo_products"("sku");

CREATE INDEX "portfolio_solutions_is_published_sort_order_idx" ON "portfolio_solutions"("is_published", "sort_order");
CREATE INDEX "portfolio_features_is_published_sort_order_idx" ON "portfolio_features"("is_published", "sort_order");
CREATE INDEX "portfolio_pricing_plans_is_published_sort_order_idx" ON "portfolio_pricing_plans"("is_published", "sort_order");
CREATE INDEX "portfolio_faqs_is_published_sort_order_idx" ON "portfolio_faqs"("is_published", "sort_order");
CREATE INDEX "portfolio_testimonials_is_published_sort_order_idx" ON "portfolio_testimonials"("is_published", "sort_order");
CREATE INDEX "portfolio_demo_products_is_published_sort_order_idx" ON "portfolio_demo_products"("is_published", "sort_order");
CREATE INDEX "portfolio_leads_status_created_at_idx" ON "portfolio_leads"("status", "created_at");
CREATE INDEX "portfolio_leads_type_created_at_idx" ON "portfolio_leads"("type", "created_at");
CREATE INDEX "portfolio_leads_email_idx" ON "portfolio_leads"("email");

-- Super-admin permission gating the whole portfolio CMS + lead inbox.
INSERT INTO "super_admin_permissions" ("action")
VALUES ('portfolio')
ON CONFLICT ("action") DO NOTHING;

INSERT INTO "super_admin_role_permissions" ("role_id", "permission_id")
SELECT role."id", permission."id"
FROM "super_admin_roles" role
CROSS JOIN "super_admin_permissions" permission
WHERE role."name" = 'admin'
  AND permission."action" = 'portfolio'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
