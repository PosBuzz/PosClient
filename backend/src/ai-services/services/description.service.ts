// src/description/description.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GenerateDescriptionDto } from '../dto/generate-description.dto';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { ConfigService } from '../../config/config.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DescriptionService {
  private readonly logger = new Logger(DescriptionService.name);
  private readonly FASTAPI_BASE_URL: string;
  private descriptions: Map<string, { description: string; timestamp: number }> = new Map();
  // 5 minute cache expiration
  private readonly CACHE_EXPIRATION_MS = 5 * 60 * 1000;

  constructor(
    private readonly httpService: HttpService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly configService: ConfigService,
  ) {
    this.FASTAPI_BASE_URL = this.configService.fastApiUrl;
    
    // Setup a consumer to receive responses from the AI service
    this.setupResponseConsumer();

    // Cleanup expired cache entries periodically
    setInterval(() => this.cleanupExpiredCache(), 60000);
  }

  private async setupResponseConsumer() {
    try {
      await this.rabbitMQService.consumeMessages('description_responses', async (msg) => {
        try {
          const response = JSON.parse(msg.content.toString());
          if (response.requestId && response.description) {
            this.descriptions.set(response.requestId, {
              description: response.description,
              timestamp: Date.now(),
            });
            this.logger.debug(`Received description for requestId: ${response.requestId}`);
          }
        } catch (error) {
          this.logger.error('Error processing description response:', error);
        }
      });
      this.logger.log('Description response consumer setup complete');
    } catch (error) {
      this.logger.error('Failed to setup description response consumer:', error);
    }
  }

  private cleanupExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.descriptions.entries()) {
      if (now - value.timestamp > this.CACHE_EXPIRATION_MS) {
        this.descriptions.delete(key);
      }
    }
  }

  async generateDescription(dto: GenerateDescriptionDto, jwt: string): Promise<string> {
    try {
      // Generate a unique ID for this request
      const requestId = uuidv4();
      
      this.logger.debug(`Generating description for product: ${dto.product}, requestId: ${requestId}`);

      // Send message to RabbitMQ
      await this.rabbitMQService.sendMessage(
        'ai_tasks',
        'generate_description',
        {
          requestId,
          product: dto.product,
          jwt,
        }
      );
      
      this.logger.debug('Message sent to RabbitMQ');

      // Poll for the response (with a timeout)
      const maxAttempts = 60; // 30 seconds with 500ms interval
      let attempts = 0;

      while (attempts < maxAttempts) {
        if (this.descriptions.has(requestId)) {
          const result = this.descriptions.get(requestId);
          this.descriptions.delete(requestId); // Clean up after retrieving
          this.logger.debug(`Description received from RabbitMQ after ${attempts} attempts`);
          return result?.description || 'No description generated'; // Add null check with fallback
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
        attempts++;
      }

      // Fallback to direct HTTP call if message processing takes too long
      this.logger.warn('RabbitMQ processing timed out, falling back to direct HTTP call');
      return this.generateDescriptionDirectly(dto, jwt);
    } catch (err) {
      this.logger.error('Error with RabbitMQ description generation:', err);
      // Fallback to direct HTTP call if RabbitMQ fails
      return this.generateDescriptionDirectly(dto, jwt);
    }
  }

  private async generateDescriptionDirectly(dto: GenerateDescriptionDto, jwt: string): Promise<string> {
    try {
      this.logger.debug(`Generating description directly via HTTP for product: ${dto.product}`);
      
      // Remove '/api/v1' from the URL since it's already included in the base URL
      const url = `${this.FASTAPI_BASE_URL}/generate-description`;
      
      this.logger.debug(`Making HTTP request to: ${url}`);
      
      // Make the request directly without CSRF (since it's API to API)
      const response = await firstValueFrom(
        this.httpService.post<{ description: string }>(
          url,
          { product: dto.product },
          {
            headers: {
              'Authorization': `Bearer ${jwt}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      
      return response.data.description;
    } catch (err) {
      this.logger.error('Error calling FastAPI directly:', err);
      // Return a generic message instead of throwing an error
      return 'Could not generate description. Please try again later.';
    }
  }
}
