
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
export class LLMProviders {
  openAIclient: OpenAI;
  anthropic: Anthropic;
  constructor() {
    this.openAIclient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.anthropic = new Anthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'], 
    });
  }

}