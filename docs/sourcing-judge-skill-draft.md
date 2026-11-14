# Judge — skill text (draft)

Draft text for the fitment skill fragments, to go with the Judge section of
`sourcing-loop.md`. **Not live.** It names `settledBy` and `to_confirm`, which the server
does not accept yet; ship the text with the code, not before.

Fragments live in
`packages/twenty-server/src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/contents/fragments/`.
Each block below says which fragment it belongs to and whether it replaces or adds.

The lists marked **seed** are a starting point from general recruiting and sales practice.
They are the tacit knowledge; edit them to match how you actually qualify.

---

## `fitment-rules.md` — replace the table and the first two bullets after it

A score is how well one person or company fits the user's criteria, from 0 to 100%.

The aim is the most likely good call: no red flag left standing, and enough green flags
matched. A rubric holds both.

| Flag | Is | Example |
| --- | --- | --- |
| Green, must-have | a fact the row must show | "VP Sales or above", "SaaS employer" |
| Green, nice-to-have (weight 1–4) | ranks rows that pass | "sold to banks" |
| Red | a fact that rules the row out | "left three jobs inside a year each" |

Score every flag **pass**, **fail** or **unknown**. For a red flag, pass means cleared:
the evidence could show it and does not. Fail means it is there.

Unknown means the evidence you have cannot answer. It is never a guess and never a fail.
Every unknown says what would settle it:

| `settledBy` | Use when | What happens |
| --- | --- | --- |
| `profile` | a full profile would show it (dates, history, skills, education, about) | the row goes to profile fetch |
| `company_web` | it is a fact about the employer the web holds (size, funding, sector) | one web column |
| `candidate` | only the person can say (see **Only the candidate knows**) | the row leaves with a question |

Choose the cheapest one that would really answer. If a profile is already on the row and
the flag is still unknown, a profile cannot settle it: it is `candidate`, or it is a fact
nobody holds and the flag should not be in the rubric.

A red flag the evidence cannot show is unknown, not cleared. A snapshot with no dates
cannot clear job-hopping. A snapshot with no history cannot clear "never managed a team".

You score the flags. The server works out the row:

| Row outcome | When |
| --- | --- |
| `fail` | a red flag is there, or a must-have fails. One is enough, at any evidence level |
| `qualified` | every must-have passes, every red flag is cleared, the score clears the threshold |
| `unknown` | something unsettled can still be bought (`profile`, `company_web`) |
| `to_confirm` | the must-haves pass and only `candidate` items are left |

Do not work the row outcome out yourself and do not argue with it. A strong profile does
not buy back a red flag.

- Nice-to-haves only rank rows that pass every must-have. An unknown nice-to-have scores
  like a fail; say so in the reason.
- Pay, notice, relocation and motivation go in the rubric as `candidate` flags, never as
  must-haves a profile is expected to show. Stated title, employer, skills and years stay
  must-haves. Never demote a stated skill, title or employer to avoid an unknown; relaxing
  a must-have needs a yes. "Preferably" / "ideally" = nice-to-have.

(The threshold bullet, the "guess is worse than unknown" bullet and the one-line-reason
bullet stay as they are.)

---

## `evidence-ladder.md` — add after the existing paragraph

**What each level can settle.**

| Field | Shows | Does not show |
| --- | --- | --- |
| Job title (snapshot) | current function and rough seniority | scope, team size, whether the title is inflated |
| Company name (snapshot) | current employer | which business unit, contract or permanent |
| Headline | how the person describes themselves; sometimes open to work, sometimes a specialism | anything dated; trust the position over it |
| Summary / about, when the snapshot carries it | domain, specialism, stated achievements | whether they are true; dates |
| Location | where the person lives | willingness to move or travel |
| Connection or follower count, when present | a real, used profile | fit |
| Full profile: experience with dates | tenure, gaps, moves, progression, past employers | reasons for leaving, real scope |
| Full profile: skills, education, certifications | stated qualifications | level of skill |
| Company web column | size, sector, funding, ownership | anything about the person |

A snapshot is enough for a row when every must-have and every red flag in the rubric sits
in the "Shows" column of a field that row actually has. Sales Navigator and Recruiter
snapshots carry more than a classic one; read the row, not the source's reputation.

A thin snapshot (title and company only, no dates, one role) settles title, employer and
location flags and nothing else.

---

## `fitment-rules.md` — add as a new section, **Red flags** (seed)

Add the ones the brief implies as red flags in the rubric. Each names the lowest level that
can clear it. Use the user's own disqualifiers first; these are prompts, not a checklist.

For recruiting:

| Red flag | Cleared at |
| --- | --- |
| Not currently in the function (moved out, "Ex-", advisor, board only) | snapshot if the title is plain; else profile |
| Seniority too low or too high for the role | snapshot |
| Current employer is the client, or on the user's exclusion list | snapshot |
| Short stints: several roles under a year each | profile (needs dates) |
| Long gap with nothing after it, or latest role ended over a year ago | profile |
| Just started the current role (under about six months) | profile |
| Title without the scope: senior title at a very small or unknown employer | profile, then company web |
| Freelance, consulting or "self-employed" where an operating role is wanted | snapshot if stated; else profile |
| Wrong geography with no sign of moving | snapshot for location; `candidate` for willingness |

For sales:

| Red flag | Cleared at |
| --- | --- |
| Not the buyer: wrong function, or too junior to own the decision | snapshot |
| Left the company, or the role is stale | profile |
| Company outside the ICP on size, sector or region | company web |
| Already a customer, a competitor, or on the exclusion list | snapshot |
| Interim, consultant or agency staff at the account | snapshot if stated; else profile |

One weak-profile signal is not a red flag (see **Reading profiles**).

---

## `fitment-rules.md` — add as a new section, **Only the candidate knows** (seed)

No source holds these. Mark them `settledBy: candidate` and write the question; never
fetch a profile or build a column for them.

| Fact | Question to carry |
| --- | --- |
| Pay expectation and current pay | "What range would make a move worth it?" |
| Notice period and earliest start | "What notice would you need to give?" |
| Willingness to relocate, travel or work on site | "Is <city> / <days on site> workable?" |
| Motivation and reason for looking, or not | "What would a next role need to offer?" |
| Real scope behind a title: team size, budget, P&L, quota | "How large was the team / number you owned?" |
| Hands-on versus managing | "How much of the work do you still do yourself?" |
| Work authorisation, non-compete, bond | "Is there anything that restricts a move?" |
| Reason for a gap or a short stint | "What led to the move from <employer>?" |

For sales, the equivalents are budget, timing, current vendor and who else decides.

Write each question so it can be asked as it stands: one fact, the person's own context
filled in, nothing that reads as a screening form. At most three per row; if more are
open, keep the ones tied to must-haves.

---

## `sourcing-scoring.md` — replace steps 3 and 5, add step 7

3. **Fetch profiles** only for rows whose outcome is `unknown` with a `profile` item open.
   Never for a `fail`, and never for a `to_confirm`: a profile cannot answer what is left.
5. **Score full profiles** with `stage: "profile"` and `rerunAll: true`. Anything still
   unknown now is `candidate` or does not belong in the rubric.
7. **Report both numbers.** "32 qualified, 9 to confirm", with the open questions for the
   nine. The questions go with the rows to outreach; do not ask them from here.
