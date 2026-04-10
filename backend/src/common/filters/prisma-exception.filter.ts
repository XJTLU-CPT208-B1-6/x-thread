import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientInitializationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(
    exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientInitializationError,
    host: ArgumentsHost,
  ) {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE).send({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message:
          'Database is unavailable. Start the local database services, run `corepack pnpm --filter x-thread-backend exec prisma migrate deploy`, and restart the backend.',
        error: 'Service Unavailable',
      });
      return;
    }

    if (exception.code === 'P2021' || exception.code === 'P2022') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE).send({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message:
          'Database schema is outdated. Run `corepack pnpm --filter x-thread-backend exec prisma migrate deploy` and restart the backend.',
        error: 'Service Unavailable',
      });
      return;
    }

    throw exception;
  }
}
