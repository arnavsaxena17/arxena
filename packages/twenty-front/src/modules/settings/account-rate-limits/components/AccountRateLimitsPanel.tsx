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

export type AccountRateLimitSnapshot<TLimits extends Record<string, number>> = {
  limits: TLimits;
  usage?: Partial<Record<Extract<keyof TLimits, string>, number>>;
  reserved?: Partial<Record<Extract<keyof TLimits, string>, number>>;
  nextSlotAt?: Partial<Record<Extract<keyof TLimits, string>, string | null>>;
};

type AccountRateLimitsPanelProps<TLimits extends Record<string, number>> = {
  title: string;
  description: string;
  accountId: string;
  fields: Array<AccountRateLimitFieldConfig<Extract<keyof TLimits, string>>>;
  loadLimits: () => Promise<AccountRateLimitSnapshot<TLimits>>;
  saveLimits: (limits: TLimits) => Promise<TLimits>;
  flushUsage?: (
    fieldKey: Extract<keyof TLimits, string>,
  ) => Promise<{ deletedKeys: number }>;
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
  const [usage, setUsage] = useState<
    Partial<Record<Extract<keyof TLimits, string>, number>>
  >({});
  const [reserved, setReserved] = useState<
    Partial<Record<Extract<keyof TLimits, string>, number>>
  >({});
  const [nextSlotAt, setNextSlotAt] = useState<
    Partial<Record<Extract<keyof TLimits, string>, string | null>>
  >({});
  const [saving, setSaving] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [pendingFlushField, setPendingFlushField] =
    useState<AccountRateLimitFieldConfig<
      Extract<keyof TLimits, string>
    > | null>(null);
  const flushModalId = `flush-account-rate-limit-usage-${accountId}`;

  const applySnapshot = useCallback(
    (snapshot: AccountRateLimitSnapshot<TLimits>) => {
      setLimits(snapshot.limits);
      setUsage(snapshot.usage ?? {});
      setReserved(snapshot.reserved ?? {});
      setNextSlotAt(snapshot.nextSlotAt ?? {});
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void loadLimits().then((next) => {
      if (!cancelled) {
        applySnapshot(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, applySnapshot, loadLimits]);

  const handleSave = useCallback(async () => {
    if (!limits) {
      return;
    }
    setSaving(true);
    try {
      const saved = await saveLimits(limits);
      setLimits(saved);
      enqueueSuccessSnackBar({
        message: t`Rate limits saved.`,
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : t`Failed to save rate limits.`,
      });
    } finally {
      setSaving(false);
    }
  }, [enqueueErrorSnackBar, enqueueSuccessSnackBar, limits, saveLimits, t]);

  const handleFlushUsage = useCallback(async () => {
    if (!flushUsage || !pendingFlushField) {
      return;
    }
    const field = pendingFlushField;
    const fieldLabel = field.label;
    const fieldWindowLabel = field.windowLabel;
    setFlushing(true);
    try {
      await flushUsage(field.key);
      setUsage((current) => ({ ...current, [field.key]: 0 }));
      setReserved((current) => ({ ...current, [field.key]: 0 }));
      setNextSlotAt((current) => ({ ...current, [field.key]: null }));
      try {
        const snapshot = await loadLimits();
        applySnapshot(snapshot);
      } catch {
        // Keep the local zero if the refresh fails.
      }
      enqueueSuccessSnackBar({
        message: t`Cleared used and reserved requests for ${fieldLabel} (${fieldWindowLabel}). New requests can run immediately.`,
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : t`Failed to clear used and reserved request counters.`,
      });
    } finally {
      setFlushing(false);
      setPendingFlushField(null);
    }
  }, [
    applySnapshot,
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    flushUsage,
    loadLimits,
    pendingFlushField,
    t,
  ]);

  const pendingFlushLabel = pendingFlushField?.label;
  const pendingFlushWindowLabel = pendingFlushField?.windowLabel;

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
                used={usage[field.key] ?? 0}
                reserved={reserved[field.key] ?? 0}
                nextSlotAt={nextSlotAt[field.key] ?? null}
                min={field.min}
                max={field.max}
                recommended={field.recommended}
                disabled={saving || flushing}
                clearing={flushing && pendingFlushField?.key === field.key}
                onClearUsage={
                  flushUsage
                    ? () => {
                        setPendingFlushField(field);
                        openModal(flushModalId);
                      }
                    : undefined
                }
                onChange={(value) =>
                  setLimits((current) =>
                    current ? { ...current, [field.key]: value } : current,
                  )
                }
              />
            ))}
          </CardContent>
        </Card>
        <Footer>
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
          title={t`Clear used and reserved requests?`}
          subtitle={
            pendingFlushLabel && pendingFlushWindowLabel
              ? t`This resets used and reserved request counters for ${pendingFlushLabel} (${pendingFlushWindowLabel}) so this action is no longer blocked by existing usage or deferred holds. Saved limit values are kept. Queued workflow retries still resume on their schedule, but will no longer wait on this counter.`
              : t`This resets used and reserved request counters for this limit so the action is no longer blocked by existing usage or deferred holds. Saved limit values are kept.`
          }
          confirmButtonText={t`Clear used and reserved`}
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
