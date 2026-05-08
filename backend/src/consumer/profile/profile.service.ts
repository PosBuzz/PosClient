import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);
  constructor(private prisma: PrismaService) {}

  /**
   * Update consumer profile fields allowed to be changed via client
   */
  async updateProfile(consumerId: number, payload: any) {
    try {
      const allowed: Array<string> = [
        'secondary_email',
        'phone',
        'address',
        'currency_symbol',
        'currency_position',
        'company_name',
        'receipt_terms',
        'logo',
      ];

      const data: any = {};
      for (const key of allowed) {
        if (payload[key] !== undefined) data[key] = payload[key];
      }

      if (Object.keys(data).length === 0) {
        throw new HttpException(
          { message: 'No valid fields provided' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const updated = await this.prisma.consumer.update({
        where: { id: consumerId },
        data,
        select: {
          id: true,
          company_name: true,
          email: true,
          secondary_email: true,
          phone: true,
          address: true,
          logo: true,
        },
      });

      return updated;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error updating consumer profile for ID ${consumerId}`,
        error.stack,
      ); 
      throw new HttpException(
        'Failed to update consumer profile',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
