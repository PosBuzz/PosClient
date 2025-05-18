import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';

import { Request } from 'express';
import { DescriptionService } from '../services/description.service';
import { GenerateDescriptionDto } from '../dto/generate-description.dto';
import { ClientAuthGuard } from 'src/auth/guards/client.auth.guard';

@UseGuards(ClientAuthGuard)
@Controller('ai/auto-description')
export class DescriptionController {
  constructor(private readonly descriptionService: DescriptionService) {}

  @Post()
  async generateAutoDescription(
    @Body() dto: GenerateDescriptionDto,
    @Req() req: Request,
  ) {
    // Get JWT from cookie rather than the authorization header
    const jwt = req.cookies['client_access_token'];

    console.log(jwt);
    
    
    // Pass the validated client user to the service
    const description = await this.descriptionService.generateDescription(
      dto,
      jwt,
    );
    return { description };
  }
}
