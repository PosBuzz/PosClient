import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ReceiptPdfSettingService } from '../../src/consumer/receipt-pdf/services/receipt-pdf-setting.service';
import { PRESET_DEFAULTS } from '../../src/consumer/receipt-pdf/preset/receipt-pdf-settings';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';

describe('receipt preset persistence and tenant boundaries', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let service: ReceiptPdfSettingService;
  beforeAll(async () => {
    boot = await bootDomain();
    service = boot.get(ReceiptPdfSettingService);
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  const cid = () => w.tenant.consumer.id;
  const branch = () => w.tenant.branches[0].id;
  const make = (name: string, branchId?: number, isActive = false) =>
    service.createSetting({
      consumerId: cid(),
      branchId,
      name,
      type: 'receipt',
      settings: PRESET_DEFAULTS.receipt,
      isActive,
      createdById: w.tenant.adminUser.id,
    });
  const rejected = async (
    request: Promise<unknown>,
    type:
      | typeof NotFoundException
      | typeof BadRequestException
      | typeof ConflictException,
    message: string,
  ) => {
    const error: any = await request.catch((e) => e);
    expect(error).toBeInstanceOf(type);
    expect(error.getStatus()).toBe(new type().getStatus());
    expect(error.message).toBe(message);
  };

  it('[BE-RSET-100] {ReceiptPdfSettingService.initializeConsumerDefaults} idempotently creates the seven consumer defaults without changing custom JSON', async () => {
    await service.initializeConsumerDefaults(cid(), w.tenant.adminUser.id);
    const defaults = await db.receiptPdfSetting.findMany({
      where: { consumer_id: cid() },
    });
    expect(defaults.map((row) => row.type).sort()).toEqual(
      Object.keys(PRESET_DEFAULTS).sort(),
    );
    expect(
      defaults.every((row) => row.is_active && row.branch_id === null),
    ).toBe(true);
    await db.receiptPdfSetting.update({
      where: { id: defaults[0].id },
      data: { name: 'Customized' },
    });
    await service.initializeConsumerDefaults(cid(), w.tenant.adminUser.id);
    expect(
      await db.receiptPdfSetting.count({ where: { consumer_id: cid() } }),
    ).toBe(7);
    expect(
      await db.receiptPdfSetting.findUniqueOrThrow({
        where: { id: defaults[0].id },
      }),
    ).toMatchObject({ name: 'Customized', settings: defaults[0].settings });
  });

  it('[BE-RSET-101] {ReceiptPdfSettingService.createSetting} {ReceiptPdfSettingService.getActiveSettings} (cross-tenant) resolves branch override, consumer default and preset fallback without reading another shop', async () => {
    expect(await service.getActiveSettings(cid(), 'receipt')).toEqual(
      PRESET_DEFAULTS.receipt,
    );
    const global = await make('Global', undefined, true);
    const local = await service.createSetting({
      consumerId: cid(),
      branchId: branch(),
      name: 'Local',
      type: 'receipt',
      settings: { ...PRESET_DEFAULTS.receipt, paperSize: 'A4' } as any,
      isActive: true,
    });
    expect(
      await db.receiptPdfSetting.findUniqueOrThrow({ where: { id: local.id } }),
    ).toMatchObject({
      consumer_id: cid(),
      branch_id: branch(),
      is_active: true,
    });
    expect(await service.getActiveSettings(cid(), 'receipt', branch())).toEqual(
      local.settings,
    );
    expect(
      await service.getActiveSettings(
        cid(),
        'receipt',
        w.bystander.branches[0].id,
      ),
    ).toEqual(global.settings);
    expect(
      await service.getActiveSettings(
        w.bystander.consumer.id,
        'receipt',
        branch(),
      ),
    ).toEqual(PRESET_DEFAULTS.receipt);
    const count = await db.receiptPdfSetting.count();
    await rejected(
      make('Foreign', w.bystander.branches[0].id),
      NotFoundException,
      'Branch not found',
    );
    await rejected(
      make('Global'),
      ConflictException,
      'A setting with the name "Global" already exists for this consumer and type "receipt". Please choose a different name.',
    );
    expect(await db.receiptPdfSetting.count()).toBe(count);
  });

  it('[BE-RSET-102] {ReceiptPdfSettingService.setActive} {ReceiptPdfSettingService.deactivateSetting} {ReceiptPdfSettingService.deleteSetting} (cross-tenant) activation stays within scope and consumer fallback cannot be removed', async () => {
    const global = await make('Global', undefined, true);
    const first = await make('First', branch(), true);
    const second = await make('Second', branch());
    expect(await service.setActive(second.id, cid())).toMatchObject({
      is_active: true,
    });
    expect(
      await db.receiptPdfSetting.findUniqueOrThrow({ where: { id: first.id } }),
    ).toMatchObject({ is_active: false });
    expect(
      await db.receiptPdfSetting.findUniqueOrThrow({
        where: { id: global.id },
      }),
    ).toMatchObject({ is_active: true });
    expect(await service.deactivateSetting(second.id, cid())).toMatchObject({
      is_active: false,
    });
    await rejected(
      service.deactivateSetting(global.id, cid()),
      BadRequestException,
      'Cannot deactivate the consumer default setting.',
    );
    await rejected(
      service.deleteSetting(global.id, cid()),
      BadRequestException,
      'Cannot delete the active consumer default setting. This is the ultimate fallback for all branches.',
    );
    for (const request of [
      () => service.setActive(first.id, w.bystander.consumer.id),
      () => service.deactivateSetting(first.id, w.bystander.consumer.id),
      () => service.deleteSetting(first.id, w.bystander.consumer.id),
    ]) {
      await rejected(request(), NotFoundException, 'Setting not found');
    }
    expect(await service.deleteSetting(first.id, cid())).toMatchObject({
      id: first.id,
    });
    expect(await db.receiptPdfSetting.count({ where: { id: first.id } })).toBe(
      0,
    );
  });

  it('[BE-RSET-103] {ReceiptPdfSettingService.getSettingById} {ReceiptPdfSettingService.listSettings} {ReceiptPdfSettingService.listAllByType} {ReceiptPdfSettingService.updateSetting} (cross-tenant) list filters and nested updates preserve untouched fields', async () => {
    const global = await make('Global');
    const local = await make('Local', branch(), true);
    expect(await service.getSettingById(local.id, cid())).toMatchObject({
      id: local.id,
      branch: { id: branch() },
      createdBy: { id: w.tenant.adminUser.id },
    });
    expect(
      (await service.listSettings(cid(), 'receipt')).map((row) => row.id),
    ).toEqual([global.id]);
    expect(
      (await service.listSettings(cid(), 'receipt', branch())).map(
        (row) => row.id,
      ),
    ).toEqual([local.id]);
    expect(
      (await service.listAllByType(cid(), 'receipt'))
        .map((row) => row.id)
        .sort(),
    ).toEqual([global.id, local.id].sort());
    expect(
      await service.listSettings(w.bystander.consumer.id, 'receipt', branch()),
    ).toEqual([]);
    expect(
      await service.listAllByType(w.bystander.consumer.id, 'receipt'),
    ).toEqual([]);
    const current: any = global.settings;
    await service.updateSetting(global.id, cid(), {
      name: 'Renamed',
      settings: { header: { ...current.header, showLogo: false } },
    });
    expect(
      await db.receiptPdfSetting.findUniqueOrThrow({
        where: { id: global.id },
      }),
    ).toMatchObject({
      name: 'Renamed',
      settings: { ...current, header: { ...current.header, showLogo: false } },
    });
    await rejected(
      service.getSettingById(global.id, w.bystander.consumer.id),
      NotFoundException,
      'Setting not found',
    );
    await rejected(
      service.updateSetting(global.id, w.bystander.consumer.id, {
        name: 'Hijack',
      }),
      NotFoundException,
      'Setting not found',
    );
    expect(
      await db.receiptPdfSetting.findUniqueOrThrow({
        where: { id: global.id },
      }),
    ).toMatchObject({ name: 'Renamed' });
  });

  it('[BE-RSET-104] {ReceiptPdfSettingService.copyToBranch} (cross-tenant) copies JSON with inactive status and rejects foreign source or target', async () => {
    const source = await make('Source');
    const copy = await service.copyToBranch(
      source.id,
      branch(),
      cid(),
      w.tenant.adminUser.id,
    );
    expect(copy).toMatchObject({
      consumer_id: cid(),
      branch_id: branch(),
      name: 'Source',
      is_active: false,
      settings: source.settings,
    });
    expect(
      await db.receiptPdfSetting.findUniqueOrThrow({ where: { id: copy.id } }),
    ).toMatchObject({ created_by: w.tenant.adminUser.id });
    const count = await db.receiptPdfSetting.count();
    await rejected(
      service.copyToBranch(
        source.id,
        branch(),
        w.bystander.consumer.id,
        w.bystander.adminUser.id,
      ),
      NotFoundException,
      'Source setting not found',
    );
    await rejected(
      service.copyToBranch(
        source.id,
        w.bystander.branches[0].id,
        cid(),
        w.tenant.adminUser.id,
      ),
      NotFoundException,
      'Branch not found',
    );
    expect(await db.receiptPdfSetting.count()).toBe(count);
  });

  it('[BE-RSET-105] {ReceiptPdfSettingService.getBrandingData} {ReceiptPdfSettingService.getConsumerOnlyBrandingData} (cross-tenant) reads owner branding and rejects a foreign branch', async () => {
    await db.consumer.update({
      where: { id: cid() },
      data: { company_name: 'My shop', logo: '/logo.png' },
    });
    await db.branch.update({
      where: { id: branch() },
      data: {
        name: 'My branch',
        address: 'Street',
        phone: '123',
        email: 'shop@example.test',
        vat_registration_number: 'VAT-1',
      },
    });
    expect(await service.getBrandingData(cid(), branch())).toEqual({
      storeName: 'My shop',
      logoPath: '/logo.png',
      branchName: 'My branch',
      branchAddress: 'Street',
      branchPhone: '123',
      branchEmail: 'shop@example.test',
      vatRegistrationNumber: 'VAT-1',
    });
    expect(await service.getConsumerOnlyBrandingData(cid())).toEqual({
      storeName: 'My shop',
      logoPath: '/logo.png',
    });
    await rejected(
      service.getBrandingData(cid(), w.bystander.branches[0].id),
      NotFoundException,
      `Branch ${w.bystander.branches[0].id} not found`,
    );
    await rejected(
      service.getBrandingData(-1, branch()),
      NotFoundException,
      'Consumer -1 not found',
    );
    await rejected(
      service.getConsumerOnlyBrandingData(-1),
      NotFoundException,
      'Consumer -1 not found',
    );
  });
});
