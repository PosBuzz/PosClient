import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.close();
  }

  private async connect() {
    try {
      const rabbitmqUrl = this.configService.rabbitMQUrl;
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Setup exchanges and queues
      await this.channel.assertExchange('ai_tasks', 'direct', {
        durable: true,
      });
      await this.channel.assertQueue('generate_description_queue', {
        durable: true,
      });
      await this.channel.assertQueue('description_responses', {
        durable: true,
      });
      await this.channel.bindQueue(
        'generate_description_queue',
        'ai_tasks',
        'generate_description',
      );

      this.logger.log('Connected to RabbitMQ');
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ', error);
      throw error;
    }
  }

  async sendMessage(
    exchange: string,
    routingKey: string,
    message: any,
    options?: amqp.Options.Publish,
  ) {
    if (!this.channel) {
      await this.connect();
    }

    return this.channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      { persistent: true, ...options },
    );
  }

  async consumeMessages(
    queue: string,
    callback: (msg: amqp.ConsumeMessage) => Promise<void>,
  ) {
    if (!this.channel) {
      await this.connect();
    }

    await this.channel.consume(queue, async (msg) => {
      if (msg) {
        try {
          await callback(msg);
          this.channel.ack(msg);
        } catch (error) {
          this.logger.error('Error processing message:', error);
          // Negative acknowledge and requeue the message
          this.channel.nack(msg, false, true);
        }
      }
    });
  }

  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error);
    }
  }
}
