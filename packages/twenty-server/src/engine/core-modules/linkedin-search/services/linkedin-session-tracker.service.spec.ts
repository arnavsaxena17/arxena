import { Test, TestingModule } from '@nestjs/testing';
import { LinkedInSessionTrackerService } from './linkedin-session-tracker.service';

describe('LinkedInSessionTrackerService', () => {
  let service: LinkedInSessionTrackerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LinkedInSessionTrackerService],
    }).compile();

    service = module.get<LinkedInSessionTrackerService>(LinkedInSessionTrackerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should track requests correctly', async () => {
    const workspaceId = 'test-workspace-123';
    
    // First request should be allowed
    const result1 = await service.trackRequest(workspaceId, 'search');
    expect(result1.allowed).toBe(true);
    expect(result1.count).toBe(1);
    expect(result1.warning).toBeUndefined();

    // Second request should be allowed
    const result2 = await service.trackRequest(workspaceId, 'search');
    expect(result2.allowed).toBe(true);
    expect(result2.count).toBe(2);
    expect(result2.warning).toBeUndefined();

    // Check status
    const status = await service.getRequestStatus(workspaceId);
    expect(status.count).toBe(2);
    expect(status.remaining).toBe(18); // 20 - 2
  });

  it('should show warning when approaching limit', async () => {
    const workspaceId = 'test-workspace-warning';
    
    // Make 10 requests to trigger warning
    for (let i = 0; i < 10; i++) {
      const result = await service.trackRequest(workspaceId, 'search');
      expect(result.allowed).toBe(true);
    }

    // 11th request should show warning
    const result = await service.trackRequest(workspaceId, 'search');
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(11);
    expect(result.warning).toContain('Warning');
  });

  it('should block requests when limit exceeded', async () => {
    const workspaceId = 'test-workspace-limit';
    
    // Make 20 requests to reach limit
    for (let i = 0; i < 20; i++) {
      const result = await service.trackRequest(workspaceId, 'search');
      expect(result.allowed).toBe(true);
    }

    // 21st request should be blocked
    const result = await service.trackRequest(workspaceId, 'search');
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(21);
    expect(result.warning).toContain('limit exceeded');
  });

  it('should reset daily count correctly', async () => {
    const workspaceId = 'test-workspace-reset';
    
    // Make some requests
    await service.trackRequest(workspaceId, 'search');
    await service.trackRequest(workspaceId, 'search');
    
    let status = await service.getRequestStatus(workspaceId);
    expect(status.count).toBe(2);

    // Reset count
    await service.resetDailyCount(workspaceId);
    
    status = await service.getRequestStatus(workspaceId);
    expect(status.count).toBe(0);
  });

  it('should handle different workspaces independently', async () => {
    const workspace1 = 'workspace-1';
    const workspace2 = 'workspace-2';
    
    // Make requests for workspace 1
    await service.trackRequest(workspace1, 'search');
    await service.trackRequest(workspace1, 'search');
    
    // Make requests for workspace 2
    await service.trackRequest(workspace2, 'search');
    
    const status1 = await service.getRequestStatus(workspace1);
    const status2 = await service.getRequestStatus(workspace2);
    
    expect(status1.count).toBe(2);
    expect(status2.count).toBe(1);
  });

  it('should clean up old data', () => {
    // This test would need to be more sophisticated to test date-based cleanup
    // For now, just ensure the method exists and doesn't throw
    expect(() => service.cleanupOldData()).not.toThrow();
  });
});
