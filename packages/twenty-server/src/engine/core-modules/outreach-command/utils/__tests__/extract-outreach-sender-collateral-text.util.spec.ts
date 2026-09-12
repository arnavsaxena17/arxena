import {
  extractOutreachSenderCollateralText,
  isOutreachSenderCollateralExtensionSupported,
} from 'src/engine/core-modules/outreach-command/utils/extract-outreach-sender-collateral-text.util';

describe('extractOutreachSenderCollateralText', () => {
  it('should accept txt and markdown extensions', () => {
    expect(isOutreachSenderCollateralExtensionSupported('notes.txt')).toBe(
      true,
    );
    expect(isOutreachSenderCollateralExtensionSupported('deck.md')).toBe(true);
    expect(isOutreachSenderCollateralExtensionSupported('slides.pptx')).toBe(
      false,
    );
  });

  it('should extract plain text files', async () => {
    const text = await extractOutreachSenderCollateralText({
      fileName: 'pitch.txt',
      fileBuffer: Buffer.from('We help factories book demos.', 'utf8'),
    });

    expect(text).toBe('We help factories book demos.');
  });

  it('should reject PowerPoint with a clear message', async () => {
    await expect(
      extractOutreachSenderCollateralText({
        fileName: 'pitch.pptx',
        fileBuffer: Buffer.from('fake'),
      }),
    ).rejects.toThrow(/PowerPoint extraction is not supported/);
  });

  it('should reject unknown extensions', async () => {
    await expect(
      extractOutreachSenderCollateralText({
        fileName: 'pitch.xyz',
        fileBuffer: Buffer.from('fake'),
      }),
    ).rejects.toThrow(/Unsupported file type/);
  });
});
