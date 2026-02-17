import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { Button } from 'twenty-ui';

const StyledCard = styled.div`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledPackName = styled.div`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledPriceLine = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

type CreditPack = {
  key: string;
  name: string;
  credits: number;
  amountSubunits: number;
  currency: string;
};

type BillingCreditPackCardProps = {
  pack: CreditPack;
  onBuy: () => void;
  isBuying: boolean;
};

export const BillingCreditPackCard = ({
  pack,
  onBuy,
  isBuying,
}: BillingCreditPackCardProps) => {
  const { t } = useLingui();

  return (
    <StyledCard>
      <StyledPackName>{pack.name}</StyledPackName>
      <StyledPriceLine>
        {pack.credits} {t`credits`} · {pack.currency}{' '}
        {(pack.amountSubunits / 100).toFixed(2)}
      </StyledPriceLine>
      <Button
        title={t`Buy credits`}
        variant="secondary"
        onClick={onBuy}
        disabled={isBuying}
      />
    </StyledCard>
  );
};
