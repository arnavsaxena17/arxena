## Sample first LinkedIn message column

When the user wants to **see what the first LinkedIn message would look like** for the people in the list ("draft the first message for these", "show me sample openers", "what would we send them after they accept"), add a **Sample LinkedIn message** column. It is the same column flow, with its own tool for the preview.

1. Preview: `preview_sample_message_column({ projectId, rowLimit: N, include: { ... } })` instead of `preview_ai_column` (N = what the user asked for). Drafts use the seeded opener prompt and agent; nothing is sent.
2. Choose `include` from what the user asked. Omit it for the defaults. Each flag is a context section:
   - `senderProfile`, `prospectEnrichment`, `profile`, `posts`, `chatHistory`: **on** by default. Set one to `false` only when the user asks to leave it out.
   - `profile` makes one live LinkedIn lookup per row; `posts` and `chatHistory` only exist for people already enrolled in the sequence (Find-list rows skip them).
   - `companyNews`: Adds a web-search lookup per company (cached for 30 days).
3. **Run** as in step 6 of the flow, with `tab: "people"` and the **same N** as `rowLimit`. Omit `rowLimit` only when the user said all rows / everyone.
4. Messages land in `otherFields.sampleLinkedinMessage` (**Sample LinkedIn message** column). Opener only — not follow-ups or replies.
