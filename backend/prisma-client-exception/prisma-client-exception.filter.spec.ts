import { ArgumentsHost, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { PrismaClientExceptionFilter } from './prisma-client-exception.filter';
import { PrismaClientValidationExceptionFilter } from './prisma-client-validation-exception.filter';
import {
  describePrismaError,
  recordName,
  uniqueFields,
} from './prisma-error-messages';

function httpHost() {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as ArgumentsHost;
  return { response, host };
}
describe('Prisma exception responses', () => {
  let log: jest.SpyInstance;
  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  it.each([
    ['BE-PEF-001', 'P2002', 409, 'A product with this name already exists.'],
    [
      'BE-PEF-002',
      'P2003',
      409,
      "This product is still used by other records, so it can't be changed or deleted. Remove or reassign those first.",
    ],
    [
      'BE-PEF-003',
      'P2025',
      404,
      "The product you're looking for doesn't exist or has been removed.",
    ],
    [
      'BE-PEF-004',
      'P2018',
      400,
      "Some of the items linked to this product don't exist anymore. Refresh and try again.",
    ],
  ])(
    '[%s] %s returns specific actionable response',
    (_id, code, status, message) => {
      const { response, host } = httpHost();
      new PrismaClientExceptionFilter().catch(
        new Prisma.PrismaClientKnownRequestError('raw\nquery secret', {
          code,
          clientVersion: 'test',
          meta: { modelName: 'Product', target: ['consumer_id', 'name'] },
        }),
        host,
      );
      expect(response.status).toHaveBeenCalledWith(status);
      expect(response.json).toHaveBeenCalledWith({
        statusCode: status,
        message,
      });
    },
  );
  it('[BE-PEF-005] unknown codes delegate to the base filter', () => {
    const fallback = jest
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => {});
    const { host, response } = httpHost();
    const error = new Prisma.PrismaClientKnownRequestError('unknown', {
      code: 'P9999',
      clientVersion: 'test',
    });
    new PrismaClientExceptionFilter().catch(error, host);
    expect(fallback).toHaveBeenCalledWith(error, host);
    expect(response.json).not.toHaveBeenCalled();
  });
  it('[BE-PEF-006] raw detail stays only in logs with newlines removed', () => {
    const { host, response } = httpHost();
    new PrismaClientExceptionFilter().catch(
      new Prisma.PrismaClientKnownRequestError('secret\nquery', {
        code: 'P2002',
        clientVersion: 'test',
      }),
      host,
    );
    expect(log).toHaveBeenCalledWith('P2002 secret query');
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 409,
      message: 'A record with these details already exists.',
    });
  });
  it('[BE-PEF-007] validation errors hide query details and return 400', () => {
    const { host, response } = httpHost();
    new PrismaClientValidationExceptionFilter().catch(
      new Prisma.PrismaClientValidationError('secret\nquery', {
        clientVersion: 'test',
      }),
      host,
    );
    expect(log).toHaveBeenCalledWith('secret query');
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 400,
      message:
        'Some of the submitted data is invalid. Please check the form and try again.',
    });
  });
  it('[BE-PEF-008] model and field labels handle metadata and safe fallbacks', () => {
    expect(recordName('Consumer')).toBe('business');
    expect(recordName('InventoryBatch')).toBe('stock batch');
    expect(recordName('SuperAdmin')).toBe('admin user');
    expect(recordName('ProductVariant')).toBe('product variant');
    for (const value of [undefined, null, 42, '']) {
      expect(recordName(value)).toBe('record');
    }
    expect(uniqueFields('constraint_name')).toEqual([]);
    expect(uniqueFields(['consumer_id', 'id', 'branch_id', 'name'])).toEqual([
      'name',
    ]);
    expect(uniqueFields(['consumer_id', 'id', 'branch_id'])).toEqual([
      'consumer_id',
      'id',
      'branch_id',
    ]);
    const message = (modelName: unknown, target: unknown) =>
      describePrismaError('P2002', { modelName, target })?.message;
    expect(message('InventoryBatch', ['batch_number'])).toBe(
      'A stock batch with this batch number already exists.',
    );
    expect(message('Unit', ['name'])).toBe(
      'A unit with this name already exists.',
    );
    expect(message('Invoice', ['name'])).toBe(
      'An invoice with this name already exists.',
    );
    expect(message('ProductVariant', ['sku'])).toBe(
      'A product variant with this SKU already exists.',
    );
    expect(message('User', ['email', 'phone'])).toBe(
      'A user with this email address and phone number already exists.',
    );
    expect(message('Consumer', ['subdomain'])).toBe(
      'A business with this subdomain already exists.',
    );
    expect(message('Product', ['branch_id'])).toBe(
      'A product with this branch already exists.',
    );
    expect(message('Product', [])).toBe(
      'A product with these details already exists.',
    );
    expect(describePrismaError('P9999', undefined)).toBeNull();
  });
});
