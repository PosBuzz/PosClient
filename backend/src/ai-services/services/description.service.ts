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

      this.logger.debug(
        `Generating description for product: ${dto.product}, requestId: ${requestId}`,
      );

      // Debug JWT
      if (jwt) {
        const crypto = require('crypto');
        const tokenHash = crypto
          .createHash('md5')
          .update(jwt || '')
          .digest('hex');

        this.logger.debug(
          `Before RabbitMQ - JWT token first 20 chars: ${jwt?.substring(0, 20)}...`,
        );
        this.logger.debug(`Before RabbitMQ - JWT token length: ${jwt?.length}`);
        this.logger.debug(`Before RabbitMQ - JWT token hash: ${tokenHash}`);
      }

      try {
        // Send message to RabbitMQ and WAIT for response
        const response = await this.rabbitMQService.sendMessage(
          'ai_tasks',
          'generate_description',
          {
            requestId,
            product: dto.product,
            jwt: jwt,
          },
          true, // Wait for response
          30000, // 30 second timeout
        );

        this.logger.debug('Response received from RabbitMQ');

        // Return the generated description
        return response.description;
      } catch (error) {
        // If error is a timeout, fall back to HTTP
        this.logger.warn(
          `RabbitMQ processing failed: ${error.message}, falling back to direct HTTP call`,
        );
        return await this.generateDescriptionViaHttp(dto.product, jwt);
      }
    } catch (error) {
      this.logger.error(`Failed to generate description: ${error.message}`);
      throw error;
    }
  }

  private async generateDescriptionViaHttp(
    product: string,
    jwt: string,
  ): Promise<string> {
    try {
      this.logger.debug(
        `Generating description directly via HTTP for product: ${product}`,
      );
      this.logger.debug(
        `Making HTTP request to: ${this.aiServiceUrl}/api/v1/generate-description`,
      );

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/v1/generate-description`,
          { product },
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
