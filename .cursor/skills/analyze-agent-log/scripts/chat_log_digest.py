#!/usr/bin/env python3
"""Condense a Twenty/Arxena AI-chat server log into an agent-behaviour digest.

The raw log is tens of MB of ANSI-painted Nest output. This script keeps only the
signals that explain *why* the agent did what it did:

  turn boundaries, injected tools/skills, prompt sizes, per-step reasoning,
  tool calls with arguments, results, errors, token growth, cost, outcome.

Usage:
  python3 chat_log_digest.py recent_log.txt > digest.md
  python3 chat_log_digest.py recent_log.txt --pid 59686 --turn 3
  python3 chat_log_digest.py recent_log.txt --json digest.json --reasoning-chars 0
"""

import argparse
import json
import re
import sys
from collections import Counter

# The capture lost only the ESC byte, leaving SGR parameter lists glued to text
# ("32m[Nest]", "LOG39m", "...ask_questions.39m"). The code set is small and
# fixed, so strip exactly those codes rather than guessing at stray "m"s.
SGR_CODE = r'(?:38;5;\d{1,3}|3[0-79]|9[0-79]|1|2)'
SGR_PREFIX = re.compile(r'(^|[\s\[\]▶"\'`])' + SGR_CODE + r'm(?=[\s\[\]▶A-Za-z"\'\({])')
SGR_SUFFIX = re.compile(r'(?<=\S)39m$')
SEVERITY_RESIDUE = re.compile(r'\b(LOG|WARN|ERROR|DEBUG|VERBOSE|FATAL)(?:[0-9;]{1,3})?m')
KV = re.compile(r'(\w+)(?:\(([^)]*)\))?=(\[[^\]]*\]|\S+)')
NEST = re.compile(r'^\[Nest\] (\d+)  - ')


def strip_sgr(line):
    line = re.sub(r'\x1b\[[0-9;]*m', '', line).rstrip('\n')
    line = SEVERITY_RESIDUE.sub(r'\1', line)
    line = SGR_PREFIX.sub(r'\1', line)
    return SGR_SUFFIX.sub('', line)


def kv(line):
    return {
        f'{key}.{detail}' if detail else key: value.strip('[],')
        for key, detail, value in KV.findall(line)
    }


def list_of(value):
    return [item.strip() for item in value.split(',') if item.strip()] if value else []


