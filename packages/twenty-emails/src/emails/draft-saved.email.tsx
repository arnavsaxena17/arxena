
import { APP_LOCALES } from 'twenty-shared';
import { BaseEmail } from '../components/BaseEmail';

type DraftSavedEmailProps = {
  firstName: string;
  subject: string;
  attachmentCount: number;
  locale: keyof typeof APP_LOCALES;
};

export const DraftSavedEmail = ({
  firstName,
  subject,
  attachmentCount,
  locale = 'en',
}: DraftSavedEmailProps) => {
  return (
    <BaseEmail locale={locale}>
      <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ color: '#1D4ED8' }}>Email Draft Saved Successfully</h2>
        <p style={{ fontSize: '16px', lineHeight: '1.5' }}>
          Hello {firstName},
        </p>
        <p style={{ fontSize: '16px', lineHeight: '1.5' }}>
          Your email draft has been successfully saved with the following details:
        </p>
        <ul style={{ fontSize: '16px', lineHeight: '1.5' }}>
          <li>Subject: {subject}</li>
          <li>Attachments: {attachmentCount} file{attachmentCount !== 1 ? 's' : ''}</li>
        </ul>
        <p style={{ fontSize: '16px', lineHeight: '1.5' }}>
          You can find this draft in your email drafts folder. Feel free to review and send it when you're ready.
        </p>
        <p style={{ fontSize: '16px', lineHeight: '1.5' }}>
          Best regards,<br />
          The Arxena Team
        </p>
      </div>
    </BaseEmail>
  );
}; 