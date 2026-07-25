import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useMemo } from 'react';

import { Modal } from '@/ui/layout/modal/components/Modal';

import { CREDIT_TRANSACTIONS } from '../graphql/creditTransactions';

const StyledTransactionMeta = styled.div`
  font-size: 12px;
  color: ${themeCssVariables.font.color.tertiary};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledModalContent = styled.div`
  padding: ${themeCssVariables.spacing[4]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  min-width: 360px;
  max-width: 560px;
  max-height: 70vh;
  overflow: hidden;
`;

const StyledTitle = styled.h2`
  margin: 0;
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledBalanceSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledBalanceRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[2]};
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledBalanceLabel = styled.span`
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledBalanceValue = styled.span`
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  overflow-y: auto;
  flex: 1;
  min-height: 0;
`;

const StyledTransactionRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  background: ${themeCssVariables.background.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledTransactionAmount = styled.span<{ type: string }>`
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${({ type }) =>
    type === 'debit'
      ? themeCssVariables.font.color.danger
      : themeCssVariables.tag.text.green};
`;

const StyledEmptyState = styled.div`
  padding: ${themeCssVariables.spacing[6]};
  text-align: center;
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

type CreditHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orgChartCredits?: number;
  revealCredits?: number;
  revealCreditsAsEmailEquivalent?: number;
  revealCreditsAsPhoneEquivalent?: number;
  emailRevealCost?: number;
  phoneRevealCost?: number;
};

const CREDIT_TYPE_LABELS: Record<string, string> = {
  org_chart: 'Org chart',
  email_reveal: 'Email reveal',
  phone_reveal: 'Phone reveal',
  reveal_top_up: 'Reveal top-up',
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
  revealCreditsAsEmailEquivalent,
  revealCreditsAsPhoneEquivalent,
  emailRevealCost = 1,
  phoneRevealCost = 5,
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
    const raw = (data as { creditTransactions?: { items: TransactionItem[] } } | undefined)
      ?.creditTransactions?.items;
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const hasError = !!error;
  const showEmpty = !loading && (hasError || items.length === 0);

  return isOpen ? (
    <Modal isClosable onClose={onClose} size="medium" padding="none">
      <StyledModalContent>
        <StyledTitle>Credit History</StyledTitle>
        <StyledBalanceSection>
          <StyledBalanceRow>
            <StyledBalanceLabel>Org chart credits</StyledBalanceLabel>
            <StyledBalanceValue>{orgChartCredits}</StyledBalanceValue>
          </StyledBalanceRow>
          <StyledBalanceRow>
            <StyledBalanceLabel>
              Reveal credits ({emailRevealCost}/email · {phoneRevealCost}/phone)
            </StyledBalanceLabel>
            <StyledBalanceValue>
              {revealCredits} (≈ {emailEquivalent} emails or {phoneEquivalent} phones)
            </StyledBalanceValue>
          </StyledBalanceRow>
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
                    {CREDIT_TYPE_LABELS[item.creditType ?? ''] ?? item.creditType} –{' '}
                    {item.type === 'debit' ? 'Used' : 'Added'}
                  </div>
                  {formatMetadata(item.metadata ?? null) && (
                    <StyledTransactionMeta>
                      {formatMetadata(item.metadata ?? null)}
                    </StyledTransactionMeta>
                  )}
                </div>
                <StyledTransactionAmount>
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
