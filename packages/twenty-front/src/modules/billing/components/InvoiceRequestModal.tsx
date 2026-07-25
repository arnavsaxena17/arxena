import { useLingui } from '@lingui/react/macro';
import { AnimatePresence, LayoutGroup } from 'framer-motion';
import { useState } from 'react';
import { styled } from '@linaria/react';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { H1Title, H1TitleFontColor } from 'twenty-ui/typography';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { TextInput } from '@/ui/input/components/TextInput';
import { Modal } from '@/ui/layout/modal/components/Modal';

const StyledModal = styled(Modal)`
  border-radius: ${themeCssVariables.border.radius.sm};
  height: auto;
  width: calc(440px - ${themeCssVariables.spacing[32]});
`;

const StyledSection = styled(Section)`
  margin-bottom: ${themeCssVariables.spacing[4]};
`;

const StyledLabel = styled.label`
  color: ${themeCssVariables.font.color.tertiary};
  display: block;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

const StyledButtonRow = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[4]};
`;

type CreditPack = {
  key: string;
  name: string;
  credits: number;
  amountSubunits: number;
  currency: string;
};

type InvoiceRequestModalProps = {
  isOpen: boolean;
  pack: CreditPack | null;
  initialCompanyName?: string;
  initialBillingEmail?: string;
  onClose: () => void;
  onSubmit: (params: {
    companyName: string;
    billingAddress: string;
    billingEmail: string;
    vatNumber?: string;
  }) => Promise<void>;
};

export const InvoiceRequestModal = ({
  isOpen,
  pack,
  initialCompanyName,
  initialBillingEmail,
  onClose,
  onSubmit,
}: InvoiceRequestModalProps) => {
  const { t } = useLingui();
  const [companyName, setCompanyName] = useState(initialCompanyName ?? '');
  const [billingEmail, setBillingEmail] = useState(initialBillingEmail ?? '');
  const [billingAddress, setBillingAddress] = useState('');

  const [vatNumber, setVatNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setCompanyName(initialCompanyName ?? '');
    setBillingEmail(initialBillingEmail ?? '');
    setVatNumber('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!pack || !companyName.trim() || !billingEmail.trim()) {
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        companyName: companyName.trim(),
        billingAddress: billingAddress.trim() || 'Not provided',
        billingEmail: billingEmail.trim(),
        vatNumber: vatNumber.trim() || undefined,
      });
      handleClose();
    } finally {
      setLoading(false);
    }
  };

  if (!pack) return null;

  const amountFormatted = (pack.amountSubunits / 100).toLocaleString();

  return (
    <AnimatePresence mode="wait">
      <LayoutGroup>
        {isOpen && (
          <StyledModal
            onClose={onClose}
            isClosable
            padding="large"
            modalVariant="primary"
          >
            <H1Title
              title={t`Create custom quote`}
              fontColor={H1TitleFontColor.Primary}
            />
            <p style={{ margin: '8px 0 16px 0', fontSize: 14, color: 'var(--color-gray-50)' }}>
              {pack.name} — {pack.currency} {amountFormatted} {t`(no surcharge)`}
            </p>
            <StyledSection>
              <StyledLabel>{t`Company name`}</StyledLabel>
              <TextInput
                value={companyName}
                onChange={setCompanyName}
                placeholder={t`Company name`}
                fullWidth
                disableHotkeys
              />
            </StyledSection>
            <StyledSection>
              <StyledLabel>{t`Billing address`}</StyledLabel>
              <TextInput
                value={billingAddress}
                onChange={setBillingAddress}
                placeholder={t`Billing address`}
                fullWidth
                disableHotkeys
              />
            </StyledSection>
            <StyledSection>
              <StyledLabel>{t`Billing email`}</StyledLabel>
              <TextInput
                value={billingEmail}
                onChange={setBillingEmail}
                placeholder={t`Billing email`}
                fullWidth
                disableHotkeys
              />
            </StyledSection>
            <StyledSection>
              <StyledLabel>{t`VAT number (optional)`}</StyledLabel>
              <TextInput
                value={vatNumber}
                onChange={setVatNumber}
                placeholder={t`VAT number`}
                fullWidth
                disableHotkeys
              />
            </StyledSection>
            <StyledButtonRow>
              <Button
                variant="secondary"
                title={t`Cancel`}
                onClick={handleClose}
                fullWidth
              />
              <Button
                variant="primary"
                title={t`Create custom quote`}
                onClick={handleSubmit}
                disabled={
                  !companyName.trim() ||
                  !billingEmail.trim() ||
                  loading
                }
                fullWidth
              />
            </StyledButtonRow>
          </StyledModal>
        )}
      </LayoutGroup>
    </AnimatePresence>
  );
};
