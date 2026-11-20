#!/usr/bin/env python3
"""Smallest runnable check for chat_log_digest.py — no framework, no fixtures."""

import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('digest', HERE / 'chat_log_digest.py')
digest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(digest)

LOG = '''\
32m[Nest] 1  - 39m19/11/2026, 4:01:26 pm 32m    LOG39m 38;5;3m[ChatExecutionService] 39m32m[AI_CHAT] start threadId=t1 turnId=u1 modelId=m browsingContext=outreachCommand39m
32m[Nest] 1  - 39m19/11/2026, 4:01:26 pm 32m    LOG39m 38;5;3m[ChatExecutionService] 39m32m[AI_CHAT] catalogs tools=646 skills=21 arxena=83 external_mcp=206 skillNames=[sourcing, outreach]39m
32m[Nest] 1  - 39m19/11/2026, 4:01:26 pm 32m    LOG39m 38;5;3m[ChatExecutionService] 39m32m[AI_CHAT] activeTools count=2 names=[ask_questions, get_tool_catalog]39m
32m[Nest] 1  - 39m19/11/2026, 4:01:26 pm 32m    LOG39m 38;5;3m[ChatExecutionService] 39m32m[AI_CHAT] streamText starting modelMessageCount=1 maxSteps=30039m
32m[Nest] 1  - 39m19/11/2026, 4:01:26 pm 32m    LOG39m 38;5;3m[ChatExecutionService] 39m32m[AI_CHAT_STEP] #1 output39m

#### 1. assistant
reasoning:
```
I should load the sourcing skill.
```
tool-call `load_skills`:
```
{
  "skills": [
    "sourcing"
  ]
}
```
error:
```
{
  "input": {
    "skills": [
      "sourcing"
    ]
  }
}
```39m
32m[Nest] 1  - 39m19/11/2026, 4:01:26 pm 32m    LOG39m 38;5;3m[ChatExecutionService] 39m32m[AI_CHAT_STEP] #1 finishReason=tool-calls latencyMs=100 toolNames=[load_skills] toolCallIds=[c1] contentPartTypes=[reasoning, tool-call, tool-error]39m
32m[Nest] 1  - 39m19/11/2026, 4:01:26 pm 32m   WARN39m 38;5;3m[ChatExecutionService] 39m33m[AI_CHAT] repairToolCall tool=load_skills toolCallId=c1 error=Model tried to call unavailable tool 'load_skills'. Available tools: ask_questions.39m
32m[Nest] 1  - 39m19/11/2026, 4:01:26 pm 32m    LOG39m 38;5;3m[ChatExecutionService] 39m32m[AI_CHAT] toolResult step=#1 tool=load_skills type=tool-error succeeded=false39m
32m[Nest] 1  - 39m19/11/2026, 4:01:26 pm 32m    LOG39m 38;5;3m[ChatExecutionService] 39m32m[AI_CHAT_STEP] #2 output39m

#### 1. assistant
reasoning:
```
Try again.
```
tool-call `load_skills`:
```
{
  "skills": [
    "sourcing"
  ]
}
```
tool-result `load_skills`:
```
ok
```39m
32m[Nest] 1  - 39m19/11/2026, 4:01:26 pm 32m    LOG39m 38;5;3m[ChatExecutionService] 39m32m[AI_CHAT_STEP] #2 finishReason=tool-calls latencyMs=200 toolNames=[load_skills] toolCallIds=[c2] contentPartTypes=[reasoning, tool-call, tool-result]39m
32m[Nest] 1  - 39m19/11/2026, 4:01:26 pm 32m    LOG39m 38;5;3m[ChatExecutionService] 39m32m[AI_CHAT_TOKENS] step #1 — inputTokens(fullContext)=1000, totalTokens=110039m
32m[Nest] 1  - 39m19/11/2026, 4:01:26 pm 32m    LOG39m 38;5;3m[ChatExecutionService] 39m32m[AI_CHAT_TOKENS] step #2 — inputTokens(fullContext)=9000, totalTokens=910039m
32m[Nest] 1  - 39m19/11/2026, 4:01:26 pm 32m    LOG39m 38;5;3m[ChatExecutionService] 39m32m[AI_CHAT] stopWhen hitMaxSteps=false askedQuestions=false hasNoMoreAvailableCredits=false39m
32m[Nest] 1  - 39m19/11/2026, 4:01:26 pm 32m    LOG39m 38;5;3m[ChatExecutionService] 39m32m[AI_CHAT_TURN_USAGE] steps=2 inputTokens=10000 outputTokens=200 costInDollars=0.0020 turnLatencyMs=943639m
32m[Nest] 1  - 39m19/11/2026, 4:01:26 pm 32m    LOG39m 38;5;3m[ChatExecutionService] 39m32m[AI_CHAT] stream completed steps=239m
'''


def main():
    with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False) as handle:
        handle.write(LOG)
        path = handle.name

    output = subprocess.run(
        [sys.executable, str(HERE / 'chat_log_digest.py'), path, '--reasoning-chars', '0', '--json', path + '.json'],
        capture_output=True, text=True, check=True).stdout
    turns = json.loads(Path(path + '.json').read_text())

    assert len(turns) == 1, turns
    turn = turns[0]
    assert turn['catalogs']['tools'] == '646'
    assert turn['catalogs']['skillNames'] == ['sourcing', 'outreach']
    assert turn['activeTools'] == ['ask_questions', 'get_tool_catalog']
    assert turn['maxSteps'] == 300
    assert [step['step'] for step in turn['steps']] == [1, 2]
    assert turn['steps'][0]['contentPartTypes'] == ['reasoning', 'tool-call', 'tool-error']
    assert turn['steps'][1]['calls'][0]['parsed'] == {'skills': ['sourcing']}
    assert turn['usage']['total']['costInDollars'] == '0.0020'
    assert turn['signals']['repairs'][0]['tool'] == 'load_skills'
    assert turn['signals']['toolErrors'] == [
        {'step': 1, 'tool': 'load_skills', 'type': 'tool-error', 'succeeded': False}]

    flags = '\n'.join(digest.meanders(turn))
    assert 'tool repair' in flags and 'repeated call ×2' in flags, flags
    assert 'context grew ×9.0' in flags, flags
    assert '39m' not in output and '32m[' not in output, output
    assert 'completed' in output

    # ANSI residue must not eat real words containing "m"
    assert digest.strip_sgr('about m and m config').strip() == 'about m and m config'
    print('self_check: OK')


if __name__ == '__main__':
    main()
