import { Controller, Get, HttpStatus, HttpCode, Req } from '@nestjs/common';
import { Request } from 'express';
import { SubdomainValidationService } from '../services/subdomain-validation.service';

@Controller('public/subdomain')
export class SubdomainValidationController {
  constructor(
    private readonly subdomainValidationService: SubdomainValidationService,
  ) {}

  /**
   * Public endpoint to check if the current subdomain exists and is active
   * This is called by frontend BEFORE any authentication attempt
   * No JWT required - Extracts subdomain automatically from Origin header
   *
   * Example: GET /api/v1/public/subdomain/validate
   * (Frontend calls from https://tenant1.example.com, Origin header is used)
   */
  @Get('validate')
  @HttpCode(HttpStatus.OK)
  async validateSubdomain(@Req() req: Request) {
    // Extract subdomain from Origin or Referer header
    const origin = req.headers.origin || req.headers.referer;
    
    
    if (!origin) {
      return {
        success: false,
        exists: false,
        message: 'Unable to determine subdomain from request',
      };
    }

    const subdomain = this.subdomainValidationService.extractSubdomainFromUrl(
        origin,
    );
    console.log({subdomain, origin});

    if (!subdomain) {
      return {
        success: false,
        exists: false,
        message: 'No valid subdomain found in request origin',
      };
    }

    const result = await this.subdomainValidationService.validateSubdomain(
      subdomain,
    );

    if (!result.exists) {
      return {
        success: false,
        exists: false,
        subdomain,
        message: result.message || 'Subdomain not found',
      };
    }

    if (!result.isActive) {
      return {
        success: false,
        exists: true,
        active: false,
        subdomain,
        message: result.message || 'Tenant subscription is not active',
      };
    }

    return {
      success: true,
      exists: true,
      active: true,
      subdomain,
      message: 'Subdomain is valid and active',
    };
  }
}
