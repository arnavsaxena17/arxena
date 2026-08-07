import { Injectable } from '@nestjs/common';

import {
  type ObjectRecordCreateEvent,
  type ObjectRecordUpdateEvent,
} from 'twenty-shared/database-events';

import { OnDatabaseBatchEvent } from 'src/engine/api/graphql/graphql-query-runner/decorators/on-database-batch-event.decorator';
import { DatabaseEventAction } from 'src/engine/api/graphql/graphql-query-runner/enums/database-event-action';
import { WorkspaceMemberProfileProvisioningService } from 'src/engine/core-modules/user-workspace/workspace-member-profile-provisioning.service';
import { WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';
import { WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';

@Injectable()
export class WorkspaceMemberProfileSyncListener {
  constructor(
    private readonly workspaceMemberProfileProvisioningService: WorkspaceMemberProfileProvisioningService,
  ) {}

  @OnDatabaseBatchEvent('workspaceMember', DatabaseEventAction.CREATED)
  async handleCreatedEvent(
    payload: WorkspaceEventBatch<
      ObjectRecordCreateEvent<WorkspaceMemberWorkspaceEntity>
    >,
  ) {
    for (const eventPayload of payload.events) {
      await this.workspaceMemberProfileProvisioningService.syncWorkspaceMemberProfileFromWorkspaceMemberData(
        payload.workspaceId,
        eventPayload.recordId,
        eventPayload.properties.after,
      );
    }
  }

  @OnDatabaseBatchEvent('workspaceMember', DatabaseEventAction.UPDATED)
  async handleUpdatedEvent(
    payload: WorkspaceEventBatch<
      ObjectRecordUpdateEvent<WorkspaceMemberWorkspaceEntity>
    >,
  ) {
    for (const eventPayload of payload.events) {
      await this.workspaceMemberProfileProvisioningService.syncWorkspaceMemberProfileFromWorkspaceMemberData(
        payload.workspaceId,
        eventPayload.recordId,
        eventPayload.properties.after,
      );
    }
  }
}
