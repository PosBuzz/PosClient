import { Global, Module } from '@nestjs/common';
import { CacheService } from './services/cache.service';
import { SubdomainValidationService } from './services/subdomain-validation.service';
import { SubdomainUtilService } from './services/subdomain-util.service';
import { SubdomainValidationController } from './controllers/subdomain-validation.controller';

@Global()
@Module({
  controllers: [SubdomainValidationController],
  providers: [
    CacheService,
    SubdomainValidationService,
    SubdomainUtilService,
  ],
  exports: [
    CacheService,
    SubdomainValidationService,
    SubdomainUtilService,
  ],
})
export class CommonModule {}
