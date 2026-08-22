import { Field, InputType } from '@nestjs/graphql';

import graphqlTypeJson from 'graphql-type-json';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@InputType()
export class TestWorkflowFormNotifyInput {
  @Field(() => UUIDScalarType, {
    description: 'Form step id (used in the decision pointer)',
  })
  stepId: string;

  @Field(() => graphqlTypeJson, {
    description: 'Form field definitions, including default values',
  })
  fields: unknown;

  @Field(() => graphqlTypeJson, {
    description: 'notifyOnPending settings (channels, templates, recipients)',
  })
  notifyOnPending: unknown;

  @Field(() => graphqlTypeJson, {
    description: 'Flat variable path to test value map',
  })
  variableValues: Record<string, unknown>;
}
