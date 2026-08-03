import { type ActorMetadata, FieldActorSource } from 'twenty-shared/types';

// Used for system auth context (jobs, StaticGraphQL / internal GraphQL execution)
export const buildCreatedByFromSystem = (): ActorMetadata => ({
  source: FieldActorSource.SYSTEM,
  name: 'System',
  workspaceMemberId: null,
  context: {},
});
