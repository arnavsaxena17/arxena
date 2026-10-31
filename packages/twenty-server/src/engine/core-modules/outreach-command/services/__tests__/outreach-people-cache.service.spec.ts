import { Test, type TestingModule } from '@nestjs/testing';

import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { OutreachCacheRealtimeService } from 'src/engine/core-modules/outreach-command/services/outreach-cache-realtime.service';
import { OutreachPeopleCacheService } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import { OutreachProjectCacheBackupService } from 'src/engine/core-modules/outreach-command/services/outreach-project-cache-backup.service';

const person = {
  id: 'person-1',
  name: 'Ada Lovelace',
  title: 'Engineer',
  companyId: '',
  companyName: 'Analytical Engines',
  linkedinUrl: '',
  warmPath: '—',
  stage: 'QUEUED',
  email: '',
};

describe('OutreachPeopleCacheService', () => {
  let service: OutreachPeopleCacheService;
  let cacheGet: jest.Mock;
  let cacheSet: jest.Mock;
  let cacheDel: jest.Mock;
  let notifyProjectCacheUpdated: jest.Mock;
  let backupWrite: jest.Mock;
  let backupRead: jest.Mock;
  let backupRemove: jest.Mock;

  beforeEach(async () => {
    cacheGet = jest.fn().mockResolvedValue(undefined);
    cacheSet = jest.fn().mockResolvedValue(undefined);
    cacheDel = jest.fn().mockResolvedValue(undefined);
    notifyProjectCacheUpdated = jest.fn();
    backupWrite = jest.fn().mockResolvedValue(undefined);
    backupRead = jest.fn().mockResolvedValue(undefined);
    backupRemove = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutreachPeopleCacheService,
        {
          provide: CacheStorageNamespace.EngineOutreachCommand,
          useValue: {
            get: cacheGet,
            set: cacheSet,
            del: cacheDel,
          },
        },
        {
          provide: OutreachCacheRealtimeService,
          useValue: { notifyProjectCacheUpdated },
        },
        {
          provide: OutreachProjectCacheBackupService,
          useValue: {
            write: backupWrite,
            read: backupRead,
            remove: backupRemove,
          },
        },
      ],
    }).compile();

    service = module.get(OutreachPeopleCacheService);
  });

  it('should dual-write Redis and S3 backup on set', async () => {
    await service.set('workspace-1', 'project-1', [person]);

    expect(cacheSet).toHaveBeenCalled();
    expect(backupWrite).toHaveBeenCalledWith(
      'workspace-1',
      'people',
      'project-1',
      expect.objectContaining({
        projectId: 'project-1',
        people: [person],
      }),
    );
    // No written rows given, so listeners refetch instead of applying a delta
    expect(notifyProjectCacheUpdated).toHaveBeenCalledWith(
      'project-1',
      'people',
      undefined,
    );
  });

  it('should hand the written rows to the event so the client can apply a delta', async () => {
    const second = { ...person, id: 'person-2', name: 'Grace Hopper' };

    await service.set('workspace-1', 'project-1', [person, second], {
      writtenRows: [second],
    });

    expect(notifyProjectCacheUpdated).toHaveBeenCalledWith(
      'project-1',
      'people',
      [second],
    );
  });

  it('should rehydrate Redis from S3 when Redis misses', async () => {
    const payload = {
      people: [person],
      projectId: 'project-1',
      cachedAt: 1,
    };

    cacheGet.mockResolvedValueOnce(undefined);
    backupRead.mockResolvedValueOnce(payload);

    const result = await service.get('workspace-1', 'project-1');

    expect(result).toEqual(payload);
    expect(backupRead).toHaveBeenCalledWith(
      'workspace-1',
      'people',
      'project-1',
    );
    expect(cacheSet).toHaveBeenCalledWith(
      'gtm-people:workspace-1:project-1',
      payload,
      expect.any(Number),
    );
  });

  it('should collapse duplicate rows before writing them', async () => {
    const harvestRow = {
      ...person,
      id: 'harvest-row',
      name: 'Naveen Srivastava',
      companyName: 'Jubilant FoodWorks Ltd.',
      linkedinUrl:
        'https://www.linkedin.com/in/ACwAAAOe40MBPIme-JeJEEBEnnp0xtsjypwL6ks',
    };
    const googleRow = {
      ...person,
      id: 'google-row',
      name: 'Naveen Srivastava',
      companyName: 'Jubilant FoodWorks',
      linkedinUrl: 'https://in.linkedin.com/in/naveen-supplychain-strategy',
    };

    await service.set('workspace-1', 'project-1', [harvestRow, googleRow]);

    expect(backupWrite).toHaveBeenCalledWith(
      'workspace-1',
      'people',
      'project-1',
      expect.objectContaining({
        people: [expect.objectContaining({ id: 'harvest-row' })],
      }),
    );
  });

  it('should clear Redis and S3 on delete', async () => {
    await service.delete('workspace-1', 'project-1');

    expect(cacheDel).toHaveBeenCalledWith('gtm-people:workspace-1:project-1');
    expect(backupRemove).toHaveBeenCalledWith(
      'workspace-1',
      'people',
      'project-1',
    );
    expect(notifyProjectCacheUpdated).toHaveBeenCalledWith(
      'project-1',
      'people',
    );
  });
});
