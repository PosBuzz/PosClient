// src/description/description.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { GenerateDescriptionDto } from '../dto/generate-description.dto';
import { v4 as uuidv4 } from 'uuid';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from 'src/config/config.service';
import { RabbitMQService } from 'src/rabbitmq/rabbitmq.service';

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
          `RabbitMQ processing failed: ${error.message}, falling back to direct HTTP call`,
        );
        return await this.generateDescriptionViaHttp(
          dto.product,
          jwt,
          dto.force_refresh,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to generate description: ${error.message}`);
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
      this.logger.error(`HTTP fallback failed: ${error.message}`);
      throw error;
    }
  }
}
