import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

const isAddressInUseError = (error: unknown): error is { code: string } =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === 'EADDRINUSE';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  const port = Number(process.env.PORT || 3001);

  app.enableCors({ origin: '*' });
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new PrismaExceptionFilter());

  try {
    await app.listen(port, '0.0.0.0');
    console.log(`X-Thread backend running on http://localhost:${port}`);
  } catch (error: unknown) {
    if (isAddressInUseError(error)) {
      console.error(
        `Port ${port} is already in use. Stop the existing process on that port or change PORT in your environment before starting the backend.`,
      );
    }
    throw error;
  }
}

bootstrap().catch((error) => {
  console.error('Backend bootstrap failed:', error);
  process.exit(1);
});
