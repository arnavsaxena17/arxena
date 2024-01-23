import { Injectable } from '@nestjs/common';

import { TimelineThread } from 'src/core/messaging/timeline-messaging.resolver';
import { TypeORMService } from 'src/database/typeorm/typeorm.service';
import { DataSourceService } from 'src/metadata/data-source/data-source.service';

@Injectable()
export class TimelineMessagingService {
  constructor(
    private readonly dataSourceService: DataSourceService,
    private readonly typeORMService: TypeORMService,
  ) {}

  async getMessagesFromPersonIds(
    workspaceId: string,
    personIds: string[],
  ): Promise<TimelineThread[]> {
    const dataSourceMetadata =
      await this.dataSourceService.getLastDataSourceMetadataFromWorkspaceIdOrFail(
        workspaceId,
      );

    const workspaceDataSource =
      await this.typeORMService.connectToDataSource(dataSourceMetadata);

    // 10 first threads This hard limit is just for the POC, we will implement pagination later
    const messageThreads = await workspaceDataSource?.query(
      `
    SELECT 
        subquery.*,
        message_count,
        last_message_subject,
        last_message_text,
        last_message_received_at,
        last_message_participant_handle,
        last_message_participant_displayName
    FROM (
        SELECT 
            mt.*,
            COUNT(m."id") OVER (PARTITION BY mt."id") AS message_count,
            FIRST_VALUE(m."subject") OVER (PARTITION BY mt."id" ORDER BY m."receivedAt" DESC) AS last_message_subject,
            FIRST_VALUE(m."text") OVER (PARTITION BY mt."id" ORDER BY m."receivedAt" DESC) AS last_message_text,
            FIRST_VALUE(m."receivedAt") OVER (PARTITION BY mt."id" ORDER BY m."receivedAt" DESC) AS last_message_received_at,
            FIRST_VALUE(mr."handle") OVER (PARTITION BY mt."id" ORDER BY m."receivedAt" DESC) AS last_message_participant_handle,
            FIRST_VALUE(mr."displayName") OVER (PARTITION BY mt."id" ORDER BY m."receivedAt" DESC) AS last_message_participant_displayName,
            ROW_NUMBER() OVER (PARTITION BY mt."id" ORDER BY m."receivedAt" DESC) AS rn
        FROM 
            ${dataSourceMetadata.schema}."messageThread" mt
        LEFT JOIN 
            ${dataSourceMetadata.schema}."message" m ON mt."id" = m."messageThreadId"
        LEFT JOIN 
            ${dataSourceMetadata.schema}."messageParticipant" mr ON m."id" = mr."messageId"
        WHERE 
            mr."personId" IN (SELECT unnest($1::uuid[]))
    ) AS subquery
    WHERE 
        subquery.rn = 1
    ORDER BY 
        subquery.last_message_received_at DESC
    LIMIT 10;
`,
      [personIds],
    );

    const formattedMessageThreads = messageThreads.map((messageThread) => {
      return {
        read: true,
        senderName: messageThread.last_message_participant_handle,
        senderPictureUrl: '',
        numberOfMessagesInThread: messageThread.message_count,
        subject: messageThread.last_message_subject,
        body: messageThread.last_message_text,
        receivedAt: messageThread.last_message_received_at,
      };
    });

    return formattedMessageThreads;
  }

  async getMessagesFromCompanyId(workspaceId: string, companyId: string) {
    const dataSourceMetadata =
      await this.dataSourceService.getLastDataSourceMetadataFromWorkspaceIdOrFail(
        workspaceId,
      );

    const workspaceDataSource =
      await this.typeORMService.connectToDataSource(dataSourceMetadata);

    const personIds = await workspaceDataSource?.query(
      `
        SELECT 
            p."id"
        FROM
            ${dataSourceMetadata.schema}."person" p
        WHERE
            p."companyId" = $1
        `,
      [companyId],
    );

    if (!personIds) {
      return [];
    }

    const formattedPersonIds = personIds.map((personId) => personId.id);

    const messageThreads = await this.getMessagesFromPersonIds(
      workspaceId,
      formattedPersonIds,
    );

    return messageThreads;
  }
}
