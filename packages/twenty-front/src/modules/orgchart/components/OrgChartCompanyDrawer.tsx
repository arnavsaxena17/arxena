import styled from '@emotion/styled';
import { IconBrandLinkedin, IconWorld } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, IconButton, IconX } from 'twenty-ui';

import { TabList } from '@/ui/layout/tab/components/TabList';
import { useTabList } from '@/ui/layout/tab/hooks/useTabList';
import { isValidLinkedInProfileUrl, toTitleCase } from 'twenty-shared';

import type { OrgChartCompanyInfoProps } from './OrgChartCompanyInfo';

const StyledDrawerBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.25);
  z-index: 50;
  animation: fadeIn 0.2s ease-out;
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const StyledDrawer = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(420px, 100vw);
  background: ${({ theme }) => theme.background.primary};
  box-shadow: -4px 0 24px rgba(15, 23, 42, 0.15);
  z-index: 51;
  display: flex;
  flex-direction: column;
  animation: slideIn 0.25s ease-out;
  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
`;

const StyledDrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  flex-shrink: 0;
`;

const StyledDrawerTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledDrawerBody = styled.div`
  flex: 1;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledCompanyHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledCompanyLogo = styled.img`
  width: 64px;
  height: 64px;
  border-radius: ${({ theme }) => theme.border.radius.md};
  object-fit: contain;
  background: ${({ theme }) => theme.background.tertiary};
  flex-shrink: 0;
`;

const StyledCompanyLogoPlaceholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.tertiary};
  flex-shrink: 0;
`;

const StyledCompanyTitleBlock = styled.div`
  min-width: 0;
  flex: 1;
`;

const StyledCompanyName = styled.h3`
  margin: 0 0 ${({ theme }) => theme.spacing(0.5)};
  font-size: 1.25rem;
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledTagline = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  line-height: 1.4;
`;

const StyledSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledSectionTitle = styled.h4`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const StyledSectionContent = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  line-height: 1.5;
`;

const StyledLinkRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledMetaGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledMetaRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledMetaLabel = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  flex-shrink: 0;
`;

const StyledMetaValue = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  text-align: right;
`;

const StyledActionsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledTabsRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  flex-wrap: wrap;
`;

const StyledTimelineTabList = styled(TabList)`
  border-bottom: none;
`;

const StyledWindowButton = styled(Button)`
  min-width: 48px;
`;

const StyledProfilesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledProfileRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
`;

const StyledProfileMain = styled.div`
  min-width: 0;
`;

const StyledProfileTitle = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledProfileRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  flex-shrink: 0;
`;

const StyledProfileFunction = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledFunctionGroup = styled.details`
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.secondary};
`;

const StyledFunctionSummary = styled.summary`
  cursor: pointer;
  list-style: none;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(1.5)};
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${({ theme }) => theme.font.color.primary};
  font-weight: 500;
  &::-webkit-details-marker {
    display: none;
  }
`;

const StyledFunctionGroupLabel = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledFunctionGroupCount = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledCacheSection = styled(StyledSection)`
  margin-top: auto;
