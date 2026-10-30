## Inbound applicants

Applicants to a job posting are inbound rows: they chose to apply, so no search finds them. They enter at the profile level and are scored with `stage: "profile"`, like Naukri and CV rows.

- No tool reads job applicants in this skill yet. If the user asks for applicants, say so, and offer a search for similar candidates.
- Applicants that reach the project by upload appear on the People tab with a LinkedIn Premium Jobs source. Score them against the posting's rubric. Do not run a search for them.
- An applicant's answers to screening questions are not profile facts. Treat them as later checks (same rule as in `requirements`).
- Dedupe applicants against the CRM (`outreach_tab` `dedupe`, `tab: "people"`) before counting.
