import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { describePrismaError } from './prisma-error-messages';

//https://www.prisma.io/blog/nestjs-prisma-error-handling-7D056s1kOop2
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  override catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ) {
    // Full Prisma detail stays in the server log; it names tables and fields
    this.logger.error(
      `${exception.code} ${exception.message.replace(/\n/g, ' ')}`,
    );

    const described = describePrismaError(exception.code, exception.meta);
    if (!described) {
      // default 500 error code
      super.catch(exception, host);
      return;
    }

    const response = host.switchToHttp().getResponse<Response>();
    response.status(described.status).json({
      statusCode: described.status,
      message: described.message,
    });
  }
}
