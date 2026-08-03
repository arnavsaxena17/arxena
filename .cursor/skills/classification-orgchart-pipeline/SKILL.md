---
name: classification-orgchart-pipeline
description: >-
  Manages the arxena-site bool-tree / truth-table pipeline that classifies job
  titles into std_function, std_function_root, and std_grade, regenerates vector
  groups, truth tables, truth trees, combo trees, OR queries, and feeds org
  charts. Use when editing truth_table_*.csv, vector_groups, booltrees,
  BooleanStandardize, tree_to_choose, taxonomy remaps, update_bool_trees,
  build_truth_table, pipeline_vector_truth_trees, org-chart classification, or
  arxena-site taxonomy work from the arxena monorepo workspace.
---

# Classification & Org Chart Pipeline

Canonical copies live in **arxena-site** (sibling repo). Read these first:

1. Skill:
   `/Users/arnavsaxena/MEGA/arx/arxena-site/.cursor/skills/classification-orgchart-pipeline/SKILL.md`
2. Reference:
   `/Users/arnavsaxena/MEGA/arx/arxena-site/.cursor/skills/classification-orgchart-pipeline/reference.md`
3. Operator doc:
   `/Users/arnavsaxena/MEGA/arx/arxena-site/arxenas3/docs/classification-orgchart-pipeline.md`
4. Rule (auto on matching globs in arxena-site):
   `/Users/arnavsaxena/MEGA/arx/arxena-site/.cursor/rules/classification-orgchart-pipeline.mdc`

Then follow that skill’s workflows. All CLI commands run from the **arxena-site**
repo root, not from this monorepo.

## Quick decision tree

| Goal | Action (in arxena-site) |
| --- | --- |
| Merge/split/re-root labels | Remap apply → `update_bool_trees.py` |
| Fix reversed / unreadable leaves | `build_truth_table.py` → trees |
| Refresh leaves from title corpus | `pipeline_vector_truth_trees.py` |
| Smoke a title | `boolean_orgchart_cli standardize "…"` |

## Hard rules (summary)

- Truth table = taxonomy source of truth; trees are generated.
- Classify reads trees → fresh process after regen.
- Remap ≠ full vector rebuild.
- Root anchors required; suffix must match `tree_to_choose`.
- No hand-edits to truth trees for taxonomy; no embedding taxonomy revival.
