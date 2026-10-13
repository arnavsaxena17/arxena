// The routing facts of a skill, written as front matter at the top of its
// markdown file. The routing lines in the system prompt and the skill's catalog
// description are generated from this, not written in code.
export type SkillRoute = {
  // The request this route catches, in the user's words
  when: string;
  // Sections of the skill to load for this request (long skills only)
  sections?: string[];
  // Text after the load_skills call. Starts with punctuation to attach to the
  // call; otherwise a space is added. {suffix} marks where a surface's own
  // addition goes; without it the addition is appended.
  hint?: string;
};

export type SkillFrontMatter = {
  // Shown in the skill list. Playbooks may omit it: the file name is title-cased.
  label?: string;
  // Tabler icon name. Playbooks may omit it.
  icon?: string;
  // One line shown in the skill catalog
  description: string;
  // Order of the skill's routing lines, lowest first
  priority: number;
  routes: SkillRoute[];
};
