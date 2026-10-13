import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootDomain, Boot } from '../../helpers/domain';
import { getPrisma, resetDb, disconnect } from '../../helpers/db';
import { api } from '../../helpers/http';
import { createAdmin, createVendor, resetSequence } from '../../factories';
import { InventoryAdjustmentService } from '../../../src/consumer/inventory/services/inventory-adjustment.service';
import { ReceiptPdfSettingService } from '../../../src/consumer/receipt-pdf/services/receipt-pdf-setting.service';
import { PRESET_DEFAULTS } from '../../../src/consumer/receipt-pdf/preset/receipt-pdf-settings';
import { SupportService } from '../../../src/consumer/support/services/support.service';
import { ProductVariantService } from '../../../src/consumer/product/services/product-variant.service';
import {
  Scenario,
  at,
  buildBusinessDay,
  iso,
} from '../../integration/reports/scenario';
import { normalize } from './normalize';

const DIR = resolve(__dirname, '../../../../contracts/responses');

/** [contract name, who asks, request] for the canonical business day. */
type Call = {
  name: string;
  as: 'tenant' | 'admin';
  path: (s: Scenario) => string;
  atInstant?: string;
};
const CALLS: Call[] = [
  { name: 'auth-client', as: 'tenant', path: () => '/auth/client' },
  {
    name: 'sales-list',
    as: 'tenant',
    path: () => '/consumer/sales?page=1&limit=10',
  },
  {
    name: 'sale-detail',
    as: 'tenant',
    path: (s) => `/consumer/sales/${s.sales.s2.id}`,
  },
  {
    name: 'sale-by-number',
    as: 'tenant',
    path: (s) => `/consumer/sales/search/${s.sales.s4.sale_number}`,
  },
  {
    name: 'products-for-sale',
    as: 'tenant',
    path: (s) => `/consumer/sales/products?branch_id=${s.main.id}`,
  },
  {
    name: 'dashboard',
    as: 'tenant',
    path: () => '/consumer/dashboard/analytics',
    atInstant: iso('16:00'),
  },
  {
    name: 'eod',
    as: 'tenant',
    path: () => '/consumer/sales/reports/eod?date=2026-03-14',
  },
  {
    name: 'user-sales-stats',
    as: 'tenant',
    path: () =>
      '/consumer/sales/user-sales-stats?startDate=2026-03-14&endDate=2026-03-14',
  },
  {
    name: 'variant-sales-stats',
    as: 'tenant',
    path: () =>
      '/consumer/sales/variant-sales-stats?startDate=2026-03-14&endDate=2026-03-14&page=1&limit=20',
  },
  {
    name: 'quotation-detail',
    as: 'tenant',
    path: (s) => `/consumer/sales/quotations/${s.quotation.id}`,
  },
  { name: 'returns-list', as: 'tenant', path: () => '/consumer/returns' },
  {
    name: 'return-detail',
    as: 'tenant',
    path: (s) => `/consumer/returns/${s.returns.r1.id}`,
  },
  {
    name: 'inventory-summary',
    as: 'tenant',
    path: () => '/consumer/inventory/summary',
  },
  {
    name: 'low-stock',
    as: 'tenant',
    path: () => '/consumer/inventory/low-stock',
  },
  {
    name: 'inventory-products',
    as: 'tenant',
    path: () => '/consumer/inventory/products',
  },
  {
    name: 'inventory-variants',
    as: 'tenant',
    path: (s) =>
      `/consumer/inventory/products/${s.p1.variant.product_id}/variants`,
  },
  {
    name: 'inventory-batches',
    as: 'tenant',
    path: () => '/consumer/inventory/batches',
  },
  { name: 'branches', as: 'tenant', path: () => '/consumer/branches' },
  {
    name: 'inventory-expiring',
    as: 'tenant',
    path: () => '/consumer/inventory/expiring',
  },
  {
    name: 'promotions-active',
    as: 'tenant',
    path: (s) => `/consumer/promotions/active/list?branch_id=${s.second.id}`,
  },
  {
    name: 'customer-points',
    as: 'tenant',
    path: (s) => `/consumer/rewards/customers/${s.c1.id}/points`,
  },
  {
    name: 'partial-payments',
    as: 'tenant',
    path: () => '/consumer/payments/partial-sales',
  },
  {
    name: 'plan-permissions',
    as: 'tenant',
    path: () => '/consumer/users/plan-permissions',
  },
  { name: 'auth-admin', as: 'admin', path: () => '/auth/admin' },
  { name: 'admin-consumers', as: 'admin', path: () => '/admin/consumers' },
  { name: 'admin-plans', as: 'admin', path: () => '/admin/plans' },
  {
    name: 'inventory-stock-by-variant',
    as: 'tenant',
    path: () => '/consumer/inventory/stock-by-variant',
  },
  {
    name: 'purchase-payment-batches',
    as: 'tenant',
    path: () => '/consumer/purchase-payments/batches',
  },
  {
    name: 'quotations-list',
    as: 'tenant',
    path: () => '/consumer/sales/quotations/list',
  },
  {
    name: 'daily-target',
    as: 'tenant',
    path: () => '/consumer/sales/reports/daily-target?date=2026-03-14',
  },
  {
    name: 'online-orders-list',
    as: 'tenant',
    path: () => '/consumer/sales/online-orders/list',
  },
  { name: 'products-list', as: 'tenant', path: () => '/consumer/products' },
  {
    name: 'product-detail',
    as: 'tenant',
    path: (s) => `/consumer/products/${s.p1.variant.product_id}`,
  },
  {
    name: 'customer-summary',
    as: 'tenant',
    path: (s) => `/consumer/customers/${s.c1.id}/summary`,
  },
  {
    name: 'online-orders-stats',
    as: 'tenant',
    path: () => '/consumer/sales/online-orders/stats',
  },
  {
    name: 'pending-deliveries',
    as: 'tenant',
    path: () => '/consumer/sales/pending-deliveries/list',
  },
  {
    name: 'inventory-adjustments',
    as: 'tenant',
    path: () => '/consumer/inventory/adjustments',
  },
  {
    name: 'variant-stock',
    as: 'tenant',
    path: (s) => `/consumer/inventory/variants/${s.p1.variant.id}/stock`,
  },
  {
    name: 'movement-history',
    as: 'tenant',
    path: (s) => `/consumer/inventory/movement-history/${s.p1.variant.id}`,
  },
  {
    name: 'product-audit',
    as: 'tenant',
    path: (s) =>
      `/consumer/inventory/audit?variant_id=${s.p1.variant.id}&start_date=2026-02-13&end_date=2026-03-14`,
  },
  { name: 'promotions-list', as: 'tenant', path: () => '/consumer/promotions' },
  {
    name: 'customers-with-points',
    as: 'tenant',
    path: () => '/consumer/rewards/customers',
  },
  { name: 'vendor-detail', as: 'tenant', path: () => '' },
  {
    name: 'receipt-settings-list',
    as: 'tenant',
    path: () => '/receipt-settings/by-type/receipt',
  },
  { name: 'receipt-setting-detail', as: 'tenant', path: () => '' },
  {
    name: 'receipt-defaults',
    as: 'tenant',
    path: () => '/receipt-settings/defaults/receipt',
  },
  {
    name: 'promotion-options',
    as: 'tenant',
    path: () => '/consumer/promotions/options',
  },
  {
    name: 'admin-plan-permissions',
    as: 'admin',
    path: () => '/admin/plans/permissions',
  },
  { name: 'admin-roles', as: 'admin', path: () => '/admin/users/roles' },
  {
    name: 'admin-permissions',
    as: 'admin',
    path: () => '/admin/users/permissions',
  },
  { name: 'admin-users', as: 'admin', path: () => '/admin/users' },
  { name: 'admin-billings', as: 'admin', path: () => '/admin/billing' },
  { name: 'admin-support', as: 'admin', path: () => '/admin/support/tickets' },
  {
    name: 'admin-support-stats',
    as: 'admin',
    path: () => '/admin/support/tickets/stats',
  },
  {
    name: 'admin-support-populated',
    as: 'admin',
    path: () => '/admin/support/tickets',
  },
  {
    name: 'admin-support-detail',
    as: 'admin',
    path: () => '/admin/support/tickets/1',
  },
  {
    name: 'rewards-settings',
    as: 'tenant',
    path: () => '/consumer/rewards/settings',
  },
];

