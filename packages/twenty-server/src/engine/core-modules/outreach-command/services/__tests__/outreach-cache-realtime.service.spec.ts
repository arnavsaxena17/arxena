import { Test, type TestingModule } from '@nestjs/testing';

import { OutreachCacheRealtimeService } from 'src/engine/core-modules/outreach-command/services/outreach-cache-realtime.service';
import {
  OUTREACH_CACHE_UPDATED_EVENT,
  outreachProjectCacheRoom,
} from 'src/engine/core-modules/outreach-command/utils/outreach-cache-realtime.constants';
import { WebSocketService } from 'src/modules/websocket/websocket.service';

describe('OutreachCacheRealtimeService', () => {
  let service: OutreachCacheRealtimeService;
  let sendToRoom: jest.Mock;

  beforeEach(async () => {
    sendToRoom = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutreachCacheRealtimeService,
        {
          provide: WebSocketService,
          useValue: { sendToRoom },
        },
      ],
    }).compile();

    service = module.get(OutreachCacheRealtimeService);
  });

  it('should emit outreach-cache-updated to the project room', () => {
    service.notifyProjectCacheUpdated('project-1', 'people');

    expect(sendToRoom).toHaveBeenCalledWith(
      outreachProjectCacheRoom('project-1'),
      OUTREACH_CACHE_UPDATED_EVENT,
      {
        projectId: 'project-1',
        kind: 'people',
      },
    );
  });

  it('should skip empty project ids', () => {
    service.notifyProjectCacheUpdated('', 'companies');

    expect(sendToRoom).not.toHaveBeenCalled();
  });
});
