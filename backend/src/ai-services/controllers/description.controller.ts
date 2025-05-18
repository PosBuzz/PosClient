import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Headers,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { DescriptionService } from '../services/description.service';
import { GenerateDescriptionDto } from '../dto/generate-description.dto';
import { ClientAuthGuard } from 'src/auth/guards/client.auth.guard';
import * as crypto from 'crypto';

@UseGuards(ClientAuthGuard)
@Controller('ai/auto-description')
export class DescriptionController {
  private readonly logger = new Logger(DescriptionController.name);
  constructor(private readonly descriptionService: DescriptionService) {}

  @Post()
  async generateDescription(
    @Req() req: Request,
    @Body() dto: GenerateDescriptionDto,
  ) {
    try {
      const jwt = req.cookies['client_access_token'];

      // Log first 20 chars of JWT for debugging (avoid logging full JWT for security)
      this.logger.debug(
        `HTTP Request - JWT token first 20 chars: ${jwt?.substring(0, 20)}...`,
      );

      // Calculate and log the token length
      this.logger.debug(`HTTP Request - JWT token length: ${jwt?.length}`);

      // Hash the token to compare tokens without exposing them in logs
      const tokenHash = crypto
        .createHash('md5')
        .update(jwt || '')
        .digest('hex');
      this.logger.debug(`HTTP Request - JWT token hash: ${tokenHash}`);

      const result = await this.descriptionService.generateDescription(
        dto,
        jwt,
      );
      return { description: result };
    } catch (error) {
      this.logger.error(`Error generating description: ${error.message}`);
      throw error;
    }
  }
}
