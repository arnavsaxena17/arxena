import { APP_LOCALES } from 'twenty-shared';

type WorkspaceSetupCompleteEmailProps = {
  firstName: string;
  workspaceName: string;
  locale: keyof typeof APP_LOCALES;
};

export const WorkspaceSetupCompleteEmail = ({
  firstName,
  workspaceName,
  locale = 'en',
}: WorkspaceSetupCompleteEmailProps) => {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ color: '#1D4ED8' }}>Workspace Setup Complete! 🎉</h2>
      <p style={{ fontSize: '16px', lineHeight: '1.5' }}>
        Hello {firstName},
      </p>
      <p style={{ fontSize: '16px', lineHeight: '1.5' }}>
        Great news! Your workspace "{workspaceName}" has been successfully set up and is ready to use.
      </p>
      <h3 style={{ color: '#374151' }}>What's been configured:</h3>
      <ul style={{ fontSize: '16px', lineHeight: '1.5' }}>
        <li>Custom objects and relationships</li>
        <li>Video interview models and templates</li>
        <li>API integrations and keys</li>
        <li>Candidate view fields</li>
      </ul>
      <p style={{ fontSize: '16px', lineHeight: '1.5' }}>
        You can now start using all features of your workspace. If you need any assistance, don't hesitate to reach out to our support team.
      </p>
      <p style={{ fontSize: '16px', lineHeight: '1.5' }}>
        Best regards,<br />
        The Arxena Team
      </p>
    </div>
  );
}; 