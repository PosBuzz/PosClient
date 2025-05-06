import { Test, TestingModule } from '@nestjs/testing';
import { BillingInvoicesService } from './billing-invoices.service';

describe('BillingInvoicesService', () => {
  let service: BillingInvoicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BillingInvoicesService],
    }).compile();

    service = module.get<BillingInvoicesService>(BillingInvoicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
