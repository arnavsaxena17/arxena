import { Injectable } from '@nestjs/common';
import { QueryUnderstanding } from '../types/candidate-search-request.type';

@Injectable()
export class RecruitingKnowledgePrompts {
  /**
   * Get prompt for org structure knowledge
   */
  getOrgStructureKnowledgePrompt(
    role: string,
    companySize: { min?: number; max?: number },
    industry: string,
  ): string {
    return `You are an expert recruiter with deep knowledge of organizational structures. Analyze the role and provide org structure insights.

Role: ${role}
Company Size: ${companySize.min || 0}-${companySize.max || 'unlimited'} employees
Industry: ${industry}

RECRUITING KNOWLEDGE - ORG STRUCTURE FITMENT:
Structure is strategy. Clients want candidates from aligned positions in org charts of similar companies.

Key Principles:
1. Role equivalence depends on company size:
   - VP in 10K+ company manages entire assets
   - VP in 1K company is like C-suite
   - Executive Director in ONGC (10K+) manages oil fields
   - ED in 1K company is like CEO
   - Plant Manager in large MNC ≈ GM Operations in smaller company

2. Job titles vary by company size and industry:
   - Service companies (Accenture, Michael Page) use "Managing Director" for P&L heads
   - Manufacturing uses "MD" for CEO role
   - Managing Director in Accenture doesn't occupy board seat
   - Managing Director in manufacturing implies CEO with legal responsibility

3. Reporting relationships matter:
   - Who a candidate reports to indicates their level
   - Which positions report to candidate indicates their scope
   - Similar reporting structures = better fitment

Provide org structure insights for this role.`;
  }

  /**
   * Get prompt for culture classification
   */
  getCultureClassificationPrompt(
    companyName: string,
    industry?: string,
    context?: string,
  ): string {
    return `You are an expert recruiter specializing in company culture classification. Classify the company culture.

Company: ${companyName}
${industry ? `Industry: ${industry}` : ''}
${context ? `Context: ${context}` : ''}

RECRUITING KNOWLEDGE - COMPANY CULTURE:
Company culture fitment is critical for executive search:
- Promoter-driven companies prefer candidates from other promoter-driven or family-run businesses
- MNC candidates may not fit in small promoter-owned companies
- Family-run businesses often want candidates from other family-run businesses
- Consider cultural fitment when matching candidates

Culture Types:
- promoter_driven: Promoter-owned, promoters actively involved
- family_run: Family-owned, family in management
- mnc: Multinational corporations
- startup: Early-stage, typically funded
- psu: Public Sector Undertakings
- pe_backed: Private equity-backed
- listed: Publicly listed

Classify the company culture.`;
  }

  /**
   * Get prompt for location strategy
   */
  getLocationStrategyPrompt(
    location: string,
    industry?: string,
  ): string {
    return `You are an expert recruiter specializing in location fallback strategies. Identify fallback locations for recruitment.

Primary Location: ${location}
${industry ? `Industry: ${industry}` : ''}

RECRUITING KNOWLEDGE - LOCATION FALLBACK:
For remote or tier 2/3 locations:
1. Identify nearby industrial clusters
2. Prioritize locations by proximity and industrial relevance
3. Example: Mt Abu → Rajasthan → Gujarat (industrial clusters near Mt Abu)
4. Candidates from nearby clusters are more likely to relocate
5. For tier 2/3 locations, prioritize candidates from nearby large cities or industrial hubs

Provide a location fallback strategy with priority-ordered locations.`;
  }

  /**
   * Get prompt for competitor matching
   */
  getCompetitorMatchingPrompt(
    industry: string,
    companyType?: string,
  ): string {
    return `You are an expert recruiter specializing in competitor analysis. Classify competitors by tier.

Industry: ${industry}
${companyType ? `Company Type: ${companyType}` : ''}

RECRUITING KNOWLEDGE - COMPETITOR MATCHING:
For executive search, prioritize exact competitors:
- Tier 1: Market leaders, top companies (e.g., "Tier 1 suppliers like Motherson, Bharat Forge")
- Tier 2: Strong competitors, established players
- Tier 3: Other competitors

When query mentions "Tier 1 suppliers like X, Y, Z":
- Search specifically in those companies first
- Then similar companies in same tier
- Prioritize exact competitors in search parameters

Classify competitors in this industry by tier.`;
  }

  /**
   * Get prompt for strategy evolution
   */
  getStrategyEvolutionPrompt(
    queryUnderstanding: QueryUnderstanding,
    validationResults: Array<{
      strategyId: string;
      validation: any;
      candidateCount: number;
    }>,
    failureReasons: string[],
  ): string {
    return `You are an expert recruiter analyzing search strategy failures and evolving strategies.

ORIGINAL QUERY:
Role: ${queryUnderstanding.primaryRole}
Industry: ${queryUnderstanding.industry?.join(', ') || 'Not specified'}
Location: ${queryUnderstanding.locationHierarchy?.primary || 'Not specified'}

FAILED STRATEGIES:
${validationResults.map((vr, idx) => `
Strategy ${idx + 1} (${vr.strategyId}):
- Candidate Count: ${vr.candidateCount}
- Quality: ${vr.validation?.qualityAssessment || 'unknown'}
- Relevance Score: ${vr.validation?.relevanceScore || 0}
`).join('\n')}

FAILURE REASONS:
${failureReasons.map((r, idx) => `${idx + 1}. ${r}`).join('\n')}

RECRUITING KNOWLEDGE - STRATEGY EVOLUTION:
When strategies fail, analyze:
1. Why did they fail? (too narrow, too broad, wrong parameters)
2. What worked in similar searches?
3. What alternative approaches could work?
4. How to adjust aggressiveness (focused → balanced → broad)?

Generate alternative strategies that address the failures.`;
  }
}

