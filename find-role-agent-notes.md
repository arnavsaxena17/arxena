# find_role_at_companies: Ask AI run notes (project b07ddc92, 274 companies, arxena-5)

## Run log
- Chat 1: "for each company... find MD/CEO/MD/promoter/owner. Run 10 first, tell me cost."
  - Agent loaded skill, got working set, ran 1 call for 10 companies. ~6 min wall time.
  - Result: 9 matched, 1 related_role_only, 24 people saved, spend $0.278 (~$0.028/company); extrapolated $7-8 for 274.
- Chat 2: "go, remaining 264 in parallel."
  - Agent paged the working set (50/page, 6 pages + extract_json_paths each time = 19 steps), then issued 11 parallel calls (10x25 + 1x14).
  - 10 of 11 finished in ~8 min. The last batch was still running after 13+ min (straggler).
  - People tab showed 76 rows while one batch was outstanding (low for ~250 companies; either many no_match or parallel upserts overwrote each other).

## Where the agent / our prompts fall short
1. Skill says "no estimate, no budget question" but the user asked for a cost. The agent had to improvise by extrapolating from spend of a sample. Fix: tool should return spend per company (it does) and the skill should say "if user asks for a cost, run a sample and extrapolate".
2. Skill and tool schema cap a call at 25 companies; tool description says "do not use it to build a large people list". For 274 companies the agent must batch itself, and the guidance never says how (parallel calls? sequential?). Fix: allow the tool to take `allCompanies: true` + projectId and batch/persist internally, or document "split into 25s, issue all calls in one step".
3. Getting the company names cost 19 steps: get_outreach_working_set returns 50/page and spills output, so the agent runs extract_json_paths per page, then re-types ~264 names into tool calls (token-heavy, typo risk). Fix: let find_role_at_companies read the project's Companies tab itself (projectId + onlyViewMatches + offset/limit), so the agent never copies names.
4. Skill step 4 (retry no_match once with alternateNames) needs legal-name knowledge the agent mostly lacks, and costs another call; consider doing the retry inside the tool.
5. Status semantics: Restaurant Brands Asia "Group CEO" was marked related_role_only, which is surprising for a CEO. FFC resolved to a pk.linkedin.com profile (likely a Pakistani company with the same acronym). Needs a country check against the company's HQ.
6. Persistence: people were written only after the whole call finished, so one slow company delayed saving everyone in that call, and a cut-off call lost all of it. Changed (see below).
7. Latency: a 10-company call took ~6 min; one 25-company call exceeded 13 min. No per-company timeout, no progress events to the chat, so the agent and user see only "Running Find Role At Companies".

## Code change made this session
- packages/twenty-server/.../find-role-at-companies-tool/find-role-at-companies-tool.ts
  - People are now persisted per company as soon as that company finishes (inside the concurrency worker), not after all companies.
  - Writes go through a per-project in-process queue, because upsert_outreach_target_people is a read-modify-write on the cached list and concurrent writers would overwrite each other.
  - 124 tests in the tool folder pass. Not yet running: the dev server uses built dist and needs a rebuild/restart.

## Still to do
- Rebuild/restart server, re-run for companies with no people so the incremental save is exercised, then confirm the final People count.
- Add a per-company timeout so a straggler cannot hold a batch.
- Simplify the skill (items 1-4).

## Update: re-run after fixes (this session)
- Bright Data docs (Context7): no documented per-zone SERP concurrency cap; stated limit is 1,000 req/min for unfunded accounts (100/min limited trial). Async SERP = POST /serp/req?zone=… -> response_id, then GET /serp/get_result?response_id=… (202 until ready). Implemented behind BRIGHT_DATA_SERP_ASYNC=true (unit-tested with mocked fetch, NOT tested live). Currently set to false.
- Code added: process-wide limit of 25 company lookups across parallel calls; per-company save; new status `source_error` + `withoutResults` list in the result; JSONL outcome trail at find-role-outcomes.jsonl (FIND_ROLE_OUTCOME_LOG_PATH); fetch errors now carry the undici cause code; skill text updated (batching, source_error, cost sample).
- The earlier "no_match" wave was NOT real misses: the worker cannot connect to api.brightdata.com (UND_ERR_CONNECT_TIMEOUT / deadline passed), even at SERP concurrency 20. My own sandbox curl to the same host also never connects. Needs a connectivity check from the dev machine (VPN, IPv6, firewall, proxy) before another full run.
- Gotcha: the queue-worker (where Ask AI tools run) is a separate process from dist/main and did not always restart on edits; restart it explicitly.
- Outcome logs: find-role-outcomes.run1-failed / run2-connect-timeouts / run3-killed .jsonl (all source_error, none are real misses).

## Update 2: duplicates, connectivity, settings
- Duplicates: the People list is a Redis cache; its dedupe key was the raw LinkedIn URL, so www.linkedin.com/in/x and in.linkedin.com/in/x (country subdomains) were two people with the same row id (the table then rendered the same row repeatedly). Also the same MD found through two different profiles was kept twice. Fixed in upsert-outreach-target-people-tool.ts (`mergePeople`): profiles compared by /in/<slug>; same name at the same company is one person; ids forced unique; merge runs over the existing list too. Saved list cleaned 239 -> 229 (backup in scratchpad, TTL kept). 5 unit tests added.
- Bright Data connectivity is load-sensitive: raw TCP to both api.brightdata.com IPs (3.232.71.244, 3.232.8.188) times out from this machine in bursts, even at 12 companies / 24 sockets; works when quiet. Open question for Bright Data / network (per-IP connection throttling?). The user's own curl worked. Untried: the native proxy endpoint (brd.superproxy.io) with the serp_api zone credentials.
- Sync + parsed_light is the fast path; async (zone toggle) took > several minutes per job and is billed per submit; kept off (BRIGHT_DATA_SERP_ASYNC=false).
- Current .env tuning: FIND_ROLE_COMPANY_CONCURRENCY=12, FIND_ROLE_SERP_CONCURRENCY=24, BRIGHT_DATA_MAX_CONNECTIONS=24, FIND_ROLE_SERP_HEDGE_DELAY_MS=0, FIND_ROLE_SERP_ATTEMPT_TIMEOUT_MS=60000, FIND_ROLE_COMPANY_DEADLINE_MS=150000.
- Agent behaviour: to choose which companies to re-run it spends many minutes hand-reconciling names against the People tab. A tool-side "companies on this project without a person" mode would remove that.
- Temporary diagnostics to remove once stable: probeConnectivity + logAsyncTurnaround in bright-data-serp.service.ts, and the find-role-outcomes.jsonl(.probe) trail (keep the outcomes trail if the no-result report is wanted).
