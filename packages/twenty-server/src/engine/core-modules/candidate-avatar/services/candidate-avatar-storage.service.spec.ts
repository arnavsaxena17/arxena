import {
    FileStorageException,
    FileStorageExceptionCode,
} from 'src/engine/core-modules/file-storage/interfaces/file-storage-exception';

import { CandidateAvatarFetchService } from './candidate-avatar-fetch.service';
import { CandidateAvatarStorageService } from './candidate-avatar-storage.service';

describe('CandidateAvatarStorageService', () => {
  const fileStorageService = {
    write: jest.fn(),
    read: jest.fn(),
  };
  const fetchService = {
    isAllowedUrl: jest.fn().mockReturnValue(true),
    fetchImageBuffer: jest.fn(),
  };

  let service: CandidateAvatarStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CANDIDATE_AVATAR_INGEST_ENABLED;
    service = new CandidateAvatarStorageService(
      fileStorageService as never,
      fetchService as unknown as CandidateAvatarFetchService,
    );
  });

  it('resolves stable key from linkedin url', () => {
    expect(
      service.resolveStableKey({
        imageUrl: 'https://media.licdn.com/x',
        linkedinUrl: 'https://www.linkedin.com/in/John-Doe/',
      }),
    ).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('detects persisted avatar paths', () => {
    expect(service.isPersistedAvatarUrl('/avatars/abc123')).toBe(true);
    expect(
      service.isPersistedAvatarUrl('https://app.arxena.com/avatars/abc123'),
    ).toBe(true);
    expect(service.isPersistedAvatarUrl('https://media.licdn.com/x')).toBe(
      false,
    );
  });

  it('returns existing avatar without refetch when file exists', async () => {
    fileStorageService.read.mockResolvedValue({ pipe: jest.fn() });

    const result = await service.ingestFromUrl({
      imageUrl: 'https://media.licdn.com/dms/image/v2/test',
      linkedinUrl: 'https://www.linkedin.com/in/test-user',
    });

    expect(result).toMatch(/^\/avatars\/[a-f0-9]{64}$/u);
    expect(fetchService.fetchImageBuffer).not.toHaveBeenCalled();
  });

  it('ingests and writes webp when missing', async () => {
    fileStorageService.read.mockRejectedValue(
      new FileStorageException(
        'File not found',
        FileStorageExceptionCode.FILE_NOT_FOUND,
      ),
    );
    const minimalPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    fetchService.fetchImageBuffer.mockResolvedValue({
      ok: true,
      buffer: minimalPng,
      contentType: 'image/png',
    });

    const result = await service.ingestFromUrl({
      imageUrl: 'https://media.licdn.com/dms/image/v2/test',
      linkedinUrl: 'https://www.linkedin.com/in/test-user',
    });

    expect(result).toMatch(/^\/avatars\/[a-f0-9]{64}$/u);
    expect(fileStorageService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        mimeType: 'image/webp',
        name: 'avatar.webp',
      }),
    );
  });

  it('skips ingest when disabled', async () => {
    process.env.CANDIDATE_AVATAR_INGEST_ENABLED = 'false';
    const url = 'https://media.licdn.com/dms/image/v2/test';

    await expect(
      service.ingestFromUrl({ imageUrl: url }),
    ).resolves.toBe(url);
    expect(fileStorageService.write).not.toHaveBeenCalled();
  });
});
