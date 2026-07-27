---
name: attachment-files-field-migration
description: >-
  Migrates ARX Attachment create/list/download call sites from workflows-era
  uploadFile+fullPath+short FKs to current FILES-field uploads, target*Id morph
  FKs, and file[0].url. Use when fixing UploadCV, AttachmentPanel, JD
  attachments, candidate CV upload, arx-chat attachment-processes, or any
  createAttachment / findManyAttachments / fullPath download path.
---

# Attachment FILES-field migration (`workflows` → current)

Attachments are workspace CRM records. Binary lives in `FileEntity`; the
attachment row links via morph FKs and a FILES field.

## Remap table

| Legacy (`workflows`) | Current |
| --- | --- |
| `uploadFile` + `FileFolder.Attachment` | `createFileUpload` → PUT → `completeFileUpload` with `FileFolder.FilesField` (+ attachment `file` field metadata id), **or** front `useUploadAttachmentFile` / `useDirectFileUpload` |
| Server multipart `uploadFile` | `uploadFilesFieldFileByUniversalIdentifier` with attachment.file UUID `20202020-15db-460e-8166-c7b5d87ad4be` |
| Create: `fullPath`, `name`, `type`/`fileCategory`, `authorId`, `candidateId` | Create: `file: [{ fileId, label }]`, optional deprecated `name`/`fileCategory`, **omit** `authorId` (`createdBy` auto), `targetCandidateId` (etc.) |
| Filter: `candidateId` / `projectId` / `personId` / `companyId` | `targetCandidateId` / `targetProjectId` / `targetPersonId` / `targetCompanyId` |
| Download: `attachment.fullPath` | `attachment.file[0].url` (fallback `fullPath` only for pre-migration rows) |
| FK helper: `` `${name}Id` `` | `` `target${Capitalize(name)}Id` `` (`getActivityTargetObjectFieldIdName`) |

ARX-only relation FKs that are **not** morph targets of the attachment `target`
field (e.g. `cvSentId`, `videoInterviewResponseId`, `whatsappMessageId` if still
short names in the workspace schema) stay as-is until confirmed morph’d.

## Canonical front patterns

### Add attachment to record

```typescript
const { uploadAttachmentFile } = useUploadAttachmentFile();

await uploadAttachmentFile(file, {
  targetObjectNameSingular: 'candidate', // or 'project', 'person', …
  id: recordId,
});
// → FILES upload + createAttachment({ file: [{ fileId, label }], targetCandidateId })
```

Do **not** hand-roll `uploadFile` / `fullPath` / `candidateId`.

### List attachments for record

```typescript
filter: { targetCandidateId: { eq: candidateId } }
// or useAttachments({ targetObjectNameSingular: 'candidate', id })
```

### Download / preview URL

```typescript
import { getAttachmentDownloadUrl } from 'twenty-shared/utils';
// or front: getAttachmentUrl after filterAttachmentsWithFile

const url = getAttachmentDownloadUrl(attachment);
// prefers file[0].url, falls back to fullPath for legacy rows
```

## Canonical server patterns

Use / extend `AttachmentProcessingService`
(`arx-chat/utils/attachment-processes.ts`):

1. Upload bytes → `{ fileId, url, label }` via FILES-field upload
2. `createAttachment` with `file: [{ fileId, label }]` + `target*Id`
3. List with `target*Id` filters
4. Read URLs via `getAttachmentDownloadUrl`

```typescript
const uploaded = await attachmentProcessing.uploadAttachmentFile(filePath, apiToken);
await attachmentProcessing.createAttachmentFromUploadedFile(
  {
    input: {
      name: fileName,
      file: [{ fileId: uploaded.fileId, label: fileName }],
      fileCategory: 'TEXT_DOCUMENT',
      targetCandidateId: candidateId,
    },
  },
  apiToken,
);
```

## Checklist per call site

```
- [ ] Replace uploadFile / FileFolder.Attachment
- [ ] Create uses file[] + target*Id (no authorId / short morph FK)
- [ ] List/filter uses target*Id
- [ ] Download uses file[0].url (fullPath fallback OK)
- [ ] Shared GQL strings select file { fileId label extension url } + target*Id
- [ ] Rebuild twenty-shared + restart nest if shared GraphQL strings changed
```

## Sibling greps

```bash
rg -n 'uploadFile|FileFolder\.Attachment|fileFolder:\s*"Attachment"' packages/twenty-{front,server,shared}/src
rg -n 'fullPath|candidateId:|projectId:\s*\{\s*eq|filter:.*candidateId|filter:.*projectId' packages/twenty-front/src/modules/{candidate-table,arx-jd-upload,candidate-search,assistant,video-interview}
rg -n 'graphQLtoCreateOneAttachmentFromFilePath|findManyAttachmentsQuery|createOneAttachmentFromFilePath|uploadAttachmentToTwenty|uploadFileToTwenty|createCvAttachment' packages/twenty-{front,server,shared}/src
rg -n 'attachment\.fullPath|node\.fullPath' packages/twenty-{front,server}/src
```

## Catalog

When fixing attachment call sites, update
`docs/port-front-migration-track.md` §2.10 / §0 / §6 and follow
`.cursor/rules/port-workflows-catalog.mdc`.

## Reference implementations

- Front create: `useUploadAttachmentFile` + `UploadCV.tsx`
- Front list/download: `useAttachments` / `AttachmentPanel.tsx`
- Server hub: `attachment-processes.ts`
- Shared: `twenty-shared` `getAttachmentDownloadUrl`, create/findMany attachment GQL
