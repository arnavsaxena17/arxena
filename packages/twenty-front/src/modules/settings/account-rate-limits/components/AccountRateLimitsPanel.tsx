import { useCallback, useEffect, useState } from 'react';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { Card, CardContent } from 'twenty-ui/surfaces';
import { H2Title } from 'twenty-ui/typography';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { AccountRateLimitSliderRow } from '@/settings/account-rate-limits/components/AccountRateLimitSliderRow';

const Panel = styled.div`
  margin-top: ${themeCssVariables.spacing[4]};
  width: 100%;
`;

const Footer = styled.div`
  display: flex;
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
};

export const AccountRateLimitsPanel = <TLimits extends Record<string, number>>({
  title,
  description,
  accountId,
  fields,
  loadLimits,
  saveLimits,
}: AccountRateLimitsPanelProps<TLimits>) => {
  const { t } = useLingui();
  const [limits, setLimits] = useState<TLimits | null>(null);
  const [saving, setSaving] = useState(false);

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
          <Button
            title={t`Save settings`}
            variant="primary"
            accent="blue"
            disabled={saving}
            onClick={() => {
              void handleSave();
            }}
          />
        </Footer>
      </Section>
    </Panel>
  );
};
