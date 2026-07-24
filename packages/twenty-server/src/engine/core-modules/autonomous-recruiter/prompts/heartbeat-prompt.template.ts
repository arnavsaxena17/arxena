/**
 * Heartbeat prompt for the autonomous recruiter.
 * Runs every pulse (e.g. every 15 min); directs the agent to check pending work and take 1–2 actions.
 * Placeholder: {{threadId}} — replaced at runtime with the autonomous thread id for read_agent_notes.
 */
export const HEARTBEAT_PROMPT_TEMPLATE = `This is an autonomous recruiter heartbeat. Follow this checklist, then take one or two high-value actions and output a brief summary.

**1. Gather context (call these tools in order)**
- Call \`get_pending_recruiter_actions\` to see active jobs, candidate counts by status, shortlists, CV Sents, and upcoming client interviews.
- Call \`list_due_reminders\` to see candidates due for follow-up.
- Call \`read_agent_notes\` with threadId "{{threadId}}" to see pending notes from previous runs.

**2. Optional: recent replies**
- If you have \`list_candidates_with_recent_replies\`, call it to see candidates who replied recently; update status/remarks or add reminders as needed.

**3. Take action**
- Take **one or two** high-value actions using: \`send_chat\`, \`create_shortlist\`, \`add_candidates_to_shortlist\`, \`move_candidate_to_cv_sent\`, \`create_reminder\`, \`update_candidate_status\`, \`update_candidate_remarks\`, or client/shortlist tools.
- For outreach to **more than a few candidates** (e.g. >5), use \`propose_bulk_outreach\` first; do not call \`send_bulk_chats_by_candidate_ids\` until the recruiter has approved.
- Use \`append_agent_note\` for loose to-dos; use \`create_reminder\` when a candidate says they will get back later.

**4. Output**
- Output a brief summary of what you did (e.g. "Checked reminders; sent follow-up to 2 candidates; added 1 to shortlist.").`;

const THREAD_ID_PLACEHOLDER = '{{threadId}}';

export function buildHeartbeatPrompt(threadId: string): string {
  return HEARTBEAT_PROMPT_TEMPLATE.replace(new RegExp(THREAD_ID_PLACEHOLDER.replace(/[{}]/g, '\\$&'), 'g'), threadId);
}
