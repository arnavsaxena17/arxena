import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('UndoChatOutreachColumnRemoval')
export class UndoChatOutreachColumnRemovalDTO {
  @Field()
  projectId: string;

  @Field()
  subject: string;

  @Field(() => [String])
  columnKeys: string[];

  @Field(() => Int)
  rowsTouched: number;

  @Field(() => Int)
  ephemeralUpdated: number;

  @Field(() => Int)
  crmUpdated: number;
}

@ObjectType('UndoChatOutreachViewClear')
export class UndoChatOutreachViewClearDTO {
  @Field()
  projectId: string;

  @Field()
  tab: string;
}

@ObjectType('UndoChatOutreachResult')
export class UndoChatOutreachResultDTO {
  @Field()
  threadId: string;

  @Field(() => [UndoChatOutreachColumnRemovalDTO])
  columnsRemoved: UndoChatOutreachColumnRemovalDTO[];

  @Field(() => [UndoChatOutreachViewClearDTO])
  viewsCleared: UndoChatOutreachViewClearDTO[];

  @Field()
  message: string;
}
