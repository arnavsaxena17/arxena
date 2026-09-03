import { Test, type TestingModule } from '@nestjs/testing';

import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { OutreachCacheRealtimeService } from 'src/engine/core-modules/outreach-command/services/outreach-cache-realtime.service';
import { OutreachPeopleCacheService } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';

describe('OutreachPeopleCacheService', () => {
  let service: OutreachPeopleCacheService;
  let cacheSet: jest.Mock;
  let notifyProjectCacheUpdated: jest.Mock;

  beforeEach(async () => {
    cacheSet = jest.fn().mockResolvedValue(undefined);
    notifyProjectCacheUpdated = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutreachPeopleCacheService,
        {
          provide: CacheStorageNamespace.EngineOutreachCommand,
          useValue: {
            get: jest.fn(),
            set: cacheSet,
            del: jest.fn(),
          },
        },
        {
          provide: OutreachCacheRealtimeService,
          useValue: { notifyProjectCacheUpdated },
        },
      ],
    }).compile();

    service = module.get(OutreachPeopleCacheService);
  });

  it('should notify the project room after writing people', async () => {
    await service.set('workspace-1', 'project-1', [
      {
        id: 'person-1',
        name: 'Ada Lovelace',
        title: 'Engineer',
        companyId: '',
        companyName: 'Analytical Engines',
        linkedinUrl: '',
        warmPath: '—',
        stage: 'queued',
        email: '',
      },
    ]);

    expect(cacheSet).toHaveBeenCalled();
    expect(notifyProjectCacheUpdated).toHaveBeenCalledWith(
      'project-1',
      'people',
    );
  });
});
