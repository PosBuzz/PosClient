import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { DescriptionService } from '../services/description.service';
import { GenerateDescriptionDto } from '../dto/generate-description.dto';
import { ClientAuthGuard } from 'src/auth/guards/client.auth.guard';

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
      const result = await this.descriptionService.generateDescription(dto, jwt);
      return { description: result };
    } catch (error) {
      this.logger.error(`Error generating description: ${error.message}`);
      throw error;
    }
  }
}
