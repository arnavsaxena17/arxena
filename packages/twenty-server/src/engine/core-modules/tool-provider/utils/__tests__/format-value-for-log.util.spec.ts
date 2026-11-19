import { formatValueForLog } from 'src/engine/core-modules/tool-provider/utils/format-value-for-log.util';

describe('formatValueForLog', () => {
  it('keeps the JSON skeleton for short values', () => {
    const text = formatValueForLog({ limit: 5, names: ['a', 'b'] });

    expect(text).toBe(
      '{\n  "limit": 5,\n  "names": [\n    "a",\n    "b"\n  ]\n}',
    );
  });

  it('lifts a long string out of the JSON and prints it uncut', () => {
    const body = `# Skill\n${'line\n'.repeat(3_000)}`;

    const text = formatValueForLog({ content: body });
    const lines = text.split('\n');

    // the marker points at the lifted body instead of the JSON
    expect(text).toContain(`<${body.length} chars, printed below>`);
    // the body follows, with real newlines and nothing dropped
    expect(lines.filter((line) => line === 'line')).toHaveLength(3_000);
    expect(text).not.toContain('truncated');
    expect(text).not.toContain('\\n');
  });

  it('labels lifted strings with their path', () => {
    const text = formatValueForLog({
      skills: [{ content: `# Skill\n${'x'.repeat(300)}` }],
    });

    expect(text).toContain('skills[0].content:');
  });

  it('redacts secrets rather than printing them', () => {
    const text = formatValueForLog({
      apiKey: `sk-live-${'1'.repeat(300)}`,
      password: 'hunter2',
    });

    expect(text).toContain('[redacted]');
    expect(text).not.toContain('sk-live');
    expect(text).not.toContain('hunter2');
  });

  it('survives a value JSON cannot serialise', () => {
    const circular: Record<string, unknown> = {};

    circular.self = circular;

    expect(() => formatValueForLog(circular)).not.toThrow();
  });
});
