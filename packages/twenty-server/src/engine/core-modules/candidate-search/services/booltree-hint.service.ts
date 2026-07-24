import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { ParsedRequirement } from '../schemas/parsed-requirement.schema';

type TruthTreeNode = {
  key?: number;
  name?: string;
  final_name?: string;
  and?: string;
  or?: string;
  not?: string;
  auto_entry?: string;
  auto_mid?: string;
  auto_leadership?: string;
  sum_count?: number;
};

type TruthTree = {
  class?: string;
  nodeDataArray?: TruthTreeNode[];
};

type GradeBand = 'entry' | 'mid' | 'senior' | 'leadership' | 'cxo';

type ParsedRequirementWithHints = ParsedRequirement & {
  role_function?: string | null;
  must_have_skills?: string[] | null;
  seniority_level?: string | null;
};

const BOOLTREE_DIR_NAME = 'tools';
const BOOLTREE_SUBDIR = 'booltrees';
const TRUTH_TREE_FILENAME = 'final_names_truth_tree_25042022.json';
const GRADES_TREE_FILENAME = 'truth_tree_grades_13042023.json';

@Injectable()
export class BooltreeHintService {
  private readonly logger = new Logger(BooltreeHintService.name);
  private cachedTruthTree: TruthTree | null = null;
  private cachedGradesTree: TruthTree | null = null;

  private getBooltreeDir(): string {
    const cwd = process.cwd();
    const fromCwd = path.join(cwd, BOOLTREE_DIR_NAME, BOOLTREE_SUBDIR);
    if (fs.existsSync(fromCwd)) {
      return fromCwd;
    }
    // Monorepo root: when cwd is packages/twenty-server, booltrees live at repo-root/tools/booltrees
    const fromMonorepoRoot = path.join(
      cwd,
      '..',
      '..',
      BOOLTREE_DIR_NAME,
      BOOLTREE_SUBDIR,
    );
    if (fs.existsSync(fromMonorepoRoot)) {
      return fromMonorepoRoot;
    }
    
    const fromPackages = path.join(cwd, '..', BOOLTREE_DIR_NAME, BOOLTREE_SUBDIR);
    if (fs.existsSync(fromPackages)) {
      return fromPackages;
    }
    const fromSrc = path.join(__dirname, '../../../../../../../', BOOLTREE_DIR_NAME, BOOLTREE_SUBDIR);
    if (fs.existsSync(fromSrc)) {
      return fromSrc;
    }
    this.logger.warn(
      `Booltree directory not found. Tried: ${fromCwd}, ${fromMonorepoRoot}, ${fromPackages}, ${fromSrc}`,
    );
    return fromCwd;
  }

