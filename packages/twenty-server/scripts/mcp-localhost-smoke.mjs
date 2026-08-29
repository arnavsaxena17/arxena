#!/usr/bin/env node
/**
 * Read-only MCP happy-path smoke against a local twenty-server.
 *
 *   MCP_ACCESS_TOKEN=... node scripts/mcp-localhost-smoke.mjs
 *
 * Does not call get_tool_catalog or list_skills (those are refresh-only).
 * Does not create, update, delete, or send.
 */
const BASE_URL = process.env.MCP_BASE_URL ?? 'http://localhost:3000/mcp';
const TOKEN = process.env.MCP_ACCESS_TOKEN;

if (!TOKEN) {
  console.error('Set MCP_ACCESS_TOKEN to a workspace ACCESS JWT.');
  process.exit(1);
}

const calledTools = [];

const postMcp = async (body) => {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ jsonrpc: '2.0', ...body }),
  });

  const json = await response.json();

  if (response.status !== 200) {
    throw new Error(
      `${body.method} HTTP ${response.status}: ${JSON.stringify(json)}`,
    );
  }

  return json;
};

const callTool = async (name, args) => {
  calledTools.push(name);

  if (name === 'get_tool_catalog' || name === 'list_skills') {
    throw new Error(
      `Happy-path smoke must not call ${name} first/at all. Got call sequence: ${calledTools.join(' -> ')}`,
    );
  }

  const json = await postMcp({
    method: 'tools/call',
    id: `call-${calledTools.length}`,
    params: { name, arguments: args },
  });

  if (json.error) {
    throw new Error(`${name} JSON-RPC error: ${JSON.stringify(json.error)}`);
  }

  return json.result;
};

const toolText = (result) =>
  (result?.content ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');

const uniqueToolNamesFromMarkdown = (markdown) => {
  const names = new Set();
  const pattern = /`([a-z][a-z0-9_]{2,})`/g;
  let match = pattern.exec(markdown);

  while (match) {
    names.add(match[1]);
    match = pattern.exec(markdown);
  }

  return [...names];
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const metaToolNames = new Set([
  'load_skills',
  'learn_tools',
  'execute_tool',
  'search_help_center',
  'get_tool_catalog',
  'list_skills',
  'list_object_metadata_names',
]);

const run = async () => {
  const initialize = await postMcp({ method: 'initialize', id: 'init-1' });
  const instructions = initialize.result?.instructions ?? '';

  assert(typeof instructions === 'string' && instructions.length > 0, 'initialize missing instructions');
  assert(instructions.includes('Plan → Skill → Learn → Execute'), 'missing CORE playbook');
  assert(instructions.includes('linkedin-search'), 'missing linkedin-search skill');
  assert(instructions.includes('search-companies'), 'missing search-companies skill');
  assert(instructions.includes('search-people'), 'missing search-people skill');
  assert(instructions.includes('Anti-bloat'), 'missing MCP anti-bloat rules');
  assert(
    !instructions.includes('## Asking the user questions'),
    'MCP instructions leaked chat-only ask_questions section',
  );
  assert(!instructions.includes('[[record:'), 'MCP instructions leaked chat record-ref syntax');

  const listed = await postMcp({ method: 'tools/list', id: 'tools-1' });
  const toolNames = (listed.result?.tools ?? []).map((tool) => tool.name);

  assert(toolNames.includes('load_skills'), 'tools/list missing load_skills');
  assert(toolNames.includes('learn_tools'), 'tools/list missing learn_tools');
  assert(toolNames.includes('execute_tool'), 'tools/list missing execute_tool');
  for (const name of toolNames) {
    assert(
      metaToolNames.has(name),
      `tools/list leaked non-meta tool ${name}`,
    );
  }

  const prompts = await postMcp({ method: 'prompts/list', id: 'prompts-1' });
  const promptNames = (prompts.result?.prompts ?? []).map((prompt) => prompt.name);

  assert(promptNames.includes('search-people'), 'prompts/list missing search-people');
  assert(promptNames.includes('search-companies'), 'prompts/list missing search-companies');
  assert(promptNames.includes('workflow-building'), 'prompts/list missing workflow-building');

  const attached = await postMcp({
    method: 'prompts/get',
    id: 'prompt-get-1',
    params: {
      name: 'search-people',
      arguments: { task: 'Find CEOs at Acme' },
    },
  });
  const attachedText = attached.result?.messages?.[0]?.content?.text ?? '';

  assert(attachedText.includes('Find CEOs at Acme'), 'prompts/get did not append the user task');
  assert(attachedText.length > 40, 'prompts/get returned empty skill markdown');

  const loadedPeople = await callTool('load_skills', {
    skillNames: ['search-people', 'linkedin-search'],
  });
  const peopleSkillText = toolText(loadedPeople);

  assert(peopleSkillText.toLowerCase().includes('search'), 'load_skills search-people returned no content');

  const peopleToolNames = uniqueToolNamesFromMarkdown(peopleSkillText)
    .filter(
      (name) =>
        name.includes('search') ||
        name.includes('linkedin') ||
        name.includes('people'),
    )
    .slice(0, 4);

  assert(peopleToolNames.length > 0, 'could not extract search tool names from search-people skill');

  const learnedPeople = await callTool('learn_tools', {
    toolNames: peopleToolNames,
  });
  const learnedPeopleText = toolText(learnedPeople);

  assert(
    peopleToolNames.some((name) => learnedPeopleText.includes(name)),
    `learn_tools did not return schemas for ${peopleToolNames.join(', ')}`,
  );

  const loadedCompanies = await callTool('load_skills', {
    skillNames: ['search-companies'],
  });

  assert(
    toolText(loadedCompanies).length > 40,
    'load_skills search-companies returned no content',
  );

  const learnedCompanies = await callTool('learn_tools', {
    toolNames: uniqueToolNamesFromMarkdown(toolText(loadedCompanies))
      .filter((name) => name.includes('search') || name.includes('compan'))
      .slice(0, 3),
  });

  assert(toolText(learnedCompanies).length > 0, 'learn_tools for company search returned empty');

  const loadedWorkflow = await callTool('load_skills', {
    skillNames: ['workflow-building'],
  });
  const workflowToolNames = uniqueToolNamesFromMarkdown(toolText(loadedWorkflow))
    .filter((name) => name.includes('workflow'))
    .slice(0, 3);

  if (workflowToolNames.length > 0) {
    await callTool('learn_tools', { toolNames: workflowToolNames });
  }

  await callTool('learn_tools', { toolNames: ['find_many_companies'] });
  const companies = await callTool('execute_tool', {
    toolName: 'find_many_companies',
    arguments: { limit: 1, select: ['id', 'name'] },
  });

  assert(
    !companies.error,
    `find_many_companies failed: ${JSON.stringify(companies)}`,
  );

  console.log('MCP localhost smoke passed.');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`tools/list: ${toolNames.join(', ')}`);
  console.log(`Happy-path calls: ${calledTools.join(' -> ')}`);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
