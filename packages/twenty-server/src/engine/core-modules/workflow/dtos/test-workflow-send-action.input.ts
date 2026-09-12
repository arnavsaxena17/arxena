import { Field, InputType } from '@nestjs/graphql';

import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

export enum TestWorkflowSendActionChannel {
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  LINKEDIN = 'LINKEDIN',
}

@InputType()
export class TestWorkflowSendActionInput {
  @IsEnum(TestWorkflowSendActionChannel)
  @Field(() => String, {
    description: 'Channel to send on: EMAIL, WHATSAPP, or LINKEDIN',
  })
  channel: TestWorkflowSendActionChannel;

  @IsUUID()
  @IsNotEmpty()
  @Field(() => UUIDScalarType, {
    description: 'Workflow version that owns the send step',
  })
  workflowVersionId: string;

  @IsUUID()
  @IsNotEmpty()
  @Field(() => UUIDScalarType, {
    description: 'Send step id to resolve and execute',
  })
  stepId: string;

  @IsUUID()
  @IsNotEmpty()
  @Field(() => UUIDScalarType, {
    description:
      'Candidate used to hydrate FIND nodes (recipient email/phone/LinkedIn)',
  })
  candidateId: string;

  @IsString()
  @IsNotEmpty()
  @Field(() => String, {
    description:
      'Literal message body to send. Required because FORM/AI reply chips are not hydrated in Test.',
  })
  body: string;

  @IsOptional()
  @IsString()
  @Field(() => String, {
    description: 'Literal email subject (EMAIL channel)',
    nullable: true,
  })
  subject?: string;

  @IsOptional()
  @IsUUID()
  @Field(() => UUIDScalarType, {
    description:
      'Connected account id for EMAIL when the step has no sender configured',
    nullable: true,
  })
  connectedAccountId?: string;
}
