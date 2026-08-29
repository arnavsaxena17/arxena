export type AiAgentTestData = {
  output: {
    data?: string;
    duration?: number;
    error?: string;
  };
  language: 'plaintext' | 'json';
};
