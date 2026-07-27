import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useArxCommandConfirmationFlow } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCommandConfirmationFlow';
import { ARX_SEND_WHATSAPP_MODAL_ID } from '@/command-menu-item/engine-command/record/arx/constants/arxCommandModalIds';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useCallback } from 'react';

const WHATSAPP_COLUMN_HEADERS = [
  'Remarks',
  'Name',
  'Company',
  'Job Title',
  'Function',
  'Grade',
  'Profile URL',
  'Status',
  'Func Root',
  'Profile Intro',
  'Skills',
  'Education Institute Ug',
  'Education Institute Pg',
  'Mobile Phone',
  'E-mail Address',
  'Salary',
  'Experience',
  'Priority',
  'Location',
  'Std. Location',
  'Notice Period',
  'Resume URL',
  'Naukri Search URL',
  'Distance from Location',
  'Org Chart',
  'Company Name',
  'Current Role Tenure',
  'Total Tenure',
  'Total Job Changes',
  'Average Tenure',
  'Count Promotions',
  'Employees in Function',
  'Employees in Company',
  'Employees at Location',
  'Progress',
  'Salary',
  'Experience',
  'Industry',
  'Nationality',
  'Year Of Passing',
  'Blank_3',
  'Source',
  'Pull ID',
  'Last Updated',
  'First Name',
  'Last Name',
  'Job',
  'ID',
];

export const ArxSendToWhatsappCommand = () => {
  const { resolveRecords } = useArxCandidateRecordsFromHeadlessContext();
  const { isConfirmed, handleCancel, handleConfirm } =
    useArxCommandConfirmationFlow(ARX_SEND_WHATSAPP_MODAL_ID);

  const handleExecute = useCallback(async () => {
    const selectedRecords = await resolveRecords();

    if (!selectedRecords || selectedRecords.length === 0) {
      return;
    }

    const transformedRecords = selectedRecords.map((record) => {
      const jobs = record.jobs as
        | {
            company?: { name?: string };
            pathPosition?: string;
            grade?: string;
            jobLocation?: string;
          }
        | undefined;
      const people = record.people as
        | {
            jobTitle?: string;
            skills?: string;
            name?: { firstName?: string; lastName?: string };
          }
        | undefined;

      return [
        null,
        (record.name as string) || '',
        jobs?.company?.name || '',
        people?.jobTitle || '',
        jobs?.pathPosition || 'unclassified',
        jobs?.grade || 'entry',
        (record.resdexNaukriUrl as { primaryLinkUrl?: string } | undefined)
          ?.primaryLinkUrl
          ? `<a href='${(record.resdexNaukriUrl as { primaryLinkUrl: string }).primaryLinkUrl}' target='_blank'>Naukri</a>`
          : '',
        (record.candConversationStatus as string) || 'Sourced',
        jobs?.pathPosition || '',
        null,
        people?.skills || '',
        null,
        null,
        (record.phoneNumber as { primaryPhoneNumber?: string } | undefined)
          ?.primaryPhoneNumber || '',
        (record.email as { primaryEmail?: string } | undefined)
          ?.primaryEmail || '',
        '10',
        4,
        null,
        jobs?.jobLocation?.split(',')[0] || '',
        '',
        '0',
        null,
        (record.hiringNaukriUrl as { primaryLinkUrl?: string } | undefined)
          ?.primaryLinkUrl
          ? `<a href='${(record.hiringNaukriUrl as { primaryLinkUrl: string }).primaryLinkUrl}' target='_blank'>Naukri Search URL</a>`
          : '',
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        1,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        0,
        `${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}; ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' })}`,
        people?.name?.firstName || '',
        people?.name?.lastName || '',
        'resdextesting',
        ((record.id as string) ?? '').substring(0, 24),
      ];
    });

    window.postMessage(
      {
        type: 'FROM_PAGE',
        text: JSON.stringify([transformedRecords]),
        columns: JSON.stringify(WHATSAPP_COLUMN_HEADERS),
      },
      window.location.origin,
    );
  }, [resolveRecords]);

  return (
    <>
      <ConfirmationModal
        modalInstanceId={ARX_SEND_WHATSAPP_MODAL_ID}
        title="Send to WhatsApp Chrome Ext."
        subtitle="Are you sure you want to send contacts to WhatsApp Chrome Extension?"
        onConfirmClick={handleConfirm}
        onClose={handleCancel}
        confirmButtonText="Send to WhatsApp Chrome Extension"
        confirmButtonAccent="blue"
      />
      <HeadlessEngineCommandWrapperEffect
        execute={handleExecute}
        ready={isConfirmed}
      />
    </>
  );
};
