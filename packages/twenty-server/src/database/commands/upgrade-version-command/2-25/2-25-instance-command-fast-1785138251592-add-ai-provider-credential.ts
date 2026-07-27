import { QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.25.0', 1785138251592)
export class AddAiProviderCredentialFastInstanceCommand implements FastInstanceCommand {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "core"."billingEntitlement" DROP CONSTRAINT "FK_766a1918aa3dbe0d67d3df62356"');
    await queryRunner.query('ALTER TABLE "core"."billingSubscriptionItem" DROP CONSTRAINT "FK_d6eb2f6674a26736c8b2fa4ab11"');
    await queryRunner.query('ALTER TABLE "core"."billingSubscription" DROP CONSTRAINT "FK_0e793f67ed79fac873fb0eb30fb"');
    await queryRunner.query('ALTER TABLE "core"."billingSubscription" DROP CONSTRAINT "FK_6e7dda21d7fd1c0be7b3b07b3c4"');
    await queryRunner.query('DROP INDEX "core"."UQ_billingSubscription_razorpaySubscriptionId"');
    await queryRunner.query('DROP INDEX "core"."IDX_creditTransactions_workspaceId_createdAt"');
    await queryRunner.query('ALTER TABLE "core"."billingSubscriptionItem" DROP CONSTRAINT "IDX_BILLING_SUBSCRIPTION_ITEM_BILLING_SUBSCRIPTION_ID_STRIPE_PR"');
    await queryRunner.query('CREATE TABLE "core"."org_chart_client_ip_rule" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ipAddress" character varying(64) NOT NULL, "isBlocked" boolean NOT NULL DEFAULT false, "serveCachedOnly" boolean NOT NULL DEFAULT false, "totalRequests" integer NOT NULL DEFAULT \'0\', "chartsServed" integer NOT NULL DEFAULT \'0\', "lastUserAgent" character varying(1024), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ffbe349bc6e1765639cda3b2b3f" PRIMARY KEY ("id"))');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_ORG_CHART_CLIENT_IP_RULE_IP" ON "core"."org_chart_client_ip_rule" ("ipAddress") ');
    await queryRunner.query('CREATE TABLE "core"."aiProviderCredential" ("workspaceId" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "providerName" character varying(255) NOT NULL, "encryptedApiKey" text NOT NULL DEFAULT \'\', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "IDX_AI_PROVIDER_CREDENTIAL_WORKSPACE_ID_PROVIDER_NAME_UNIQUE" UNIQUE ("workspaceId", "providerName"), CONSTRAINT "CHK_aiProviderCredential_encryptedApiKey_encrypted" CHECK ("encryptedApiKey" = \'\' OR "encryptedApiKey" LIKE \'enc:v2:%\'), CONSTRAINT "PK_0deb4fd44454b1597863cea1f92" PRIMARY KEY ("id"))');
    await queryRunner.query('CREATE INDEX "IDX_AI_PROVIDER_CREDENTIAL_WORKSPACE_ID" ON "core"."aiProviderCredential" ("workspaceId") ');
    await queryRunner.query('CREATE TYPE "core"."workspaceMcpServer_toolmode_enum" AS ENUM(\'all\', \'allowlist\')');
    await queryRunner.query('CREATE TABLE "core"."workspaceMcpServer" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "label" character varying NOT NULL, "slug" character varying NOT NULL, "transport" character varying NOT NULL DEFAULT \'streamable-http\', "url" character varying NOT NULL, "authHeaderName" character varying, "authTokenEncrypted" text, "enabled" boolean NOT NULL DEFAULT true, "toolMode" "core"."workspaceMcpServer_toolmode_enum" NOT NULL DEFAULT \'all\', "toolAllowlist" jsonb NOT NULL DEFAULT \'[]\', "cachedToolsJson" jsonb, "catalogHash" character varying, "lastSyncAt" TIMESTAMP WITH TIME ZONE, "lastSyncError" text, "timeoutMs" integer NOT NULL DEFAULT \'30000\', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "workspaceId" uuid NOT NULL, CONSTRAINT "UQ_WORKSPACE_MCP_SERVER_WORKSPACE_SLUG" UNIQUE ("workspaceId", "slug"), CONSTRAINT "PK_079253c39112a6d7ee3ef990a09" PRIMARY KEY ("id"))');
    await queryRunner.query('CREATE INDEX "IDX_WORKSPACE_MCP_SERVER_WORKSPACE_ID" ON "core"."workspaceMcpServer" ("workspaceId") ');
    await queryRunner.query('CREATE TYPE "core"."privacy_consent_event_consenttype_enum" AS ENUM(\'cookie_banner\', \'terms_at_signup\')');
    await queryRunner.query('CREATE TYPE "core"."privacy_consent_event_action_enum" AS ENUM(\'accept_all\', \'reject_all\', \'custom\', \'withdraw\')');
    await queryRunner.query('CREATE TYPE "core"."privacy_consent_event_source_enum" AS ENUM(\'website\', \'app\')');
    await queryRunner.query('CREATE TABLE "core"."privacy_consent_event" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid, "visitorId" uuid NOT NULL, "consentType" "core"."privacy_consent_event_consenttype_enum" NOT NULL, "policyVersion" character varying(32) NOT NULL, "action" "core"."privacy_consent_event_action_enum" NOT NULL, "categories" jsonb NOT NULL, "source" "core"."privacy_consent_event_source_enum" NOT NULL, "userAgent" character varying(1024), "locale" character varying(16), "linkedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c5fbd93e83dc0b0d1ad366b3ea0" PRIMARY KEY ("id"))');
    await queryRunner.query('CREATE INDEX "IDX_PRIVACY_CONSENT_USER_ID" ON "core"."privacy_consent_event" ("userId") ');
    await queryRunner.query('CREATE INDEX "IDX_PRIVACY_CONSENT_VISITOR_ID" ON "core"."privacy_consent_event" ("visitorId") ');
    await queryRunner.query('ALTER TYPE "core"."billingPrice_interval_enum" RENAME TO "billingPrice_interval_enum_old"');
    await queryRunner.query('CREATE TYPE "core"."billingPrice_interval_enum" AS ENUM(\'month\', \'year\')');
    await queryRunner.query('ALTER TABLE "core"."billingPrice" ALTER COLUMN "interval" TYPE "core"."billingPrice_interval_enum" USING "interval"::"text"::"core"."billingPrice_interval_enum"');
    await queryRunner.query('DROP TYPE "core"."billingPrice_interval_enum_old"');
    await queryRunner.query('ALTER TABLE "core"."billingPrice" ALTER COLUMN "interval" SET NOT NULL');
    await queryRunner.query('ALTER TYPE "core"."billingSubscription_interval_enum" RENAME TO "billingSubscription_interval_enum_old"');
    await queryRunner.query('CREATE TYPE "core"."billingSubscription_interval_enum" AS ENUM(\'month\', \'year\')');
    await queryRunner.query('ALTER TABLE "core"."billingSubscription" ALTER COLUMN "interval" TYPE "core"."billingSubscription_interval_enum" USING "interval"::"text"::"core"."billingSubscription_interval_enum"');
    await queryRunner.query('DROP TYPE "core"."billingSubscription_interval_enum_old"');
    await queryRunner.query('ALTER TABLE "core"."billingCustomer" DROP CONSTRAINT "FK_53c2ef50e9611082f83d760897d"');
    await queryRunner.query('ALTER TABLE "core"."billingCustomer" DROP CONSTRAINT "UQ_53c2ef50e9611082f83d760897d"');
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_BILLING_CUSTOMER_WORKSPACE_ID_UNIQUE" ON "core"."billingCustomer" ("workspaceId") ');
    await queryRunner.query('CREATE INDEX "IDX_85de3296a0d6020624931844bf" ON "core"."creditTransactions" ("workspaceId", "createdAt") ');
    await queryRunner.query('ALTER TABLE "core"."billingSubscriptionItem" ADD CONSTRAINT "IDX_BILLING_SUBSCRIPTION_ITEM_BILLING_SUBSCRIPTION_ID_STRIPE_PRODUCT_ID_UNIQUE" UNIQUE ("billingSubscriptionId", "stripeProductId")');
    await queryRunner.query('ALTER TABLE "core"."billingEntitlement" ADD CONSTRAINT "FK_599121a93d8177b5d713b941982" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
    await queryRunner.query('ALTER TABLE "core"."billingEntitlement" ADD CONSTRAINT "FK_766a1918aa3dbe0d67d3df62356" FOREIGN KEY ("stripeCustomerId") REFERENCES "core"."billingCustomer"("stripeCustomerId") ON DELETE CASCADE ON UPDATE CASCADE');
    await queryRunner.query('ALTER TABLE "core"."billingPrice" ADD CONSTRAINT "FK_4d57ee4dbfc8b4075eb24026fca" FOREIGN KEY ("stripeProductId") REFERENCES "core"."billingProduct"("stripeProductId") ON DELETE CASCADE ON UPDATE NO ACTION');
    await queryRunner.query('ALTER TABLE "core"."billingPrice" ADD CONSTRAINT "FK_c8b4375b7bf8724ba54065372e1" FOREIGN KEY ("stripeMeterId") REFERENCES "core"."billingMeter"("stripeMeterId") ON DELETE NO ACTION ON UPDATE NO ACTION');
    await queryRunner.query('ALTER TABLE "core"."billingSubscriptionItem" ADD CONSTRAINT "FK_a602e7c9da619b8290232f6eeab" FOREIGN KEY ("billingSubscriptionId") REFERENCES "core"."billingSubscription"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
    await queryRunner.query('ALTER TABLE "core"."billingSubscriptionItem" ADD CONSTRAINT "FK_e576e45ea2b21aef8271826622e" FOREIGN KEY ("stripeProductId") REFERENCES "core"."billingProduct"("stripeProductId") ON DELETE NO ACTION ON UPDATE NO ACTION');
    await queryRunner.query('ALTER TABLE "core"."billingSubscription" ADD CONSTRAINT "FK_4abfb70314c18da69e1bee1954d" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
    await queryRunner.query('ALTER TABLE "core"."billingCustomer" ADD CONSTRAINT "FK_53c2ef50e9611082f83d760897d" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
    await queryRunner.query('ALTER TABLE "core"."aiProviderCredential" ADD CONSTRAINT "FK_72a8e71a937eec71061081a8dcc" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
    await queryRunner.query('ALTER TABLE "core"."workspaceMcpServer" ADD CONSTRAINT "FK_1303bf7475c8995043e258f9af0" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
    await queryRunner.query('ALTER TABLE "core"."privacy_consent_event" ADD CONSTRAINT "FK_0355c07409fbb5f37fa9176425b" FOREIGN KEY ("userId") REFERENCES "core"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "core"."privacy_consent_event" DROP CONSTRAINT "FK_0355c07409fbb5f37fa9176425b"');
    await queryRunner.query('ALTER TABLE "core"."workspaceMcpServer" DROP CONSTRAINT "FK_1303bf7475c8995043e258f9af0"');
    await queryRunner.query('ALTER TABLE "core"."aiProviderCredential" DROP CONSTRAINT "FK_72a8e71a937eec71061081a8dcc"');
    await queryRunner.query('ALTER TABLE "core"."billingCustomer" DROP CONSTRAINT "FK_53c2ef50e9611082f83d760897d"');
    await queryRunner.query('ALTER TABLE "core"."billingSubscription" DROP CONSTRAINT "FK_4abfb70314c18da69e1bee1954d"');
    await queryRunner.query('ALTER TABLE "core"."billingSubscriptionItem" DROP CONSTRAINT "FK_e576e45ea2b21aef8271826622e"');
    await queryRunner.query('ALTER TABLE "core"."billingSubscriptionItem" DROP CONSTRAINT "FK_a602e7c9da619b8290232f6eeab"');
    await queryRunner.query('ALTER TABLE "core"."billingPrice" DROP CONSTRAINT "FK_c8b4375b7bf8724ba54065372e1"');
    await queryRunner.query('ALTER TABLE "core"."billingPrice" DROP CONSTRAINT "FK_4d57ee4dbfc8b4075eb24026fca"');
    await queryRunner.query('ALTER TABLE "core"."billingEntitlement" DROP CONSTRAINT "FK_766a1918aa3dbe0d67d3df62356"');
    await queryRunner.query('ALTER TABLE "core"."billingEntitlement" DROP CONSTRAINT "FK_599121a93d8177b5d713b941982"');
    await queryRunner.query('ALTER TABLE "core"."billingSubscriptionItem" DROP CONSTRAINT "IDX_BILLING_SUBSCRIPTION_ITEM_BILLING_SUBSCRIPTION_ID_STRIPE_PRODUCT_ID_UNIQUE"');
    await queryRunner.query('DROP INDEX "core"."IDX_85de3296a0d6020624931844bf"');
    await queryRunner.query('DROP INDEX "core"."IDX_BILLING_CUSTOMER_WORKSPACE_ID_UNIQUE"');
    await queryRunner.query('ALTER TABLE "core"."billingCustomer" ADD CONSTRAINT "UQ_53c2ef50e9611082f83d760897d" UNIQUE ("workspaceId")');
    await queryRunner.query('ALTER TABLE "core"."billingCustomer" ADD CONSTRAINT "FK_53c2ef50e9611082f83d760897d" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
    await queryRunner.query('CREATE TYPE "core"."billingSubscription_interval_enum_old" AS ENUM(\'day\', \'month\', \'week\', \'year\')');
    await queryRunner.query('ALTER TABLE "core"."billingSubscription" ALTER COLUMN "interval" TYPE "core"."billingSubscription_interval_enum_old" USING "interval"::"text"::"core"."billingSubscription_interval_enum_old"');
    await queryRunner.query('DROP TYPE "core"."billingSubscription_interval_enum"');
    await queryRunner.query('ALTER TYPE "core"."billingSubscription_interval_enum_old" RENAME TO "billingSubscription_interval_enum"');
    await queryRunner.query('ALTER TABLE "core"."billingPrice" ALTER COLUMN "interval" DROP NOT NULL');
    await queryRunner.query('CREATE TYPE "core"."billingPrice_interval_enum_old" AS ENUM(\'day\', \'month\', \'week\', \'year\')');
    await queryRunner.query('ALTER TABLE "core"."billingPrice" ALTER COLUMN "interval" TYPE "core"."billingPrice_interval_enum_old" USING "interval"::"text"::"core"."billingPrice_interval_enum_old"');
    await queryRunner.query('DROP TYPE "core"."billingPrice_interval_enum"');
    await queryRunner.query('ALTER TYPE "core"."billingPrice_interval_enum_old" RENAME TO "billingPrice_interval_enum"');
    await queryRunner.query('DROP INDEX "core"."IDX_PRIVACY_CONSENT_VISITOR_ID"');
    await queryRunner.query('DROP INDEX "core"."IDX_PRIVACY_CONSENT_USER_ID"');
    await queryRunner.query('DROP TABLE "core"."privacy_consent_event"');
    await queryRunner.query('DROP TYPE "core"."privacy_consent_event_source_enum"');
    await queryRunner.query('DROP TYPE "core"."privacy_consent_event_action_enum"');
    await queryRunner.query('DROP TYPE "core"."privacy_consent_event_consenttype_enum"');
    await queryRunner.query('DROP INDEX "core"."IDX_WORKSPACE_MCP_SERVER_WORKSPACE_ID"');
    await queryRunner.query('DROP TABLE "core"."workspaceMcpServer"');
    await queryRunner.query('DROP TYPE "core"."workspaceMcpServer_toolmode_enum"');
    await queryRunner.query('DROP INDEX "core"."IDX_AI_PROVIDER_CREDENTIAL_WORKSPACE_ID"');
    await queryRunner.query('DROP TABLE "core"."aiProviderCredential"');
    await queryRunner.query('DROP INDEX "core"."UQ_ORG_CHART_CLIENT_IP_RULE_IP"');
    await queryRunner.query('DROP TABLE "core"."org_chart_client_ip_rule"');
    await queryRunner.query('ALTER TABLE "core"."billingSubscriptionItem" ADD CONSTRAINT "IDX_BILLING_SUBSCRIPTION_ITEM_BILLING_SUBSCRIPTION_ID_STRIPE_PR" UNIQUE ("billingSubscriptionId", "stripeProductId")');
    await queryRunner.query('CREATE INDEX "IDX_creditTransactions_workspaceId_createdAt" ON "core"."creditTransactions" ("createdAt", "workspaceId") ');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_billingSubscription_razorpaySubscriptionId" ON "core"."billingSubscription" ("razorpaySubscriptionId") WHERE ("razorpaySubscriptionId" IS NOT NULL)');
    await queryRunner.query('ALTER TABLE "core"."billingSubscription" ADD CONSTRAINT "FK_6e7dda21d7fd1c0be7b3b07b3c4" FOREIGN KEY ("stripeCustomerId") REFERENCES "core"."billingCustomer"("stripeCustomerId") ON DELETE NO ACTION ON UPDATE NO ACTION');
    await queryRunner.query('ALTER TABLE "core"."billingSubscription" ADD CONSTRAINT "FK_0e793f67ed79fac873fb0eb30fb" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
    await queryRunner.query('ALTER TABLE "core"."billingSubscriptionItem" ADD CONSTRAINT "FK_d6eb2f6674a26736c8b2fa4ab11" FOREIGN KEY ("billingSubscriptionId") REFERENCES "core"."billingSubscription"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
    await queryRunner.query('ALTER TABLE "core"."billingEntitlement" ADD CONSTRAINT "FK_766a1918aa3dbe0d67d3df62356" FOREIGN KEY ("stripeCustomerId") REFERENCES "core"."billingCustomer"("stripeCustomerId") ON DELETE CASCADE ON UPDATE NO ACTION');
  }
}
