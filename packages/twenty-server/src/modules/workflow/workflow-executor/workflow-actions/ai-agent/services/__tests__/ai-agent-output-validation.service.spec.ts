import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { AiAgentOutputValidationService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-agent/services/ai-agent-output-validation.service';
import { scanOutputFields } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-agent/utils/ai-agent-output-validation.util';

const jevAnswer = (operatorNote: number, unresolvedPlaceholder: number) => ({
  ok: true,
  json: async () => ({
    answers: {
      message__operatorNote: { type: 'noul', noul: operatorNote },
      message__unresolvedPlaceholder: {
        type: 'noul',
        noul: unresolvedPlaceholder,
      },
    },
  }),
});

describe('AiAgentOutputValidationService', () => {
  const configService = {
    get: jest.fn().mockReturnValue('test-key'),
  } as unknown as TwentyConfigService;

  const service = new AiAgentOutputValidationService(configService);

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('skips an empty field without calling Jev', () => {
    const scanned = scanOutputFields({ message: '   ' }, ['message']);

    expect(scanned.jevFields).toEqual([]);
    expect(scanned.fields).toEqual([
      { fieldKey: 'message', skipped: true, cleared: true },
    ]);
  });

  it('rejects a template token without calling Jev', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    const fields = await service.judgeDraft({ message: 'Hi {{firstName}}' }, [
      'message',
    ]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fields[0]?.codeFailure).toBe('{{firstName}}');
    expect(fields[0]?.cleared).toBe(false);
  });

  it('retries when operatorNote is high and returns the cleared draft', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(jevAnswer(0.8, 0.1) as never)
      .mockResolvedValueOnce(jevAnswer(0.1, 0.1) as never);
    const execute = jest
      .fn()
      .mockResolvedValueOnce({
        result: { message: 'Here is a draft you can tweak: Hi Priya' },
        hasNoMoreAvailableCredits: false,
      })
      .mockResolvedValueOnce({
        result: {
          message: 'Hi Priya, open to a short call next week?',
        },
        hasNoMoreAvailableCredits: false,
      });

    const { executionResult, report } = await service.runWithRetries({
      userPrompt: 'Draft a note',
      fieldKeys: ['message'],
      execute,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[1]?.[0]).toContain(
      'it addresses the sender instead of the prospect',
    );
    expect(executionResult.result).toEqual({
      message: 'Hi Priya, open to a short call next week?',
    });
    expect(report).toEqual({
      attempts: 2,
      cleared: true,
      fields: [
        {
          fieldKey: 'message',
          skipped: false,
          cleared: true,
          operatorNote: 0.1,
          unresolvedPlaceholder: 0.1,
          checkResults: [
            {
              id: 'operatorNote',
              label: 'Operator note',
              noul: 0.1,
              failed: false,
            },
            {
              id: 'unresolvedPlaceholder',
              label: 'Unresolved blank',
              noul: 0.1,
              failed: false,
            },
          ],
        },
      ],
    });
  });

  it('judges a saved check and skips Jev when every check is removed', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        answers: {
          message__tone: { type: 'noul', noul: 0.9 },
        },
      }),
    } as never);

    const fields = await service.judgeDraft(
      { message: 'Hi Priya' },
      ['message'],
      [
        {
          id: 'tone',
          label: 'Tone',
          instructions: 'Is this too casual to send to an executive?',
          invalidWhen: 'The wording is too casual for an executive.',
          validWhen: 'The wording is appropriate for an executive.',
        },
      ],
    );

    const requestInit = fetchSpy.mock.calls[0]?.[1];
    const body = JSON.parse(String(requestInit?.body));

    expect(body.questions.message__tone.criteria.true).toBe(
      'The wording is too casual for an executive.',
    );
    expect(fields[0]?.cleared).toBe(false);
    expect(fields[0]?.checkResults).toEqual([
      {
        id: 'tone',
        label: 'Tone',
        noul: 0.9,
        failed: true,
      },
    ]);

    fetchSpy.mockClear();

    const clearedFields = await service.judgeDraft(
      { message: 'Hi Priya' },
      ['message'],
      [],
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(clearedFields[0]?.cleared).toBe(true);
  });
});
