// A curated function x grade expression is a boolean string written for a
// job-title field. Three consumers read it, each with its own ceiling: Bright
// Data and Harvest parse it into a filter, Google gets it as a query clause and
// silently drops a clause over 30 words. A root query that unions every
// function under the root grows with the taxonomy, so an unbounded expression
// can overflow one consumer and disappear from it.
//
// This module caps an expression by term count and by words. Terms are ordered
// by the taxonomy's frequency-ranked list before a cap is applied, so the terms
// that survive are the ones the dataset uses most, not whichever the curator
// happened to type first. Reordering is safe: OR and AND are commutative.

export type BooleanExpressionNode =
  | { kind: 'term'; value: string }
  | { kind: 'or'; children: BooleanExpressionNode[] }
  | { kind: 'and'; children: BooleanExpressionNode[] }
  | { kind: 'not'; child: BooleanExpressionNode };

export type BooleanTermBudget = {
  // Total term nodes the expression may keep
  maxTerms: number;
  // Words in the printed expression; Google drops a clause above 30
  maxWords: number;
  // Terms one OR group may keep
  maxTermsPerGroup: number;
};

// What a provider boolean may carry. Generous enough for a root query, small
// enough that OR-ing a few roles cannot build a runaway filter.
export const DEFAULT_BOOLEAN_TERM_BUDGET: BooleanTermBudget = {
  maxTerms: 20,
  maxWords: 45,
  maxTermsPerGroup: 12,
};

// Google writes the clause into a query string and caps it at about 32 words;
// stay under that with room for the site: and company terms around it.
export const GOOGLE_TITLE_TERM_BUDGET: BooleanTermBudget = {
  maxTerms: 16,
  maxWords: 28,
  maxTermsPerGroup: 10,
};

const TOKEN_PATTERN = /\(|\)|"[^"]*"|[^\s()]+/g;

class BooleanExpressionParser {
  private position = 0;

  constructor(private readonly tokens: string[]) {}

  parse(): BooleanExpressionNode {
    const node = this.parseOr();

    if (this.position < this.tokens.length) {
      throw new Error(`Unexpected token "${this.tokens[this.position]}"`);
    }

    return node;
  }

  private peek(): string | undefined {
    return this.tokens[this.position];
  }

  private take(): string | undefined {
    return this.tokens[this.position++];
  }

  private isOperator(token: string | undefined, operator: string): boolean {
    return token !== undefined && token.toUpperCase() === operator;
  }

  private parseOr(): BooleanExpressionNode {
    const children = [this.parseAnd()];

    while (this.isOperator(this.peek(), 'OR')) {
      this.take();
      children.push(this.parseAnd());
    }

    return children.length === 1 ? children[0] : { kind: 'or', children };
  }

  private parseAnd(): BooleanExpressionNode {
    const children = [this.parseUnary()];

    while (
      this.peek() !== undefined &&
      this.peek() !== ')' &&
      !this.isOperator(this.peek(), 'OR')
    ) {
      if (this.isOperator(this.peek(), 'AND')) {
        this.take();
      }

      children.push(this.parseUnary());
    }

    return children.length === 1 ? children[0] : { kind: 'and', children };
  }

  private parseUnary(): BooleanExpressionNode {
    const token = this.take();

    if (token === undefined) {
      throw new Error('Unexpected end of boolean expression');
    }

    if (this.isOperator(token, 'NOT')) {
      return { kind: 'not', child: this.parseUnary() };
    }

    if (token === '(') {
      const inner = this.parseOr();

      if (this.take() !== ')') {
        throw new Error('Missing closing parenthesis');
      }

      return inner;
    }

    if (token === ')') {
      throw new Error('Unexpected closing parenthesis');
    }

    return { kind: 'term', value: token };
  }
}

export const parseBooleanExpression = (
  expression: string,
): BooleanExpressionNode | null => {
  const tokens = expression.match(TOKEN_PATTERN);

  if (tokens === null || tokens.length === 0) {
    return null;
  }

  try {
    return new BooleanExpressionParser(tokens).parse();
  } catch {
    // A malformed curated row is left exactly as written; the provider's own
    // parser is the authority on rejecting it
    return null;
  }
};

const precedenceOf = (node: BooleanExpressionNode): number => {
  if (node.kind === 'term') {
    return 3;
  }

  if (node.kind === 'not') {
    return 3;
  }

  return node.kind === 'or' ? 1 : 2;
};

export const printBooleanExpression = (
  node: BooleanExpressionNode,
  parentPrecedence = 0,
): string => {
  if (node.kind === 'term') {
    return node.value;
  }

  if (node.kind === 'not') {
    const printed = printBooleanExpression(node.child, 3);

    return `NOT ${printed}`;
  }

  const precedence = precedenceOf(node);

  if (node.children.length === 1) {
    return printBooleanExpression(node.children[0], parentPrecedence);
  }

  const separator = node.kind === 'or' ? ' OR ' : ' AND ';
  const body = node.children
    .map((child) => printBooleanExpression(child, precedence))
    .join(separator);

  return precedence < parentPrecedence ? `(${body})` : body;
};

