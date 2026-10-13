# Writing a skill or playbook

A **playbook** is a short, single-purpose instruction: one job, one tool call
pattern, about a screen of text. To add one, create a markdown file in this
folder. Nothing else: no label constant, UUID, metadata entry or routing line in
code. It is available as soon as it is deployed.

```markdown
---
description: One line shown in the skill catalog
priority: 45            # where its routing line sits; lower comes first
routes:
  - when: The request this catches, in the user's words ("do X", "Y of these")
    hint: |-
      and follow it: the one thing to remember. Starts with punctuation to
      attach to the load call; otherwise a space is added.
---
# Title

`learn_tools([...])` once, then the numbered steps.
```

Optional front matter: `label` (default: the file name in Title Case), `icon`
(a Tabler icon name, default `IconBook`), and per route `sections: [name]` when
the skill is split into sections.

## Rules the tests enforce
- A playbook stays under 1,500 tokens. If it needs more, it is two playbooks, or
  a core skill with sections.
- Every route needs a `when`; every skill needs a `description`.
- Tools named in backticks must exist.
- Front matter is removed before the model sees the text.

## Shared text
Put a passage used by more than one skill in `fragments/<name>.md` and include
it with `{{include: name}}` on a line of its own. Includes are resolved when the
package is built and do not nest.

## Core skills
`search`, `setup`, `outreach` and the others listed in `OUTREACH_SKILL_LABELS`
are long skills with their own front matter. A new instruction should start as a
playbook; grow a core skill only for a family of related jobs.
