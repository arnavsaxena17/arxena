import {
  clampInboundWindowDelayMinutes,
  concatenatedUserBurst,
  isCurrentInboundGeneration,
  unionInboundTurns,
} from 'src/engine/core-modules/outreach-command/utils/inbound-reply-window.util';

describe('inbound-reply-window.util', () => {
  it('unions turns by externalMessageId', () => {
    const merged = unionInboundTurns(
      [{ role: 'user', content: 'hi', externalMessageId: 'a' }],
      [
        { role: 'user', content: 'hi', externalMessageId: 'a' },
        { role: 'user', content: 'there', externalMessageId: 'b' },
      ],
    );

    expect(merged).toEqual([
      { role: 'user', content: 'hi', externalMessageId: 'a' },
      { role: 'user', content: 'there', externalMessageId: 'b' },
    ]);
  });

  it('concatenates trailing user turns', () => {
    expect(
      concatenatedUserBurst([
        { role: 'assistant', content: 'hello' },
        { role: 'user', content: 'one' },
        { role: 'user', content: 'two' },
      ]),
    ).toBe('one\ntwo');
  });

  it('accepts a flush when Redis generation is missing', () => {
    expect(isCurrentInboundGeneration(3, undefined)).toBe(true);
    expect(isCurrentInboundGeneration(3, 3)).toBe(true);
    expect(isCurrentInboundGeneration(2, 3)).toBe(false);
  });

  it('clamps delay minutes', () => {
    expect(clampInboundWindowDelayMinutes(undefined)).toBe(2);
    expect(clampInboundWindowDelayMinutes(0)).toBe(1);
    expect(clampInboundWindowDelayMinutes(90)).toBe(60);
  });
});
