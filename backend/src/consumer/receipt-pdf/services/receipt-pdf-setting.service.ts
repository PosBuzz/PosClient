// receipt-pdf-setting.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ReceiptPdfSettings,
  ReceiptPresetType,
  PRESET_DEFAULTS,
} from './receipt-pdf-settings';
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
  ): Promise<void> {
    try {
      const presets: { name: string; type: ReceiptPresetType }[] = [
        { name: 'Default Receipt', type: 'receipt' },
        { name: 'Default Quotation', type: 'quotation' },
        { name: 'Default Return Receipt', type: 'return' },
      ];

      for (const preset of presets) {
        const settings = PRESET_DEFAULTS[preset.type];
        await this.prisma.receiptPdfSetting.create({
          data: {
            consumer_id: consumerId,
            branch_id: null, // Consumer-level default
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
      // Don't throw - consumer creation shouldn't fail because of this
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
    // 1. Try branch-specific override
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

    // 2. Fall back to consumer-level default
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

    // 3. Ultimate fallback to hardcoded defaults
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
    currencySymbol: string;
    currencyPosition: 'before' | 'after';
    footerTerms: string;
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
          currency_symbol: true,
          currency_position: true,
          receipt_terms: true,
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
      currencySymbol: consumer.currency_symbol,
      currencyPosition: consumer.currency_position as 'before' | 'after',
      footerTerms: consumer.receipt_terms || '',
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

  async createSetting(
    data: {
      consumerId: number;
      branchId?: number | null;
      name: string;
      type: ReceiptPresetType;
      settings: ReceiptPdfSettings;
      isActive?: boolean;
      createdById?: number;
    },
  ) {
    // If setting as active, deactivate others in the same scope
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

    // Deactivate all in the same scope and type
    await this.prisma.receiptPdfSetting.updateMany({
      where: {
        consumer_id: consumerId,
        branch_id: setting.branch_id,
        type: setting.type,
        is_active: true,
      },
      data: { is_active: false },
    });

    // Activate the target
    return this.prisma.receiptPdfSetting.update({
      where: { id: settingId },
      data: { is_active: true },
    });
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
      orderBy: [
        { is_active: 'desc' },
        { name: 'asc' },
      ],
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

  async listAllByType(
    consumerId: number,
    type: ReceiptPresetType,
  ) {
    return this.prisma.receiptPdfSetting.findMany({
      where: {
        consumer_id: consumerId,
        type,
      },
      orderBy: [
        { branch_id: 'asc' }, // null (consumer) first, then branches
        { is_active: 'desc' },
        { name: 'asc' },
      ],
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

    if (setting.is_active) {
      throw new Error(
        'Cannot delete active setting. Set another as active first.',
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

  async resetBranchToDefault(
    branchId: number,
    consumerId: number,
    type: ReceiptPresetType,
  ) {
    // Delete all branch-specific settings for this type
    await this.prisma.receiptPdfSetting.deleteMany({
      where: {
        consumer_id: consumerId,
        branch_id: branchId,
        type,
      },
    });

    // Branch will now inherit from consumer default
    return { message: 'Branch reset to consumer default' };
  }

  /* ================================================================== */
  /*  HELPERS                                                           */
  /* ================================================================== */

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
}