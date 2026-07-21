import { Button, H2Title } from 'twenty-ui';
import { IconDownload } from 'twenty-ui/icons';
import { useState } from 'react';

import { ArxDownloadModal } from '@/candidate-table/components/ArxDownloadModal';
import { useLingui } from '@lingui/react/macro';

export const DownloadApp = () => {
  const { t } = useLingui();
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  const handleDownloadClick = () => {
    setIsDownloadModalOpen(true);
  };

  return (
    <>
      <H2Title
        title={t`Download App`}
        description={t`Download the Arxena desktop application for your system`}
      />

      <Button
        Icon={IconDownload}
        onClick={handleDownloadClick}
        variant="secondary"
        title={t`Download App`}
      />

      <ArxDownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />
    </>
  );
};

