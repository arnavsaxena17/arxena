import {
  mapArxCandidateToPersonNode,
  processArxCandidate,
} from '../data-transformation-utility';

describe('mapArxCandidateToPersonNode', () => {
  it('maps a bare linkedin_search draft without naukri/avatar fields', () => {
    const personNode = mapArxCandidateToPersonNode({
      firstName: 'Khaled',
      lastName: 'PhD',
      uniqueStringKey: 'khaledphdtabukagriculturaldevelopmentcompany',
      dataSource: 'linkedin_search',
      linkedinUrl: 'https://www.linkedin.com/in/khaled-example',
      jobTitle: 'CFO',
      company: 'Tabuk Agricultural Development Company',
    });

    expect(personNode.uniqueStringKey).toBe(
      'khaledphdtabukagriculturaldevelopmentcompany',
    );
    expect(personNode.name).toEqual({ firstName: 'Khaled', lastName: 'PhD' });
    expect(personNode.jobCompanyName).toBe(
      'Tabuk Agricultural Development Company',
    );
    expect(personNode.hiringNaukriUrl).toBeUndefined();
    expect(personNode.resdexNaukriUrl).toBeUndefined();
    expect(personNode.linkedinLink.primaryLinkUrl).toContain('linkedin.com');
  });

  it('omits broken optional link objects instead of throwing', () => {
    const personNode = mapArxCandidateToPersonNode({
      firstName: 'Ada',
      lastName: 'Lovelace',
      uniqueStringKey: 'adalovelace',
      hiringNaukriUrl: { primaryLinkUrl: undefined },
      resdexNaukriUrl: null,
      displayPicture: null,
    });

    expect(personNode.uniqueStringKey).toBe('adalovelace');
    expect(personNode.hiringNaukriUrl).toBeUndefined();
    expect(personNode.resdexNaukriUrl).toBeUndefined();
  });

  it('falls back to a minimal person when inner mapping throws', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const personNode = mapArxCandidateToPersonNode({
      firstName: 'Broken',
      lastName: 'Draft',
      uniqueStringKey: 'brokendraft',
      // Force a throw inside email parsing path by poisoning parseEmails input shape
      // via a getter that throws when emails.primaryEmail is read after truthy check.
      get emails() {
        throw new Error('emails boom');
      },
    });

    expect(personNode).toEqual(
      expect.objectContaining({
        uniqueStringKey: 'brokendraft',
        name: { firstName: 'Broken', lastName: 'Draft' },
        avatarUrl: '',
      }),
    );
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('processArxCandidate', () => {
  it('still produces candidate + person for linkedin_search without optional urls', async () => {
    const { personNode, candidateNode } = await processArxCandidate(
      {
        firstName: 'Jignesh',
        lastName: 'Patel',
        uniqueStringKey: 'jigneshpatelfalcor',
        dataSource: 'linkedin_search',
        linkedinUrl: 'https://www.linkedin.com/in/jignesh-patel',
      },
      { id: 'project-1' },
      'whatsapp-unipile',
    );

    expect(personNode.uniqueStringKey).toBe('jigneshpatelfalcor');
    expect(candidateNode.projectId).toBe('project-1');
    expect(candidateNode.messagingChannel).toBe('LINKEDIN_CONNECT');
  });
});
