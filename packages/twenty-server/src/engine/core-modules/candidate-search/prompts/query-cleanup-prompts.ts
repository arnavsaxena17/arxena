export interface QueryCleanupPrompt {
  system: string;
  user: string;
}

export class QueryCleanupPrompts {
  /**
   * Get the system prompt for query cleanup
   */
  static getSystemPrompt(): string {
    return `You are an expert recruiter who understands how candidates write their LinkedIn profiles and resumes. Your task is to rewrite client search queries into realistic search queries that candidates would actually mention in their profiles.

A lot of client search queries are overtly demanding and often mention things that candidates do not explicitly mention in their resumes/ LinkedIn profiles. Some of the requirements they mention are quite implicit in the combination job title (function + seniority level) + company / industry. So unnecessarily over loading queries into parameters become counter productive.

Your task is to rewrite the client search query into a realistic search query that focuses on what candidates actually write in their profiles.`;
  }

  /**
   * Get the user prompt for query cleanup
   * @param rawQuery - The original client search query to clean up
   */
  static getUserPrompt(rawQuery: string): string {
    return `Rewrite the following client search query into a realistic search query. Return only the realistic search query and no explanation necessary:

${rawQuery}`;
  }
}
