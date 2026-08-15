// src/description/description.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { GenerateDescriptionDto } from '../dto/generate-description.dto';
import { SubmitFeedbackDto } from '../dto/submit-feedback.dto'; // Import the new DTO
import { v4 as uuidv4 } from 'uuid';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from 'src/config/config.service';
import { RabbitMQService } from 'src/rabbitmq/rabbitmq.service';
import { errorMessage } from '../../common/utils/error.util';

@Injectable()
export class DescriptionService {
  private readonly logger = new Logger(DescriptionService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.aiServiceUrl = this.configService.fastApiUrl;
  }

  async generateDescription(
    dto: GenerateDescriptionDto,
    jwt: string,
  ): Promise<string> {
    try {
      const requestId = uuidv4();

      try {
        // Send message to RabbitMQ and wait for response
        const response = await this.rabbitMQService.sendMessage(
          'ai_tasks',
          'generate_description',
          {
            requestId,
            product: dto.product,
            force_refresh: dto.force_refresh,
            jwt,
          },
          true,
          60000,
        );

        return response.description;
      } catch (error) {
        // If RabbitMQ fails, fall back to HTTP
        this.logger.warn(
          `RabbitMQ processing failed: ${errorMessage(error)}, falling back to direct HTTP call`,
        );
        return await this.generateDescriptionViaHttp(
          dto.product,
          jwt,
          dto.force_refresh,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to generate description: ${errorMessage(error)}`,
      );
      throw error;
    }
  }

  // Also update the HTTP fallback method signature to include forceRefresh
  private async generateDescriptionViaHttp(
    product: string,
    jwt: string,
    force_refresh: boolean = false,
  ): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/generate-description`,
          {
            product,
            force_refresh,
          },
          {
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          },
        ),
      );

      return response.data.description;
    } catch (error) {
      this.logger.error(`HTTP fallback failed: ${errorMessage(error)}`);
      throw error;
    }
  }

  // Add the new method for submitting feedback
  async submitFeedback(dto: SubmitFeedbackDto, jwt: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/feedback`,
          {
            product: dto.product,
            description: dto.description,
            rating: dto.rating,
            comment: dto.comment,
            user_edited_description: dto.user_edited_description,
          },
          {
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          },
        ),
      );

      this.logger.log(`Feedback submitted for product: ${dto.product}`);
      return response.data.success;
    } catch (error) {
      this.logger.error(`Failed to submit feedback: ${errorMessage(error)}`);
      throw error;
    }
  }
}