`;

export type OrgChartCompanyDrawerProps = OrgChartCompanyInfoProps & {
  isOpen: boolean;
  onClose: () => void;
  onClearCompanyCache?: () => void;
  timelineMetrics?: Record<string, unknown> | null;
  timelineProfilesOptions?: {
    baseUrl: string;
    accessToken?: string;
    companyId: string;
    asOfMonth?: string;
    companyName?: string;
    sampleSource?: string;
    sampleProfiles?: string;
    includeOrgIntelligence?: string;
  };
};

export const OrgChartCompanyDrawer = ({
  companyName,
  website,
  locationName,
  industry,
  profileCount,
  linkedinUrl,
  employeeCount,
  linkedinDisplayName,
  description,
  tagline,
  logoUrl: logoUrlProp,
  hideProfileCountWhenUnipile,
  isOpen,
  onClose,
  onClearCompanyCache,
  timelineMetrics,
  timelineProfilesOptions,
}: OrgChartCompanyDrawerProps) => {
  const timelineTabListInstanceId = 'orgchart-company-drawer-timeline-tabs';
  const { activeTabId } = useTabList(timelineTabListInstanceId);
  const activeTab = (
    activeTabId ?? 'company'
  ) as 'company' | 'joined' | 'left' | 'current' | 'past';
  const [activeWindow, setActiveWindow] = useState<'1m' | '3m' | '6m' | '1y'>(
    '1m',
  );
  const [timelineProfiles, setTimelineProfiles] = useState<Record<string, unknown> | null>(null);
  const [isTimelineProfilesLoading, setIsTimelineProfilesLoading] = useState(false);

  const getLogoUrl = (site?: string): string | null => {
    if (!site?.trim()) return null;
    const base = process.env.REACT_APP_SERVER_BASE_URL ?? '';
    if (!base) return null;
    return `${base.replace(/\/$/, '')}/org-chart/company-logo?website=${encodeURIComponent(
      site,
    )}`;
  };

  const getDisplayDomain = (site?: string): string | null => {
    if (!site?.trim()) return null;
    try {
      const withProtocol = site.startsWith('http') ? site : `https://${site}`;
      const { hostname } = new URL(withProtocol);
      return hostname.replace(/^www\./u, '');
    } catch {
      return site;
    }
  };

  const logoUrl = logoUrlProp?.trim() ? logoUrlProp : getLogoUrl(website);
  const websiteDomain = getDisplayDomain(website);
  const displayCompanyName = toTitleCase(companyName);
  const displayLocationName = toTitleCase(locationName);
  const displayIndustry = toTitleCase(industry);
  const linkedinLabel =
    toTitleCase(linkedinDisplayName) || displayCompanyName || 'LinkedIn';
  const websiteUrl = website
    ? website.startsWith('http')
      ? website
      : `https://${website}`
    : null;

  const shouldFetchProfiles =
    activeTab === 'joined' ||
    activeTab === 'left' ||
    activeTab === 'current' ||
    activeTab === 'past';

  useEffect(() => {
    if (!shouldFetchProfiles || !timelineProfilesOptions?.baseUrl?.trim()) {
      setTimelineProfiles(null);
      return;
    }
    const event =
      activeTab === 'joined' || activeTab === 'left' || activeTab === 'current' || activeTab === 'past'
        ? activeTab
        : 'current';
    let cancelled = false;
    const run = async () => {
      setIsTimelineProfilesLoading(true);
      try {
        const params = new URLSearchParams();
        if (timelineProfilesOptions.companyName?.trim()) {
          params.set('companyName', timelineProfilesOptions.companyName.trim());
        }
        if (timelineProfilesOptions.asOfMonth?.trim()) {
          params.set('asOfMonth', timelineProfilesOptions.asOfMonth.trim());
        }
        if (timelineProfilesOptions.sampleSource?.trim()) {
          params.set('sampleSource', timelineProfilesOptions.sampleSource.trim());
        }
        if (timelineProfilesOptions.sampleProfiles?.trim()) {
          params.set('sampleProfiles', timelineProfilesOptions.sampleProfiles.trim());
        }
        if (timelineProfilesOptions.includeOrgIntelligence?.trim()) {
          params.set(
            'includeOrgIntelligence',
            timelineProfilesOptions.includeOrgIntelligence.trim(),
          );
        }
        params.set('event', event);
        params.set('window', activeWindow);
        params.set('limit', '100');
        const url = `${timelineProfilesOptions.baseUrl.replace(
          /\/$/,
          '',
        )}/org-chart/${encodeURIComponent(
          timelineProfilesOptions.companyId,
        )}/timeline/profiles?${params.toString()}`;
        const res = await fetch(url, {
          headers: {
            ...(timelineProfilesOptions.accessToken
              ? { Authorization: `Bearer ${timelineProfilesOptions.accessToken}` }
              : {}),
          },
        });
        const json = (await res.json()) as {
          result?: Record<string, unknown>;
        };
        if (!cancelled) {
          setTimelineProfiles(res.ok ? json.result ?? null : null);
        }
      } catch {
        if (!cancelled) setTimelineProfiles(null);
      } finally {
        if (!cancelled) setIsTimelineProfilesLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeTab, activeWindow, shouldFetchProfiles, timelineProfilesOptions]);

  const timelineProfilesRows = useMemo(() => {
    const rows = timelineProfiles?.profiles;
    return Array.isArray(rows) ? rows : [];
  }, [timelineProfiles]);

  const normalizeLinkedInUrl = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!isValidLinkedInProfileUrl(trimmed)) return null;
    return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  };

  const activeWindowMetrics = useMemo(() => {
    const windows = timelineMetrics?.windows as Record<string, unknown> | undefined;
    const slot =
      windows && typeof windows === 'object'
        ? (windows[activeWindow] as Record<string, unknown> | undefined)
        : undefined;
    const joined =
      slot?.joined && typeof slot.joined === 'object'
        ? (slot.joined as Record<string, unknown>).total
        : undefined;
    const left =
      slot?.left && typeof slot.left === 'object'
        ? (slot.left as Record<string, unknown>).total
        : undefined;
    return {
      joined: typeof joined === 'number' ? joined : '—',
      left: typeof left === 'number' ? left : '—',
    };
  }, [activeWindow, timelineMetrics]);

  const timelineMetricsByWindow = useMemo(() => {
    const windows = timelineMetrics?.windows as Record<string, unknown> | undefined;
    return (['1m', '3m', '6m', '1y'] as const).map((w) => {
      const slot =
        windows && typeof windows === 'object'
          ? (windows[w] as Record<string, unknown> | undefined)
          : undefined;
      const joined =
        slot?.joined && typeof slot.joined === 'object'
          ? (slot.joined as Record<string, unknown>).total
          : undefined;
      const left =
        slot?.left && typeof slot.left === 'object'
          ? (slot.left as Record<string, unknown>).total
          : undefined;
      const rates =
        slot?.rates && typeof slot.rates === 'object'
          ? (slot.rates as Record<string, unknown>)
          : undefined;
      const hiringRatePct =
        typeof rates?.hiringRatePct === 'number' ? rates.hiringRatePct : null;
      const attritionRatePct =
        typeof rates?.attritionRatePct === 'number' ? rates.attritionRatePct : null;
      return {
        window: w,
        joined: typeof joined === 'number' ? joined : '—',
        left: typeof left === 'number' ? left : '—',
        hiringRatePct:
          hiringRatePct === null ? '—' : `${hiringRatePct.toFixed(1)}%`,
        attritionRatePct:
          attritionRatePct === null ? '—' : `${attritionRatePct.toFixed(1)}%`,
      };
    });
  }, [timelineMetrics]);

  const groupedTimelineRows = useMemo(() => {
    const showGrouped = activeTab === 'joined' || activeTab === 'left';
    if (!showGrouped) return null;
    const groups = new Map<string, Array<Record<string, unknown>>>();
    for (const row of timelineProfilesRows) {
      const item = row as Record<string, unknown>;
      const raw = String(item.functionRoot ?? 'unclassified');
      const root = toTitleCase(raw);
      const current = groups.get(root) ?? [];
      current.push(item);
      groups.set(root, current);
    }
    return Array.from(groups.entries())
      .map(([functionRoot, items]) => ({
        functionRoot,
        items: items.sort((a, b) =>
          String(a.fullName ?? '').localeCompare(String(b.fullName ?? '')),
        ),
      }))
      .sort((a, b) => a.functionRoot.localeCompare(b.functionRoot));
  }, [activeTab, timelineProfilesRows]);

  if (!isOpen) return null;

  return (
    <>
      <StyledDrawerBackdrop onClick={onClose} aria-hidden="true" />
      <StyledDrawer role="dialog" aria-modal="true" aria-label="Company details">
        <StyledDrawerHeader>
          <StyledDrawerTitle>Company details</StyledDrawerTitle>
          <IconButton
            Icon={IconX}
            onClick={onClose}
            variant="tertiary"
            aria-label="Close company details"
          />
        </StyledDrawerHeader>
        <StyledDrawerBody>
          <StyledCompanyHeader>
            {logoUrl ? (
              <StyledCompanyLogo src={logoUrl} alt="" loading="lazy" />
            ) : (
              <StyledCompanyLogoPlaceholder />
            )}
            <StyledCompanyTitleBlock>
              <StyledCompanyName>{displayCompanyName || 'Company'}</StyledCompanyName>
              {tagline?.trim() && (
                <StyledTagline>{tagline.trim()}</StyledTagline>
              )}
            </StyledCompanyTitleBlock>
          </StyledCompanyHeader>

          {(linkedinUrl || website) && (
            <StyledSection>
              <StyledSectionTitle>Links</StyledSectionTitle>
              <StyledLinkRow>
                {linkedinUrl && (
                  <Button
                    title={linkedinLabel}
                    variant="secondary"
                    size="small"
                    onClick={() => window.open(linkedinUrl, '_blank', 'noopener,noreferrer')}
                    ariaLabel="Open LinkedIn company page"
                  />
                )}
                {websiteUrl && (
                  <Button
                    title={websiteDomain || 'Website'}
                    variant="secondary"
                    size="small"
                    Icon={IconWorld}
                    onClick={() => window.open(websiteUrl, '_blank', 'noopener,noreferrer')}
                    ariaLabel="Open company website"
                  />
                )}
              </StyledLinkRow>
            </StyledSection>
          )}

          <StyledSection>
            <StyledSectionTitle>Overview</StyledSectionTitle>
            <StyledMetaGrid>
              {displayLocationName && (
                <StyledMetaRow>
                  <StyledMetaLabel>Location</StyledMetaLabel>
                  <StyledMetaValue>{displayLocationName}</StyledMetaValue>
                </StyledMetaRow>
              )}
              {displayIndustry && (
                <StyledMetaRow>
                  <StyledMetaLabel>Industry</StyledMetaLabel>
                  <StyledMetaValue>{displayIndustry}</StyledMetaValue>
                </StyledMetaRow>
              )}
              {typeof employeeCount === 'number' && (
                <StyledMetaRow>
                  <StyledMetaLabel>Employees</StyledMetaLabel>
                  <StyledMetaValue>
                    {employeeCount.toLocaleString()}
                  </StyledMetaValue>
                </StyledMetaRow>
              )}
              {typeof profileCount === 'number' && !hideProfileCountWhenUnipile && (
                <StyledMetaRow>
                  <StyledMetaLabel>Profiles</StyledMetaLabel>
                  <StyledMetaValue>
                    {profileCount.toLocaleString()}
                  </StyledMetaValue>
                </StyledMetaRow>
              )}
            </StyledMetaGrid>
          </StyledSection>

          <StyledSection>
            <StyledSectionTitle>Timeline</StyledSectionTitle>
            <StyledTimelineTabList
              tabListInstanceId={timelineTabListInstanceId}
              behaveAsLinks={false}
              isInRightDrawer
              tabs={[
                { id: 'company', title: 'Company info' },
                { id: 'joined', title: 'Who joined' },
                { id: 'left', title: 'Who left' },
                { id: 'current', title: 'Current' },
                { id: 'past', title: 'Past' },
              ]}
            />
            {activeTab !== 'company' && (
              <StyledTabsRow>
                {(['1m', '3m', '6m', '1y'] as const).map((w) => (
                  <StyledWindowButton
                    key={w}
                    title={w}
                    variant={activeWindow === w ? 'primary' : 'secondary'}
                    size="small"
                    onClick={() => setActiveWindow(w)}
                  />
                ))}
              </StyledTabsRow>
            )}
          </StyledSection>

          {timelineMetrics && (
            <StyledSection>
              <StyledSectionTitle>Timeline metrics</StyledSectionTitle>
              <StyledSectionContent>
                <StyledMetaGrid>
                  <StyledMetaRow>
                    <StyledMetaLabel>As of</StyledMetaLabel>
                    <StyledMetaValue>
                      {typeof timelineMetrics.asOfMonth === 'string'
                        ? timelineMetrics.asOfMonth
                        : '—'}
                    </StyledMetaValue>
                  </StyledMetaRow>
                  <StyledMetaRow>
                    <StyledMetaLabel>Headcount</StyledMetaLabel>
                    <StyledMetaValue>
                      {typeof timelineMetrics.headcount === 'number'
                        ? timelineMetrics.headcount
                        : '—'}
                    </StyledMetaValue>
                  </StyledMetaRow>
                  <StyledMetaRow>
                    <StyledMetaLabel>{activeWindow}</StyledMetaLabel>
                    <StyledMetaValue>
                      joined {activeWindowMetrics.joined} · left {activeWindowMetrics.left}
                    </StyledMetaValue>
                  </StyledMetaRow>
                  {/* {timelineMetricsByWindow.map((slot) => (
                    <StyledMetaRow key={slot.window}>
                      <StyledMetaLabel>{slot.window} rates</StyledMetaLabel>
                      <StyledMetaValue>
                        hiring {slot.hiringRatePct} · attrition {slot.attritionRatePct}
                      </StyledMetaValue>
                    </StyledMetaRow>
                  ))} */}
                </StyledMetaGrid>
              </StyledSectionContent>
            </StyledSection>
          )}

          {shouldFetchProfiles && (
            <StyledSection>
              <StyledSectionTitle>
                {activeTab === 'joined'
                  ? 'Joined profiles'
                  : activeTab === 'left'
                    ? 'Left profiles'
                    : activeTab === 'current'
                      ? 'Current profiles'
                      : 'Past profiles'}
              </StyledSectionTitle>
              <StyledSectionContent>
                {isTimelineProfilesLoading && <div>Loading profiles…</div>}
                {!isTimelineProfilesLoading && timelineProfilesRows.length === 0 && (
                  <div>No profiles found for this selection.</div>
                )}
                {!isTimelineProfilesLoading && timelineProfilesRows.length > 0 && groupedTimelineRows && (
                  <StyledProfilesList>
                    {groupedTimelineRows.map((group, groupIdx) => (
                      <StyledFunctionGroup key={group.functionRoot} open={groupIdx === 0}>
                        <StyledFunctionSummary>
                          <StyledFunctionGroupLabel>{group.functionRoot}</StyledFunctionGroupLabel>
                          <StyledFunctionGroupCount>
                            {group.items.length}
                          </StyledFunctionGroupCount>
                        </StyledFunctionSummary>
                        <StyledProfilesList>
                          {group.items.map((item, idx) => {
                            const itemLinkedInUrl = normalizeLinkedInUrl(item.linkedinUrl);
                            return (
                              <StyledProfileRow key={`${String(item.id ?? idx)}`}>
                                <StyledProfileMain>
                                  <div>{String(item.fullName ?? 'Unknown')}</div>
                                  <StyledProfileTitle>
                                    {String(item.titleAtAsOf ?? '')}
                                    {item.eventMonth ? ` · ${String(item.eventMonth)}` : ''}
                                  </StyledProfileTitle>
                                </StyledProfileMain>
                                <StyledProfileRight>
                                  {itemLinkedInUrl && (
                                    <IconButton
                                      Icon={IconBrandLinkedin}
                                      onClick={() =>
                                        window.open(itemLinkedInUrl, '_blank', 'noopener,noreferrer')
                                      }
                                      variant="tertiary"
                                      size="small"
                                      aria-label={`Open ${String(item.fullName ?? 'profile')} on LinkedIn`}
                                    />
                                  )}
                                </StyledProfileRight>
                              </StyledProfileRow>
                            );
                          })}
                        </StyledProfilesList>
                      </StyledFunctionGroup>
                    ))}
                  </StyledProfilesList>
                )}
                {!isTimelineProfilesLoading && timelineProfilesRows.length > 0 && !groupedTimelineRows && (
                  <StyledProfilesList>
                    {timelineProfilesRows.map((row, idx) => {
                      const item = row as Record<string, unknown>;
                      const itemLinkedInUrl = normalizeLinkedInUrl(item.linkedinUrl);
                      return (
                        <StyledProfileRow key={`${String(item.id ?? idx)}`}>
                          <StyledProfileMain>
                            <div>{String(item.fullName ?? 'Unknown')}</div>
                            <StyledProfileTitle>
                              {String(item.titleAtAsOf ?? '')}
                              {item.eventMonth ? ` · ${String(item.eventMonth)}` : ''}
                            </StyledProfileTitle>
                          </StyledProfileMain>
                          <StyledProfileRight>
                            <StyledProfileFunction>
                              {toTitleCase(String(item.functionRoot ?? 'unclassified'))}
                            </StyledProfileFunction>
                            {itemLinkedInUrl && (
                              <IconButton
                                Icon={IconBrandLinkedin}
                                onClick={() =>
                                  window.open(itemLinkedInUrl, '_blank', 'noopener,noreferrer')
                                }
                                variant="tertiary"
                                size="small"
                                aria-label={`Open ${String(item.fullName ?? 'profile')} on LinkedIn`}
                              />
                            )}
                          </StyledProfileRight>
                        </StyledProfileRow>
                      );
                    })}
                  </StyledProfilesList>
                )}
              </StyledSectionContent>
            </StyledSection>
          )}

          {description?.trim() && (
            <StyledSection>
              <StyledSectionTitle>About</StyledSectionTitle>
              <StyledSectionContent
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {description.trim()}
              </StyledSectionContent>
            </StyledSection>
          )}

          {onClearCompanyCache && (
            <StyledCacheSection>
              <StyledSectionTitle>Cache</StyledSectionTitle>
              <StyledActionsRow>
                <Button
                  title="Clear cached org chart"
                  variant="secondary"
                  size="small"
                  onClick={onClearCompanyCache}
                />
              </StyledActionsRow>
            </StyledCacheSection>
          )}
        </StyledDrawerBody>
      </StyledDrawer>
    </>
  );
};
