import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

const isJest = process.argv.some((arg) => arg.includes('jest'));

export const typeORMMetadataModuleOptions: TypeOrmModuleOptions = {
  url: process.env.PG_DATABASE_URL,
  type: 'postgres',
  logging: ['error'],
  schema: 'metadata',
  entities: [
    `${isJest ? '' : 'dist/'}src/engine/metadata-modules/**/*.entity{.ts,.js}`,
  ],
  synchronize: false,
  migrationsRun: false,
  migrationsTableName: '_typeorm_migrations',
  migrations: [
    `${isJest ? '' : 'dist/'}src/database/typeorm/metadata/migrations/*{.ts,.js}`,
  ],
  ssl:
    process.env.PG_SSL_ALLOW_SELF_SIGNED === 'true'
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  extra: {
    query_timeout: 10000,
    // Connection pooling configuration for TypeORM 0.3.20
    max: 100,
    min: 10,
    idle: 60000,
    acquire: 120000,
    evict: 30000,
    // Node-postgres specific settings to match TypeORM configuration
    idleTimeoutMillis: 60000, // Match TypeORM idle timeout
    connectionTimeoutMillis: 120000, // Match TypeORM acquire timeout
    // Additional PostgreSQL pool settings
    connectionLimit: 100,
    acquireTimeout: 120000,
    timeout: 60000,
  },
};

export const connectionSource = new DataSource(
  typeORMMetadataModuleOptions as DataSourceOptions,
);
