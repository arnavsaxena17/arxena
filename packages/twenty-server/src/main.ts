import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import fs from 'fs';

import bytes from 'bytes';
import { useContainer, ValidationError } from 'class-validator';
import session from 'express-session';
import { graphqlUploadExpress } from 'graphql-upload';

import { NodeEnvironment } from 'src/engine/core-modules/environment/interfaces/node-environment.interface';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { LoggerService } from 'src/engine/core-modules/logger/logger.service';
import { getSessionStorageOptions } from 'src/engine/core-modules/session-storage/session-storage.module-factory';
import { UnhandledExceptionFilter } from 'src/filters/unhandled-exception.filter';

import { AppModule } from './app.module';


import './instrument';

import { settings } from './engine/constants/settings';
import { generateFrontConfig } from './utils/generate-front-config';

const bootstrap = async () => {
  console.log("Starting server")
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: process.env.LOGGER_IS_BUFFER_ENABLED === 'true',
    rawBody: true,
    snapshot: process.env.NODE_ENV === NodeEnvironment.development,
    ...(process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH
      ? {
          httpsOptions: {
            key: fs.readFileSync(process.env.SSL_KEY_PATH),
            cert: fs.readFileSync(process.env.SSL_CERT_PATH),
          },
        }
      : {}),
  });
  const logger = app.get(LoggerService);
  const environmentService = app.get(EnvironmentService);

  // Explicitly enable CORS with full configuration
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      // Allow localhost
      if (/^https?:\/\/localhost:\d+$/.test(origin)) {
        return callback(null, true);
      }
      
      // Allow arxena.com domains
      if (/^https?:\/\/[^/]+\.arxena\.com$/.test(origin)) {
        return callback(null, true);
      }
      
      // Allow chrome-extension origins (32 character alphanumeric IDs)
      if (/^chrome-extension:\/\/[a-z0-9]{32}$/.test(origin)) {
        return callback(null, true);
      }
      
      // Allow specific origins
      const allowedOrigins = [
        'https://arxena.arxena.com',
        'https://app.arxena.com',
        'https://web.whatsapp.com',
      ];
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With', 
      'Content-Type',
      'Accept',
      'Authorization',
      'x-origin-domain',
      'x-domain-origin',
      'X-Origin-Domain',
      'X-Domain-Origin',
      'x-schema-version',
      'x-locale',
      'sec-ch-ua',
      'sec-ch-ua-mobile',
      'sec-ch-ua-platform',
      'User-Agent',
      'DNT',
      'Referer'
    ],
    exposedHeaders: [
      'x-origin-domain',
      'X-Origin-Domain',
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.use(session(getSessionStorageOptions(environmentService)));

  // TODO: Double check this as it's not working for now, it's going to be helpful for durable trees in twenty "orm"
  // // Apply context id strategy for durable trees
  // ContextIdFactory.apply(new AggregateByWorkspaceContextIdStrategy());

  // Apply class-validator container so that we can use injection in validators
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Use our logger
  app.useLogger(logger);

  console.log("Using logger")
  app.useGlobalFilters(new UnhandledExceptionFilter());

  // Apply validation pipes globally
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      exceptionFactory: (errors) => {
        const error = new ValidationError();

        error.constraints = Object.assign(
          {},
          ...errors.map((error) => error.constraints),
        );

        return error;
      },
    }),
  );
  app.useBodyParser('json', { limit: settings.storage.maxFileSize });
  app.useBodyParser('urlencoded', {
    limit: settings.storage.maxFileSize,
    extended: true,
  });

  // Graphql file upload - only apply to GraphQL routes
  app.use(
    '/graphql',
    graphqlUploadExpress({
      maxFieldSize: bytes(settings.storage.maxFileSize),
      maxFiles: 10,
    }),
  );

  // Inject the server url in the frontend page
  generateFrontConfig();

  console.log("Starting server")
  console.log("environmentService.get('NODE_PORT')", environmentService.get('NODE_PORT'))
  await app.listen(environmentService.get('NODE_PORT'));
};

bootstrap();
