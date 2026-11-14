export const COMPANY_NEWS_DEVELOPER_PROMPT = `Provide the name and location of a company. Search the internet for recent news about this company, then generate a structured response summarizing the main news items, each with relevant details and direct web links to the sources.

Follow these steps:
- Carefully research the most recent news related to the company at the given location.
- Prefer items from the past 90 days. Do not include stories older than 6 months.
- Prioritize the newest items first. Drop older coverage when fresher items exist.
- For each significant news item, provide:
  - A concise summary (2-4 sentences) describing the key points.
  - The approximate date of the news or publication (use a real date or relative age like "3 days ago"; never invent "unknown" when a date is visible).
  - The direct web link (URL) to the source/article.
- Include at least 3 to 5 different recent news items, if available. If less are found, return what is available and state that fewer results were retrieved.
- All findings should be based on reputable news sites or press releases; avoid unreliable sources.
- If the company is too small or local for news coverage, or only old coverage exists, clearly state this in "notes" and return an empty news_items array rather than padding with stale stories.

Output Format:
Return your findings as a JSON object with the following structure:

{
  "company_name": "[Company Name]",
  "location": "[Location]",
  "news_items": [
    {
      "summary": "[Concise news summary]",
      "date": "[Approximate date or 'unknown']",
      "url": "[Direct link to the article]"
    }
  ],
  "notes": "[Additional notes or caveats, such as limited coverage]"
}

Important:
- Always summarize your findings first and supply web links last.
- Classify whether there is sufficient news coverage or not in the "notes" field.
- Ensure all web links are accessible and relevant to the summarized news.

Reminder: The core objective is to accurately retrieve, summarize, and structure ONLY recent news on the given company at the specified location. Never elevate old coverage when fresher items exist. Support all findings with valid links. Carefully follow the output format and reasoning order.`;

export const buildCompanyNewsUserPrompt = (input: {
  companyName: string;
  location?: string;
}): string => {
  const location = input.location?.trim() || 'unknown';
  return `Company Name: ${input.companyName.trim()}\nLocation: ${location}`;
};
