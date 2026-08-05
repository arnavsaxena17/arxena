import { SystemPromptBuilderService } from 'src/engine/metadata-modules/ai/ai-chat/services/system-prompt-builder.service';

describe('SystemPromptBuilderService', () => {
  const buildService = () =>
    new SystemPromptBuilderService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

  describe('buildUserContextSection', () => {
    it('omits the timezone line when timezone is the "system" sentinel', () => {
      const service = buildService();

      const result = service.buildUserContextSection({
        firstName: 'John',
        lastName: 'Doe',
        locale: 'en',
        timezone: 'system',
      });

      expect(result).not.toContain('Timezone:');
      expect(result).toContain('Current date:');
    });

    it('includes the timezone line for a valid IANA timezone', () => {
      const service = buildService();

      const result = service.buildUserContextSection({
        firstName: 'John',
        lastName: 'Doe',
        locale: 'en',
        timezone: 'America/New_York',
      });

      expect(result).toContain('Timezone: America/New_York');
      expect(result).toContain('Current date:');
    });
  });

  describe('buildConnectedAccountsSection', () => {
    it('lists available Unipile search types when connected', () => {
      const service = buildService();

      const result = service.buildConnectedAccountsSection({
        connected: true,
        accountId: 'acc-123',
        inferredSearchType: 'sales_navigator',
        salesNavigatorAvailable: true,
        recruiterAvailable: false,
      });

      expect(result).toContain('## Connected Accounts');
      expect(result).toContain('connected (account_id=acc-123)');
      expect(result).toContain('Preferred searchType: sales_navigator');
      expect(result).toContain(
        'Search types available: classic, sales_navigator',
      );
      expect(result).toContain('Recruiter: not available');
    });

    it('instructs the model not to call Unipile search when disconnected', () => {
      const service = buildService();

      const result = service.buildConnectedAccountsSection({
        connected: false,
        accountId: null,
        inferredSearchType: null,
        salesNavigatorAvailable: false,
        recruiterAvailable: false,
      });

      expect(result).toContain('LinkedIn (Unipile): not connected');
      expect(result).toContain('Do not call search_linkedin_*');
      expect(result).toContain('dataSource: "harvest"');
    });
  });
});
