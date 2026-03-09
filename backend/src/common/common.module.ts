import { Global, Module } from '@nestjs/common';
import { SubdomainValidationService } from './services/subdomain-validation.service';
import { SubdomainUtilService } from './services/subdomain-util.service';
import { SubdomainValidationController } from './controllers/subdomain-validation.controller';

@Global()
@Module({
  controllers: [SubdomainValidationController],
  providers: [
    SubdomainValidationService,
    SubdomainUtilService,
  ],
  exports: [
    SubdomainValidationService,
    SubdomainUtilService,
  ],
})
export class CommonModule {}
