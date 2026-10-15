import { ArgumentsHost, Catch, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

//https://www.prisma.io/blog/nestjs-prisma-error-handling-7D056s1kOop2
@Catch(Prisma.PrismaClientValidationError)
export class PrismaClientValidationExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(
    PrismaClientValidationExceptionFilter.name,
  );

  override catch(
    exception: Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ) {
    // The Prisma message quotes the query; keep it in the server log only
    this.logger.error(exception.message.replace(/\n/g, ' '));

    const status = HttpStatus.BAD_REQUEST;
    host.switchToHttp().getResponse<Response>().status(status).json({
      statusCode: status,
      message:
        'Some of the submitted data is invalid. Please check the form and try again.',
    });
  }
}
