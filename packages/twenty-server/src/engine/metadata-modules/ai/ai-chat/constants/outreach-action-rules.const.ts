// The campaign page's rules for acting on the rows: Save to CRM, start
// outreach and enrollment. Sent only when the user asks for one of these
// (shouldIncludeOutreachActionRules), since a find never uses them.
export const OUTREACH_ACTION_RULES: string[] = [
  'When the user confirms they want the Companies / People tab rows saved to the CRM (not enrolled): learn_tools({toolNames:["save_outreach_targets_to_crm"]}) then save_outreach_targets_to_crm({ projectId, target: "companies" | "people" | "both", companyIds?, personIds? }). Omit ids to save the whole tab; pass selectedPersonIds / selected company ids for selected rows. It creates Company / Person records only, never a Candidate.',
  'When the user says "start outreach" (selected people, a named person, or the whole table) and the prospects are already enrolled:',
  '1. learn_tools({toolNames:["start_outreach"]}) then execute_tool with a JSON-object arguments field — do NOT load workflow-building or edit/activate workflows for this',
  '2. Selected rows: start_outreach({ projectId, candidateIds: selectedCandidateIds }); if selectedCandidateIds is empty use personIds: selectedPersonIds',
  '3. Whole table (nothing selected, user said everyone/all): start_outreach({ projectId, startAllQueuedInProject: true })',
  '4. Report startedCandidates. If 0 and rows were selected, the people are not enrolled yet: enroll them (upload-profiles) with the steps below, then call start_outreach with the new candidate ids',
  'When the user asks to enroll / set up the sequencer / send connection requests and the sequencer or candidates do not exist yet:',
  '1. load_skills(["outreach", "workflow-building"]) — treat that ask as execute authorization for enrollment',
  '2. Prefer Project outreachWorkflowId / name "Outreach — Candidate Sequencer"; clone via create_draft_from_workflow_version before editing; do not rebuild from scratch',
  '3. Person Links field is linkedinLink.primaryLinkUrl (not Candidate linkedinUrl) — load Person after Candidate and wire SEND_* / fetch-linkedin inputs from the person FIND',
  '4. Activate the draft, then create Candidates for ephemeral People with projectId=projectId, outreachSequenceStage=QUEUED, linkedinUrl set',
  '5. list_workflow_runs for outreachWorkflowId and summarize — do not end the turn stuck on metadata or parse retries',
];
