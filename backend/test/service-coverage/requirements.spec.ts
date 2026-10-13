import { depthShortfalls, tenantShortfalls } from './requirements';
import { ServiceMethod, TestClaim } from './service-inventory';

describe('risk and tenancy coverage requirements', () => {
  const method: ServiceMethod = {
    service: 'ExampleService',
    method: 'write',
    file: 'src/example.service.ts',
    line: 1,
    throws: 2,
    consumerId: true,
  };
  const claim = (title: string): TestClaim => ({
    title,
    file: 'test/example.int-spec.ts',
    tags: ['ExampleService.write'],
  });
  it('[BE-COV-004] Tier A defaults fail closed and require a happy path and one distinct failure title for every throw', () => {
    expect(
      depthShortfalls(
        [method],
        [claim('(happy-path)'), claim('(failure)')],
        {},
      ),
    ).toEqual([
      'ExampleService.write: Tier A, 2 throws, 1 happy-path tests, 1/2 failure tests',
    ]);
    expect(
      depthShortfalls(
        [method],
        [
          claim('(happy-path)'),
          claim('(failure) first'),
          claim('(failure) second'),
        ],
        {},
      ),
    ).toEqual([]);
  });
  it('[BE-COV-005] Tier B requires both outcomes and Tier C still requires a claimed subject', () => {
    expect(
      depthShortfalls([method], [claim('(happy-path)')], {
        ExampleService: 'B',
      }),
    ).toHaveLength(1);
    expect(
      depthShortfalls([method], [claim('(happy-path)'), claim('(failure)')], {
        ExampleService: 'B',
      }),
    ).toEqual([]);
    expect(depthShortfalls([method], [], { ExampleService: 'C' })).toHaveLength(
      1,
    );
    expect(
      depthShortfalls([method], [claim('plain subject')], {
        ExampleService: 'C',
      }),
    ).toEqual([]);
  });
  it('[BE-COV-006] a foreign-tenant marker must claim the actual method and unscoped methods need no marker', () => {
    expect(tenantShortfalls([method], [claim('plain subject')])).toHaveLength(
      1,
    );
    expect(tenantShortfalls([method], [claim('(cross-tenant)')])).toEqual([]);
    expect(
      tenantShortfalls(
        [method],
        [{ ...claim('(cross-tenant)'), tags: ['Other.read'] }],
      ),
    ).toHaveLength(1);
    expect(tenantShortfalls([{ ...method, consumerId: false }], [])).toEqual(
      [],
    );
  });
});
