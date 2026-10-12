import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describePrismaError } from '../../../prisma-client-exception/prisma-error-messages';

/**
 * Errors that already carry a user-facing meaning and must reach the client
 * as-is: HTTP exceptions, and Prisma errors the Prisma filter turns into a
 * readable 4xx (duplicate, still in use, not found). Service catch blocks
 * rethrow these instead of replacing them with a generic 500.
 */
export function isClientError(error: unknown): boolean {
  if (error instanceof HttpException) return true;
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    describePrismaError(error.code, error.meta) !== null
  );
}
