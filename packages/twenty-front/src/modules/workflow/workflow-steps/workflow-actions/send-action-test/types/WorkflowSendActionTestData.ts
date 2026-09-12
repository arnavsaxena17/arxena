export type WorkflowSendActionTestData = {
  output: {
    data?: string;
    duration?: number;
    error?: string;
  };
  language: 'plaintext' | 'json';
};
