import { formatMcpServersConfig } from '~/pages/settings/ai/utils/formatMcpServersConfig';

describe('formatMcpServersConfig', () => {
  it('should pretty print valid JSON with two spaces', () => {
    expect(formatMcpServersConfig('{"mcpServers":{"a":{"url":"https://x"}}}')).toEqual({
      isValid: true,
      formattedText:
        '{\n  "mcpServers": {\n    "a": {\n      "url": "https://x"\n    }\n  }\n}',
    });
  });

  it('should report the line of a syntax error', () => {
    const result = formatMcpServersConfig('{\n  "a": 1,\n  "b": }\n}');

    expect(result.isValid).toBe(false);
  });
});
