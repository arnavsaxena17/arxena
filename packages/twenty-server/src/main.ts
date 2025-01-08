process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

import * as Sentry from '@sentry/node';
import { graphqlUploadExpress } from 'graphql-upload';
import bytes from 'bytes';
import { useContainer } from 'class-validator';
import '@sentry/tracing';

import { ApplyCorsToExceptions } from 'src/utils/apply-cors-to-exceptions';

import { AppModule } from './app.module';

import { generateFrontConfig } from './utils/generate-front-config';
import { settings } from './engine/constants/settings';
import { LoggerService } from './engine/integrations/logger/logger.service';
import { json, urlencoded } from 'express';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
// import { BaileysModule } from 'src/engine/core-modules/baileys/baileys.module';
import * as dotenv from 'dotenv';
// import { CoopCoepMiddleware } from './utils/coop-coep.middleware';


const bootstrap = async () => {
  dotenv.config();
  console.log('Current working directory:', process.cwd());


  const envPath = '.env';
  if (fs.existsSync(envPath)) {
    console.log('.env file found');
  } else {
    console.log('.env file not found');
  }

  dotenv.config();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
    bufferLogs: process.env.LOGGER_IS_BUFFER_ENABLED === 'true',
    rawBody: true,
    snapshot: process.env.DEBUG_MODE === 'true',
  });
  const logger = app.get(LoggerService);

  // TODO: Double check this as it's not working for now, it's going to be heplful for durable trees in twenty "orm"
  // // Apply context id strategy for durable trees
  // ContextIdFactory.apply(new AggregateByWorkspaceContextIdStrategy());

  // Apply class-validator container so that we can use injection in validators
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Use our logger
  app.useLogger(logger);

  if (Sentry.isInitialized()) {
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
  }

  app.useGlobalFilters(new ApplyCorsToExceptions());

  // Apply validation pipes globally
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );
  app.useBodyParser('json', { limit: settings.storage.maxFileSize });
  app.useBodyParser('urlencoded', {
    limit: settings.storage.maxFileSize,
    extended: true,
  });

  // Graphql file upload
  app.use(
    graphqlUploadExpress({
      maxFieldSize: bytes(settings.storage.maxFileSize),
      maxFiles: 10,
    }),
  );

  // Create the env-config.js of the front at runtime
  generateFrontConfig();

  // app.enableCors({
  //   // origin: ['http://localhost:3001', 'http://127.0.0.1:3001'],
  //   origin: true, // During development, you can use this to accept all origins

  //   methods: 'GET,POST,PUT,DELETE,OPTIONS,HEAD,PATCH',
  //   allowedHeaders: 'Content-Type, Authorization, x-schema-version',
  //   credentials: true,
  // });

  app.enableCors({
    origin: [
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'https://docs.google.com',
      'https://drive.google.com'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-schema-version'],
    credentials: true,
  });

  app.use((req, res, next) => {
    res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
    next();
  });
  

  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  // app.use(CoopCoepMiddleware);


  await app.listen(process.env.PORT ?? 3000);

  // if (process.env.WHATSAPP_API == 'baileys') {
  //   const baileysApp = await NestFactory.create(BaileysModule, { cors: true });
  //   await baileysApp.listen(process.env.BAILEYS_PORT ?? 4000);
  // }
};

bootstrap();
