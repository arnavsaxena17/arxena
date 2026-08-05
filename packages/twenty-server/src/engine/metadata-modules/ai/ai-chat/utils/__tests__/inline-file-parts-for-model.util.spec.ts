import {
  inlineFilePartsForModel,
  shouldInlineFileUrlForModel,
} from 'src/engine/metadata-modules/ai/ai-chat/utils/inline-file-parts-for-model.util';

const buildUserMessageWithFile = (url: string) => ({
  id: 'msg-1',
  role: 'user' as const,
  parts: [
    {
      type: 'file' as const,
      mediaType: 'image/png',
      filename: 'shot.png',
      url,
      fileId: 'file-1',
    },
  ],
});

describe('shouldInlineFileUrlForModel', () => {
  it('inlines http(s) urls', () => {
    expect(
      shouldInlineFileUrlForModel(
        'http://localhost:3000/file/AgentChat/abc?token=t',
      ),
    ).toBe(true);
    expect(
      shouldInlineFileUrlForModel(
        'https://api.example.com/file/AgentChat/abc?token=t',
      ),
    ).toBe(true);
    expect(shouldInlineFileUrlForModel('')).toBe(true);
  });

  it('skips data urls', () => {
    expect(shouldInlineFileUrlForModel('data:image/png;base64,abc')).toBe(
      false,
    );
  });
});

describe('inlineFilePartsForModel', () => {
  it('replaces signed file urls with data urls', async () => {
    const messages = [
      buildUserMessageWithFile(
        'http://localhost:3000/file/AgentChat/file-1?token=t',
      ),
    ];

    const result = await inlineFilePartsForModel(messages, async () => ({
      buffer: Buffer.from('png-bytes'),
      mimeType: 'image/png',
    }));

    expect(result[0].parts[0]).toMatchObject({
      type: 'file',
      fileId: 'file-1',
      mediaType: 'image/png',
      url: `data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}`,
    });
  });

  it('does not reload existing data urls', async () => {
    const loadFileContent = jest.fn();
    const dataUrl = 'data:image/png;base64,abc';
    const messages = [buildUserMessageWithFile(dataUrl)];

    const result = await inlineFilePartsForModel(messages, loadFileContent);

    expect(loadFileContent).not.toHaveBeenCalled();
    expect(result[0].parts[0]).toEqual(messages[0].parts[0]);
  });

  it('downgrades missing files to a text note', async () => {
    const messages = [
      buildUserMessageWithFile(
        'http://localhost:3000/file/AgentChat/file-1?token=t',
      ),
    ];

    const result = await inlineFilePartsForModel(messages, async () => null);

    expect(result[0].parts[0]).toEqual({
      type: 'text',
      text: '[Attached file: shot.png could not be loaded for model analysis]',
    });
  });
});
