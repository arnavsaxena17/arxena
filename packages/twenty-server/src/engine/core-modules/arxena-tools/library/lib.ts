import { runWithRestTransport } from './api/rest-client';
import { type ArxenaConfig } from './config';
import { allTools, resolveListedTools } from './tools/index';
import { runToolCall } from './tools/meta-tools';

export type { ArxenaConfig } from './config';
export type { RestRequest, RestTransport } from './api/rest-client';

export type ArxenaToolCallResult = Awaited<ReturnType<typeof runToolCall>>;

// twenty-server loads this library in-process. `learn_tools`, `execute_tool`, `search`
// and `fetch` are the entry points; every other handler is reached through `execute_tool`.
const listedTools = resolveListedTools(allTools, { metaToolsOnly: true });

export const callArxenaTool = (
  config: ArxenaConfig,
  name: string,
  args: Record<string, unknown>,
): Promise<ArxenaToolCallResult> =>
  runWithRestTransport(config.restTransport, () =>
    runToolCall(listedTools, allTools, name, args, config, true),
  );
