import { ArgumentsHost, Catch, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { isOutOfRangeMessage } from './prisma-error-messages';

/**
 * Prisma reports a few client mistakes (an id larger than 32 bits sent to a raw query, text where
 * a number belongs) as "unknown request" errors. Those are the caller's fault, not a server fault.
 */
@Catch(Prisma.PrismaClientUnknownRequestError)
export class PrismaClientUnknownRequestExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(
    PrismaClientUnknownRequestExceptionFilter.name,
  );

  override catch(
    exception: Prisma.PrismaClientUnknownRequestError,
    host: ArgumentsHost,
  ) {
    this.logger.error(exception.message.replace(/\n/g, ' '));

    if (!isOutOfRangeMessage(exception.message)) {
      super.catch(exception, host);
      return;
    }

    const status = HttpStatus.BAD_REQUEST;
    host.switchToHttp().getResponse<Response>().status(status).json({
      statusCode: status,
      message: 'A number in the request is too large or too small.',
    });
  }
}
