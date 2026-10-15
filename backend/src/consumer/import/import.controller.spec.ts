import { ForbiddenException } from '@nestjs/common';
import { ConsumerPermission } from '../../auth/enums/consumerPermissions.enum';
import { ImportController } from './import.controller';

const req: any = {
  user: {
    consumer_id: 1,
    id: 2,
    permissions: [ConsumerPermission.customers],
  },
};

describe('ImportController feature switch', () => {
  const original = process.env.IMPORT_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.IMPORT_ENABLED;
    else process.env.IMPORT_ENABLED = original;
  });

  const build = () => {
    const importService: any = {
      assertKnownEntity: jest.fn(),
      columnsFor: jest.fn().mockReturnValue([]),
    };
    return { controller: new ImportController(importService), importService };
  };

  it('[BE-IMPORT-001] reports off unless IMPORT_ENABLED is exactly "true"', () => {
    const { controller } = build();
    delete process.env.IMPORT_ENABLED;
    expect(controller.status()).toEqual({ enabled: false });
    process.env.IMPORT_ENABLED = 'yes';
    expect(controller.status()).toEqual({ enabled: false });
    process.env.IMPORT_ENABLED = 'true';
    expect(controller.status()).toEqual({ enabled: true });
  });

  it('[BE-IMPORT-002] is refused while import is off', () => {
    const { controller, importService } = build();
    delete process.env.IMPORT_ENABLED;
    expect(() => controller.columns('customers', req)).toThrow(
      ForbiddenException,
    );
    expect(importService.columnsFor).not.toHaveBeenCalled();
  });

  it('[BE-IMPORT-003] works again once IMPORT_ENABLED=true', () => {
    const { controller } = build();
    process.env.IMPORT_ENABLED = 'true';
    expect(controller.columns('customers', req)).toEqual({
      entity: 'customers',
      columns: [],
    });
  });
});
