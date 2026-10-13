import { claimsInSource, serviceInventory } from './service-inventory';

describe('service claim discovery', () => {
  it('[BE-COV-007] tenant obligations recognize camelCase and snake_case parameters', () => {
    const inventory = serviceInventory();
    expect(
      inventory.find(
        (item) =>
          item.service === 'ConsumerUsersService' &&
          item.method === 'createRole',
      )?.consumerId,
    ).toBe(true);
    expect(
      inventory.find(
        (item) => item.service === 'SalesService' && item.method === 'create',
      )?.consumerId,
    ).toBe(true);
    expect(
      inventory.find(
        (item) =>
          item.service === 'AdminUsersService' && item.method === 'createRole',
      )?.consumerId,
    ).toBe(false);
  });
  it('[BE-COV-002] discovers multiline parameterized titles and every tag but excludes comments and skipped tests', () => {
    const claims = claimsInSource(
      `
      // it('{Ghost.fake}', () => {});
      it.each([[1], [2]])(
        '[ID] {Example.read} {Example.write} values', () => {}
      );
      test('[ID] {Example.remove} missing', () => {});
      it.skip('[ID] {Ghost.skipped}', () => {});
      test.todo('[ID] {Ghost.todo}');
    `,
      'sample.spec.ts',
    );
    expect(claims.map((claim) => claim.tags)).toEqual([
      ['Example.read', 'Example.write'],
      ['Example.remove'],
    ]);
    expect(claims.every((claim) => claim.file === 'sample.spec.ts')).toBe(true);
  });
  it('[BE-COV-003] consumer and admin user classes have independent inventory identities', () => {
    const users = serviceInventory().filter((item) =>
      item.service.endsWith('UsersService'),
    );
    expect(
      users.some(
        (item) =>
          item.service === 'AdminUsersService' &&
          item.file.startsWith('src/admin/'),
      ),
    ).toBe(true);
    expect(
      users.some(
        (item) =>
          item.service === 'ConsumerUsersService' &&
          item.file.startsWith('src/consumer/'),
      ),
    ).toBe(true);
    expect(users.some((item) => item.service === 'UsersService')).toBe(false);
  });
});
