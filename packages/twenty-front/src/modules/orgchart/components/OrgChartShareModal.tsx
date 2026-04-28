import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useMemo, useState } from 'react';
import { Button, Section, SectionAlignment, SectionFontColor } from 'twenty-ui';

import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInput } from '@/ui/input/components/TextInput';
import { Modal } from '@/ui/layout/modal/components/Modal';

const StyledModal = styled(Modal)`
  border-radius: ${({ theme }) => theme.spacing(1)};
`;

const StyledContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  align-items: flex-end;
  flex-wrap: wrap;
`;

const StyledField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledFieldLabel = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  line-height: ${({ theme }) => theme.font.size.sm};
`;

const StyledExpiryControls = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  align-items: stretch;
  flex-wrap: wrap;
`;

const StyledSelect = styled.select`
  height: ${({ theme }) => theme.spacing(5)};
  min-width: 160px;
  padding: 0 ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledGenerateButton = styled(Button)`
  height: ${({ theme }) => theme.spacing(5)};
`;

const StyledLinkRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  align-items: center;
`;

const StyledLinkInput = styled(TextInput)`
  flex: 1;
`;

type ExpiryOption = {
  id: '2h' | '12h' | '3d' | '30d';
  label: string;
  ttlSeconds: number;
};

const EXPIRY_OPTIONS: ExpiryOption[] = [
  { id: '2h', label: '2 hours', ttlSeconds: 60 * 60 * 2 },
  { id: '12h', label: '12 hours', ttlSeconds: 60 * 60 * 12 },
  { id: '3d', label: '3 days', ttlSeconds: 60 * 60 * 24 * 3 },
  { id: '30d', label: '30 days', ttlSeconds: 60 * 60 * 24 * 30 },
];

export type OrgChartShareModalProps = {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyName?: string;
  accessToken: string;
  serverBaseUrl: string;
  arxenaSiteBaseUrl?: string;
};

export const OrgChartShareModal = ({
  isOpen,
  onClose,
  companyId,
  companyName,
  accessToken,
  serverBaseUrl,
  arxenaSiteBaseUrl,
}: OrgChartShareModalProps) => {
  const { t } = useLingui();
  const { enqueueSnackBar } = useSnackBar();
  const [selectedExpiryId, setSelectedExpiryId] =
    useState<ExpiryOption['id']>('12h');
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');

  const selectedExpiry = useMemo(
    () => EXPIRY_OPTIONS.find((o) => o.id === selectedExpiryId) ?? EXPIRY_OPTIONS[1],
    [selectedExpiryId],
  );

  const siteBase = (arxenaSiteBaseUrl ?? 'https://arxena.com').replace(/\/$/, '');
  const normalizedServerBase = serverBaseUrl.replace(/\/$/, '');

  const generateShareLink = useCallback(async () => {
    if (!normalizedServerBase || !accessToken) {
      enqueueSnackBar(t`Missing server configuration`, {
        variant: SnackBarVariant.Error,
        duration: 6000,
      });
      return;
    }
    setIsGenerating(true);
    setShareUrl('');
    try {
      const res = await fetch(`${normalizedServerBase}/org-chart/share/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          companyId,
          companyName,
          ttlSeconds: selectedExpiry.ttlSeconds,
        }),
      });
      const json = (await res.json()) as {
        status?: string;
        shareToken?: string;
        accessKey?: string;
        expiresAt?: string;
        message?: string;
      };
      if (!res.ok || json?.status !== 'ok' || !json.shareToken || !json.accessKey) {
        const msg =
          typeof json?.message === 'string' && json.message.trim()
            ? json.message.trim()
            : t`Failed to generate share link`;
        throw new Error(msg);
      }
      const url = `${siteBase}/org-chart/share/${encodeURIComponent(
        json.shareToken,
      )}?k=${encodeURIComponent(json.accessKey)}`;
      setShareUrl(url);
      enqueueSnackBar(t`Share link generated`, {
        variant: SnackBarVariant.Success,
        duration: 4000,
      });
    } catch (e) {
      enqueueSnackBar(e instanceof Error ? e.message : t`Failed to generate share link`, {
        variant: SnackBarVariant.Error,
        duration: 8000,
      });
    } finally {
      setIsGenerating(false);
    }
  }, [
    accessToken,
    companyId,
    companyName,
    enqueueSnackBar,
    normalizedServerBase,
    selectedExpiry.ttlSeconds,
    siteBase,
    t,
  ]);

  const copyLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      enqueueSnackBar(t`Copied link`, {
        variant: SnackBarVariant.Success,
        duration: 2500,
      });
    } catch {
      enqueueSnackBar(t`Failed to copy`, {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
    }
  }, [enqueueSnackBar, shareUrl, t]);

  if (!isOpen) return null;

  return (
    <StyledModal isClosable={true} onClose={onClose} size="medium" padding="medium">
      <StyledContent>
        <Section alignment={SectionAlignment.Left} fontColor={SectionFontColor.Primary}>
          <StyledTitle>{t`Share org chart`}</StyledTitle>
        </Section>

        <Section alignment={SectionAlignment.Left} fontColor={SectionFontColor.Secondary}>
          {t`Choose how long this link should work. After expiry, viewers will see an expired message and a sign-up prompt.`}
        </Section>

        <Section alignment={SectionAlignment.Left}>
          <StyledRow>
            <StyledField>
              <StyledFieldLabel>{t`Expires in`}</StyledFieldLabel>
              <StyledExpiryControls>
                <StyledSelect
                  value={selectedExpiryId}
                  onChange={(e) =>
                    setSelectedExpiryId(e.target.value as ExpiryOption['id'])
                  }
                >
                  {EXPIRY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </StyledSelect>

                <StyledGenerateButton
                  title={isGenerating ? t`Generating...` : t`Generate link`}
                  variant="primary"
                  accent="blue"
                  size="small"
                  type="button"
                  disabled={isGenerating}
                  onClick={() => void generateShareLink()}
                />
              </StyledExpiryControls>
            </StyledField>
          </StyledRow>
        </Section>

        <Section alignment={SectionAlignment.Left}>
          <StyledFieldLabel>{t`Share link`}</StyledFieldLabel>
          <StyledLinkRow>
            <StyledLinkInput
              value={shareUrl}
              placeholder={t`Generate a link to copy`}
              onChange={() => {}}
              disabled={true}
            />
            <Button
              title={t`Copy`}
              variant="secondary"
              accent="default"
              size="small"
              type="button"
              disabled={!shareUrl}
              onClick={() => void copyLink()}
            />
          </StyledLinkRow>
        </Section>

        <Section alignment={SectionAlignment.Left}>
          <Button
            title={t`Close`}
            variant="secondary"
            accent="default"
            size="small"
            type="button"
            onClick={onClose}
          />
        </Section>
      </StyledContent>
    </StyledModal>
  );
};