describe('response contracts for the canonical business day', () => {
  it('[BE-CONTRACT-DATE-001] preserves business dates and normalizes only volatile metadata', () => {
    expect(
      normalize({
        billing_till: '2040-01-01T00:00:00.000Z',
        billing_from: '2020-01-01T00:00:00.000Z',
        created_at: '2026-10-13T00:00:00.000Z',
      }),
    ).toEqual({
      billing_till: '2040-01-01T00:00:00.000Z',
      billing_from: '2020-01-01T00:00:00.000Z',
      created_at: '2026-03-14T12:00:00.000Z',
    });
  });
  const db = getPrisma();
  let boot: Boot;
  let live: Record<string, unknown>;

  async function collect(): Promise<Record<string, unknown>> {
    await resetDb();
    resetSequence();
    const scenario = await buildBusinessDay(db, boot);
    const admin = await createAdmin(db);
    const out: Record<string, unknown> = {};
    let vendorId: number;
    let receiptSettingId: number;
    for (const call of CALLS) {
      if (call.name === 'admin-support-populated') {
        await boot
          .get(SupportService)
          .create(scenario.tenant.consumer.id, scenario.tenant.adminUser.id, {
            subject: 'C4 support request',
            category: 'TECHNICAL',
            message: 'Please help with the receipt',
          });
      }
      if (call.name === 'inventory-adjustments') {
        await boot
          .get(InventoryAdjustmentService)
          .create(scenario.tenant.consumer.id, scenario.tenant.adminUser.id, {
            variant_id: scenario.p1.variant.id,
            branch_id: scenario.main.id,
            batch_id: scenario.p1.mainBatch.id,
            quantity_change: 1,
            reason: 'Stock Count Correction',
          });
        // Movement history exposes this DB-generated timestamp as `date`.
        // Pin fixture metadata at its source instead of rewriting business dates.
        await db.inventoryAdjustment.updateMany({
          where: {
            variant: { product: { consumer_id: scenario.tenant.consumer.id } },
          },
          data: { created_at: new Date(iso('16:00')) },
        });
        const vendor = await createVendor(db, {
          consumer_id: scenario.tenant.consumer.id,
          name: 'C4 vendor',
        });
        vendorId = vendor.id;
        await db.inventoryBatch.update({
          where: { id: scenario.p1.mainBatch.id },
          data: { vendor_id: vendor.id },
        });
        const setting = await boot.get(ReceiptPdfSettingService).createSetting({
          consumerId: scenario.tenant.consumer.id,
          name: 'C4 receipt',
          type: 'receipt',
          settings: PRESET_DEFAULTS.receipt,
          isActive: false,
          createdById: scenario.tenant.adminUser.id,
        });
        receiptSettingId = setting.id;
      }
      if (call.name === 'daily-target') {
        await db.productVariant.update({
          where: { id: scenario.p1.variant.id },
          data: { daily_sale_objective: 5 },
        });
      }
      if (call.name === 'online-orders-list') {
        await db.sale.update({
          where: { id: scenario.sales.s6.id },
          data: { is_online_order: true, online_order_status: 'PENDING' },
        });
      }
      const session =
        call.as === 'admin'
          ? api(boot.app).asAdmin(admin)
          : api(boot.app).as(scenario.tenant.adminUser);
      const callPath =
        call.name === 'vendor-detail'
          ? `/consumer/vendors/${vendorId!}/details`
          : call.name === 'receipt-setting-detail'
            ? `/receipt-settings/${receiptSettingId!}`
            : call.path(scenario);
      const send = () => session.get(callPath);
      const response = await (call.atInstant
        ? at(call.atInstant, send)
        : send());
      expect({
        call: call.name,
        status: response.status,
        body:
          response.status === 200
            ? undefined
            : JSON.stringify(response.body).slice(0, 300),
      }).toEqual({
        call: call.name,
        status: 200,
        body: undefined,
      });
      out[call.name] = normalize(response.body);
    }
    return out;
  }

  beforeAll(async () => {
    boot = await bootDomain();
    live = await collect();
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });

  it('[BE-CONTRACT-000] the same scenario produces identical bodies on every run (ids are deterministic)', async () => {
    const again = await collect();
    expect(again).toEqual(live);
  });

  it.each(CALLS.map((c) => [c.name] as const))(
    '[BE-CONTRACT] the live response equals its contracts/responses file: %s',
    (name) => {
      const file = resolve(DIR, `${name}.json`);
      if (process.env.UPDATE_CONTRACTS === '1') {
        mkdirSync(DIR, { recursive: true });
        writeFileSync(file, `${JSON.stringify(live[name], null, 2)}\n`);
      }
      expect({ file: `${name}.json`, exists: existsSync(file) }).toEqual({
        file: `${name}.json`,
        exists: true,
      });
      const committed = JSON.parse(readFileSync(file, 'utf8'));
      if (JSON.stringify(committed) !== JSON.stringify(live[name])) {
        throw new Error(
          `Response contract ${name}.json changed. Review, then run UPDATE_CONTRACTS=1 npm run test:e2e and commit contracts/responses/`,
        );
      }
    },
  );

  it('[BE-CONTRACT-SHAPE] money stays a string, ids stay numbers, and no secret is in any contract', () => {
    const text = JSON.stringify(live);
    expect(text).not.toMatch(/"password"|"refresh_token"|\$2[aby]\$/);
    const sale = live['sale-detail'] as {
      total_amount: unknown;
      id: unknown;
      items: Array<{ line_total: unknown }>;
    };
    expect(typeof sale.total_amount).toBe('string');
    expect(typeof sale.id).toBe('number');
    expect(typeof sale.items[0].line_total).toBe('string');
  });
  it('[BE-CONTRACT-BOOL-001] low-stock flags are boolean at zero and at the exact stock threshold', async () => {
    const product = live['product-detail'] as {
      consumer_id: number;
      variants: Array<{
        id: number;
        total_stock: number;
        is_low_stock: unknown;
      }>;
    };
    const variant = product.variants[0];
    expect(variant.is_low_stock).toBe(false);
    const service = boot.get(ProductVariantService);
    const current = await service.findOne(variant.id, product.consumer_id);
    expect(current.is_low_stock).toBe(false);
    const batches = await db.inventoryBatch.aggregate({
      where: { variant_id: variant.id },
      _sum: { quantity: true },
    });
    expect(current.total_stock).toBe(batches._sum.quantity);
    await db.productVariant.update({
      where: { id: variant.id },
      data: { alert_quantity: current.total_stock },
    });
    expect(
      (await service.findOne(variant.id, product.consumer_id)).is_low_stock,
    ).toBe(true);
    await db.productVariant.update({
      where: { id: variant.id },
      data: { alert_quantity: current.total_stock - 1 },
    });
    expect(
      (await service.findOne(variant.id, product.consumer_id)).is_low_stock,
    ).toBe(false);
    await db.productVariant.update({
      where: { id: variant.id },
      data: { alert_quantity: 0 },
    });
  });
  it('[BE-CONTRACT-TEN-001] variant details reject an explicitly mismatched tenant', async () => {
    const product = live['product-detail'] as {
      consumer_id: number;
      variants: Array<{ id: number }>;
    };
    await expect(
      boot
        .get(ProductVariantService)
        .findOne(product.variants[0].id, product.consumer_id + 1000),
    ).rejects.toMatchObject({ status: 404 });
  });
});
