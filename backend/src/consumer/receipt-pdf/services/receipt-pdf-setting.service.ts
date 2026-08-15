// receipt-pdf-setting.service.ts

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ReceiptPdfSettings,
  ReceiptPresetType,
  PRESET_DEFAULTS,
} from '../preset/receipt-pdf-settings';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReceiptPdfSettingService {
  private readonly logger = new Logger(ReceiptPdfSettingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /* ================================================================== */
  /*  INITIALIZATION - Called when consumer is created                  */
  /* ================================================================== */

  async initializeConsumerDefaults(
    consumerId: number,
    adminUserId: number,
    tx?: any,
  ): Promise<void> {
    try {
      const client = tx || this.prisma;
      const presets: { name: string; type: ReceiptPresetType }[] = [
        { name: 'Default Receipt', type: 'receipt' },
        { name: 'Default Quotation', type: 'quotation' },
        { name: 'Default Return Receipt', type: 'return' },
        { name: 'Default Delivery Chalan', type: 'chalan' },
        { name: 'Default Money Receipt', type: 'money_receipt' },
        { name: 'Default Delivery Slip', type: 'delivery_slip' },
      ];

      for (const preset of presets) {
        const settings = PRESET_DEFAULTS[preset.type];

        await client.receiptPdfSetting.create({
          data: {
            consumer_id: consumerId,
            branch_id: null,
            name: preset.name,
            type: preset.type,
            is_active: true,
            settings: settings as any,
            created_by: adminUserId,
          },
        });
      }

      this.logger.log(
        `Initialized default receipt settings for consumer ${consumerId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize receipt settings for consumer ${consumerId}`,
        error.stack,
      );
    }
  }

  /* ================================================================== */
  /*  GET SETTINGS - Resolves branch override → consumer default        */
  /* ================================================================== */

  async getActiveSettings(
    consumerId: number,
    type: ReceiptPresetType,
    branchId?: number,
  ): Promise<ReceiptPdfSettings> {
    if (branchId) {
      const branchSetting = await this.prisma.receiptPdfSetting.findFirst({
        where: {
          consumer_id: consumerId,
          branch_id: branchId,
          type,
          is_active: true,
        },
      });

      if (branchSetting) {
        return branchSetting.settings as unknown as ReceiptPdfSettings;
      }
    }

    const consumerSetting = await this.prisma.receiptPdfSetting.findFirst({
      where: {
        consumer_id: consumerId,
        branch_id: null,
        type,
        is_active: true,
      },
    });

    if (consumerSetting) {
      return consumerSetting.settings as unknown as ReceiptPdfSettings;
    }

    return PRESET_DEFAULTS[type];
  }

  /* ================================================================== */
  /*  GET BRANDING DATA - From Consumer/Branch tables (not JSON)        */
  /* ================================================================== */

  async getBrandingData(
    consumerId: number,
    branchId: number,
  ): Promise<{
    storeName: string;
    logoPath: string;
    branchName: string;
    branchAddress: string;
    branchPhone: string;
    branchEmail: string;
    vatRegistrationNumber: string;
  }> {
    const [consumer, branch] = await Promise.all([
      this.prisma.consumer.findUnique({
        where: { id: consumerId },
        select: {
          company_name: true,
          logo: true,
        },
      }),
      this.prisma.branch.findFirst({
        where: { id: branchId, consumer_id: consumerId },
        select: {
          name: true,
          address: true,
          phone: true,
          email: true,
          vat_registration_number: true,
        },
      }),
    ]);

    if (!consumer) {
      throw new NotFoundException(`Consumer ${consumerId} not found`);
    }
    if (!branch) {
      throw new NotFoundException(`Branch ${branchId} not found`);
    }

    return {
      storeName: consumer.company_name,
      logoPath: consumer.logo || '',
      branchName: branch.name,
      branchAddress: branch.address || '',
      branchPhone: branch.phone || '',
      branchEmail: branch.email || '',
      vatRegistrationNumber: branch.vat_registration_number || '',
    };
  }

  /* ================================================================== */
  /*  CRUD OPERATIONS                                                   */
  /* ================================================================== */

  async createSetting(data: {
    consumerId: number;
    branchId?: number | null;
    name: string;
    type: ReceiptPresetType;
    settings: ReceiptPdfSettings;
    isActive?: boolean;
    createdById?: number;
  }) {
    await this.ensureNameIsUnique(
      data.consumerId,
      data.branchId ?? null,
      data.type,
      data.name,
    );

    if (data.isActive) {
      await this.prisma.receiptPdfSetting.updateMany({
        where: {
          consumer_id: data.consumerId,
          branch_id: data.branchId ?? null,
          type: data.type,
          is_active: true,
        },
        data: { is_active: false },
      });
    }

    return this.prisma.receiptPdfSetting.create({
      data: {
        consumer_id: data.consumerId,
        branch_id: data.branchId ?? null,
        name: data.name,
        type: data.type,
        settings: data.settings as any,
        is_active: data.isActive ?? false,
        created_by: data.createdById,
      },
    });
  }

  async setActive(settingId: number, consumerId: number) {
    const setting = await this.prisma.receiptPdfSetting.findFirst({
      where: { id: settingId, consumer_id: consumerId },
    });

    if (!setting) {
      throw new NotFoundException('Setting not found');
    }

    await this.prisma.receiptPdfSetting.updateMany({
      where: {
        consumer_id: consumerId,
        branch_id: setting.branch_id,
        type: setting.type,
        is_active: true,
      },
      data: { is_active: false },
    });

    return this.prisma.receiptPdfSetting.update({
      where: { id: settingId },
      data: { is_active: true },
    });
  }

  async deactivateSetting(settingId: number, consumerId: number) {
    const setting = await this.prisma.receiptPdfSetting.findFirst({
      where: { id: settingId, consumer_id: consumerId },
    });

    if (!setting) {
      throw new NotFoundException('Setting not found');
    }

    if (setting.branch_id === null) {
      throw new BadRequestException(
        'Cannot deactivate the consumer default setting.',
      );
    }

    return this.prisma.receiptPdfSetting.update({
      where: { id: settingId },
      data: { is_active: false },
    });
  }

  async getSettingById(settingId: number, consumerId: number) {
    const setting = await this.prisma.receiptPdfSetting.findFirst({
      where: { id: settingId, consumer_id: consumerId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
    });

    if (!setting) {
      throw new NotFoundException('Setting not found');
    }

    return setting;
  }

  async listSettings(
    consumerId: number,
    type?: ReceiptPresetType,
    branchId?: number | null,
  ) {
    return this.prisma.receiptPdfSetting.findMany({
      where: {
        consumer_id: consumerId,
        ...(type && { type }),
        branch_id: branchId ?? null,
      },
      orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async listAllByType(consumerId: number, type: ReceiptPresetType) {
    return this.prisma.receiptPdfSetting.findMany({
      where: {
        consumer_id: consumerId,
        type,
      },
      orderBy: [{ branch_id: 'asc' }, { is_active: 'desc' }, { name: 'asc' }],
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async updateSetting(
    settingId: number,
    consumerId: number,
    data: {
      name?: string;
      settings?: Partial<ReceiptPdfSettings>;
    },
  ) {
    const setting = await this.prisma.receiptPdfSetting.findFirst({
      where: { id: settingId, consumer_id: consumerId },
    });

    if (!setting) {
      throw new NotFoundException('Setting not found');
    }

    if (data.name && data.name !== setting.name) {
      await this.ensureNameIsUnique(
        consumerId,
        setting.branch_id,
        setting.type as ReceiptPresetType,
        data.name,
      );
    }

    const currentSettings = setting.settings as unknown as ReceiptPdfSettings;
    const newSettings = data.settings
      ? this.deepMerge(currentSettings, data.settings)
      : currentSettings;

    return this.prisma.receiptPdfSetting.update({
      where: { id: settingId },
      data: {
        ...(data.name && { name: data.name }),
        settings: newSettings as any,
      },
    });
  }

  async deleteSetting(settingId: number, consumerId: number) {
    const setting = await this.prisma.receiptPdfSetting.findFirst({
      where: { id: settingId, consumer_id: consumerId },
    });

    if (!setting) {
      throw new NotFoundException('Setting not found');
    }

    if (setting.branch_id === null && setting.is_active) {
      throw new BadRequestException(
        'Cannot delete the active consumer default setting. This is the ultimate fallback for all branches.',
      );
    }

    return this.prisma.receiptPdfSetting.delete({
      where: { id: settingId },
    });
  }

  async copyToBranch(
    sourceSettingId: number,
    targetBranchId: number,
    consumerId: number,
    userId: number,
  ) {
    const source = await this.prisma.receiptPdfSetting.findFirst({
      where: { id: sourceSettingId, consumer_id: consumerId },
    });

    if (!source) {
      throw new NotFoundException('Source setting not found');
    }

    return this.createSetting({
      consumerId,
      branchId: targetBranchId,
      name: source.name,
      type: source.type as ReceiptPresetType,
      settings: source.settings as unknown as ReceiptPdfSettings,
      isActive: false,
      createdById: userId,
    });
  }

  /* ================================================================== */
  /*  HELPERS                                                           */
  /* ================================================================== */

  private async ensureNameIsUnique(
    consumerId: number,
    branchId: number | null,
    type: ReceiptPresetType,
    name: string,
  ): Promise<void> {
    const existing = await this.prisma.receiptPdfSetting.findFirst({
      where: {
        consumer_id: consumerId,
        branch_id: branchId,
        type,
        name,
      },
    });

    if (existing) {
      const scope = branchId ? 'branch' : 'consumer';
      throw new ConflictException(
        `A setting with the name "${name}" already exists for this ${scope} and type "${type}". Please choose a different name.`,
      );
    }
  }

  private deepMerge(target: any, source: any): any {
    const out = { ...target };
    for (const key of Object.keys(source)) {
      if (
        source[key] !== null &&
        source[key] !== undefined &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        out[key] = this.deepMerge(target[key] ?? {}, source[key]);
      } else if (source[key] !== undefined) {
        out[key] = source[key];
      }
    }
    return out;
  }

  async getConsumerOnlyBrandingData(consumerId: number): Promise<{
    storeName: string;
    logoPath: string;
  }> {
    const consumer = await this.prisma.consumer.findUnique({
      where: { id: consumerId },
      select: {
        company_name: true,
        logo: true,
      },
    });

    if (!consumer) {
      throw new NotFoundException(`Consumer ${consumerId} not found`);
    }

    return {
      storeName: consumer.company_name,
      logoPath: consumer.logo || '',
    };
  }
}
