import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

const isJest = process.argv.some((arg) => arg.includes('jest'));

export const typeORMCoreModuleOptions: TypeOrmModuleOptions = {
  url: process.env.PG_DATABASE_URL,
  type: 'postgres',
  logging: ['error'],
  schema: 'core',
  entities:
    process.env.IS_BILLING_ENABLED === 'true'
      ? [`${isJest ? '' : 'dist/'}src/engine/core-modules/**/*.entity{.ts,.js}`]
      : [
          `${isJest ? '' : 'dist/'}src/engine/core-modules/**/!(billing-*).entity{.ts,.js}`,
        ],
  synchronize: false,
  migrationsRun: false,
  migrationsTableName: '_typeorm_migrations',
  metadataTableName: '_typeorm_generated_columns_and_materialized_views',
  migrations:
    process.env.IS_BILLING_ENABLED === 'true'
      ? [
          `${isJest ? '' : 'dist/'}src/database/typeorm/core/migrations/common/*{.ts,.js}`,
          `${isJest ? '' : 'dist/'}src/database/typeorm/core/migrations/billing/*{.ts,.js}`,
        ]
      : [
          `${isJest ? '' : 'dist/'}src/database/typeorm/core/migrations/common/*{.ts,.js}`,
        ],
  ssl:
    process.env.PG_SSL_ALLOW_SELF_SIGNED === 'true'
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  extra: {
    query_timeout: 10000,
    // Connection pooling: cap to avoid "too many clients" (sum of all pools must be < PostgreSQL max_connections)
    max: parseInt(process.env.PG_POOL_CORE_MAX ?? '10', 10),
    min: parseInt(process.env.PG_POOL_CORE_MIN ?? '2', 10),
    idle: 60000,
    acquire: 120000,
    evict: 30000,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 120000,
    connectionLimit: parseInt(process.env.PG_POOL_CORE_MAX ?? '10', 10),
    acquireTimeout: 120000,
    timeout: 60000,
  },
};

export const connectionSource = new DataSource(
  typeORMCoreModuleOptions as DataSourceOptions,
);
