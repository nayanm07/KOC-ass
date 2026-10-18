import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { SocketIoAdapter } from './realtime/socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(cookieParser());
  const webOrigin = config.getOrThrow<string>('WEB_ORIGIN');
  app.enableCors({ origin: webOrigin, credentials: true });
  app.useWebSocketAdapter(new SocketIoAdapter(app, webOrigin));

  // All REST routes live under /api/v1/...
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  await app.listen(config.get<number>('PORT') ?? 4000);
}
void bootstrap();
