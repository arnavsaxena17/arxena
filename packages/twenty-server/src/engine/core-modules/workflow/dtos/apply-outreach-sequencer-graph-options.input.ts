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
    description:
      'Member email account is connected. When false, email sends become a system email to the workspace member',
    nullable: false,
  })
  emailConnected: boolean;

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

  @Field(() => Boolean, {
    description:
      'When true, view profile, comment on posts, wait for inbound invite, then connect if none',
    nullable: false,
  })
  commentBeforeConnect: boolean;

  @Field(() => Number, {
    description:
      'Number of comment rounds when commentBeforeConnect is on (1 or 2)',
    nullable: false,
  })
  commentRounds: number;

  @Field(() => Number, {
    description:
      'Days to wait for an inbound invite after commenting before sending outbound connect',
    nullable: false,
  })
  inboundInviteWaitDays: number;

  @Field(() => Boolean, {
    description:
      'When true, after connection wait send Sales Navigator InMail before email enrich/fallback',
    nullable: false,
  })
  inmailEnabled: boolean;

  @Field(() => Boolean, {
    description:
      'When true, collapse every DELAY wait from days to 1 minute for rapid testing',
    nullable: false,
  })
  testMode: boolean;
}
