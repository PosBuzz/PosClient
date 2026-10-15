import type { SeededTenant } from './seed';

/** Plausible valid bodies per route, so a request gets past validation and really reaches the service. */
export function bodyFor(
  method: string,
  template: string,
  seed: SeededTenant,
): object {
  const path = template.replace('/api/v1/', '');
  const key = `${method} ${path}`;
  const named = { name: 'hijacked' };
  const rules: Array<[RegExp, object]> = [
    [
      /^PATCH consumer\/(branches|brands|categories|tags|units|vendors|products|promotions)\/:id$/,
      named,
    ],
    [
      /^PATCH consumer\/customers\/:id$/,
      { name: 'hijacked', phone: '01799999999', customer_type: 'individual' },
    ],
    [
      /^PATCH consumer\/operational-costs\/:id$/,
      { name: 'hijacked', amount: 1, incurred_on: '2026-03-14' },
    ],
    [/^PATCH consumer\/users\/roles\/:id$/, named],
    [/^PATCH consumer\/users\/:id$/, { name: 'hijacked' }],
    [/^PATCH consumer\/sales\/:id\/note$/, { notes: 'hijacked' }],
    [/^PATCH consumer\/inventory\/batches\/:id$/, { location: 'hijacked' }],
    [/^PATCH receipt-settings\/:id$/, named],
    [
      /^PATCH consumer\/sales\/online-orders\/:id\/status$/,
      { status: 'CONFIRMED' },
    ],
    [/^POST consumer\/support\/tickets\/:id\/messages$/, { body: 'hijacked' }],
    [
      /^POST consumer\/rewards\/customers\/:id\/adjust$/,
      { customer_id: seed.ids.customer, points: 7, description: 'hijacked' },
    ],
    [
      /^POST consumer\/rewards\/customers\/:id\/redeem$/,
      { customer_id: seed.ids.customer, points: 5 },
    ],
    [
      /^POST consumer\/rewards\/customers\/:id\/process-credit$/,
      { customer_id: seed.ids.customer, amount: 5, sale_id: seed.ids.sale },
    ],
    [
      /^POST consumer\/rewards\/customers\/:id\/process-credit-refund$/,
      { customer_id: seed.ids.customer, amount: 5 },
    ],
    [/^POST receipt-settings\/:id\/copy-to-branch\/:branchId$/, {}],
  ];
  const hit = rules.find(([pattern]) => pattern.test(key));
  return hit ? hit[1] : {};
}
