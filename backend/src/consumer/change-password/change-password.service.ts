import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcryptjs from 'bcryptjs';
import { errorStack } from '../../common/utils/error.util';
import { isClientError } from '../../common/errors/client-error';

@Injectable()
export class ChangePasswordService {
  private readonly logger = new Logger(ChangePasswordService.name);
  constructor(private prisma: PrismaService) {}

  async changePassword(id: number, old_password: string, new_password: string) {
    try {
      // Fetch the user by ID
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: { password: true },
      });

      if (!user) {
        throw new HttpException(
          { message: 'User not found' },
          HttpStatus.EXPECTATION_FAILED,
        );
      }

      // Verify the old password
      const isPasswordValid = await bcryptjs.compare(
        old_password,
        user.password,
      );
      if (!isPasswordValid) {
        throw new HttpException(
          { message: 'Old password is incorrect' },
          HttpStatus.EXPECTATION_FAILED,
        );
      }

      // Hash the new password
      const hashedNewPassword = await bcryptjs.hash(new_password, 10);

      // Update the user's password
      return await this.prisma.user.update({
        where: { id },
        data: { password: hashedNewPassword },
        select: { id: true, email: true, name: true },
      });
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Error changing password with ID ${id}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to change password',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
