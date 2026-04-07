# Workspace activation and metadata queues

## Async workspace activation

- `activateWorkspace` returns quickly after setting `activationStatus` to `ONGOING_CREATION` and enqueueing a job on `workspace-queue` (`CompleteWorkspaceActivationJob`).
- BullMQ job id pattern: `workspace-${workspaceId}-activate-*` (driver appends a suffix for uniqueness). Duplicate enqueue attempts while a job is waiting or active are skipped in the driver.
- If the worker throws, activation is reset to `PENDING_CREATION` so the user can retry.
- **Operations:** If Redis or queue workers are down, workspaces can remain stuck in `ONGOING_CREATION`. Monitor queue depth and failed jobs; requeue or reset `activationStatus` after investigation.

## Metadata structure queue

- `POST /workspace-modifications/create-metadata-structure` returns HTTP **202** and enqueues `CreateMetadataStructureJob` on `metadata-structure-queue`.
- After successful activation, the server may also enqueue metadata creation using a freshly minted access token (see `WorkspaceService.completeWorkspaceActivation`).
