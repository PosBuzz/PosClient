import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';

/**
 * Hides developer tooling routes outside local development. Responds 404 so the
 * routes look nonexistent instead of advertising that they are blocked.
 */
@Injectable()
export class DevelopmentOnlyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(): boolean {
    if (this.configService.nodeEnv !== 'development') {
      throw new NotFoundException();
    }
    return true;
  }
}
