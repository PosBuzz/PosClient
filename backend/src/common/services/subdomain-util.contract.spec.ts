import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SubdomainUtilService } from './subdomain-util.service';

// Shared with consumer/src/utils/__contracts__/pricing.contract.test.ts
const rows: { id: string; host: string; expected: string | null }[] =
  JSON.parse(
    readFileSync(
      resolve(__dirname, '../../../../contracts/fixtures/subdomains.json'),
      'utf8',
    ),
  );

describe('shared subdomain fixtures', () => {
  const service = new SubdomainUtilService();
  it.each(rows.map((r) => [r.id, r] as const))(
    '[%s] backend host parsing matches the contract',
    (_id, row) => {
      expect(service.extractSubdomainFromHost(row.host)).toBe(row.expected);
    },
  );
});
