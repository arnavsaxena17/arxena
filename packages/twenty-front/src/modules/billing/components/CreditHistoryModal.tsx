import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { useMemo } from 'react';
import { IconX } from 'twenty-ui/icon';
import { IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { Modal } from '@/ui/layout/modal/components/Modal';

import { CREDIT_TRANSACTIONS } from '../graphql/creditTransactions';

const StyledModalContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  max-height: 70vh;
  overflow: hidden;
  padding: ${themeCssVariables.spacing[5]};
  width: 100%;
`;

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
`;

const StyledTitle = styled.h2`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

const StyledBalanceSection = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  width: 100%;
`;

const StyledBalanceRow = styled.div`
  align-items: flex-start;
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  gap: ${themeCssVariables.spacing[3]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
  width: 100%;
`;

const StyledBalanceLabel = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  flex: 1;
  font-weight: ${themeCssVariables.font.weight.medium};
  min-width: 0;
`;

const StyledBalanceValue = styled.span`
  flex-shrink: 0;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  text-align: right;
`;

const StyledList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  max-height: 320px;
  min-height: 0;
  overflow-y: auto;
  width: 100%;
`;

const StyledTransactionRow = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[3]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

const StyledTransactionMeta = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 12px;
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledTransactionAmount = styled.span<{ type: string }>`
  color: ${({ type }) =>
    type === 'debit'
      ? themeCssVariables.font.color.danger
      : themeCssVariables.tag.text.green};
  flex-shrink: 0;
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledEmptyState = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[4]} 0;
  text-align: center;
`;

type CreditHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orgChartCredits?: number;
  revealCredits?: number;
  apiCredits?: number;
  revealCreditsAsEmailEquivalent?: number;
  revealCreditsAsPhoneEquivalent?: number;
  emailRevealCost?: number;
  phoneRevealCost?: number;
  aiCredits?: number;
};

const CREDIT_TYPE_LABELS: Record<string, string> = {
  org_chart: 'Map credits',
  email_reveal: 'Email reveal',
  phone_reveal: 'Phone reveal',
  reveal_top_up: 'Reveal top-up',
  ai_top_up: 'AI credits',
  api_search: 'API search',
  api_top_up: 'API top-up',
  email_contact: 'Email contact',
  phone_contact: 'Phone contact',
};

const formatMetadata = (metadata: Record<string, unknown> | null): string => {
  if (!metadata) return '';
  const parts: string[] = [];
  if (metadata.companyName) parts.push(String(metadata.companyName));
  if (metadata.employeeCount) parts.push(`${metadata.employeeCount} employees`);
  if (metadata.linkedinUrl) parts.push(String(metadata.linkedinUrl));
  if (metadata.creditPackKey) parts.push(`Pack: ${metadata.creditPackKey}`);
  return parts.join(' · ') || '';
};

export const CreditHistoryModal = ({
  isOpen,
  onClose,
  orgChartCredits = 0,
  revealCredits = 0,
  apiCredits = 0,
  revealCreditsAsEmailEquivalent,
  revealCreditsAsPhoneEquivalent,
  emailRevealCost = 1,
  phoneRevealCost = 5,
  aiCredits,
}: CreditHistoryModalProps) => {
  const emailEquivalent =
    revealCreditsAsEmailEquivalent ??
    Math.floor(revealCredits / Math.max(1, emailRevealCost));
  const phoneEquivalent =
    revealCreditsAsPhoneEquivalent ??
    Math.floor(revealCredits / Math.max(1, phoneRevealCost));

  const { data, loading, error } = useQuery(CREDIT_TRANSACTIONS, {
    variables: { limit: 50 },
    skip: !isOpen,
  });

  type TransactionItem = {
    id?: string;
    type?: string;
    creditType?: string;
    amount?: number;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  };

  const items = useMemo((): TransactionItem[] => {
    const raw = (
      data as { creditTransactions?: { items: TransactionItem[] } } | undefined
    )?.creditTransactions?.items;
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const hasError = !!error;
  const showEmpty = !loading && (hasError || items.length === 0);

  return isOpen ? (
    <Modal isClosable onClose={onClose} size="medium" padding="none">
      <StyledModalContent>
        <StyledHeader>
          <StyledTitle>Credit History</StyledTitle>
          <IconButton
            Icon={IconX}
            onClick={onClose}
            variant="tertiary"
            size="small"
          />
        </StyledHeader>
        <StyledBalanceSection>
          <StyledBalanceRow>
            <StyledBalanceLabel>Map credits</StyledBalanceLabel>
            <StyledBalanceValue>{orgChartCredits}</StyledBalanceValue>
          </StyledBalanceRow>
          <StyledBalanceRow>
            <StyledBalanceLabel>
              Reveal credits ({emailRevealCost}/email · {phoneRevealCost}/phone)
            </StyledBalanceLabel>
            <StyledBalanceValue>
              {revealCredits} (≈ {emailEquivalent} emails or {phoneEquivalent}{' '}
              phones)
            </StyledBalanceValue>
          </StyledBalanceRow>
          <StyledBalanceRow>
            <StyledBalanceLabel>API credits</StyledBalanceLabel>
            <StyledBalanceValue>{apiCredits}</StyledBalanceValue>
          </StyledBalanceRow>
          {aiCredits !== undefined && (
            <StyledBalanceRow>
              <StyledBalanceLabel>AI & usage credits</StyledBalanceLabel>
              <StyledBalanceValue>{aiCredits}</StyledBalanceValue>
            </StyledBalanceRow>
          )}
        </StyledBalanceSection>
        <StyledList>
          {loading && (
            <StyledEmptyState>Loading transaction history...</StyledEmptyState>
          )}
          {showEmpty && !loading && (
            <StyledEmptyState>
              {hasError
                ? 'Unable to load credit history. It will appear here once transactions are recorded.'
                : 'No credit transactions yet.'}
            </StyledEmptyState>
          )}
          {!loading &&
            items.length > 0 &&
            items.map((item) => (
              <StyledTransactionRow key={item.id ?? Math.random()}>
                <div>
                  <div>
                    {CREDIT_TYPE_LABELS[item.creditType ?? ''] ??
                      item.creditType}{' '}
                    – {item.type === 'debit' ? 'Used' : 'Added'}
                  </div>
                  {formatMetadata(item.metadata ?? null) && (
                    <StyledTransactionMeta>
                      {formatMetadata(item.metadata ?? null)}
                    </StyledTransactionMeta>
                  )}
                </div>
                <StyledTransactionAmount type={item.type ?? 'credit'}>
                  {item.type === 'debit' ? '-' : '+'}
                  {item.amount ?? 0}
                </StyledTransactionAmount>
              </StyledTransactionRow>
            ))}
        </StyledList>
      </StyledModalContent>
    </Modal>
  ) : null;
};
