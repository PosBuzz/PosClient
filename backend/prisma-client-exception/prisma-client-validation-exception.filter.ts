import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

//https://www.prisma.io/blog/nestjs-prisma-error-handling-7D056s1kOop2
@Catch(Prisma.PrismaClientValidationError)
export class PrismaClientValidationExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientValidationError, host: ArgumentsHost) {
    console.error('PrismaClientValidationError', exception.message);
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const message = exception.message.replace(/\n/g, '');

    const status = HttpStatus.CONFLICT;
    response.status(status).json({
      statusCode: status,
      message: 'PrismaClientValidationError',
      error: message,
    });

    /*switch (exception.code) {
      case 'P2002': {
        const status = HttpStatus.CONFLICT;
        response.status(status).json({
          statusCode: status,
          message: 'Unique constraint failed',
          error: message,
        });
        break;
      }

      default:
        // default 500 error code
        super.catch(exception, host);
        break;
    }*/
  }
}
