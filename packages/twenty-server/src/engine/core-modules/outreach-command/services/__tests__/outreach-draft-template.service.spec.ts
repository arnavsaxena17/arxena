import { type Repository } from 'typeorm';

import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { OutreachDraftTemplateService } from 'src/engine/core-modules/outreach-command/services/outreach-draft-template.service';
import { type GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';

const buildService = (companyDomain: string | null = 'www.acme.com') =>
  new OutreachDraftTemplateService(
    {} as GlobalWorkspaceOrmManager,
    {
      findOne: jest.fn().mockResolvedValue({ id: 'workspace', companyDomain }),
    } as unknown as Repository<WorkspaceEntity>,
  );

const FULL_INPUT = {
  personFirstName: 'Priya',
  personLastName: 'Sharma',
  companyName: 'Acme Retail',
  senderFirstName: 'Arnav',
  senderLastName: 'Saxena',
};

describe('OutreachDraftTemplateService.render', () => {
  it('should fill the member template for the candidate', async () => {
    const result = await buildService().render({
      workspaceId: 'workspace',
      input: {
        ...FULL_INPUT,
        templateKey: 'followUp2',
        template:
          'Hi {{person.firstName}} at {{company.name}}, {{sender.name}}',
      },
    });

    expect(result).toEqual({
      success: true,
      message: 'Hi Priya at Acme Retail, Arnav Saxena',
      error: '',
    });
  });

  it('should fall back to the seeded default when the member template is empty', async () => {
    const result = await buildService().render({
      workspaceId: 'workspace',
      input: { ...FULL_INPUT, templateKey: 'firstMessage', template: '' },
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Hi Priya,');
    expect(result.message).toContain('www.acme.com');
  });

  it('should fail, blocking the send, when a variable is empty', async () => {
    const result = await buildService().render({
      workspaceId: 'workspace',
      input: {
        ...FULL_INPUT,
        companyName: undefined,
        templateKey: 'firstMessage',
        template: 'Hello {{company.name}}',
      },
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('');
    expect(result.error).toContain('Company Name is empty');
  });

  it('should fail when the workspace has no website but the template uses it', async () => {
    const result = await buildService(null).render({
      workspaceId: 'workspace',
      input: {
        ...FULL_INPUT,
        templateKey: 'firstMessage',
        template: 'Visit {{sender.website}}',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Sender Website is empty');
  });

  it('should reject an unknown template key', async () => {
    const result = await buildService().render({
      workspaceId: 'workspace',
      input: { ...FULL_INPUT, templateKey: 'nope' },
    });

    expect(result.success).toBe(false);
  });
});
