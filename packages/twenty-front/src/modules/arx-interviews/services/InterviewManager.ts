import OpenAI from 'openai';

interface Question {
  text: string;
  followUps?: string[];
}

export class InterviewManager {
  private openai: OpenAI;
  private currentQuestionIndex = 0;
  private interviewPlan: Question[] = [];
  private conversationHistory: {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }[] = [];

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    // Initialize conversation with system message
    this.conversationHistory.push({
      role: 'system',
      content: `You are an AI interviewer for a job position. 
      Your goal is to conduct a professional interview while being friendly and encouraging. 
      Speak directly to the candidate as if you were a real interviewer.
      Keep your responses concise and focused on the interview.
      Ask one question at a time and wait for the candidate's response.
      You should provide thoughtful follow-up questions based on their answers.
      If the candidate's answer is too brief or vague, ask them to elaborate.
      Make the interview conversational and natural, not an interrogation.`,
    });
  }

  async generateInitialQuestions(jobPosition: string): Promise<void> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content:
              "Generate 5 interview questions for the specified job position. Format as JSON array of objects with 'text' property for each question.",
          },
          {
            role: 'user',
            content: `Generate 5 relevant interview questions for a ${jobPosition} position. Focus on skills, experience, and situational questions.`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(
        response.choices[0].message.content || '{"questions":[]}',
      );
      this.interviewPlan = result.questions || [];

      // Add introduction as first question
      this.interviewPlan.unshift({
        text: `Hello! I'm your AI interviewer today for the ${jobPosition} position. Thank you for joining us. To get started, could you please introduce yourself and tell me a bit about your background?`,
      });

      // Add closing as last question
      this.interviewPlan.push({
        text: 'Thank you for your time today. Do you have any questions for me about the position or the company?',
      });

      this.currentQuestionIndex = 0;
    } catch (error) {
      console.error('Error generating initial questions:', error);
      // Fallback questions if API fails
      this.interviewPlan = [
        {
          text: "Hello! I'm your AI interviewer today. Could you please introduce yourself?",
        },
        { text: 'What makes you interested in this position?' },
        {
          text: 'What are your key strengths that would make you successful in this role?',
        },
        {
          text: 'Can you describe a challenging situation at work and how you handled it?',
        },
        { text: 'Where do you see yourself professionally in 5 years?' },
        { text: 'Thank you for your time. Do you have any questions for me?' },
      ];
    }
  }

  getCurrentQuestion(): string {
    if (this.interviewPlan.length === 0) {
      return "Let's start the interview. Could you please introduce yourself?";
    }
    return this.interviewPlan[this.currentQuestionIndex].text;
  }

  async getNextQuestion(candidateResponse: string): Promise<string> {
    if (!candidateResponse || candidateResponse.trim() === '') {
      return "I didn't catch that. Could you please repeat your answer?";
    }

    // Add candidate's response to history
    this.conversationHistory.push({
      role: 'user',
      content: candidateResponse,
    });

    try {
      // Generate appropriate response and next question
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          ...this.conversationHistory,
          {
            role: 'user',
            content:
              'Based on my answer, please respond briefly and ask your next question. Keep your response under 100 words.',
          },
        ],
        max_tokens: 300,
      });

      const response =
        completion.choices[0].message.content ||
        "Thank you for sharing. Let's move on to the next question.";

      // Add AI response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response,
      });

      // Move to next prepared question if available
      this.currentQuestionIndex++;
      if (this.currentQuestionIndex >= this.interviewPlan.length) {
        this.currentQuestionIndex = this.interviewPlan.length - 1; // Stay at the last question
      }

      return response;
    } catch (error) {
      console.error('Error generating next question:', error);

      // Fallback: move to next prepared question
      this.currentQuestionIndex++;
      if (this.currentQuestionIndex >= this.interviewPlan.length) {
        return 'Thank you for all your responses. That concludes our interview for today.';
      }
      return `Thank you for sharing. ${this.getCurrentQuestion()}`;
    }
  }

  isInterviewComplete(): boolean {
    return this.currentQuestionIndex >= this.interviewPlan.length - 1;
  }
}