  private loadTree(filename: string): TruthTree {
    const dir = this.getBooltreeDir();
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`Booltree file not found: ${filePath}`);
      return { nodeDataArray: [] };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as TruthTree;
  }

  private getTruthTree(): TruthTree {
    if (!this.cachedTruthTree) {
      this.cachedTruthTree = this.loadTree(TRUTH_TREE_FILENAME);
    }
    return this.cachedTruthTree;
  }

  private getGradesTree(): TruthTree {
    if (!this.cachedGradesTree) {
      this.cachedGradesTree = this.loadTree(GRADES_TREE_FILENAME);
    }
    return this.cachedGradesTree;
  }

  private tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean),
    );
  }

  private splitTerms(value?: string): string[] {
    if (!value) return [];
    return value
      .split(/[,|]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  private scoreTruthNode(tokens: Set<string>, node: TruthTreeNode): number {
    const andTerms = this.splitTerms(node.and);
    if (!andTerms.length) return 0;

    for (const t of andTerms) {
      if (!tokens.has(t)) return 0;
    }

    const notTerms = this.splitTerms(node.not);
    for (const t of notTerms) {
      if (tokens.has(t)) return 0;
    }

    const orTerms = this.splitTerms(node.or);
    let bonus = 0;
    if (orTerms.length) {
      bonus = orTerms.some((t) => tokens.has(t)) ? 1 : 0;
    }

    return andTerms.length + bonus;
  }

  private findTopTruthNodes(
    tokens: Set<string>,
    tree: TruthTree,
    limit: number,
  ): TruthTreeNode[] {
    const nodes = tree.nodeDataArray ?? [];
    const scored = nodes
      .map((node) => ({ node, score: this.scoreTruthNode(tokens, node) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((entry) => entry.node);
  }

  private mapSeniorityToGradeBand(seniorityLevel: string | null | undefined): GradeBand {
    if (!seniorityLevel) return 'mid';
    const s = seniorityLevel.toLowerCase();
    if (/(junior|intern|trainee|entry|associate|analyst|executive|officer)\b/.test(s)) return 'entry';
    if (/(mid|manager|lead|senior\s+associate|agm|dgm)\b/.test(s)) return 'mid';
    if (/(senior|head|director|general\s+manager|gm)\b/.test(s)) return 'senior';
    if (/(vp|svp|avp|president|chief|cxo)\b/.test(s)) return 'leadership';
    if (/\b(ceo|cfo|cto|coo|cpo|chro|cmo|cdo)\b/.test(s)) return 'cxo';
    return 'mid';
  }

  private gradeTokensForBand(band: GradeBand): string[] {
    switch (band) {
      case 'entry':
        return ['intern', 'trainee', 'associate', 'assistant', 'executive', 'officer', 'analyst'];
      case 'mid':
        return ['manager', 'lead', 'senior associate', 'assistant manager'];
      case 'senior':
        return ['senior manager', 'head', 'director', 'general manager', 'gm'];
      case 'leadership':
        return ['vp', 'svp', 'avp', 'president', 'chief', 'director', 'head'];
      case 'cxo':
        return ['ceo', 'cfo', 'cto', 'coo', 'cpo', 'ciso', 'chro', 'cmo', 'cdo'];
      default:
        return [];
    }
  }

  /**
   * Get function and grade hints from booltrees for the given cleaned query and parsed requirement.
   * Uses the same logic as agent-linkedin-unresolved: tokenize query + context, match against
   * final_names_truth_tree (role hints) and truth_tree_grades (seniority hints).
   */
  getHintsForQuery(
    rawQuery: string,
    cleanedQuery: string,
    parsedRequirement: ParsedRequirementWithHints,
  ): string {
    const subdomains: string[] = [
      parsedRequirement?.role_function,
      parsedRequirement?.primary_role_name,
      ...(parsedRequirement?.industry ?? []),
      ...(parsedRequirement?.must_have_skills ?? []),
    ].filter((s): s is string => !!s && typeof s === 'string');

    const gradeBand = this.mapSeniorityToGradeBand(parsedRequirement?.seniority_level);
    const queryPart = (cleanedQuery || '').trim();
    const contextText = queryPart ? [queryPart, ...subdomains].join(' ') : subdomains.join(' ');
    const tokens = this.tokenize(contextText);
    
    const truthTree = this.getTruthTree();
    const gradesTree = this.getGradesTree();
    const roleNodes = this.findTopTruthNodes(tokens, truthTree, 10);

    const gradeTokenSet = new Set(this.gradeTokensForBand(gradeBand));
    const gradeNodes = this.findTopTruthNodes(gradeTokenSet, gradesTree, 8);

    const roleLines = roleNodes.map((node) => {
      const name = node.final_name || node.name || 'unknown';
      const entry = node.auto_entry ? `entry: ${node.auto_entry}` : '';
      const mid = node.auto_mid ? `mid: ${node.auto_mid}` : '';
      const lead = node.auto_leadership ? `leadership: ${node.auto_leadership}` : '';
      const parts = [entry, mid, lead].filter(Boolean).join(' | ');
      return `- ${name}${parts ? ` -> ${parts}` : ''}`;
    });

    const gradeLines = gradeNodes.map((node) => {
      const name = node.final_name || node.name || 'unknown';
      return `- ${name} (and: ${node.and || ''}${node.or ? ` | or: ${node.or}` : ''})`;
    });

    const hintText = [
      `Role/function hints for ${subdomains.length ? subdomains.join(', ') : 'general'}:`,
      ...(roleLines.length ? roleLines : ['- (none)']),
      '',
      `Seniority/grade hints (${gradeBand}):`,
      ...(gradeLines.length ? gradeLines : ['- (none)']),
      '',
      'Use these hints as optional guidance to improve recall. If a hint conflicts with the requirement, ignore the hint.',
    ].join('\n');

    this.logger.debug(`Booltree hints generated for grade ${gradeBand}, ${roleNodes.length} role nodes, ${gradeNodes.length} grade nodes`);
    return hintText;
  }
}
