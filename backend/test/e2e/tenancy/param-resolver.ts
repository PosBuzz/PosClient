import type { SeededTenant } from './seed';

type Resolve = (seed: SeededTenant) => string | number;

/** Which resource each path parameter points at. First matching rule wins. */
const RULES: Array<[RegExp, Record<string, Resolve>]> = [
  [/^consumer\/branches\/:id/, { id: (s) => s.ids.branch }],
  [/^consumer\/brands\/:id/, { id: (s) => s.ids.brand }],
  [/^consumer\/categories\/:id/, { id: (s) => s.ids.category }],
  [/^consumer\/tags\/:id/, { id: (s) => s.ids.tag }],
  [/^consumer\/units\/:id/, { id: (s) => s.ids.unit }],
  [/^consumer\/customers\/:id/, { id: (s) => s.ids.customer }],
  [/^consumer\/vendors\/:id/, { id: (s) => s.ids.vendor }],
  [
    /^consumer\/delivery-partners\/:id/,
    {
      id: (s) => s.ids.deliveryPartner,
      settlementId: (s) => s.ids.partnerSettlement,
    },
  ],
  [/^consumer\/products\/:id/, { id: (s) => s.ids.product }],
  [/^consumer\/promotions\/:id/, { id: (s) => s.ids.promotion }],
  [/^consumer\/operational-costs\/:id/, { id: (s) => s.ids.cost }],
  [/^consumer\/support\/tickets\/:id/, { id: (s) => s.ids.ticket }],
  [/^consumer\/users\/roles\/:id/, { id: (s) => s.ids.role }],
  [/^consumer\/users\/:id/, { id: (s) => s.ids.user }],
  [/^consumer\/returns\/:id/, { id: (s) => s.ids.return }],
  [/^consumer\/inventory\/adjustments\/:id/, { id: (s) => s.ids.adjustment }],
  [/^consumer\/inventory\/batches\/:id/, { id: (s) => s.ids.batch }],
  [/^consumer\/inventory\/transfers\/:id/, { id: (s) => s.ids.transfer }],
  [
    /^consumer\/inventory\/movement-history\/:variantId/,
    { variantId: (s) => s.ids.variant },
  ],
  [
    /^consumer\/inventory\/variants\/:variantId/,
    { variantId: (s) => s.ids.variant },
  ],
  [
    /^consumer\/inventory\/products\/:productId/,
    { productId: (s) => s.ids.product },
  ],
  [/^consumer\/payments\/sales\/:id/, { id: (s) => s.ids.sale }],
  [/^consumer\/purchase-payments\/batches\/:id/, { id: (s) => s.ids.batch }],
  [
    /^consumer\/rewards\/customers\/:id/,
    { id: (s) => s.ids.customer, points: () => 10, amount: () => 1 },
  ],
  [/^consumer\/rewards\/redemption-value\/:points/, { points: () => 10 }],
  [/^consumer\/sales\/quotations\/:id/, { id: (s) => s.ids.quotation }],
  [
    /^consumer\/sales\/receipt\/:id/,
    { id: (s) => s.ids.sale, paymentId: (s) => s.ids.payment },
  ],
  [
    /^consumer\/sales\/search\/:saleNumber/,
    { saleNumber: (s) => s.ids.saleNumber },
  ],
  [
    /^consumer\/sales\/user-sales-stats\/:userId/,
    { userId: (s) => s.ids.user },
  ],
  [
    /^consumer\/sales\/variant-sales-stats\/:variantId/,
    { variantId: (s) => s.ids.variant },
  ],
  [
    /^consumer\/sales\/(online-orders|pending-deliveries)\/:id/,
    { id: (s) => s.ids.sale },
  ],
  [/^consumer\/sales\/:id/, { id: (s) => s.ids.sale }],
  [/^consumer\/import\/:entity/, { entity: () => 'customers' }],
  [
    /^receipt-settings\/:id\/copy-to-branch\/:branchId/,
    { id: (s) => s.ids.receiptSetting, branchId: (s) => s.ids.branch2 },
  ],
  [/^receipt-settings\/(by-type|defaults)\/:type/, { type: () => 'receipt' }],
  [/^receipt-settings\/:id/, { id: (s) => s.ids.receiptSetting }],
];

/** Fills a manifest path such as /api/v1/consumer/customers/:id with `seed`'s own ids, or returns null if a param has no mapping. */
export function resolvePath(
  template: string,
  seed: SeededTenant,
): string | null {
  const path = template.replace('/api/v1/', '');
  const rule = RULES.find(([pattern]) => pattern.test(path));
  const names = [...path.matchAll(/:(\w+)/g)].map((m) => m[1]);
  if (!names.length) return `/${path}`;
  if (!rule) return null;
  let missing = false;
  const filled = path.replace(/:(\w+)/g, (_m, name: string) => {
    const resolve = rule[1][name];
    if (!resolve) {
      missing = true;
      return '';
    }
    return String(resolve(seed));
  });
  return missing ? null : `/${filled}`;
}

/** Query string with a value for every filter the list/report routes understand. */
export const QUERY_DEFAULTS = (seed: SeededTenant) =>
  new URLSearchParams({
    branch_id: String(seed.ids.branch),
    page: '1',
    limit: '10',
    date: '2026-03-14',
    start_date: '2020-01-01',
    end_date: '2040-01-01',
    date_from: '2020-01-01T00:00:00.000Z',
    date_to: '2040-01-01T00:00:00.000Z',
    from: '2020-01-01',
    to: '2040-01-01',
    period: 'day',
    search: 'a',
    q: 'a',
  }).toString();
