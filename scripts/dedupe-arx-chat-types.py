#!/usr/bin/env python3
"""Remove duplicate top-level export interface/type/const blocks from ArxChatTypes.ts."""

from __future__ import annotations

import re
from pathlib import Path

path = Path("packages/twenty-shared/src/arx/ArxChatTypes.ts")
lines = path.read_text().splitlines(True)

out: list[str] = []
seen_interfaces: set[str] = set()
seen_types: set[str] = set()
seen_consts: set[str] = set()
i = 0


def take_braced_block(start_line: str, start_idx: int) -> tuple[list[str], int]:
    block = [start_line]
    idx = start_idx + 1
    depth = start_line.count("{") - start_line.count("}")
    while idx < len(lines) and depth > 0:
        block.append(lines[idx])
        depth += lines[idx].count("{") - lines[idx].count("}")
        idx += 1
    return block, idx


while i < len(lines):
    line = lines[i]
    m_iface = re.match(r"^export interface (\w+)\b", line)
    m_type = re.match(r"^export type (\w+)\b", line)
    m_const = re.match(r"^export const (\w+)\b", line)

    if m_iface:
        name = m_iface.group(1)
        block, i = take_braced_block(line, i)
        if name in seen_interfaces:
            print(f"drop iface {name}")
            continue
        seen_interfaces.add(name)
        out.extend(block)
        continue

    if m_type:
        name = m_type.group(1)
        block = [line]
        if "{" in line:
            block, i = take_braced_block(line, i)
        else:
            i += 1
            while i < len(lines) and not block[-1].rstrip().endswith(";"):
                block.append(lines[i])
                i += 1
        if name in seen_types:
            print(f"drop type {name}")
            continue
        seen_types.add(name)
        out.extend(block)
        continue

    if m_const:
        name = m_const.group(1)
        block = [line]
        i += 1
        depth = (
            line.count("{")
            - line.count("}")
            + line.count("[")
            - line.count("]")
            + line.count("(")
            - line.count(")")
        )
        while i < len(lines):
            if depth <= 0 and block[-1].rstrip().endswith(";"):
                break
            block.append(lines[i])
            depth += lines[i].count("{") - lines[i].count("}")
            depth += lines[i].count("[") - lines[i].count("]")
            depth += lines[i].count("(") - lines[i].count(")")
            ended = block[-1].rstrip().endswith(";") and depth <= 0
            i += 1
            if ended:
                break
        if name in seen_consts:
            print(f"drop const {name}")
            continue
        seen_consts.add(name)
        out.extend(block)
        continue

    out.append(line)
    i += 1

new = "".join(out)
path.write_text(new)
print(f"wrote {path}: {len(lines)} -> {new.count(chr(10))} lines")
