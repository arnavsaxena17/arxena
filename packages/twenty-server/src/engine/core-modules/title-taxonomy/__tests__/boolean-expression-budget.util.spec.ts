import {
  capBooleanExpression,
  countBooleanTerms,
  DEFAULT_BOOLEAN_TERM_BUDGET,
  GOOGLE_TITLE_TERM_BUDGET,
  isWithinBooleanBudget,
  parseBooleanExpression,
  printBooleanExpression,
} from 'src/engine/core-modules/title-taxonomy/boolean-expression-budget.util';

const SUPPLY_CHAIN_ROOT =
  '(("Supply Chain" OR procurement OR logistics OR SCM) AND  (head OR director OR VP OR president OR chief OR SVP OR EVP OR AVP OR GM OR "general manager")) OR CSCO';

const OPERATIONS_ROOT =
  '((operations OR ops OR COO) AND  (head OR director OR VP OR president OR chief OR SVP OR EVP OR AVP OR GM OR "general manager")) OR (COO OR "Chief Operating Officer")';

// Rank as the taxonomy's frequency-ordered term list gives it: lower is more
// common. Unknown terms fall after the ranked ones.
const rankFrom = (terms: string[]) => (term: string) => {
  const index = terms.indexOf(term.replace(/"/g, '').trim().toLowerCase());

  return index === -1 ? Number.POSITIVE_INFINITY : index;
};

const wordsOf = (expression: string): number =>
  expression.split(/\s+/).filter((part) => part !== '').length;

describe('parseBooleanExpression', () => {
  it('should round-trip a function x grade expression', () => {
    const node = parseBooleanExpression(SUPPLY_CHAIN_ROOT);

    expect(node).not.toBeNull();
    expect(printBooleanExpression(node as never)).toBe(
      '("Supply Chain" OR procurement OR logistics OR SCM) AND (head OR director OR VP OR president OR chief OR SVP OR EVP OR AVP OR GM OR "general manager") OR CSCO',
    );
  });

  it('should keep implicit AND between adjacent terms', () => {
    const node = parseBooleanExpression('engineer "plant head"');

    expect(printBooleanExpression(node as never)).toBe(
      'engineer AND "plant head"',
    );
  });

  it('should return null for a malformed expression', () => {
    expect(parseBooleanExpression('(procurement OR')).toBeNull();
    expect(parseBooleanExpression('')).toBeNull();
  });
});

describe('capBooleanExpression', () => {
  it('should reorder an OR group by frequency without changing its terms', () => {
    const capped = capBooleanExpression({
      expression:
        '("Supply Chain" OR procurement OR logistics OR SCM) AND (head OR director)',
      rankOf: rankFrom(['logistics', 'procurement', 'supply chain', 'scm']),
      budget: DEFAULT_BOOLEAN_TERM_BUDGET,
    });

    expect(capped.droppedTerms).toEqual([]);
    expect(capped.expression).toContain(
      'logistics OR procurement OR "Supply Chain" OR SCM',
    );
  });

  it('should drop the least frequent terms when the term budget is exceeded', () => {
    const capped = capBooleanExpression({
      expression:
        '(procurement OR purchasing OR sourcing OR buyer OR purchaser) AND (head OR director)',
      rankOf: rankFrom([
        'procurement',
        'purchasing',
        'buyer',
        'sourcing',
        'purchaser',
      ]),
      budget: { maxTerms: 5, maxWords: 100, maxTermsPerGroup: 3 },
    });

    // procurement, purchasing, buyer are the three most common; the two rarest
    // are dropped, and the grade group is untouched
    expect(capped.droppedTerms).toEqual(['purchaser', 'sourcing']);
    expect(capped.expression).toBe(
      '(procurement OR purchasing OR buyer) AND (head OR director)',
    );
  });

  it('should bring a root query under the Google word ceiling instead of dropping it', () => {
    const capped = capBooleanExpression({
      expression: OPERATIONS_ROOT,
      rankOf: rankFrom(['operations', 'ops']),
      budget: GOOGLE_TITLE_TERM_BUDGET,
    });

    expect(wordsOf(capped.expression)).toBeLessThanOrEqual(28);
    expect(
      isWithinBooleanBudget(capped.expression, GOOGLE_TITLE_TERM_BUDGET),
    ).toBe(true);
    // Still an operations query with a seniority clause, and still carries the
    // COO branch
    expect(capped.expression).toContain('operations');
    expect(capped.expression).toContain('head');
    expect(capped.expression).toContain('COO OR "Chief Operating Officer"');
    expect(capped.droppedTerms.length).toBeGreaterThan(0);
  });

  it('should keep the supply chain root query usable for Google', () => {
    const capped = capBooleanExpression({
      expression: SUPPLY_CHAIN_ROOT,
      rankOf: rankFrom(['logistics', 'procurement', 'supply chain', 'scm']),
      budget: GOOGLE_TITLE_TERM_BUDGET,
    });

    expect(wordsOf(capped.expression)).toBeLessThanOrEqual(28);
    expect(capped.expression).toContain('logistics');
    expect(capped.expression).toContain('procurement');
    expect(capped.expression).toContain('CSCO');
  });

  it('should never empty an OR group', () => {
    const capped = capBooleanExpression({
      expression: '(a OR b) AND (c OR d)',
      budget: { maxTerms: 1, maxWords: 1, maxTermsPerGroup: 1 },
    });

    expect(
      countBooleanTerms(parseBooleanExpression(capped.expression) as never),
    ).toBe(2);
    expect(capped.expression).toContain('a');
    expect(capped.expression).toContain('c');
  });

  it('should leave a malformed expression exactly as written', () => {
    const capped = capBooleanExpression({
      expression: '(procurement OR',
      budget: { maxTerms: 1, maxWords: 1, maxTermsPerGroup: 1 },
    });

    expect(capped.expression).toBe('(procurement OR');
    expect(capped.droppedTerms).toEqual([]);
  });

  it('should leave an expression already inside the budget alone', () => {
    const capped = capBooleanExpression({
      expression: '(procurement OR purchasing) AND head',
      budget: DEFAULT_BOOLEAN_TERM_BUDGET,
    });

    expect(capped.expression).toBe('(procurement OR purchasing) AND head');
    expect(capped.droppedTerms).toEqual([]);
  });
});
