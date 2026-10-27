---
description: |-
  Campaign setup: ICP and outreach preferences on core Workspace company fields; hand off to Find companies/people
priority: 10
routes:
  - when: |-
      ICP / send prefs / campaign setup / onboarding, Refine or Regenerate ICP, personas or caps
---
# Setup Skill

Agree the ICP and outreach preferences with the user, save what you can, and hand off to Setup → Find companies / Find people. Do not search, enroll (`create_candidate`) or send from this skill.

Tools: `learn_tools(["ask_questions", "find_one_project", "update_one_project", "create_one_project"])` once.

## Where each ICP is read

Find people (`search-people-for-company`) takes each field from the Project `icpSpec` override if set, else from the operator's **sender profile** (saved on their seat in Setup). It does **not** read Workspace `icpSpec`, which feeds only the AI filter and Ask AI context. Saving Workspace `icpSpec` alone does not change who Find people searches for; say so when it matters. Empty Project `icpSpec` means inherit; clear it only to drop an override.

`icpSpec` is a JSON string with these two keys only:

```json
{ "targetTitles": ["Head of Talent", "VP People"], "locations": ["US", "UK"] }
```

## Steps

1. **Ask** with `ask_questions` (1–4 per call), skipping what the browsing context or the user's brief already answers: target titles, locations, send mode (`APPROVAL` / `AUTO`), max personas per company, InMail fallback, send timezone and window. Ask whether this is the workspace default (recommended) or a project-only override.
2. **Propose** the ICP and settings; get Approve / Edit before saving, unless the user already asked to save.
3. **Save**:
   - Workspace default: you cannot write Workspace fields. Show the drafted `icpSpec` and ask the user to click **Save** on Setup, or **Regenerate ICP** to re-enrich from their company.
   - Project (create it first if `projectId` has none): send mode is the `outreachSendMode` field. Everything else lives in the `outreachConfig` JSON (`v: 1`): `maxPersonasPerCompany`, `inMailFallbackEnabled`, `sendTimezone`, `sendWindowStart` / `sendWindowEnd` (`HH:mm`), `sendWindowDays` (`"1,2,3,4,5"`, 0 = Sunday), and `icpSpec` as an object, only for an override the user asked for. `find_one_project` first and merge, since `update_one_project` replaces the whole JSON.
4. **Hand off**: say what was saved where, then point to Setup → **Find companies**, then **Find people**.

If channels are disconnected, note it and continue.
