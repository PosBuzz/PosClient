import { Controller, Post, Body, Req, UseGuards, Logger } from '@nestjs/common';
import { Request } from 'express';
import { DescriptionService } from '../services/description.service';
import { GenerateDescriptionDto } from '../dto/generate-description.dto';
import { ClientAuthGuard } from 'src/auth/guards/client.auth.guard';
import { SubmitFeedbackDto } from '../dto/submit-feedback.dto';
import { errorMessage } from '../../common/utils/error.util';

@UseGuards(ClientAuthGuard)
@Controller('ai')
export class DescriptionController {
  private readonly logger = new Logger(DescriptionController.name);

  constructor(private readonly descriptionService: DescriptionService) {}

  @Post('auto-description')
  async generateDescription(
    @Req() req: Request,
    @Body() dto: GenerateDescriptionDto,
  ) {
    try {
      const jwt = req.cookies['client_access_token'];
      const result = await this.descriptionService.generateDescription(
        dto,
        jwt,
      );
      return { description: result };
    } catch (error) {
      this.logger.error(`Error generating description: ${errorMessage(error)}`);
      throw error;
    }
  }

  @Post('description-feedback')
  async submitFeedback(@Req() req: Request, @Body() dto: SubmitFeedbackDto) {
    try {
      const jwt = req.cookies['client_access_token'];
      const result = await this.descriptionService.submitFeedback(dto, jwt);
      return { success: result, message: 'Feedback recorded successfully' };
    } catch (error) {
      this.logger.error(`Error submitting feedback: ${errorMessage(error)}`);
      throw error;
    }
  }
}
