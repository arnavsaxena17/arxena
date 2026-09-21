import { normalizeOutreachSenderProfile } from 'src/engine/core-modules/outreach-command/utils/outreach-sender-profile.util';

describe('normalizeOutreachSenderProfile collateralFiles', () => {
  it('preserves collateral file ids for send_files resolution', () => {
    const profile = normalizeOutreachSenderProfile({
      targetTitles: ['AE'],
      locations: ['SF'],
      brief: 'Hello',
      collateralFiles: [
        {
          fileId: '11111111-1111-1111-1111-111111111111',
          fileName: 'deck.pptx',
          mimeType:
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        },
        { fileId: '', fileName: 'skip-me.pdf' },
      ],
    });

    expect(profile.collateralFiles).toEqual([
      {
        fileId: '11111111-1111-1111-1111-111111111111',
        fileName: 'deck.pptx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
    ]);
  });
});
