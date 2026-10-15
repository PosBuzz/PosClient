import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PRESET_DEFAULTS } from '../preset/receipt-pdf-settings';
import { ReceiptPdfSettingService } from './receipt-pdf-setting.service';

const PRESETS = [
  ['Default Receipt', 'receipt'],
  ['Default Quotation', 'quotation'],
  ['Default Return Receipt', 'return'],
  ['Default Delivery Chalan', 'chalan'],
  ['Default Money Receipt', 'money_receipt'],
  ['Default Delivery Slip', 'delivery_slip'],
  ['Default Online Delivery Slip', 'online_delivery_slip'],
  ['Default Transfer Slip', 'transfer_slip'],
  ['Default Transfer Chalan', 'transfer_chalan'],
] as const;

function setup() {
  const prisma: any = {
    consumer: { findMany: jest.fn(), findUnique: jest.fn() },
    branch: { findFirst: jest.fn() },
    receiptPdfSetting: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
  };
  return { prisma, service: new ReceiptPdfSettingService(prisma) };
}

const include = {
  createdBy: { select: { id: true, name: true, email: true } },
  branch: { select: { id: true, name: true } },
};

describe('ReceiptPdfSettingService (unit)', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('defaults', () => {
    it('[BE-MUT-220] startup backfill creates every missing default only for live consumers', async () => {
      const { prisma, service } = setup();
      prisma.consumer.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      prisma.receiptPdfSetting.findMany.mockImplementation(({ where }: any) =>
        where.consumer_id === 1 ? [{ type: 'receipt' }] : [],
      );
      await service.onModuleInit();
      expect(prisma.consumer.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
        select: { id: true },
      });
      expect(prisma.receiptPdfSetting.findMany).toHaveBeenCalledWith({
        where: { consumer_id: 1, branch_id: null },
        select: { type: true },
      });
      const created = prisma.receiptPdfSetting.create.mock.calls.map(
        ([a]: any) => a.data,
      );
      expect(created.filter((d: any) => d.consumer_id === 1)).toHaveLength(8);
      expect(
        created.find((d: any) => d.consumer_id === 1 && d.type === 'receipt'),
      ).toBeUndefined();
      expect(created.filter((d: any) => d.consumer_id === 2)).toHaveLength(9);
    });

    it('[BE-MUT-221] each default has a pinned name, type, active flag, preset JSON and no branch', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.findMany.mockResolvedValue([]);
      await service.initializeConsumerDefaults(5, 77);
      const calls = prisma.receiptPdfSetting.create.mock.calls.map(
        ([a]: any) => a,
      );
      expect(calls).toEqual(
        PRESETS.map(([name, type]) => ({
          data: {
            consumer_id: 5,
            branch_id: null,
            name,
            type,
            is_active: true,
            settings: PRESET_DEFAULTS[type],
            created_by: 77,
          },
        })),
      );
    });

    it('[BE-MUT-222] initialization uses the supplied transaction client and logs success', async () => {
      const { prisma, service } = setup();
      const tx = {
        receiptPdfSetting: {
          findMany: jest
            .fn()
            .mockResolvedValue(PRESETS.map(([, type]) => ({ type }))),
          create: jest.fn(),
        },
      };
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      await service.initializeConsumerDefaults(5, 77, tx);
      expect(tx.receiptPdfSetting.findMany).toHaveBeenCalledTimes(1);
      expect(tx.receiptPdfSetting.create).not.toHaveBeenCalled();
      expect(prisma.receiptPdfSetting.findMany).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(
        'Initialized default receipt settings for consumer 5',
      );
    });

    it('[BE-MUT-223] initialization and startup failures are logged with their stack and never thrown', async () => {
      const { prisma, service } = setup();
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const boom = new Error('db down');
      prisma.receiptPdfSetting.findMany.mockRejectedValue(boom);
      await expect(
        service.initializeConsumerDefaults(5, 77),
      ).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledWith(
        'Failed to initialize receipt settings for consumer 5',
        boom.stack,
      );
      error.mockClear();
      prisma.consumer.findMany.mockRejectedValue(boom);
      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledWith(
        'Failed to backfill missing receipt settings',
        boom.stack,
      );
    });
  });

  describe('getActiveSettings', () => {
    it('[BE-MUT-224] an active branch setting wins over the consumer default', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.findFirst.mockResolvedValueOnce({
        settings: { from: 'branch' },
      });
      await expect(service.getActiveSettings(1, 'receipt', 8)).resolves.toEqual(
        { from: 'branch' },
      );
      expect(prisma.receiptPdfSetting.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.receiptPdfSetting.findFirst).toHaveBeenCalledWith({
        where: {
          consumer_id: 1,
          branch_id: 8,
          type: 'receipt',
          is_active: true,
        },
      });
    });

    it('[BE-MUT-225] without a branch the consumer default is used and the branch is never queried', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.findFirst.mockResolvedValue({
        settings: { from: 'consumer' },
      });
      await expect(service.getActiveSettings(1, 'quotation')).resolves.toEqual({
        from: 'consumer',
      });
      expect(prisma.receiptPdfSetting.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.receiptPdfSetting.findFirst).toHaveBeenCalledWith({
        where: {
          consumer_id: 1,
          branch_id: null,
          type: 'quotation',
          is_active: true,
        },
      });
    });

    it('[BE-MUT-226] a branch without its own setting falls back to the consumer default, then to the built-in preset', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ settings: { from: 'consumer' } });
      await expect(service.getActiveSettings(1, 'receipt', 8)).resolves.toEqual(
        { from: 'consumer' },
      );
      prisma.receiptPdfSetting.findFirst.mockResolvedValue(null);
      await expect(service.getActiveSettings(1, 'chalan', 8)).resolves.toBe(
        PRESET_DEFAULTS.chalan,
      );
    });
  });

  describe('branding', () => {
    it('[BE-MUT-227] branding combines company and branch columns, scoped to the tenant', async () => {
      const { prisma, service } = setup();
      prisma.consumer.findUnique.mockResolvedValue({
        company_name: 'Shop',
        logo: 'l.png',
      });
      prisma.branch.findFirst.mockResolvedValue({
        name: 'Main',
        address: 'Road',
        phone: '123',
        email: 'b@x.io',
        vat_registration_number: 'VAT1',
      });
      await expect(service.getBrandingData(1, 2)).resolves.toEqual({
        storeName: 'Shop',
        logoPath: 'l.png',
        branchName: 'Main',
        branchAddress: 'Road',
        branchPhone: '123',
        branchEmail: 'b@x.io',
        vatRegistrationNumber: 'VAT1',
      });
      expect(prisma.consumer.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { company_name: true, logo: true },
      });
      expect(prisma.branch.findFirst).toHaveBeenCalledWith({
        where: { id: 2, consumer_id: 1 },
        select: {
          name: true,
          address: true,
          phone: true,
          email: true,
          vat_registration_number: true,
        },
      });
    });

    it('[BE-MUT-228] missing optional branding columns become empty strings, not null', async () => {
      const { prisma, service } = setup();
      prisma.consumer.findUnique.mockResolvedValue({
        company_name: 'Shop',
        logo: null,
      });
      prisma.branch.findFirst.mockResolvedValue({
        name: 'Main',
        address: null,
        phone: null,
        email: null,
        vat_registration_number: null,
      });
      await expect(service.getBrandingData(1, 2)).resolves.toEqual({
        storeName: 'Shop',
        logoPath: '',
        branchName: 'Main',
        branchAddress: '',
        branchPhone: '',
        branchEmail: '',
        vatRegistrationNumber: '',
      });
      await expect(service.getConsumerOnlyBrandingData(1)).resolves.toEqual({
        storeName: 'Shop',
        logoPath: '',
      });
    });

    it('[BE-MUT-229] an unknown consumer or branch is a 404 naming the id', async () => {
      const { prisma, service } = setup();
      prisma.consumer.findUnique.mockResolvedValue(null);
      prisma.branch.findFirst.mockResolvedValue({ name: 'x' });
      await expect(service.getBrandingData(1, 2)).rejects.toThrow(
        new NotFoundException('Consumer 1 not found'),
      );
      await expect(service.getConsumerOnlyBrandingData(1)).rejects.toThrow(
        new NotFoundException('Consumer 1 not found'),
      );
      prisma.consumer.findUnique.mockResolvedValue({ company_name: 'S' });
      prisma.branch.findFirst.mockResolvedValue(null);
      await expect(service.getBrandingData(1, 2)).rejects.toThrow(
        new NotFoundException('Branch 2 not found'),
      );
    });
  });

  describe('createSetting', () => {
    const base = {
      consumerId: 1,
      name: 'Mine',
      type: 'receipt' as const,
      settings: { a: 1 } as any,
    };

    it('[BE-MUT-230] a new inactive consumer-level setting is stored without touching the active one', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.findFirst.mockResolvedValue(null);
      prisma.receiptPdfSetting.create.mockResolvedValue({ id: 9 });
      await expect(
        service.createSetting({ ...base, createdById: 3 }),
      ).resolves.toEqual({ id: 9 });
      expect(prisma.branch.findFirst).not.toHaveBeenCalled();
      expect(prisma.receiptPdfSetting.updateMany).not.toHaveBeenCalled();
      expect(prisma.receiptPdfSetting.findFirst).toHaveBeenCalledWith({
        where: {
          consumer_id: 1,
          branch_id: null,
          type: 'receipt',
          name: 'Mine',
        },
      });
      expect(prisma.receiptPdfSetting.create).toHaveBeenCalledWith({
        data: {
          consumer_id: 1,
          branch_id: null,
          name: 'Mine',
          type: 'receipt',
          settings: { a: 1 },
          is_active: false,
          created_by: 3,
        },
      });
    });

    it('[BE-MUT-231] activating a new setting first deactivates the active one of the same scope and type', async () => {
      const { prisma, service } = setup();
      prisma.branch.findFirst.mockResolvedValue({ id: 4 });
      prisma.receiptPdfSetting.findFirst.mockResolvedValue(null);
      prisma.receiptPdfSetting.create.mockResolvedValue({ id: 9 });
      await service.createSetting({ ...base, branchId: 4, isActive: true });
      expect(prisma.branch.findFirst).toHaveBeenCalledWith({
        where: { id: 4, consumer_id: 1 },
        select: { id: true },
      });
      expect(prisma.receiptPdfSetting.updateMany).toHaveBeenCalledWith({
        where: {
          consumer_id: 1,
          branch_id: 4,
          type: 'receipt',
          is_active: true,
        },
        data: { is_active: false },
      });
      expect(
        prisma.receiptPdfSetting.updateMany.mock.invocationCallOrder[0],
      ).toBeLessThan(
        prisma.receiptPdfSetting.create.mock.invocationCallOrder[0],
      );
      expect(
        prisma.receiptPdfSetting.create.mock.calls[0][0].data,
      ).toMatchObject({ branch_id: 4, is_active: true });
    });

    it('[BE-MUT-232] another shop branch is a 404, and a taken name is a 409 that names scope and type', async () => {
      const { prisma, service } = setup();
      prisma.branch.findFirst.mockResolvedValue(null);
      await expect(
        service.createSetting({ ...base, branchId: 4 }),
      ).rejects.toThrow(new NotFoundException('Branch not found'));
      expect(prisma.receiptPdfSetting.create).not.toHaveBeenCalled();

      prisma.branch.findFirst.mockResolvedValue({ id: 4 });
      prisma.receiptPdfSetting.findFirst.mockResolvedValue({ id: 1 });
      await expect(
        service.createSetting({ ...base, branchId: 4, isActive: true }),
      ).rejects.toThrow(
        new ConflictException(
          'A setting with the name "Mine" already exists for this branch and type "receipt". Please choose a different name.',
        ),
      );
      await expect(service.createSetting(base)).rejects.toThrow(
        'already exists for this consumer and type "receipt"',
      );
      expect(prisma.receiptPdfSetting.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('activation', () => {
    it('[BE-MUT-233] setActive switches the active setting inside the same scope and type', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.findFirst.mockResolvedValue({
        id: 5,
        branch_id: 4,
        type: 'quotation',
      });
      prisma.receiptPdfSetting.update.mockResolvedValue({ id: 5 });
      await expect(service.setActive(5, 1)).resolves.toEqual({ id: 5 });
      expect(prisma.receiptPdfSetting.findFirst).toHaveBeenCalledWith({
        where: { id: 5, consumer_id: 1 },
      });
      expect(prisma.receiptPdfSetting.updateMany).toHaveBeenCalledWith({
        where: {
          consumer_id: 1,
          branch_id: 4,
          type: 'quotation',
          is_active: true,
        },
        data: { is_active: false },
      });
      expect(prisma.receiptPdfSetting.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { is_active: true },
      });
    });

    it('[BE-MUT-234] activation, deactivation, read, update, delete and copy of another tenant setting are 404s', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.findFirst.mockResolvedValue(null);
      await expect(service.setActive(5, 1)).rejects.toThrow(
        new NotFoundException('Setting not found'),
      );
      await expect(service.deactivateSetting(5, 1)).rejects.toThrow(
        new NotFoundException('Setting not found'),
      );
      await expect(service.getSettingById(5, 1)).rejects.toThrow(
        new NotFoundException('Setting not found'),
      );
      await expect(service.updateSetting(5, 1, { name: 'x' })).rejects.toThrow(
        new NotFoundException('Setting not found'),
      );
      await expect(service.deleteSetting(5, 1)).rejects.toThrow(
        new NotFoundException('Setting not found'),
      );
      await expect(service.copyToBranch(5, 2, 1, 3)).rejects.toThrow(
        new NotFoundException('Source setting not found'),
      );
      expect(prisma.receiptPdfSetting.updateMany).not.toHaveBeenCalled();
      expect(prisma.receiptPdfSetting.update).not.toHaveBeenCalled();
      expect(prisma.receiptPdfSetting.delete).not.toHaveBeenCalled();
    });

    it('[BE-MUT-235] a branch setting can be deactivated, the consumer default cannot', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.findFirst.mockResolvedValue({
        id: 5,
        branch_id: 4,
      });
      prisma.receiptPdfSetting.update.mockResolvedValue({ id: 5 });
      await expect(service.deactivateSetting(5, 1)).resolves.toEqual({ id: 5 });
      expect(prisma.receiptPdfSetting.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { is_active: false },
      });
      prisma.receiptPdfSetting.findFirst.mockResolvedValue({
        id: 5,
        branch_id: null,
      });
      prisma.receiptPdfSetting.update.mockClear();
      await expect(service.deactivateSetting(5, 1)).rejects.toThrow(
        new BadRequestException(
          'Cannot deactivate the consumer default setting.',
        ),
      );
      expect(prisma.receiptPdfSetting.update).not.toHaveBeenCalled();
    });
  });

  describe('reads', () => {
    it('[BE-MUT-236] getSettingById is tenant scoped and includes author and branch names only', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.findFirst.mockResolvedValue({ id: 5 });
      await expect(service.getSettingById(5, 1)).resolves.toEqual({ id: 5 });
      expect(prisma.receiptPdfSetting.findFirst).toHaveBeenCalledWith({
        where: { id: 5, consumer_id: 1 },
        include,
      });
    });

    it('[BE-MUT-237] listSettings filters by type only when given, defaults to consumer level and sorts active first', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.findMany.mockResolvedValue([{ id: 1 }]);
      await expect(service.listSettings(1, 'return', 4)).resolves.toEqual([
        { id: 1 },
      ]);
      expect(prisma.receiptPdfSetting.findMany).toHaveBeenCalledWith({
        where: { consumer_id: 1, type: 'return', branch_id: 4 },
        orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
        include,
      });
      await service.listSettings(1);
      expect(prisma.receiptPdfSetting.findMany).toHaveBeenLastCalledWith({
        where: { consumer_id: 1, branch_id: null },
        orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
        include,
      });
    });

    it('[BE-MUT-238] listAllByType covers every branch, consumer level first, active first, then by name', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.findMany.mockResolvedValue([{ id: 2 }]);
      await expect(service.listAllByType(1, 'chalan')).resolves.toEqual([
        { id: 2 },
      ]);
      expect(prisma.receiptPdfSetting.findMany).toHaveBeenCalledWith({
        where: { consumer_id: 1, type: 'chalan' },
        orderBy: [{ branch_id: 'asc' }, { is_active: 'desc' }, { name: 'asc' }],
        include,
      });
    });
  });

  describe('updateSetting', () => {
    const existing = {
      id: 5,
      name: 'Old',
      branch_id: 4,
      type: 'receipt',
      settings: { a: 1, nested: { x: 1, y: 2 }, list: [1, 2], keep: 'k' },
    };

    it('[BE-MUT-239] a rename checks uniqueness in the setting scope and writes the new name', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null);
      prisma.receiptPdfSetting.update.mockResolvedValue({ id: 5 });
      await service.updateSetting(5, 1, { name: 'New' });
      expect(prisma.receiptPdfSetting.findFirst).toHaveBeenLastCalledWith({
        where: { consumer_id: 1, branch_id: 4, type: 'receipt', name: 'New' },
      });
      expect(prisma.receiptPdfSetting.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { name: 'New', settings: existing.settings },
      });
    });

    it('[BE-MUT-240] keeping the same name or sending none skips the uniqueness check and keeps the name', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.findFirst.mockResolvedValue(existing);
      prisma.receiptPdfSetting.update.mockResolvedValue({ id: 5 });
      await service.updateSetting(5, 1, { name: 'Old' });
      await service.updateSetting(5, 1, {});
      expect(prisma.receiptPdfSetting.findFirst).toHaveBeenCalledTimes(2);
      for (const [arg] of prisma.receiptPdfSetting.update.mock.calls) {
        expect(arg.data).toEqual({
          ...(arg.data.name ? { name: 'Old' } : {}),
          settings: existing.settings,
        });
      }
    });

    it('[BE-MUT-241] a renamed duplicate is rejected before anything is written', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ id: 8 });
      await expect(
        service.updateSetting(5, 1, { name: 'Taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.receiptPdfSetting.update).not.toHaveBeenCalled();
    });

    it('[BE-MUT-242] settings are deep merged: nested objects merge, arrays and scalars replace, null clears, undefined is ignored', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.findFirst.mockResolvedValue(existing);
      prisma.receiptPdfSetting.update.mockResolvedValue({ id: 5 });
      await service.updateSetting(5, 1, {
        settings: {
          a: 2,
          nested: { y: 3, z: 4 },
          list: [9],
          keep: undefined,
          created: { deep: { v: 1 } },
          gone: null,
        } as any,
      });
      expect(
        prisma.receiptPdfSetting.update.mock.calls[0][0].data.settings,
      ).toEqual({
        a: 2,
        nested: { x: 1, y: 3, z: 4 },
        list: [9],
        keep: 'k',
        created: { deep: { v: 1 } },
        gone: null,
      });
      expect(existing.settings.nested).toEqual({ x: 1, y: 2 });
    });
  });

  describe('delete and copy', () => {
    it('[BE-MUT-243] the active consumer default cannot be deleted; inactive defaults and branch settings can', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.delete.mockResolvedValue({ id: 5 });
      prisma.receiptPdfSetting.findFirst.mockResolvedValue({
        id: 5,
        branch_id: null,
        is_active: true,
      });
      await expect(service.deleteSetting(5, 1)).rejects.toThrow(
        'Cannot delete the active consumer default setting. This is the ultimate fallback for all branches.',
      );
      expect(prisma.receiptPdfSetting.delete).not.toHaveBeenCalled();
      for (const row of [
        { id: 5, branch_id: null, is_active: false },
        { id: 5, branch_id: 4, is_active: true },
      ]) {
        prisma.receiptPdfSetting.findFirst.mockResolvedValue(row);
        await expect(service.deleteSetting(5, 1)).resolves.toEqual({ id: 5 });
      }
      expect(prisma.receiptPdfSetting.delete).toHaveBeenCalledTimes(2);
      expect(prisma.receiptPdfSetting.delete).toHaveBeenCalledWith({
        where: { id: 5 },
      });
    });

    it('[BE-MUT-244] copying to a branch creates an inactive duplicate owned by the copier', async () => {
      const { prisma, service } = setup();
      prisma.receiptPdfSetting.findFirst
        .mockResolvedValueOnce({
          id: 5,
          name: 'Src',
          type: 'receipt',
          settings: { a: 1 },
        })
        .mockResolvedValueOnce(null);
      prisma.branch.findFirst.mockResolvedValue({ id: 2 });
      prisma.receiptPdfSetting.create.mockResolvedValue({ id: 6 });
      await expect(service.copyToBranch(5, 2, 1, 3)).resolves.toEqual({
        id: 6,
      });
      expect(prisma.receiptPdfSetting.findFirst).toHaveBeenNthCalledWith(1, {
        where: { id: 5, consumer_id: 1 },
      });
      expect(prisma.receiptPdfSetting.updateMany).not.toHaveBeenCalled();
      expect(prisma.receiptPdfSetting.create).toHaveBeenCalledWith({
        data: {
          consumer_id: 1,
          branch_id: 2,
          name: 'Src',
          type: 'receipt',
          settings: { a: 1 },
          is_active: false,
          created_by: 3,
        },
      });
    });
  });
});
