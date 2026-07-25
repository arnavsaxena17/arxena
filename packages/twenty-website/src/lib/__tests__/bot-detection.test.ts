import { isBlockedBot, isDeclaredBotUserAgent } from '@/lib/bot-detection';

describe('bot-detection', () => {
  describe('isDeclaredBotUserAgent', () => {
    it('returns true for common search crawler user agents', () => {
      expect(
        isDeclaredBotUserAgent(
          'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        ),
      ).toBe(true);
      expect(
        isDeclaredBotUserAgent(
          'Mozilla/5.0 (compatible; SeznamBot/4.0; +https://o-seznam.cz/napoveda/vyhledavani/en/seznambot-crawler/)',
        ),
      ).toBe(true);
      expect(
        isDeclaredBotUserAgent(
          'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.3; +https://openai.com/gptbot)',
        ),
      ).toBe(true);
    });

    it('returns false for typical browser user agents', () => {
      expect(
        isDeclaredBotUserAgent(
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        ),
      ).toBe(false);
      expect(
        isDeclaredBotUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
        ),
      ).toBe(false);
    });

    it('returns false for empty or missing user agent', () => {
      expect(isDeclaredBotUserAgent(null)).toBe(false);
      expect(isDeclaredBotUserAgent('')).toBe(false);
      expect(isDeclaredBotUserAgent('   ')).toBe(false);
    });
  });

  describe('isBlockedBot', () => {
    it('still blocks known abusive crawlers', () => {
      expect(isBlockedBot('Mozilla/5.0 (compatible; SemrushBot/7~bl)')).toBe(
        true,
      );
    });
  });
});
