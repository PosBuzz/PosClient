import { ServiceMethod, TestClaim } from './service-inventory';

export type RiskTier = 'A' | 'B' | 'C';

/** Explicit outcome markers are reviewed alongside the assertions; an unmarked title proves only one claim. */
export function depthShortfalls(
  inventory: ServiceMethod[],
  tests: TestClaim[],
  tiers: Record<string, RiskTier>,
): string[] {
  return inventory.flatMap((method) => {
    const key = `${method.service}.${method.method}`;
    const tier = tiers[method.service] ?? 'A';
    const claims = tests.filter((test) => test.tags.includes(key));
    if (tier === 'C') {
      return claims.length ? [] : [`${key}: Tier C needs one subject test`];
    }
    const happy = claims.filter((test) =>
      test.title.includes('(happy-path)'),
    ).length;
    const failure = claims.filter((test) =>
      test.title.includes('(failure)'),
    ).length;
    const requiredFailures = tier === 'A' ? method.throws : 1;
    return happy >= 1 && failure >= requiredFailures
      ? []
      : [
          `${key}: Tier ${tier}, ${method.throws} throws, ${happy} happy-path tests, ${failure}/${requiredFailures} failure tests`,
        ];
  });
}

export function tenantShortfalls(
  inventory: ServiceMethod[],
  tests: TestClaim[],
): string[] {
  return inventory
    .filter(
      (method) =>
        method.consumerId &&
        !tests.some(
          (test) =>
            test.tags.includes(`${method.service}.${method.method}`) &&
            test.title.includes('(cross-tenant)'),
        ),
    )
    .map(
      (method) =>
        `${method.service}.${method.method}: missing (cross-tenant) subject test`,
    );
}
