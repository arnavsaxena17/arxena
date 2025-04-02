// src/services/llm.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';

@Injectable()
export class LlmService {
  private openai: OpenAI;
  private conversationHistory: ChatCompletionMessageParam[] = [];

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });

    // Initialize conversation with system prompt
    this.conversationHistory.push({
      role: 'system',
      content: `You are an AI recruiter conducting a job interview. Your goal is to assess the candidate's skills, experience, and fit for the position. 
      
      Follow these guidelines:
      - Ask clear, open-ended questions
      - Follow up on the candidate's responses with relevant questions
      - Be professional and courteous
      - Keep your responses concise (maximum 3 sentences)
      - Don't list multiple questions in a single response
      - Focus on one topic at a time
      - Ask for specific examples and details
      
      The interview structure should cover:
      1. Introduction and background
      2. Technical skills and experience
      3. Problem-solving abilities
      4. Team collaboration
      5. Career goals
      
      Start with simple questions and gradually increase complexity.`,
    });
  }

  async generateResponse(userInput: string): Promise<string> {
    try {
      // Add user input to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: userInput,
      });

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: this.conversationHistory,
        max_tokens: 150,
        temperature: 0.7,
      });

      const assistantResponse =
        response.choices[0]?.message?.content ||
        "I'm sorry, I couldn't process that response. Could you please elaborate more on your previous answer?";

      // Add assistant response to conversation history
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantResponse,
      });

      return assistantResponse;
    } catch (error) {
      console.error('Error generating LLM response:', error);

      return "I apologize, but I'm having trouble processing our conversation right now. Let's continue. Could you tell me more about your experience?";
    }
  }

  resetConversation() {
    // Reset the conversation history but keep the system prompt
    const systemPrompt = this.conversationHistory[0];

    this.conversationHistory = [systemPrompt];
  }
}
