import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth() {
    return await this.appService.getHealth();
  }

  @Get('metrics')
  async getMetrics() {
    return await this.appService.getMetrics();
  }
}