export const countBooleanTerms = (node: BooleanExpressionNode): number => {
  if (node.kind === 'term') {
    return 1;
  }

  if (node.kind === 'not') {
    return countBooleanTerms(node.child);
  }

  return node.children.reduce(
    (total, child) => total + countBooleanTerms(child),
    0,
  );
};

export const collectBooleanTerms = (node: BooleanExpressionNode): string[] => {
  if (node.kind === 'term') {
    return [node.value];
  }

  if (node.kind === 'not') {
    return collectBooleanTerms(node.child);
  }

  return node.children.flatMap(collectBooleanTerms);
};

type TermRank = (term: string) => number;

// Rank is the term's position in the taxonomy's frequency-ordered list, so a
// lower number is kept. A term the list does not name keeps its curated order
// after the ranked ones.
const rankKnownLast =
  (rankOf: TermRank): TermRank =>
  (term) => {
    const rank = rankOf(term);

    return Number.isFinite(rank) ? rank : Number.MAX_SAFE_INTEGER;
  };

// OR groups whose children are all plain terms: the only place a term can be
// dropped without breaking an AND clause apart
const termOnlyOrGroups = (
  node: BooleanExpressionNode,
  groups: Array<Extract<BooleanExpressionNode, { kind: 'or' }>> = [],
): Array<Extract<BooleanExpressionNode, { kind: 'or' }>> => {
  if (
    node.kind === 'or' &&
    node.children.every((child) => child.kind === 'term')
  ) {
    groups.push(node);
  }

  if (node.kind === 'or' || node.kind === 'and') {
    for (const child of node.children) {
      termOnlyOrGroups(child, groups);
    }
  } else if (node.kind === 'not') {
    termOnlyOrGroups(node.child, groups);
  }

  return groups;
};

const sortGroupByRank = (
  group: Extract<BooleanExpressionNode, { kind: 'or' }>,
  rankOf: TermRank,
): void => {
  group.children = group.children
    .map((child, index) => ({ child, index }))
    .sort((first, second) => {
      const firstRank =
        first.child.kind === 'term' ? rankOf(first.child.value) : 0;
      const secondRank =
        second.child.kind === 'term' ? rankOf(second.child.value) : 0;

      return firstRank - secondRank || first.index - second.index;
    })
    .map((entry) => entry.child);
};

const wordCount = (expression: string): number =>
  expression.split(/\s+/).filter((part) => part !== '').length;

export type BooleanExpressionCap = {
  expression: string;
  droppedTerms: string[];
};

// Caps an expression in place of dropping it: Google's 30-word gate rejected a
// whole root clause, which is how a role silently lost its search. Trimming the
// least frequent terms keeps the clause usable.
export const capBooleanExpression = ({
  expression,
  rankOf = () => Number.POSITIVE_INFINITY,
  budget = DEFAULT_BOOLEAN_TERM_BUDGET,
}: {
  expression: string;
  rankOf?: TermRank;
  budget?: BooleanTermBudget;
}): BooleanExpressionCap => {
  const trimmedInput = expression.trim();

  if (trimmedInput === '') {
    return { expression: '', droppedTerms: [] };
  }

  const root = parseBooleanExpression(trimmedInput);

  if (root === null) {
    return { expression: trimmedInput, droppedTerms: [] };
  }

  const rank = rankKnownLast(rankOf);
  const groups = termOnlyOrGroups(root);
  const droppedTerms: string[] = [];

  for (const group of groups) {
    sortGroupByRank(group, rank);

    while (group.children.length > Math.max(budget.maxTermsPerGroup, 1)) {
      const dropped = group.children.pop();

      if (dropped?.kind === 'term') {
        droppedTerms.push(dropped.value);
      }
    }
  }

  const print = () => printBooleanExpression(root);

  while (
    countBooleanTerms(root) > budget.maxTerms ||
    wordCount(print()) > budget.maxWords
  ) {
    const candidates = termOnlyOrGroups(root).filter(
      (group) => group.children.length > 1,
    );

    if (candidates.length === 0) {
      break;
    }

    candidates.sort(
      (first, second) => second.children.length - first.children.length,
    );

    const dropped = candidates[0].children.pop();

    if (dropped?.kind !== 'term') {
      break;
    }

    droppedTerms.push(dropped.value);
  }

  const capped = print();

  return {
    // A cap that cannot get inside the budget must not return a worse string
    // than the caller gave it
    expression: capped === '' ? trimmedInput : capped,
    droppedTerms,
  };
};

export const isWithinBooleanBudget = (
  expression: string,
  budget: BooleanTermBudget = DEFAULT_BOOLEAN_TERM_BUDGET,
): boolean => {
  const root = parseBooleanExpression(expression);

  if (root === null) {
    return false;
  }

  return (
    countBooleanTerms(root) <= budget.maxTerms &&
    wordCount(printBooleanExpression(root)) <= budget.maxWords
  );
};
