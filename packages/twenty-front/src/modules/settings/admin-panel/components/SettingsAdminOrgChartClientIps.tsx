import {
    DELETE_ORG_CHART_CLIENT_IP_RULE,
    RESET_ORG_CHART_CLIENT_IP_RULE_COUNTERS,
    UPSERT_ORG_CHART_CLIENT_IP_RULE,
} from '@/settings/admin-panel/graphql/mutations/orgChartClientIpRules';
import { GET_ORG_CHART_CLIENT_IP_RULES } from '@/settings/admin-panel/graphql/queries/getOrgChartClientIpRules';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInput } from '@/ui/input/components/TextInput';
import { Table } from '@/ui/layout/table/components/Table';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { FetchResult, useMutation, useQuery } from '@apollo/client';
import styled from '@emotion/styled';
import { useState } from 'react';
import { isDefined } from 'twenty-shared';
import {
    Button,
    H2Title,
    IconRefresh,
    IconTrash,
    Section,
    Toggle,
} from 'twenty-ui';

type OrgChartClientIpRuleRow = {
  id: string;
  ipAddress: string;
  isBlocked: boolean;
  serveCachedOnly: boolean;
  totalRequests: number;
  chartsServed: number;
  lastUserAgent?: string | null;
  createdAt: string;
  updatedAt: string;
};

type GetOrgChartClientIpRulesData = {
  orgChartClientIpRules: OrgChartClientIpRuleRow[];
};

type UpsertOrgChartClientIpRuleData = {
  upsertOrgChartClientIpRule: OrgChartClientIpRuleRow;
};

type UpsertOrgChartClientIpRuleVariables = {
  input: {
    ipAddress: string;
    isBlocked: boolean;
    serveCachedOnly: boolean;
  };
};

type IdMutationVariables = { id: string };

const StyledSection = styled(Section)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledAddRow = styled.div`
  align-items: flex-end;
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  justify-content: flex-end;
`;

const StyledTable = styled(Table)`
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledHint = styled.p`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin: 0;
  max-width: 720px;
