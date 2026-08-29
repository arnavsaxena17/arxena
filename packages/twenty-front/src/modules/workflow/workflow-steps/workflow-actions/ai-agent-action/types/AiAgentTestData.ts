export type AiAgentTestData = {
  variableValues: { [variablePath: string]: string };
  output: {
    data?: string;
    duration?: number;
    error?: string;
  };
  language: 'plaintext' | 'json';
};
