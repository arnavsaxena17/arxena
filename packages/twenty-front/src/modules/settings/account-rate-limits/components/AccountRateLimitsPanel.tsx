import { useCallback, useEffect, useState } from 'react';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { Card, CardContent } from 'twenty-ui/surfaces';
import { H2Title } from 'twenty-ui/typography';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { AccountRateLimitSliderRow } from '@/settings/account-rate-limits/components/AccountRateLimitSliderRow';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';

const Panel = styled.div`
  margin-top: ${themeCssVariables.spacing[4]};
  width: 100%;
`;

const Footer = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
  margin-top: ${themeCssVariables.spacing[3]};
`;

export type AccountRateLimitFieldConfig<TKey extends string> = {
  key: TKey;
  label: string;
  windowLabel: string;
  min: number;
  max: number;
  recommended: number;
};

type AccountRateLimitsPanelProps<TLimits extends Record<string, number>> = {
  title: string;
  description: string;
  accountId: string;
  fields: Array<AccountRateLimitFieldConfig<Extract<keyof TLimits, string>>>;
  loadLimits: () => Promise<TLimits>;
  saveLimits: (limits: TLimits) => Promise<TLimits>;
  flushUsage?: () => Promise<{ deletedKeys: number }>;
};

export const AccountRateLimitsPanel = <TLimits extends Record<string, number>>({
  title,
  description,
  accountId,
  fields,
  loadLimits,
  saveLimits,
  flushUsage,
}: AccountRateLimitsPanelProps<TLimits>) => {
  const { t } = useLingui();
  const { openModal } = useModal();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const [limits, setLimits] = useState<TLimits | null>(null);
  const [saving, setSaving] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const flushModalId = `flush-account-rate-limit-usage-${accountId}`;

  useEffect(() => {
    let cancelled = false;
    void loadLimits().then((next) => {
      if (!cancelled) {
        setLimits(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, loadLimits]);

  const handleSave = useCallback(async () => {
    if (!limits) {
      return;
    }
    setSaving(true);
    try {
      const saved = await saveLimits(limits);
      setLimits(saved);
    } finally {
      setSaving(false);
    }
  }, [limits, saveLimits]);

  const handleFlushUsage = useCallback(async () => {
    if (!flushUsage) {
      return;
    }
    setFlushing(true);
    try {
      const result = await flushUsage();
      enqueueSuccessSnackBar({
        message: t`Cleared ${result.deletedKeys} used request counters. New requests can run immediately.`,
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : t`Failed to clear used request counters.`,
      });
    } finally {
      setFlushing(false);
    }
  }, [enqueueErrorSnackBar, enqueueSuccessSnackBar, flushUsage, t]);

  if (!limits) {
    return null;
  }

  return (
    <Panel>
      <Section>
        <H2Title title={title} description={description} />
        <Card>
          <CardContent>
            {fields.map((field) => (
              <AccountRateLimitSliderRow
                key={field.key}
                instanceId={`${accountId}-${field.key}`}
                label={field.label}
                windowLabel={field.windowLabel}
                value={limits[field.key]}
                min={field.min}
                max={field.max}
                recommended={field.recommended}
                onChange={(value) =>
                  setLimits((current) =>
                    current
                      ? { ...current, [field.key]: value }
                      : current,
                  )
                }
              />
            ))}
          </CardContent>
        </Card>
        <Footer>
          {flushUsage && (
            <Button
              title={t`Clear used requests`}
              variant="secondary"
              accent="danger"
              disabled={saving || flushing}
              onClick={() => openModal(flushModalId)}
            />
          )}
          <Button
            title={t`Save settings`}
            variant="primary"
            accent="blue"
            disabled={saving || flushing}
            onClick={() => {
              void handleSave();
            }}
          />
        </Footer>
      </Section>
      {flushUsage && (
        <ConfirmationModal
          modalInstanceId={flushModalId}
          title={t`Clear used requests?`}
          subtitle={t`This resets this account's Redis request counters so searches and sends are no longer blocked by existing rate-limit usage. Saved limit values are kept. Queued workflow retries still resume on their schedule, but will no longer wait on these counters.`}
          confirmButtonText={t`Clear used requests`}
          confirmButtonAccent="danger"
          loading={flushing}
          onConfirmClick={() => {
            void handleFlushUsage();
          }}
        />
      )}
    </Panel>
  );
};
