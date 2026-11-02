import { OUTREACH_DRAFT_DEFAULT_TEMPLATES } from 'twenty-shared/arx';

import { type OutreachPersonRow } from '@/outreach-home/types/outreach-home.types';
import {
  buildOutreachDraftPreviewValues,
  buildOutreachDraftVariableCoverage,
  getOutreachDraftAttachmentFileNames,
} from '@/outreach-home/utils/outreachDraftPreview';
import { type OutreachDraftSettings } from '@/outreach-home/utils/outreach-draft-templates-api';

const buildPerson = (
  overrides: Partial<OutreachPersonRow> = {},
): OutreachPersonRow => ({
  id: 'person-1',
  name: 'Priya Sharma',
  title: 'Head of Retail',
  companyId: 'company-1',
  companyName: 'Acme Retail',
  linkedinUrl: 'https://www.linkedin.com/in/priya-sharma',
  warmPath: '',
  stage: 'QUEUED',
  email: 'priya@acme.example',
  ...overrides,
});

const buildSettings = (
  overrides: Partial<OutreachDraftSettings> = {},
): OutreachDraftSettings => ({
  templates: { ...OUTREACH_DRAFT_DEFAULT_TEMPLATES },
  attachments: {},
  senderName: 'Arnav Saxena',
  senderWebsite: 'www.example.com',
  ...overrides,
});

describe('buildOutreachDraftPreviewValues', () => {
  it('falls back to sample values when no prospect is selected', () => {
    const values = buildOutreachDraftPreviewValues({
      settings: buildSettings(),
      person: undefined,
    });

    expect(values['person.firstName']).toBe('Priya');
    expect(values['company.name']).toBe('Acme Retail');
  });

  it('takes the sender from settings instead of the sample', () => {
    const values = buildOutreachDraftPreviewValues({
      settings: buildSettings({ senderName: '', senderWebsite: '' }),
      person: undefined,
    });

    expect(values['sender.name']).toBe('');
    expect(values['sender.website']).toBe('');
  });

  it('uses the first word as the prospect first name', () => {
    const values = buildOutreachDraftPreviewValues({
      settings: buildSettings(),
      person: buildPerson({ name: '  Priya Sharma  ' }),
    });

    expect(values['person.firstName']).toBe('Priya');
    expect(values['person.fullName']).toBe('Priya Sharma');
  });
});

describe('buildOutreachDraftVariableCoverage', () => {
  it('counts prospects whose referenced variable is empty', () => {
    const gaps = buildOutreachDraftVariableCoverage({
      template: 'Hi {{person.firstName}} at {{company.name}}',
      people: [
        buildPerson(),
        buildPerson({ id: 'person-2', companyName: '   ' }),
        buildPerson({ id: 'person-3', companyName: '' }),
      ],
      settings: buildSettings(),
    });

    expect(gaps).toEqual([
      { variableKey: 'company.name', label: 'Company Name', missingCount: 2 },
    ]);
  });

  it('ignores variables the template does not reference', () => {
    const gaps = buildOutreachDraftVariableCoverage({
      template: 'Hi {{person.firstName}}',
      people: [buildPerson({ companyName: '' })],
      settings: buildSettings(),
    });

    expect(gaps).toEqual([]);
  });

  it('ignores unknown variables, which validation reports instead', () => {
    const gaps = buildOutreachDraftVariableCoverage({
      template: 'Hi {{nickname}}',
      people: [buildPerson()],
      settings: buildSettings(),
    });

    expect(gaps).toEqual([]);
  });

  it('counts a blank sender field once per prospect', () => {
    const gaps = buildOutreachDraftVariableCoverage({
      template: '{{sender.name}} — {{sender.website}}',
      people: [buildPerson(), buildPerson({ id: 'person-2' })],
      settings: buildSettings({ senderWebsite: '' }),
    });

    expect(gaps).toEqual([
      {
        variableKey: 'sender.website',
        label: 'Sender Website',
        missingCount: 2,
      },
    ]);
  });

  it('returns no gaps without prospects', () => {
    const gaps = buildOutreachDraftVariableCoverage({
      template: 'Hi {{person.firstName}}',
      people: [],
      settings: buildSettings(),
    });

    expect(gaps).toEqual([]);
  });
});

describe('getOutreachDraftAttachmentFileNames', () => {
  it('keeps uploaded file names and variable references', () => {
    const names = getOutreachDraftAttachmentFileNames([
      {
        id: '7f8a1b2c-3d4e-5f60-8a9b-0c1d2e3f4a5b',
        name: 'deck.pdf',
        size: 1024,
        type: 'application/pdf',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      '{{step.files}}',
    ]);

    expect(names).toEqual(['deck.pdf', '{{step.files}}']);
  });

  it('returns an empty list when nothing is attached', () => {
    expect(getOutreachDraftAttachmentFileNames([])).toEqual([]);
  });
});
