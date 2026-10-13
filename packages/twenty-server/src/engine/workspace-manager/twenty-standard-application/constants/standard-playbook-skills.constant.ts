import { v5 } from 'uuid';

import { listPlaybookNames } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

// Fixed namespace: a playbook keeps the same universal identifier in every
// workspace and every deploy, derived from its file name.
const STANDARD_PLAYBOOK_SKILL_NAMESPACE = '3f6d1c52-8a47-4e9b-9d0a-6b2c7e5f1a84';

// A playbook is a markdown file in twenty-shared/src/outreach/skills with front
// matter. It needs no entry in STANDARD_SKILL.
export const STANDARD_PLAYBOOK_SKILL_NAMES: string[] =
  listPlaybookNames();

export const getPlaybookUniversalIdentifier = (name: string): string =>
  v5(`standard-playbook-skill:${name}`, STANDARD_PLAYBOOK_SKILL_NAMESPACE);
