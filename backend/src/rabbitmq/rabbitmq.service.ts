import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { Subject } from 'rxjs';
import { timeout, filter, take, map } from 'rxjs/operators';

@Injectable()
export class RabbitMQService implements OnModuleInit {
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private responseEmitter = new Subject<any>();
  private readonly logger = new Logger(RabbitMQService.name);
  
  // Store requests waiting for responses
  private pendingRequests: Map<string, Subject<any>> = new Map();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
    await this.setupResponseConsumer();
  }

  async connect() {
    try {
      this.connection = await amqp.connect(this.configService.get<string>('RABBITMQ_URL'));
      this.channel = await this.connection.createChannel();
      
      // Declare exchanges
      await this.channel.assertExchange('ai_tasks', 'direct', { durable: true });
      
      // Declare queues
      await this.channel.assertQueue('generate_description', { durable: true });
      await this.channel.assertQueue('description_responses', { durable: true });
      
      // Bind queues to exchange
      await this.channel.bindQueue('generate_description', 'ai_tasks', 'generate_description');
      await this.channel.bindQueue('description_responses', 'ai_tasks', 'description_responses');
      
      this.logger.log('Connected to RabbitMQ');
    } catch (error) {
      this.logger.error(`Failed to connect to RabbitMQ: ${error.message}`);
      throw error;
    }
  }

  async setupResponseConsumer() {
    try {
      // Create an exclusive queue for responses
      const { queue } = await this.channel.assertQueue('', { exclusive: true });
      
      // Bind to the description_responses routing key
      await this.channel.bindQueue(queue, 'ai_tasks', 'description_responses');
      
      // Set up consumer
      await this.channel.consume(queue, (message) => {
        if (message) {
          try {
            const content = JSON.parse(message.content.toString());
            const requestId = content.requestId;
            
            this.logger.debug(`Received response for request ${requestId}`);
            
            // Find the pending request and resolve it
            const pendingRequest = this.pendingRequests.get(requestId);
            if (pendingRequest) {
              pendingRequest.next(content);
              pendingRequest.complete();
              this.pendingRequests.delete(requestId);
            } else {
              this.logger.warn(`Received response for unknown request ID: ${requestId}`);
            }
          } catch (error) {
            this.logger.error(`Error processing response: ${error.message}`);
          } finally {
            this.channel.ack(message);
          }
        }
      });
      
      this.logger.log('Response consumer set up successfully');
    } catch (error) {
      this.logger.error(`Failed to set up response consumer: ${error.message}`);
      throw error;
    }
  }

  async sendMessage(
    exchange: string,
    routingKey: string,
    data: any,
    waitForResponse = false,
    timeoutMs = 30000,
  ): Promise<any> {
    try {
      // Add a request ID if not present
      if (!data.requestId) {
        data.requestId = uuidv4();
      }
      
      const requestId = data.requestId;
      
      // Debug JWT
      if (data.jwt) {
        const jwtTokenHash = this.createHash(data.jwt);
        this.logger.debug(`RabbitMQ Sending - JWT token first 20 chars: ${data.jwt.substring(0, 20)}...`);
        this.logger.debug(`RabbitMQ Sending - JWT token length: ${data.jwt.length}`);
        this.logger.debug(`RabbitMQ Sending - JWT token hash: ${jwtTokenHash}`);
      }

      // Send the message
      await this.channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(data)),
        { persistent: true },
      );

      // If waiting for response, return a promise that resolves when response is received
      if (waitForResponse) {
        const responseSubject = new Subject<any>();
        this.pendingRequests.set(requestId, responseSubject);
        
        return new Promise((resolve, reject) => {
          const subscription = responseSubject.pipe(
            timeout(timeoutMs),
            take(1)
          ).subscribe({
            next: (response) => {
              resolve(response);
            },
            error: (error) => {
              this.pendingRequests.delete(requestId);
              reject(error);
            }
          });
        });
      }
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`);
      throw error;
    }
  }

  private createHash(data: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(data).digest('hex');
  }
}