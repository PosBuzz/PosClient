import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isClientError } from './client-error';

describe('isClientError', () => {
  const known = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: 't' });
  it.each([
    ['BE-CERR-001', new BadRequestException('x'), true],
    ['BE-CERR-002', known('P2002'), true],
    ['BE-CERR-003', known('P2020'), true],
    ['BE-CERR-004', known('P9999'), false],
    [
      'BE-CERR-005',
      new Prisma.PrismaClientValidationError('bad id', { clientVersion: 't' }),
      true,
    ],
    [
      'BE-CERR-006',
      new Prisma.PrismaClientUnknownRequestError('value out of range', {
        clientVersion: 't',
      }),
      true,
    ],
    [
      'BE-CERR-007',
      new Prisma.PrismaClientUnknownRequestError('connection lost', {
        clientVersion: 't',
      }),
      false,
    ],
    ['BE-CERR-008', new Error('plain'), false],
  ])('[%s] %#', (_id, error, expected) => {
    expect(isClientError(error)).toBe(expected);
  });
});
