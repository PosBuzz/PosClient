import { Test, TestingModule } from '@nestjs/testing';
import { BillingInvoicesController } from './billing-invoices.controller';
import { BillingInvoicesService } from './billing-invoices.service';

describe('BillingInvoicesController', () => {
  let controller: BillingInvoicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingInvoicesController],
      providers: [BillingInvoicesService],
    }).compile();

    controller = module.get<BillingInvoicesController>(
      BillingInvoicesController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