`;

const StyledErrorMessage = styled.div`
  background: ${({ theme }) => theme.background.transparent.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.color.red};
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledEmptyTableMessage = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledUserAgent = styled.span`
  display: block;
  font-size: ${({ theme }) => theme.font.size.sm};
  max-width: min(360px, 100%);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const SettingsAdminOrgChartClientIps = () => {
  const { enqueueSnackBar } = useSnackBar();
  const [ipInput, setIpInput] = useState('');
  const [addBlocked, setAddBlocked] = useState(false);
  const [addCachedOnly, setAddCachedOnly] = useState(false);

  const { data, loading, error, refetch } = useQuery<GetOrgChartClientIpRulesData>(
    GET_ORG_CHART_CLIENT_IP_RULES,
    {
      fetchPolicy: 'network-only',
    },
  );

  const [upsertRule, { loading: upsertLoading }] = useMutation<
    UpsertOrgChartClientIpRuleData,
    UpsertOrgChartClientIpRuleVariables
  >(UPSERT_ORG_CHART_CLIENT_IP_RULE, {
    onError: (e) => {
      enqueueSnackBar(e.message, { variant: SnackBarVariant.Error });
    },
  });

  const [deleteRule] = useMutation<
    { deleteOrgChartClientIpRule: boolean },
    IdMutationVariables
  >(DELETE_ORG_CHART_CLIENT_IP_RULE, {
    onCompleted: () => {
      enqueueSnackBar('Rule removed', { variant: SnackBarVariant.Success });
      void refetch();
    },
    onError: (e) => {
      enqueueSnackBar(e.message, { variant: SnackBarVariant.Error });
    },
  });

  const [resetCounters] = useMutation<
    { resetOrgChartClientIpRuleCounters: boolean },
    IdMutationVariables
  >(RESET_ORG_CHART_CLIENT_IP_RULE_COUNTERS, {
    onCompleted: () => {
      enqueueSnackBar('Counters reset', { variant: SnackBarVariant.Success });
      void refetch();
    },
    onError: (e) => {
      enqueueSnackBar(e.message, { variant: SnackBarVariant.Error });
    },
  });

  const handleAdd = async () => {
    const trimmed = ipInput.trim();
    if (trimmed.length === 0) {
      enqueueSnackBar('Enter an IP address or CIDR', {
        variant: SnackBarVariant.Error,
      });
      return;
    }
    const res: FetchResult<UpsertOrgChartClientIpRuleData> = await upsertRule({
      variables: {
        input: {
          ipAddress: trimmed,
          isBlocked: addBlocked,
          serveCachedOnly: addCachedOnly,
        },
      },
    });
    if (isDefined(res.data?.upsertOrgChartClientIpRule)) {
      enqueueSnackBar('Rule saved', { variant: SnackBarVariant.Success });
      setIpInput('');
      await refetch();
    }
  };

  const handleToggle = async (
    ipAddress: string,
    isBlocked: boolean,
    serveCachedOnly: boolean,
    field: 'isBlocked' | 'serveCachedOnly',
    value: boolean,
  ) => {
    const next =
      field === 'isBlocked'
        ? {
            ipAddress,
            isBlocked: value,
            serveCachedOnly,
          }
        : {
            ipAddress,
            isBlocked,
            serveCachedOnly: value,
          };
    const res: FetchResult<UpsertOrgChartClientIpRuleData> = await upsertRule({
      variables: { input: next },
    });
    if (isDefined(res.data?.upsertOrgChartClientIpRule)) {
      await refetch();
    }
  };

  const rules = data?.orgChartClientIpRules ?? [];

  return (
    <StyledSection>
      <H2Title
        title="Org chart client IPs"
        description="Track and control public org-chart traffic by IP or CIDR range."
      />
      <StyledHint>
        Enter a single IPv4 (e.g. 203.0.113.10) or a CIDR block (e.g.
        43.173.0.0/16). Any client IP matching a rule is counted and controlled.
        Block stops all org-chart JSON (403). Cache-only skips Elasticsearch and
        only serves Redis, S3, or the blank placeholder. When both are off, the
        rule is only monitored. The marketing site sends{' '}
        <code>X-Org-Chart-Client-Ip</code> and{' '}
        <code>X-Org-Chart-Client-User-Agent</code> automatically from the
        org-chart API route.
      </StyledHint>

      {error && (
        <StyledErrorMessage>
          Failed to load IP rules: {error.message}
        </StyledErrorMessage>
      )}

      <StyledAddRow>
        <TextInput
          placeholder="e.g. 203.0.113.10 or 43.173.0.0/16"
          value={ipInput}
          onChange={setIpInput}
        />
        <Toggle value={addBlocked} onChange={setAddBlocked} />
        <span>Block</span>
        <Toggle value={addCachedOnly} onChange={setAddCachedOnly} />
        <span>Cache only</span>
        <Button
          title="Add / update"
          variant="primary"
          onClick={() => void handleAdd()}
          disabled={upsertLoading}
        />
        <Button
          Icon={IconRefresh}
          title="Refresh"
          variant="secondary"
          onClick={() => void refetch()}
          disabled={loading}
        />
      </StyledAddRow>

      <StyledTable>
        <TableRow
          gridAutoColumns="120px minmax(160px,1fr) 72px 88px 72px 72px minmax(100px,0.8fr)"
          mobileGridAutoColumns="1fr"
        >
          <TableHeader>IP / CIDR</TableHeader>
          <TableHeader>User-Agent</TableHeader>
          <TableHeader align="center">Block</TableHeader>
          <TableHeader align="center">Cache only</TableHeader>
          <TableHeader align="right">Requests</TableHeader>
          <TableHeader align="right">Charts</TableHeader>
          <TableHeader align="right">Actions</TableHeader>
        </TableRow>
        {loading && (
          <TableRow gridAutoColumns="1fr" mobileGridAutoColumns="1fr">
            <TableCell>Loading…</TableCell>
          </TableRow>
        )}
        {!loading &&
          !error &&
          rules.length === 0 && (
            <TableRow gridAutoColumns="1fr" mobileGridAutoColumns="1fr">
              <TableCell>
                <StyledEmptyTableMessage>
                  No rules yet. Add an IP or CIDR above to track and manage traffic.
                </StyledEmptyTableMessage>
              </TableCell>
            </TableRow>
          )}
        {!loading &&
          rules.map((rule) => (
            <TableRow
              key={rule.id}
              gridAutoColumns="120px minmax(160px,1fr) 72px 88px 72px 72px minmax(100px,0.8fr)"
              mobileGridAutoColumns="1fr"
            >
              <TableCell>{rule.ipAddress}</TableCell>
              <TableCell>
                <StyledUserAgent title={rule.lastUserAgent ?? undefined}>
                  {rule.lastUserAgent?.trim() ? rule.lastUserAgent : '—'}
                </StyledUserAgent>
              </TableCell>
              <TableCell align="center">
                <Toggle
                  value={rule.isBlocked}
                  onChange={(v) =>
                    void handleToggle(
                      rule.ipAddress,
                      rule.isBlocked,
                      rule.serveCachedOnly,
                      'isBlocked',
                      v,
                    )
                  }
                />
              </TableCell>
              <TableCell align="center">
                <Toggle
                  value={rule.serveCachedOnly}
                  onChange={(v) =>
                    void handleToggle(
                      rule.ipAddress,
                      rule.isBlocked,
                      rule.serveCachedOnly,
                      'serveCachedOnly',
                      v,
                    )
                  }
                />
              </TableCell>
              <TableCell align="right">{rule.totalRequests}</TableCell>
              <TableCell align="right">{rule.chartsServed}</TableCell>
              <TableCell align="right">
                <StyledActions>
                  <Button
                    title="Reset counters"
                    variant="secondary"
                    onClick={() =>
                      void resetCounters({ variables: { id: rule.id } })
                    }
                  />
                  <Button
                    Icon={IconTrash}
                    title="Delete"
                    variant="secondary"
                    onClick={() =>
                      void deleteRule({ variables: { id: rule.id } })
                    }
                  />
                </StyledActions>
              </TableCell>
            </TableRow>
          ))}
      </StyledTable>
    </StyledSection>
  );
};
