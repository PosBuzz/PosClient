import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { Subject } from 'rxjs';
import { timeout, take } from 'rxjs/operators';

interface PendingRequest {
  subject: Subject<any>;
  timestamp: number;
}

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private readonly logger = new Logger(RabbitMQService.name);
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
    await this.setupResponseConsumer();
    this.startCleanupTimer();
  }

  async onModuleDestroy() {
    this.stopCleanupTimer();
    await this.close();
  }

  async connect() {
    try {
      this.connection = await amqp.connect(this.configService.get<string>('RABBITMQ_URL'));
      this.channel = await this.connection.createChannel();
      
      // Set up exchanges and queues
      await this.setupExchangesAndQueues();
      
      this.logger.log('Connected to RabbitMQ');
      
      // Set up recovery handlers
      this.connection.on('error', (err) => {
        this.logger.error(`RabbitMQ connection error: ${err.message}`);
        this.reconnect();
      });
      
      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
        this.reconnect();
      });
      
    } catch (error) {
      this.logger.error(`Failed to connect to RabbitMQ: ${error.message}`);
      this.reconnect();
    }
  }

  private async setupExchangesAndQueues() {
    // Declare exchange
    await this.channel.assertExchange('ai_tasks', 'direct', { durable: true });
    
    // Declare queues
    await this.channel.assertQueue('generate_description_queue', { durable: true });
    await this.channel.assertQueue('description_responses', { durable: true });
    
    // Bind queues to exchange
    await this.channel.bindQueue('generate_description_queue', 'ai_tasks', 'generate_description');
    await this.channel.bindQueue('description_responses', 'ai_tasks', 'description_responses');
  }

  async setupResponseConsumer() {
    try {
      // Create a queue for responses
      const queueName = 'nestjs_response_queue';
      
      await this.channel.assertQueue(queueName, { 
        durable: true,
        arguments: {
          'x-message-ttl': 300000 // 5 minutes TTL
        }
      });
      
      // Bind to the response routing key
      await this.channel.bindQueue(queueName, 'ai_tasks', 'description_responses');
      
      // Set up consumer
      await this.channel.consume(queueName, (message) => this.handleResponseMessage(message));
      
      this.logger.log('Response consumer set up successfully');
    } catch (error) {
      this.logger.error(`Failed to set up response consumer: ${error.message}`);
    }
  }

  private handleResponseMessage(message: amqp.ConsumeMessage | null) {
    if (!message) return;
    
    try {
      const content = JSON.parse(message.content.toString());
      const requestId = content.requestId;
      
      if (!requestId) {
        this.logger.warn('Received message without requestId');
        this.channel.ack(message);
        return;
      }
      
      // Find the pending request and resolve it
      const pendingRequest = this.pendingRequests.get(requestId);
      if (pendingRequest) {
        this.logger.debug(`Received RabbitMQ response for request: ${requestId}`);
        pendingRequest.subject.next(content);
        pendingRequest.subject.complete();
        this.pendingRequests.delete(requestId);
      }
    } catch (error) {
      this.logger.error(`Error processing response: ${error.message}`);
    } finally {
      this.channel.ack(message);
    }
  }

  async sendMessage(
    exchange: string,
    routingKey: string,
    data: any,
    waitForResponse = false,
    timeoutMs = 60000,
  ): Promise<any> {
    try {
      // Ensure channel is available
      if (!this.channel) {
        await this.connect();
      }
      
      // Add a request ID if not present
      if (!data.requestId) {
        data.requestId = uuidv4();
      }
      
      const requestId = data.requestId;

      // Send the message
      await this.channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(data)),
        { persistent: true },
      );
      
      this.logger.debug(`Sent RabbitMQ message to ${routingKey}, requestId: ${requestId}`);

      // If waiting for response, return a promise that resolves when response is received
      if (waitForResponse) {
        this.logger.debug(`Waiting for RabbitMQ response, requestId: ${requestId}`);
        const responseSubject = new Subject<any>();
        this.pendingRequests.set(requestId, {
          subject: responseSubject,
          timestamp: Date.now()
        });
        
        return new Promise((resolve, reject) => {
          responseSubject.pipe(
            timeout(timeoutMs),
            take(1)
          ).subscribe({
            next: (response) => resolve(response),
            error: (error) => {
              this.logger.warn(`RabbitMQ response timeout for requestId: ${requestId}`);
              this.pendingRequests.delete(requestId);
              reject(error);
            }
          });
        });
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`);
      throw error;
    }
  }

  async close() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }
  
  private reconnect() {
    setTimeout(async () => {
      try {
        this.logger.debug('Attempting to reconnect to RabbitMQ...');
        await this.connect();
        if (this.channel) {
          await this.setupResponseConsumer();
        }
      } catch (error) {
        this.logger.error(`Reconnection failed: ${error.message}`);
      }
    }, 5000); // Try reconnecting after 5 seconds
  }
  
  private startCleanupTimer() {
    // Clean up stale pending requests
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [requestId, request] of this.pendingRequests.entries()) {
        if (now - request.timestamp > 5 * 60 * 1000) { // 5 minutes
          request.subject.error(new Error('Request timed out during cleanup'));
          this.pendingRequests.delete(requestId);
        }
      }
    }, 60000); // Check every minute
  }
  
  private stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}