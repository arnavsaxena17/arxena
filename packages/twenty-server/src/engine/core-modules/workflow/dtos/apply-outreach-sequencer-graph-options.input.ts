import { Field, InputType } from '@nestjs/graphql';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@InputType()
export class ApplyOutreachSequencerGraphOptionsInput {
  @Field(() => UUIDScalarType, {
    description: 'Candidate Sequencer workflow ID',
    nullable: false,
  })
  workflowId: string;

  @Field(() => Boolean, {
    description: 'Draft connection note with LLM before send',
    nullable: false,
  })
  useLlmConnectionNote: boolean;

  @Field(() => Boolean, {
    description: 'Keep approve FORM steps before send',
    nullable: false,
  })
  humanInTheLoop: boolean;

  @Field(() => Boolean, {
    description: 'Include WhatsApp channel send branches',
    nullable: false,
  })
  whatsappEnabled: boolean;

  @Field(() => Boolean, {
    description: 'Include MEETING_BOOKED follow-up cadence',
    nullable: false,
  })
  meetingFollowUpEnabled: boolean;

  @Field(() => Boolean, {
    description:
      'When true, insert company sibling dedupe before connection send; default is off',
    nullable: false,
  })
  checkDeduplicationPerCompany: boolean;

  @Field(() => Boolean, {
    description:
      'When true, run Qualify prospect AI go/no-go before connection; when false, Fetch LinkedIn profile goes straight to the connection path',
    nullable: false,
  })
  qualifyProspectEnabled: boolean;
}