def to_int(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


STEP_PART = re.compile(
    r'^(?:\s*(?:reasoning|text|error):'
    r'|\s*tool-call `([^`]+)`:'
    r'|\s*tool-result `([^`]+)`:'
    r'|#### \d+\. (\w+))'
)


def parse_step_block(lines):
    """Split a `[AI_CHAT_STEP] #N output` block into reasoning / calls / results."""
    parts = []
    kind, name, buffer = None, None, []

    def flush():
        if kind is None:
            return
        body = '\n'.join(buffer).strip().strip('`').strip()
        parts.append({'kind': kind, 'name': name, 'body': body})

    for line in lines:
        if line.strip() == '```':
            continue
        header = STEP_PART.match(line)
        if header:
            flush()
            if header.group(1):
                kind, name = 'tool-call', header.group(1)
            elif header.group(2):
                kind, name = 'tool-result', header.group(2)
            elif header.group(3):
                kind, name = 'role', header.group(3)
            else:
                kind, name = line.strip().rstrip(':'), None
            buffer = []
        else:
            buffer.append(line)
    flush()

    step = {'reasoning': [], 'text': [], 'calls': [], 'results': [], 'errors': []}
    for part in parts:
        if part['kind'] == 'reasoning':
            step['reasoning'].append(part['body'])
        elif part['kind'] == 'text':
            step['text'].append(part['body'])
        elif part['kind'] == 'error':
            step['errors'].append(part['body'])
        elif part['kind'] == 'tool-call':
            args = part['body']
            try:
                parsed = json.loads(args)
            except json.JSONDecodeError:
                parsed = None
            step['calls'].append({'tool': part['name'], 'args': args, 'parsed': parsed})
        elif part['kind'] == 'tool-result':
            step['results'].append({'tool': part['name'], 'chars': len(part['body'])})
    return step


def new_turn(index, info):
    return {
        'turn': index,
        'threadId': info.get('threadId'),
        'turnId': info.get('turnId'),
        'streamId': info.get('streamId'),
        'model': info.get('modelId'),
        'browsingContext': info.get('browsingContext'),
        'contextLength': to_int(info.get('contextLength')),
        'catalogs': {},
        'activeTools': [],
        'systemPromptLength': None,
        'promptSections': {},
        'maxSteps': None,
        'steps': [],
        'signals': {'repairs': [], 'toolErrors': [], 'failures': []},
        'usage': {},
        'stop': {},
        'finished': False,
        'registryTools': [],
    }


TURN_KEYS = (
    'catalogs', 'model', 'nativeCapabilities', 'preloadedTools', 'directTools',
    'coreTools', 'activeTools', 'promptReady', 'pruning', 'stopWhen', 'usage',
    'signal', 'prepare', 'ttft', 'registryTool', 'promptSection', 'streamFail',
    'blockStart', 'blockFinish', 'tokens', 'toolFinish', 'repair', 'toolResult',
    'streamDone', 'error',
)


def classify(line):
    """Return (key, payload) for the log lines we care about, else (None, None)."""
    if '[AI_CHAT] start ' in line:
        return 'start', kv(line)
    if '[AI_CHAT] catalogs ' in line:
        payload = kv(line)
        payload['skillNames'] = list_of(payload.get('skillNames', ''))
        return 'catalogs', payload
    if '[AI_CHAT] browsingContext ' in line:
        payload = kv(line)
        return 'browsingContext', {
            'type': payload.get('type'),
            'contextLength': to_int(payload.get('contextLength')),
        }
    if '[AI_CHAT] activeTools count' in line:
        return 'activeTools', list_of(kv(line).get('names', ''))
    if '[SYSTEM_PROMPT_BUILDER] ' in line:
        return 'promptSection', line.split('[SYSTEM_PROMPT_BUILDER] ', 1)[1].strip()
    if '[AI_CHAT_STEP] #' in line and ' output' in line:
        return 'blockStart', to_int(re.search(r'#(\d+) output', line).group(1))
    if '[AI_CHAT_STEP] #' in line and 'finishReason=' in line:
        match = re.search(
            r'#(\d+) finishReason=(\S+) latencyMs=(\S+) toolNames=\[([^\]]*)\]'
            r'.*contentPartTypes=\[([^\]]*)\]', line)
        if match:
            return 'blockFinish', {
                'step': to_int(match.group(1)),
                'finishReason': match.group(2),
                'latencyMs': to_int(match.group(3)),
                'toolNames': list_of(match.group(4)),
                'contentPartTypes': list_of(match.group(5)),
            }
    if '[AI_CHAT_TOKENS] step #' in line:
        # the log spells the full-context figure as `inputTokens(fullContext)=`
        tokens = {
            'inputTokens' if key == 'inputTokens.fullContext' else key: to_int(value)
            for key, value in kv(line).items()
        }
        tokens['step'] = to_int(re.search(r'step #(\d+)', line).group(1))
        return 'tokens', tokens
    if '[AI_CHAT] repairToolCall ' in line:
        return 'repair', {
            'tool': (re.search(r'tool=(\S+)', line) or re.search('', line)).group(1),
            'error': line.split('error=', 1)[1] if 'error=' in line else '',
        }
    if '[AI_CHAT] toolResult step=' in line:
        payload = kv(line)
        return 'toolResult', {
            'step': to_int(payload.get('step', '').lstrip('#')),
            'tool': payload.get('tool'),
            'type': payload.get('type'),
            'succeeded': payload.get('succeeded') == 'true',
        }
    if '[AI_CHAT] stopWhen ' in line:
        return 'stopWhen', kv(line)
    if '[AI_CHAT] prepareStep #' in line:
        payload = kv(line)
        return 'prepare', {
            'step': to_int(payload.get('step', '').lstrip('#')),
            'messageCount': to_int(payload.get('messageCount')),
            'roles': list_of(payload.get('roles', '')),
        }
    if '[AI_CHAT] ttftMs=' in line:
        payload = kv(line)
        return 'ttft', {'ttftMs': to_int(payload.get('ttftMs')), 'chunk': payload.get('firstChunkType')}
    if '[AI_CHAT] streamText starting' in line:
        payload = kv(line)
        return 'maxSteps', to_int(payload.get('maxSteps'))
    if '[AI_CHAT] promptReady' in line:
        payload = kv(line)
        return 'promptReady', {
            'systemPromptLength': to_int(payload.get('systemPromptLength')),
            'preloadedToolNames': list_of(payload.get('preloadedToolNames', '')),
        }
    if '[AI_CHAT] pruning ' in line:
        return 'pruning', kv(line)
    if '[AI_CHAT_TURN_USAGE] ' in line:
        return 'usage', kv(line)
    if '[AI_CHAT] stream failed' in line or ('failed: ' in line and 'StreamAgentChatJob' in line):
        return 'streamFail', line.split('failed: ', 1)[-1].strip()
    if '[AI_CHAT] stream completed' in line:
        return 'streamDone', to_int(kv(line).get('steps'))
    if '[ToolRegistryService] ▶ ' in line:
        return 'registryTool', line.split('▶ ', 1)[1].split(' (workspace')[0].strip()
    return None, None


def parse(lines):
    turns = []
    turn = None
    block = None
    for line in lines:
        key, payload = classify(line)
        if key == 'start':
            turn = new_turn(len(turns) + 1, payload)
            turns.append(turn)
            block = None
            continue
        if turn is None:
            continue
        if key == 'blockStart':
            block = {'step': payload, 'lines': []}
            continue
        if key == 'blockFinish':
            parsed = parse_step_block(block['lines']) if block and block['step'] == payload['step'] else None
            if parsed is not None:
                parsed.update(payload)
                turn['steps'].append(parsed)
            else:
                turn['steps'].append(dict(payload, reasoning=[], text=[], calls=[], results=[], errors=[]))
            block = None
            continue
        if block is not None:
            block['lines'].append(line)
            continue
        if key == 'catalogs':
            turn['catalogs'] = payload
        elif key == 'browsingContext':
            turn['browsingContext'] = payload['type'] or turn['browsingContext']
            turn['contextLength'] = payload['contextLength']
        elif key == 'activeTools':
            turn['activeTools'] = payload
        elif key == 'promptSection':
            turn['promptSections'].setdefault(payload, 0)
        elif key == 'promptReady':
            turn['systemPromptLength'] = payload['systemPromptLength']
        elif key == 'maxSteps':
            turn['maxSteps'] = payload
        elif key == 'tokens':
            turn['usage'].setdefault('steps', []).append(payload)
        elif key == 'repair':
            turn['signals']['repairs'].append(payload)
        elif key == 'toolResult':
            if not payload['succeeded']:
                turn['signals']['toolErrors'].append(payload)
        elif key == 'stopWhen':
            turn['stop'] = payload
        elif key == 'usage':
            turn['usage']['total'] = payload
        elif key == 'streamFail':
            turn['signals']['failures'].append(payload)
        elif key == 'streamDone':
            turn['finished'] = payload
        elif key == 'registryTool':
            turn['registryTools'].append(payload)
    return turns


def turn_calls(turn):
    return [
        {'step': step['step'], 'tool': call['tool'], 'args': call['args'], 'parsed': call['parsed']}
        for step in turn['steps'] for call in step['calls']
    ]


def canonical_args(call):
    parsed = call['parsed']
    if parsed is None:
        return re.sub(r'\s+', ' ', call['args']).strip()[:200]
    return json.dumps(parsed, sort_keys=True)[:200]


def meanders(turn):
    calls = turn_calls(turn)
    flags = []
    repeats = Counter((call['tool'], canonical_args(call)) for call in calls)
    for (tool, args), count in repeats.most_common():
        if count > 1:
            flags.append(f'repeated call ×{count}: {tool} {args[:120]}')

    loaded = [call for call in calls if call['tool'] == 'load_skills']
    skill_hits = Counter()
    for call in loaded:
        names = (call['parsed'] or {}).get('skillNames') or (call['parsed'] or {}).get('skills') or []
        skill_hits.update(names if isinstance(names, list) else [names])
    for name, count in skill_hits.items():
        if count > 1:
            flags.append(f'skill reloaded ×{count}: {name}')

    for repair in turn['signals']['repairs']:
        flags.append(f'tool repair (schema/prompt mismatch): {repair["tool"]} — {repair["error"][:160]}')
    for error in turn['signals']['toolErrors']:
        flags.append(f'tool error: {error["tool"]} (step {error["step"]})')
    for failure in turn['signals']['failures']:
        flags.append(f'stream failed: {failure[:200]}')

    steps = turn['usage'].get('steps', [])
    if len(steps) > 1:
        first, last = steps[0].get('inputTokens') or 0, steps[-1].get('inputTokens') or 0
        if first and last > first * 4:
            flags.append(f'context grew ×{last / first:.1f} across the turn ({first} → {last} input tokens)')

    total = turn['usage'].get('total') or {}
    if total.get('costInDollars'):
        flags.append(f'cost ${float(total["costInDollars"]):.5f}')
    return flags


def clip(text, limit):
    text = re.sub(r'\n{3,}', '\n\n', text.strip())
    if limit and len(text) > limit:
        return text[:limit] + f'\n… [{len(text) - limit} chars trimmed]'
    return text


def call_line(call):
    args = re.sub(r'\s+', ' ', call['args']).strip()
    return f'{call["tool"]} {args[:160]}'


LEARNING_TOOLS = ('load_skills', 'learn_tools', 'get_tool_catalog', 'execute_tool')


def render(turns, reasoning_chars):
    out = ['# Agent chat log digest', '']
    total_cost = 0.0
    total_tokens = 0
    for turn in turns:
        total = turn['usage'].get('total') or {}
        total_cost += float(total.get('costInDollars') or 0)
        total_tokens += to_int(total.get('totalTokens')) or 0
    ask_runs = 0
    streak = 0
    for turn in turns:
        if turn['stop'].get('askedQuestions') == 'true' and turn['signals']['failures'] == []:
            streak += 1
            ask_runs = max(ask_runs, streak)
        else:
            streak = 0
    out.append(f'{len(turns)} turns · {total_tokens} tokens · ${total_cost:.4f} · '
               f'longest ask-only streak: {ask_runs} turns')
    out.append('')
    out.append('| turn | context | steps | tool calls | learn calls | in tokens | out tokens | cost | latency ms | outcome |')
    out.append('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    for turn in turns:
        calls = turn_calls(turn)
        total = turn['usage'].get('total') or {}
        learn = sum(1 for call in calls if call['tool'] in LEARNING_TOOLS)
        outcome = 'failed' if turn['signals']['failures'] else (
            'asked user' if turn['stop'].get('askedQuestions') == 'true' else
            f'step budget hit' if turn['stop'].get('hitMaxSteps') == 'true' else 'completed')
        out.append(
            f'| {turn["turn"]} | {turn["browsingContext"]} | {len(turn["steps"])} | {len(calls)} | {learn} '
            f'| {total.get("inputTokens", "-")} | {total.get("outputTokens", "-")} '
            f'| {total.get("costInDollars", "-")} | {total.get("turnLatencyMs", "-")} | {outcome} |')
    out.append('')

    for turn in turns:
        catalogs = turn['catalogs']
        out.append(f'## Turn {turn["turn"]} — {turn["browsingContext"]} (`{turn["threadId"]}`)')
        out.append('')
        out.append(f'- model: `{turn["model"]}` maxSteps={turn["maxSteps"]}')
        out.append(f'- catalog: tools={catalogs.get("tools")} skills={catalogs.get("skills")} '
                   f'arxena={catalogs.get("arxena")} external_mcp={catalogs.get("external_mcp")}')
        out.append(f'- skill catalog: {", ".join(catalogs.get("skillNames", [])) or "-"}')
        out.append(f'- active tools this turn: {", ".join(turn["activeTools"]) or "-"}')
        out.append(f'- prompt: systemPromptLength={turn["systemPromptLength"]} '
                   f'browsingContextChars={turn["contextLength"]} sections={", ".join(turn["promptSections"]) or "-"}')
        if turn['signals']['failures']:
            out.append(f'- **failed**: {turn["signals"]["failures"][0][:300]}')
        out.append('')

        if turn['steps']:
            out.append('### Tool + learning timeline')
            out.append('')
            for step in turn['steps']:
                reasoning = clip('\n'.join(step['reasoning']), reasoning_chars).replace('\n', '\n  ')
                text = clip('\n'.join(step['text']), 300).replace('\n', '\n  ')
                out.append(f'**step {step["step"]}** — {step["finishReason"]} · {step["latencyMs"]}ms')
                if reasoning:
                    out.append(f'- reasoning: {reasoning}')
                for call in step['calls']:
                    out.append(f'- call: `{call_line(call)}`')
                for result in step['results']:
                    out.append(f'- result: {result["tool"]} ({result["chars"]} chars)')
                for error in step['errors']:
                    out.append(f'- error: {clip(error, 300)}')
                if text:
                    out.append(f'- said: {text}')
                out.append('')

        if turn['registryTools']:
            out.append(f'### Downstream tool executions\n\n{", ".join(turn["registryTools"])}\n')

        flags = meanders(turn)
        if flags:
            out.append('### Signals')
            out.append('')
            out.extend(f'- {flag}' for flag in flags)
            out.append('')
    return '\n'.join(out)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('log_file')
    parser.add_argument('--pid', type=int, help='keep only one Nest process (isolates interleaved servers)')
    parser.add_argument('--turn', type=int, help='digest a single turn (1-based)')
    parser.add_argument('--reasoning-chars', type=int, default=800,
                        help='reasoning shown per step; 0 = full (needed for deep decision analysis)')
    parser.add_argument('--json', dest='json_path', help='also write the structured digest')
    args = parser.parse_args()

    with open(args.log_file, encoding='utf-8', errors='replace') as handle:
        lines = []
        for raw in handle:
            line = strip_sgr(raw)
            if args.pid:
                match = NEST.match(line)
                if match and int(match.group(1)) != args.pid:
                    continue
            lines.append(line)

    turns = parse(lines)
    if args.turn:
        turns = [turn for turn in turns if turn['turn'] == args.turn]
    if not turns:
        sys.exit('no AI_CHAT turns found — check --pid or that the log contains [AI_CHAT] start')

    if args.json_path:
        with open(args.json_path, 'w', encoding='utf-8') as handle:
            json.dump(turns, handle, indent=1)
    print(render(turns, args.reasoning_chars))


if __name__ == '__main__':
    main()
