import { Prisma, PrismaClient } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

 const DEFAULT_RECEIPT_SETTINGS = {
  page: {
    size: 'A4',
    margins: { top: 50, right: 50, bottom: 50, left: 50 },
  },
  currencySymbol: '$',
  currencyPosition: 'before',
  header: {
    show: true,
    text: 'RECEIPT',
    showLogo: true,
    logoMaxWidth: 120,
    logoMaxHeight: 60,
    layout: 'centered',
  },
  storeInfo: {
    show: true,
    showStoreName: true,
    showBranchName: true,
    showAddress: true,
    showPhone: true,
    showEmail: true,
    showVatRegistration: false,
  },
  orderInfo: {
    show: true,
    showSaleNumber: true,
    showSaleType: false,
    showDate: true,
    showCashier: true,
    showServedBy: false,
    showPriceType: false,
  },
  customerInfo: {
    show: true,
    showName: true,
    showPhone: true,
    showEmail: false,
    showRewardPoints: false,
  },
  items: {
    show: true,
    showSku: false,
    showVariantName: true,
    showUnitPrice: true,
    showQuantity: true,
    showDiscount: true,
    discountDisplay: 'total',
    showTax: false,
    taxDisplay: 'total',
    showLineTotal: true,
  },
  totals: {
    show: true,
    showSubtotal: true,
    showDiscount: true,
    showShipping: false,
    showTax: false,
  },
  payment: {
    show: true,
    showBreakdown: false,
    showReceivedAmount: true,
    showChangeAmount: true,
  },
  notes: { show: false },
  footer: {
    showTerms: true,
    termsText: 'Thank you for your purchase! All sales are final. Items must be returned within 7 days with original receipt.',
    showBarcode: true,
    showThankYou: true,
    showPrintDate: true,
  },
  fontSizes: {
    title: 18,
    subtitle: 13,
    heading: 10,
    body: 9,
    small: 7.5,
  },
};

 const DEFAULT_QUOTATION_SETTINGS = {
  ...DEFAULT_RECEIPT_SETTINGS,
  header: {
    show: true,
    text: 'QUOTATION',
    showLogo: true,
    logoMaxWidth: 150,
    logoMaxHeight: 75,
    layout: 'logo-left',
  },
  storeInfo: {
    show: true,
    showStoreName: true,
    showBranchName: true,
    showAddress: true,
    showPhone: true,
    showEmail: true,
    showVatRegistration: true,
  },
  orderInfo: {
    show: true,
    showSaleNumber: true,
    showSaleType: true,
    showDate: true,
    showCashier: true,
    showServedBy: true,
    showPriceType: true,
  },
  customerInfo: {
    show: true,
    showName: true,
    showPhone: true,
    showEmail: true,
    showRewardPoints: false,
  },
  items: {
    show: true,
    showSku: true,
    showVariantName: true,
    showUnitPrice: true,
    showQuantity: true,
    showDiscount: true,
    discountDisplay: 'breakdown',
    showTax: true,
    taxDisplay: 'breakdown',
    showLineTotal: true,
  },
  totals: {
    show: true,
    showSubtotal: true,
    showDiscount: true,
    showShipping: true,
    showTax: true,
  },
  payment: {
    show: false,
    showBreakdown: false,
    showReceivedAmount: false,
    showChangeAmount: false,
  },
  notes: { show: true },
  footer: {
    showTerms: true,
    termsText: 'This quotation is valid for 30 days from the date of issue. Prices are subject to change after expiration.',
    showBarcode: false,
    showThankYou: true,
    showPrintDate: true,
  },
  fontSizes: {
    title: 20,
    subtitle: 14,
    heading: 10,
    body: 9.5,
    small: 8,
  },
};

 const DEFAULT_RETURN_SETTINGS = {
  ...DEFAULT_RECEIPT_SETTINGS,
  header: {
    show: true,
    text: 'RETURN RECEIPT',
    showLogo: true,
    logoMaxWidth: 120,
    logoMaxHeight: 60,
    layout: 'centered',
  },
  orderInfo: {
    show: true,
    showSaleNumber: true,
    showSaleType: true,
    showDate: true,
    showCashier: true,
    showServedBy: false,
    showPriceType: false,
  },
  customerInfo: {
    show: true,
    showName: true,
    showPhone: true,
    showEmail: false,
    showRewardPoints: true,
  },
  items: {
    show: true,
    showSku: false,
    showVariantName: true,
    showUnitPrice: true,
    showQuantity: true,
    showDiscount: false,
    discountDisplay: 'total',
    showTax: true,
    taxDisplay: 'total',
    showLineTotal: true,
  },
  totals: {
    show: true,
    showSubtotal: true,
    showDiscount: false,
    showShipping: false,
    showTax: true,
  },
  payment: {
    show: true,
    showBreakdown: true,
    showReceivedAmount: true,
    showChangeAmount: true,
  },
  notes: { show: true },
  footer: {
    showTerms: true,
    termsText: 'Refunds will be processed within 3-5 business days. Items must be in their original condition with tags attached.',
    showBarcode: true,
    showThankYou: true,
    showPrintDate: true,
  },
};

