import {
  ASK_QUESTIONS_TOOL_NAME,
  askQuestionsInputSchema,
  createAskQuestionsTool,
} from 'src/engine/metadata-modules/ai/ai-chat/tools/ask-questions.tool';

describe('ask_questions tool', () => {
  it('is named ask_questions (plural)', () => {
    expect(ASK_QUESTIONS_TOOL_NAME).toBe('ask_questions');
  });

  it('execute echoes the questions with a pending status', async () => {
    const tool = createAskQuestionsTool();
    const questions = [
      {
        header: 'Email type',
        question: 'What type of email?',
        options: [{ label: 'Welcome' }, { label: 'Offer' }],
      },
    ];

    const output = await tool.execute({ questions });

    expect(output).toEqual({
      success: true,
      message: expect.any(String),
      result: { questions, status: 'pending' },
    });
  });

  it('accepts one option, so a near-miss question is not lost', () => {
    const result = askQuestionsInputSchema.safeParse({
      questions: [
        { header: 'h', question: 'q', options: [{ label: 'only one' }] },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('fills a missing label from the description instead of failing', async () => {
    const tool = createAskQuestionsTool();
    const input = askQuestionsInputSchema.parse({
      questions: [
        {
          header: 'Company fetch',
          question: 'Which budget?',
          options: [
            { description: 'Fetch all ~372 records (~$0.74).', isRecommended: true },
            { label: 'Refine query first' },
          ],
        },
      ],
    });

    const output = await tool.execute(input);

    expect(output.result.questions[0].options[0].label).toBe(
      'Fetch all ~372 records',
    );
    expect(output.result.questions[0].options[1].label).toBe(
      'Refine query first',
    );
  });

  it('rejects zero questions', () => {
    const result = askQuestionsInputSchema.safeParse({ questions: [] });

    expect(result.success).toBe(false);
  });

  it('rejects more than four questions', () => {
    const question = {
      header: 'h',
      question: 'q',
      options: [{ label: 'a' }, { label: 'b' }],
    };
    const result = askQuestionsInputSchema.safeParse({
      questions: [question, question, question, question, question],
    });

    expect(result.success).toBe(false);
  });

  it('rejects more than four options', () => {
    const result = askQuestionsInputSchema.safeParse({
      questions: [
        {
          header: 'h',
          question: 'q',
          options: [
            { label: 'a' },
            { label: 'b' },
            { label: 'c' },
            { label: 'd' },
            { label: 'e' },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('keeps only the first recommended option', async () => {
    const tool = createAskQuestionsTool();
    const input = askQuestionsInputSchema.parse({
      questions: [
        {
          header: 'h',
          question: 'q',
          options: [
            { label: 'a', isRecommended: true },
            { label: 'b', isRecommended: true },
          ],
        },
      ],
    });

    const output = await tool.execute(input);

    expect(output.result.questions[0].options.map((option) => option.isRecommended)).toEqual([
      true,
      false,
    ]);
  });

  it('accepts a valid multi-question payload', () => {
    const result = askQuestionsInputSchema.safeParse({
      questions: [
        {
          header: 'h1',
          question: 'q1',
          options: [{ label: 'a' }, { label: 'b' }],
        },
        {
          header: 'h2',
          question: 'q2',
          options: [
            { label: 'c', description: 'desc', isRecommended: true },
            { label: 'd' },
          ],
          allowMultiSelect: true,
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
