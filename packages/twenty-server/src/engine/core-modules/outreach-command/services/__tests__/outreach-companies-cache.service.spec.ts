import { Test, type TestingModule } from '@nestjs/testing';

import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { OutreachCacheRealtimeService } from 'src/engine/core-modules/outreach-command/services/outreach-cache-realtime.service';
import { OutreachCompaniesCacheService } from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import { OutreachProjectCacheBackupService } from 'src/engine/core-modules/outreach-command/services/outreach-project-cache-backup.service';

const company = {
  id: 'company-1',
  name: 'Acme',
  domain: 'acme.com',
  industry: '',
  employees: '',
  segment: '',
  icpFit: '',
  status: 'new',
};

describe('OutreachCompaniesCacheService', () => {
  let service: OutreachCompaniesCacheService;
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
        OutreachCompaniesCacheService,
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

    service = module.get(OutreachCompaniesCacheService);
  });

  it('should dual-write Redis and S3 backup on set', async () => {
    await service.set('workspace-1', 'project-1', [company]);

    expect(cacheSet).toHaveBeenCalled();
    expect(backupWrite).toHaveBeenCalledWith(
      'workspace-1',
      'companies',
      'project-1',
      expect.objectContaining({
        projectId: 'project-1',
        companies: [company],
      }),
    );
    expect(notifyProjectCacheUpdated).toHaveBeenCalledWith(
      'project-1',
      'companies',
    );
  });

  it('should rehydrate Redis from S3 when Redis misses', async () => {
    const payload = {
      companies: [company],
      projectId: 'project-1',
      cachedAt: 1,
    };

    cacheGet.mockResolvedValueOnce(undefined);
    backupRead.mockResolvedValueOnce(payload);

    const result = await service.get('workspace-1', 'project-1');

    expect(result).toEqual(payload);
    expect(backupRead).toHaveBeenCalledWith(
      'workspace-1',
      'companies',
      'project-1',
    );
    expect(cacheSet).toHaveBeenCalledWith(
      'gtm-companies:workspace-1:project-1',
      payload,
      expect.any(Number),
    );
  });

  it('should clear Redis and S3 on delete', async () => {
    await service.delete('workspace-1', 'project-1');

    expect(cacheDel).toHaveBeenCalledWith(
      'gtm-companies:workspace-1:project-1',
    );
    expect(backupRemove).toHaveBeenCalledWith(
      'workspace-1',
      'companies',
      'project-1',
    );
    expect(notifyProjectCacheUpdated).toHaveBeenCalledWith(
      'project-1',
      'companies',
    );
  });
});
