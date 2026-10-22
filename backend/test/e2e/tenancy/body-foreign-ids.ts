import type { SeededTenant } from './seed';

type Swap = {
  field: string;
  body: (a: SeededTenant, b: SeededTenant) => object;
};
export type BodyCase = {
  name: string;
  method: 'POST' | 'PATCH';
  path: (a: SeededTenant) => string;
  /** A valid request for tenant A. Must succeed on its own. */
  valid: (a: SeededTenant, n: number) => object;
  /** Set when A has no suitable fixture (the plain request is covered by a B3 scenario). */
  skipControl?: boolean;
  /** The same request with exactly one id swapped for tenant B's. Each must be refused. */
  swaps: Swap[];
};

const line = (a: SeededTenant, over: object = {}) => ({
  variant_id: a.ids.variant,
  quantity: 1,
  unit_price: 100,
  sold_unit_price: 100,
  tax_amount: 5,
  line_total: 105,
  ...over,
});
const sale = (a: SeededTenant, over: object = {}, lineOver: object = {}) => ({
  branch_id: a.ids.branch,
  items: [line(a, lineOver)],
  payments: [{ payment_method: 'CASH', amount: 105 }],
  ...over,
});

export const BODY_CASES: BodyCase[] = [
  {
    name: 'POST /consumer/sales',
    method: 'POST',
    path: () => '/consumer/sales',
    valid: (a) => sale(a),
    swaps: [
      {
        field: 'branch_id',
        body: (a, b) => sale(a, { branch_id: b.ids.branch }),
      },
      {
        field: 'customer_id',
        body: (a, b) => sale(a, { customer_id: b.ids.customer }),
      },
      {
        field: 'served_by_id',
        body: (a, b) => sale(a, { served_by_id: b.ids.user }),
      },
      {
        field: 'quotation_id',
        body: (a, b) => sale(a, { quotation_id: b.ids.quotation }),
      },
      {
        field: 'items[].variant_id',
        body: (a, b) => sale(a, {}, { variant_id: b.ids.variant }),
      },
      {
        field: 'items[].batch_id',
        body: (a, b) => sale(a, {}, { batch_id: b.ids.batch }),
      },
      {
        field: 'applied_promotion_id',
        body: (a, b) => sale(a, { applied_promotion_id: b.ids.promotion }),
      },
    ],
  },
  {
    name: 'POST /consumer/sales (quotation)',
    method: 'POST',
    path: () => '/consumer/sales',
    valid: (a) => sale(a, { sale_type: 'quotation', payments: [] }),
    swaps: [
      {
        field: 'branch_id',
        body: (a, b) =>
          sale(a, {
            sale_type: 'quotation',
            payments: [],
            branch_id: b.ids.branch,
          }),
      },
      {
        field: 'items[].variant_id',
        body: (a, b) =>
          sale(
            a,
            { sale_type: 'quotation', payments: [] },
            { variant_id: b.ids.variant },
          ),
      },
    ],
  },
  {
    name: 'POST /consumer/returns',
    method: 'POST',
    path: () => '/consumer/returns',
    valid: (a) => ({
      original_sale_id: a.ids.sale,
      branch_id: a.ids.branch,
      items: [
        {
          sale_item_id: a.ids.saleItem,
          variant_id: a.ids.variant,
          batch_id: a.ids.batch,
          quantity: 1,
        },
      ],
      payments: [{ payment_method: 'CASH', amount: 105 }],
    }),
    swaps: [
      {
        field: 'original_sale_id',
        body: (a, b) => ({
          original_sale_id: b.ids.sale,
          branch_id: a.ids.branch,
          items: [
            {
              sale_item_id: b.ids.saleItem,
              variant_id: a.ids.variant,
              batch_id: a.ids.batch,
              quantity: 1,
            },
          ],
          payments: [{ payment_method: 'CASH', amount: 105 }],
        }),
      },
      {
        field: 'branch_id',
        body: (a, b) => ({
          original_sale_id: a.ids.sale,
          branch_id: b.ids.branch,
          items: [
            {
              sale_item_id: a.ids.saleItem,
              variant_id: a.ids.variant,
              batch_id: a.ids.batch,
              quantity: 1,
            },
          ],
          payments: [{ payment_method: 'CASH', amount: 105 }],
        }),
      },
      {
        field: 'items[].sale_item_id',
        body: (a, b) => ({
          original_sale_id: a.ids.sale,
          branch_id: a.ids.branch,
          items: [
            {
              sale_item_id: b.ids.saleItem,
              variant_id: a.ids.variant,
              batch_id: a.ids.batch,
              quantity: 1,
            },
          ],
          payments: [{ payment_method: 'CASH', amount: 105 }],
        }),
      },
      {
        field: 'items[].batch_id',
        body: (a, b) => ({
          original_sale_id: a.ids.sale,
          branch_id: a.ids.branch,
          items: [
            {
              sale_item_id: a.ids.saleItem,
              variant_id: a.ids.variant,
              batch_id: b.ids.batch,
              quantity: 1,
            },
          ],
          payments: [{ payment_method: 'CASH', amount: 105 }],
        }),
      },
      {
        field: 'exchanges[].variant_id',
        body: (a, b) => ({
          original_sale_id: a.ids.sale,
          branch_id: a.ids.branch,
          items: [
            {
              sale_item_id: a.ids.saleItem,
              variant_id: a.ids.variant,
              batch_id: a.ids.batch,
              quantity: 1,
            },
          ],
          payments: [{ payment_method: 'EXCHANGE', amount: 105 }],
          exchanges: [
            {
              variant_id: b.ids.variant,
              quantity: 1,
              unit_price: 100,
              line_total: 105,
            },
          ],
        }),
      },
    ],
  },
  {
    name: 'POST /consumer/inventory/transfers',
    method: 'POST',
    path: () => '/consumer/inventory/transfers',
    valid: (a) => ({
      source_branch_id: a.ids.branch,
      destination_branch_id: a.ids.branch2,
      items: [{ batch_id: a.ids.batch, quantity: 1 }],
    }),
    swaps: [
      {
        field: 'source_branch_id',
        body: (a, b) => ({
          source_branch_id: b.ids.branch,
          destination_branch_id: a.ids.branch2,
          items: [{ batch_id: a.ids.batch, quantity: 1 }],
        }),
      },
      {
        field: 'destination_branch_id',
        body: (a, b) => ({
          source_branch_id: a.ids.branch,
          destination_branch_id: b.ids.branch2,
          items: [{ batch_id: a.ids.batch, quantity: 1 }],
        }),
      },
      {
        field: 'items[].batch_id',
        body: (a, b) => ({
          source_branch_id: a.ids.branch,
          destination_branch_id: a.ids.branch2,
          items: [{ batch_id: b.ids.batch, quantity: 1 }],
        }),
      },
    ],
  },
  {
    name: 'POST /consumer/inventory/adjustments',
    method: 'POST',
    path: () => '/consumer/inventory/adjustments',
    valid: (a) => ({
      variant_id: a.ids.variant,
      branch_id: a.ids.branch,
      batch_id: a.ids.batch,
      quantity_change: 1,
      reason: 'count',
    }),
    swaps: [
      {
        field: 'variant_id',
        body: (a, b) => ({
          variant_id: b.ids.variant,
          branch_id: a.ids.branch,
          batch_id: a.ids.batch,
          quantity_change: 1,
          reason: 'count',
        }),
      },
      {
        field: 'branch_id',
        body: (a, b) => ({
          variant_id: a.ids.variant,
          branch_id: b.ids.branch,
          batch_id: a.ids.batch,
          quantity_change: 1,
          reason: 'count',
        }),
      },
      {
        field: 'batch_id',
        body: (a, b) => ({
          variant_id: a.ids.variant,
          branch_id: a.ids.branch,
          batch_id: b.ids.batch,
          quantity_change: 1,
          reason: 'count',
        }),
      },
    ],
  },
  {
    name: 'POST /consumer/inventory/batches',
    method: 'POST',
    path: () => '/consumer/inventory/batches',
    valid: (a, n) => ({
      variant_id: a.ids.variant,
      branch_id: a.ids.branch,
      batch_number: `NB-${n}`,
      quantity: 1,
      cost_price: '1',
    }),
    swaps: [
      {
        field: 'variant_id',
        body: (a, b) => ({
          variant_id: b.ids.variant,
          branch_id: a.ids.branch,
          batch_number: 'X-1',
          quantity: 1,
          cost_price: '1',
        }),
      },
      {
        field: 'branch_id',
        body: (a, b) => ({
          variant_id: a.ids.variant,
          branch_id: b.ids.branch,
          batch_number: 'X-2',
          quantity: 1,
          cost_price: '1',
        }),
      },
      {
        field: 'vendor_id',
        body: (a, b) => ({
          variant_id: a.ids.variant,
          branch_id: a.ids.branch,
          batch_number: 'X-3',
          quantity: 1,
          cost_price: '1',
          vendor_id: b.ids.vendor,
        }),
      },
    ],
  },
  {
    name: 'POST /consumer/products',
    method: 'POST',
    path: () => '/consumer/products',
    valid: (a, n) => ({
      name: `New ${n}`,
      code: `NP${n}`,
      has_variants: false,
      variants: [
        {
          name: 'Default',
          regular_price: '10.00',
          sale_unit_id: a.ids.unit,
          purchase_unit_id: a.ids.unit,
        },
      ],
    }),
    swaps: [
      {
        field: 'category_id',
        body: (a, b) => ({
          name: 'Swap C',
          code: 'SC',
          has_variants: false,
          category_id: b.ids.category,
          variants: [
            {
              name: 'Default',
              regular_price: '10.00',
              sale_unit_id: a.ids.unit,
              purchase_unit_id: a.ids.unit,
            },
          ],
        }),
      },
      {
        field: 'brand_id',
        body: (a, b) => ({
          name: 'Swap B',
          code: 'SB',
          has_variants: false,
          brand_id: b.ids.brand,
          variants: [
            {
              name: 'Default',
              regular_price: '10.00',
              sale_unit_id: a.ids.unit,
              purchase_unit_id: a.ids.unit,
            },
          ],
        }),
      },
      {
        field: 'tag_ids',
        body: (a, b) => ({
          name: 'Swap T',
          code: 'ST',
          has_variants: false,
          tag_ids: [b.ids.tag],
          variants: [
            {
              name: 'Default',
              regular_price: '10.00',
              sale_unit_id: a.ids.unit,
              purchase_unit_id: a.ids.unit,
            },
          ],
        }),
      },
      {
        field: 'variants[].sale_unit_id',
        body: (a, b) => ({
          name: 'Swap U',
          code: 'SU',
          has_variants: false,
          variants: [
            {
              name: 'Default',
              regular_price: '10.00',
              sale_unit_id: b.ids.unit,
              purchase_unit_id: a.ids.unit,
            },
          ],
        }),
      },
    ],
  },
  {
    name: 'POST /consumer/promotions',
    method: 'POST',
    path: () => '/consumer/promotions',
    valid: (a, n) => ({
      name: `Promo ${n}`,
      scope: 'SINGLE_PRODUCT',
      discount_type: 'percentage',
      discount_value: 5,
      start_date: '2026-01-01T00:00:00.000Z',
      variant_ids: [a.ids.variant],
    }),
    swaps: [
      {
        field: 'variant_ids',
        body: (_a, b) => ({
          name: 'Swap V',
          scope: 'SINGLE_PRODUCT',
          discount_type: 'percentage',
          discount_value: 5,
          start_date: '2026-01-01T00:00:00.000Z',
          variant_ids: [b.ids.variant],
        }),
      },
      {
        field: 'branch_ids',
        body: (a, b) => ({
          name: 'Swap BR',
          scope: 'SINGLE_PRODUCT',
          discount_type: 'percentage',
          discount_value: 5,
          start_date: '2026-01-01T00:00:00.000Z',
          variant_ids: [a.ids.variant],
          branch_specific: true,
          branch_ids: [b.ids.branch],
        }),
      },
      {
        field: 'brand_id',
        body: (_a, b) => ({
          name: 'Swap BD',
          scope: 'BRAND',
          discount_type: 'percentage',
          discount_value: 5,
          start_date: '2026-01-01T00:00:00.000Z',
          brand_id: b.ids.brand,
        }),
      },
    ],
  },
  {
    name: 'POST /consumer/users',
    method: 'POST',
    path: () => '/consumer/users',
    valid: (a, n) => ({
      name: 'New Staff',
      email: `staff${n}@example.test`,
      password: 'Passw0rd!x',
      role_id: a.ids.role,
    }),
    swaps: [
      {
        field: 'role_id',
        body: (_a, b) => ({
          name: 'Swap R',
          email: 'swap-r@example.test',
          password: 'Passw0rd!x',
          role_id: b.ids.role,
        }),
      },
      {
        field: 'branch_ids',
        body: (a, b) => ({
          name: 'Swap BR',
          email: 'swap-br@example.test',
          password: 'Passw0rd!x',
          role_id: a.ids.role,
          branch_ids: [b.ids.branch],
        }),
      },
    ],
  },
  {
    name: 'PATCH /consumer/users/:id',
    method: 'PATCH',
    path: (a) => `/consumer/users/${a.ids.user}`,
    valid: () => ({ name: 'Renamed' }),
    swaps: [
      { field: 'role_id', body: (_a, b) => ({ role_id: b.ids.role }) },
      {
        field: 'branch_ids',
        body: (_a, b) => ({ branch_ids: [b.ids.branch] }),
      },
    ],
  },
  {
    name: 'POST /consumer/operational-costs',
    method: 'POST',
    path: () => '/consumer/operational-costs',
    valid: (a) => ({
      name: 'Rent',
      amount: 1,
      incurred_on: '2026-03-14',
      branch_id: a.ids.branch,
    }),
    swaps: [
      {
        field: 'branch_id',
        body: (_a, b) => ({
          name: 'Rent',
          amount: 1,
          incurred_on: '2026-03-14',
          branch_id: b.ids.branch,
        }),
      },
    ],
  },
  {
    name: 'POST /consumer/payments/make-payment',
    skipControl: true,
    method: 'POST',
    path: () => '/consumer/payments/make-payment',
    valid: (a) => ({
      sale_id: a.ids.sale,
      payments: [{ payment_method: 'CASH', amount: 1 }],
    }),
    swaps: [
      {
        field: 'sale_id',
        body: (_a, b) => ({
          sale_id: b.ids.sale,
          payments: [{ payment_method: 'CASH', amount: 1 }],
        }),
      },
    ],
  },
  {
    name: 'POST /consumer/purchase-payments/make-payment',
    skipControl: true,
    method: 'POST',
    path: () => '/consumer/purchase-payments/make-payment',
    valid: () => ({ batch_id: 0, payments: [] }),
    swaps: [
      {
        field: 'batch_id',
        body: (_a, b) => ({
          batch_id: b.ids.batch,
          payments: [{ payment_method: 'CASH', amount: 1 }],
        }),
      },
    ],
  },
  {
    name: 'PATCH /consumer/sales/online-orders/:id/status',
    method: 'PATCH',
    path: (a) => `/consumer/sales/online-orders/${a.ids.onlineSale}/status`,
    valid: (a) => ({
      status: 'CONFIRMED',
      delivery_partner_id: a.ids.deliveryPartner,
    }),
    swaps: [
      {
        field: 'delivery_partner_id',
        body: (_a, b) => ({
          status: 'CONFIRMED',
          delivery_partner_id: b.ids.deliveryPartner,
        }),
      },
    ],
  },
  {
    name: 'POST /consumer/delivery-partners/:id/settlements',
    method: 'POST',
    path: (a) =>
      `/consumer/delivery-partners/${a.ids.deliveryPartner}/settlements`,
    valid: () => ({ direction: 'RECEIVED', amount: 1, payment_method: 'CASH' }),
    swaps: [
      {
        field: 'sale_ids',
        body: (_a, b) => ({
          direction: 'RECEIVED',
          amount: 1,
          payment_method: 'CASH',
          sale_ids: [b.ids.onlineSale],
        }),
      },
    ],
  },
  {
    name: 'POST /consumer/support/tickets/:id/messages',
    method: 'POST',
    path: (a) => `/consumer/support/tickets/${a.ids.ticket}/messages`,
    valid: () => ({ body: 'follow up' }),
    swaps: [],
  },
  {
    name: 'POST /receipt-settings',
    method: 'POST',
    path: () => '/receipt-settings',
    valid: (a, n) => ({
      name: `Receipt ${n}`,
      type: 'receipt',
      branchId: a.ids.branch,
      settings: {},
    }),
    swaps: [
      {
        field: 'branch_id',
        body: (_a, b) => ({
          name: 'Swap',
          type: 'receipt',
          branchId: b.ids.branch,
          settings: {},
        }),
      },
    ],
  },
];
