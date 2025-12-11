import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { SubdomainUtilService } from 'src/common/services/subdomain-util.service';

@Injectable()
export class ClientAuthGuard extends PassportAuthGuard('jwt-client') {
  private readonly logger = new Logger(ClientAuthGuard.name);

  constructor(
    @Inject(SubdomainUtilService)
    private readonly subdomainUtil: SubdomainUtilService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First, run passport JWT authentication
    const authenticated = await super.canActivate(context);

    if (!authenticated) {
      return false;
    }

    // After JWT validation, validate subdomain matches
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const user = request.user as any;
    const method = request?.method || 'UNKNOWN';
    const url = request?.originalUrl || request?.url || 'UNKNOWN_URL';

    // Extract subdomain from the origin or host header
    const subdomain = this.subdomainUtil.extractSubdomainFromRequest(request);

    // If no subdomain, allow (might be direct API access or admin)
    if (!subdomain) {
      this.logger.debug(
        `No subdomain detected for ${method} ${url}, allowing request`,
      );
      return true;
    }

    // Check if user has consumer_subdomain in JWT
    if (!user.consumer_subdomain) {
      this.logger.warn(
        `User ${user.sub} missing consumer_subdomain for ${method} ${url} - JWT needs refresh`,
      );
      // Allow for now - subdomain validation will happen after user logs out/in again
      // TODO: Remove this fallback after all users have new JWTs
      return true;
    }

    // Validate subdomain matches the one in JWT
    if (subdomain !== user.consumer_subdomain) {
      this.logger.warn(
        `Subdomain mismatch for ${method} ${url}: request='${subdomain}' jwt='${user.consumer_subdomain}' user='${user.sub}' - clearing cookies`,
      );
      
      // Clear cookies to force re-authentication
      response.clearCookie('client_access_token', {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
      });
      response.clearCookie('client_refresh_token', {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
      });
      
      throw new UnauthorizedException(
        'Access denied: subdomain does not match your tenant',
      );
    }

    this.logger.debug(
      `Subdomain validated for ${method} ${url}: '${subdomain}' matches JWT for user ${user.sub}`,
    );

    return true;
  }
}