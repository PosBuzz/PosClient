import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';

@Controller('rabbitmq-test')
export class RabbitMQController {
  constructor(private readonly rabbitMQService: RabbitMQService) {}

  @Get('health')
  async checkHealth() {
    try {
      const result = await this.rabbitMQService.sendMessage(
        'ai_tasks',
        'health_check',
        { timestamp: new Date().toISOString() },
      );
      return { status: 'ok', connected: true };
    } catch (error) {
      return { status: 'error', connected: false, message: error.message };
    }
  }

  @Post('send-description-test')
  async sendTestDescription(@Body() body: { product: string }) {
    try {
      const requestId = 'test-' + Date.now();
      await this.rabbitMQService.sendMessage(
        'ai_tasks',
        'generate_description',
        {
          requestId,
          product: body.product,
          // Use a test JWT that will pass validation
          jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        }
      );
      return { success: true, requestId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get('get-response/:requestId')
  async getResponse(@Param('requestId') requestId: string) {
    // This would need a separate implementation to check for responses
    return { message: 'Not implemented yet' };
  }
}