import { Injectable } from '@nestjs/common';

import { OnDatabaseBatchEvent } from 'src/engine/api/graphql/graphql-query-runner/decorators/on-database-batch-event.decorator';
import { DatabaseEventAction } from 'src/engine/api/graphql/graphql-query-runner/enums/database-event-action';
import { ObjectRecordCreateEvent } from 'src/engine/core-modules/event-emitter/types/object-record-create.event';
import { ObjectRecordUpdateEvent } from 'src/engine/core-modules/event-emitter/types/object-record-update.event';
import { WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event.type';
import { WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';

import { WorkspaceMemberProfileProvisioningService } from 'src/engine/core-modules/user-workspace/workspace-member-profile-provisioning.service';

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
