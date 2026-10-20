// Single source for MCP tool descriptions used by both the NestJS /mcp server and the
// Arxena tool library (twenty-server/.../arxena-tools/library), which only exposes execute_tool, learn_tools,
// search and fetch to the server-side bridge. list_skills is served by NestJS only;
// load_skills and get_tool_catalog have NestJS-specific wording and stay with their tools.
export const MCP_TOOL_DESCRIPTIONS = {
  execute_tool:
    'Execute a tool by name with arguments. Call learn_tools first to discover the required input schema. Company and people search (Apollo, LinkedIn, Harvest, Bright Data, Exa) runs through this tool; load the "sourcing" skill with load_skills first.',
  learn_tools:
    'Get input schemas for tools. Pass all the tool names you need in a single call (toolNames accepts an array) rather than calling learn_tools once per tool. Call this with exact tool names to learn the required arguments before calling execute_tool. For company or people search, learn the search tools named in the "sourcing" skill (load it first with load_skills) instead of using web search.',
  list_skills:
    'List skill names only when the initialize instructions look stale. Do not call this on the happy path — skill names are already listed in server instructions. Then load a matching skill with load_skills.',
  search:
    'Search Arxena workspace knowledge: org charts, companies, jobs and candidates. Returns result ids to pass to fetch.',
  fetch:
    'Fetch a full document by id returned from search (orgchart:{id}, project:{id}, candidate:{id}).',
} as const;