/* ------------------------------------------------------------------ */
/*  Preset type to default settings mapping                           */
/* ------------------------------------------------------------------ */

export const PRESET_DEFAULTS = {
  receipt: DEFAULT_RECEIPT_SETTINGS,
  quotation: DEFAULT_QUOTATION_SETTINGS,
  return: DEFAULT_RETURN_SETTINGS,
};

async function main() {
  const hash = bcryptjs.hashSync('PosBuzz!234', 10);

  // Super Admin permissions
  const adminPermissions = [
    'plans',
    'show_consumers',
    'add_consumers',
    'modify_consumers',
    'delete_consumers',
    'billing',
    'users',
    'backup&restore',
    'profile',
  ];
  const createdPermissions = await Promise.all(
    adminPermissions.map((action) =>
      prisma.superAdminPermission.upsert({
        where: { action },
        update: {},
        create: { action },
      }),
    ),
  );

  // Create "admin" role with all permissions
  const adminRole = await prisma.superAdminRole.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      permissions: {
        create: createdPermissions.map((perm) => ({
          permission_id: perm.id,
        })),
      },
    },
    include: {
      permissions: true,
    },
  });

  // If updating, ensure permissions are linked
  if (adminRole.permissions.length === 0) {
    await Promise.all(
      createdPermissions.map((perm) =>
        prisma.superAdminRolePermission.upsert({
          where: {
            role_id_permission_id: {
              role_id: adminRole.id,
              permission_id: perm.id,
            },
          },
          update: {},
          create: {
            role_id: adminRole.id,
            permission_id: perm.id,
          },
        }),
      ),
    );
  }

  // Super Admin user
  await prisma.superAdmin.upsert({
    where: { email: 'superadmin@posbuzz.cloud' },
    update: {},
    create: {
      name: 'Root Admin',
      email: 'superadmin@posbuzz.cloud',
      password: hash,
      role_id: adminRole.id,
    },
  });

  // Plans
  // Create only ONE Plan
  const enterprisePlan = await prisma.plan.upsert({
    where: { name: 'Enterprise' },
    update: { price: 50 },
    create: {
      name: 'Enterprise',
      price: 50,
    },
  });

  // Consumer permissions
  const consumerPermissions = [
    'profile',
    'users',
    'product_audit',
    'add_product',
    'edit_product',
    'view_product',
    'delete_product',
    'branches',
    'vendors',
    'inventory_batches',
    'inventory_transfer',
    'inventory_adjustment',
    'customers',
    'sales',
    'quotations',
    'companyProfile',
    'receipt_settings',
  ];
  const permissions = await Promise.all(
    consumerPermissions.map((action) =>
      prisma.permission.upsert({
        where: { action },
        update: {},
        create: { action },
      }),
    ),
  );

  // Map permissions for easier access
  const permissionMap = Object.fromEntries(
    permissions.map((p) => [p.action, p.id]),
  );

  // Assign ALL permissions to the ONLY plan
  await Promise.all(
    consumerPermissions.map((action) =>
      prisma.planPermission.upsert({
        where: {
          plan_id_permission_id: {
            plan_id: enterprisePlan.id,
            permission_id: permissionMap[action],
          },
        },
        update: {},
        create: {
          plan_id: enterprisePlan.id,
          permission_id: permissionMap[action],
        },
      }),
    ),
  );

  // Create Consumer assigned to the only plan
  const consumer1 = await prisma.consumer.upsert({
    where: { subdomain: 'consumer1' },
    update: {
      company_name: 'Possbuzz',
      email: 'consumer@example.com',
      plan_id: enterprisePlan.id,
    },
    create: {
      company_name: 'Possbuzz',
      subdomain: 'consumer1',
      email: 'consumer@example.com',
      plan_id: enterprisePlan.id,
    },
  });

  // Create Main Branch
  const mainBranch = await prisma.branch.upsert({
    where: {
      consumer_id_name: {
        consumer_id: consumer1.id,
        name: 'Main Store',
      },
    },
    update: {
      address: '123 Main Street, Downtown',
      email: 'mainstore@example.com',
      phone: '+1-555-0200',
      vat_registration_number: 'BIN-1234567890',
      is_main: true,
      is_warehouse: false,
    },
    create: {
      consumer_id: consumer1.id,
      name: 'Main Store',
      address: '123 Main Street, Downtown',
      email: 'mainstore@example.com',
      phone: '+1-555-0200',
      vat_registration_number: 'BIN-1234567890',
      is_main: true,
      is_warehouse: false,
    },
  });

  // Create Admin Role for Consumer
  const adminConsumerRole = await prisma.role.upsert({
    where: {
      is_admin: true,
      consumer_id_name: {
        consumer_id: consumer1.id,
        name: 'Admin',
      },
    },
    update: {},
    create: {
      consumer_id: consumer1.id,
      name: 'Admin',
      is_admin: true,
    },
  });

  // Assign all plan permissions to the admin role
  await Promise.all(
    permissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: {
          role_id_permission_id: {
            role_id: adminConsumerRole.id,
            permission_id: permission.id,
          },
        },
        update: {},
        create: {
          role_id: adminConsumerRole.id,
          permission_id: permission.id,
        },
      }),
    ),
  );

  // Create Admin User
  const adminUser = await prisma.user.upsert({
    where: {
      consumer_id_email: {
        consumer_id: consumer1.id,
        email: 'consumer@example.com',
      },
    },
    update: {
      consumer_id: consumer1.id,
      name: 'Consumer Admin',
      password: hash,
      role_id: adminConsumerRole.id,
    },
    create: {
      consumer_id: consumer1.id,
      email: 'consumer@example.com',
      name: 'Consumer Admin',
      password: hash,
      role_id: adminConsumerRole.id,
    },
  });

  // Assign all branches to the admin user

  await prisma.userBranch.createMany({
    data: [
      {
        user_id: adminUser.id,
        branch_id: mainBranch.id,
      },
    ],
    skipDuplicates: true,
  });

  // Initialize default receipt PDF settings for main branch
  const receiptPresets = [
    { name: 'Default Receipt', type: 'receipt' as const },
    { name: 'Default Quotation', type: 'quotation' as const },
    { name: 'Default Return Receipt', type: 'return' as const },
  ];

  for (const preset of receiptPresets) {
    await prisma.receiptPdfSetting.upsert({
      where: {
        consumer_id_branch_id_name_type: {
          consumer_id: consumer1.id,
          branch_id: mainBranch.id,
          name: preset.name,
          type: preset.type,
        },
      },
      update: {
        settings: PRESET_DEFAULTS[
          preset.type
        ] as unknown as Prisma.InputJsonValue,
        is_active: true,
      },
      create: {
        consumer_id: consumer1.id,
        name: preset.name,
        type: preset.type,
        is_active: true,
        settings: PRESET_DEFAULTS[
          preset.type
        ] as unknown as Prisma.InputJsonValue,
        created_by: adminUser.id,
      },
    });
  }

  // Create billing history
  await prisma.billingHistory.upsert({
    where: {
      consumer_id_billing_date: {
        consumer_id: consumer1.id,
        billing_date: new Date(new Date().setUTCHours(0, 0, 0, 0)),
      },
    },
    update: {
      amount: 100.0,
      plan_id: enterprisePlan.id,
      billing_date: new Date(new Date().setUTCHours(0, 0, 0, 0)),
    },
    create: {
      consumer_id: consumer1.id,
      plan_id: enterprisePlan.id,
      amount: 100.0,
      reference: 'Invoice #12345',
      billing_date: new Date(new Date().setUTCHours(0, 0, 0, 0)),
    },
  });

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
