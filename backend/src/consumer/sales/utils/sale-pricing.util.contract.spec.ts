import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateTaxAndTotal } from './sale-pricing.util';

// Shared with consumer/src/utils/__contracts__/pricing.contract.test.ts
const rows: {
  id: string;
  price: number;
  qty: number;
  taxPct: number;
  method: string;
  expected: { line_total: number; tax_amount: number };
}[] = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../../../contracts/fixtures/pricing.json'),
    'utf8',
  ),
);

describe('shared pricing fixtures', () => {
  it.each(rows.map((r) => [r.id, r] as const))(
    '[%s] backend line math matches the contract',
    (_id, row) => {
      expect(
        calculateTaxAndTotal(row.price, row.qty, row.taxPct, row.method),
      ).toEqual(row.expected);
    },
  );
});
