# Multi-member list ownership: demo runbook

One list, several members. Each person on the list is pinned to one workspace member, and every LinkedIn message, email, calendar invite and reply for that person stays on that member's account.

## Switching it on

1. Open the project's **Outreach — Candidate Sequencer** workflow → **Edit Workflow**.
2. Turn on **Pin outreach sender by warm overlap** (Sender section), apply, and **activate** the new version.
   Off by default. With it off, the sequencer is unchanged and everything sends from the first workspace member.
3. In **Outreach → Setup → Team sending**, pick how new people are assigned and who is on the list:
   - Least loaded member (default), Round robin, Warm overlap, or Manual only.
   - Members without a connected LinkedIn seat cannot be ticked.
4. Existing workspaces first need the upgrade command (adds the candidate fields and the selector logic function):

```bash
npx nx run twenty-server:command -- upgrade:2-25:add-outreach-member-pin-fields -w <workspaceId>
```

## Working one list as a team

- **People tab → Owner column** shows who owns each person.
- Select people → **Assign owner** menu: give them to one member, split evenly by workload, or split round robin.
- Reassigning someone who has not been contacted is free. Someone already contacted keeps their owner (the LinkedIn thread lives on that account) unless you force it through the API (`force: true`).
- **Today** has Everyone / Mine, and each draft shows its owner.
- Referred people inherit the referrer's owner (project setting `referralInheritsOwner`).

## Warm overlap policy

Scores each eligible seat per prospect from mutual connections (capped at 60), being already connected, shared school, and shared employers. It makes one profile fetch per seat (never the people search) and caches mutuals per account. `warmMode: suggest` (default) stores a suggestion for you to confirm; `auto` pins the winner.

## API (all under `/outreach-command/projects/:projectId`)

| Call | Purpose |
| --- | --- |
| `GET assignment/members` | members, load, seat status, policy, whether pinning is active |
| `GET assignment/owners` | candidateId → owner / suggestion |
| `POST assignment/config` | `policy`, `participantMemberIds`, `weights`, `warmMode`, `referralInheritsOwner` |
| `POST assignment/assign` | `candidateIds`, `memberId`, `force?` |
| `POST assignment/split` | `candidateIds`, `memberIds?`, `mode: balanced \| round_robin` |
| `POST assignment/confirm-suggestions` | accept warm overlap suggestions |
| `POST candidates/:candidateId/reassign` | `memberId`, `force?` |

## Mock demos

In a workspace with `IS_OUTREACH_MOCK_UNIPILE_ENABLED`, every member counts as having a seat. Register a demo member's seat with an account id starting `mock-unipile-` and profile fetches use fixtures instead of Unipile. The `/outreach-mock` endpoints (upload profiles, accept, reply, hitl, reset) work as before.
