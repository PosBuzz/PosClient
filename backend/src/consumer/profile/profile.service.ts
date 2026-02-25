import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheService } from 'src/common/services/cache.service';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  /**
   * Update consumer profile fields allowed to be changed via client
   */
  async updateProfile(consumerId: number, payload: any) {
    const allowed: Array<string> = [
      'secondary_email',
      'phone',
      'address',
      'company_name',
      'logo',
    ];

    const data: any = {};
    for (const key of allowed) {
      if (payload[key] !== undefined) data[key] = payload[key];
    }

    if (Object.keys(data).length === 0) {
      throw new HttpException({ message: 'No valid fields provided' }, HttpStatus.BAD_REQUEST);
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

    // Invalidate consumer caches
    try {
      await this.cacheService.invalidateConsumerCache(consumerId);
      await this.cacheService.invalidateGlobalConsumerCaches();
    } catch (err) {
      console.error('Failed to invalidate caches after consumer update', err);
    }

    return updated;
  }
}
