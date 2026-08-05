# Code Interpreter Skill

You have access to the `code_interpreter` tool to execute Python code in a sandboxed environment.

## How to Use
Call the `code_interpreter` tool with your Python code. The tool will execute the code and return stdout, stderr, and any generated files.

## Capabilities
- Analyze CSV, Excel, and JSON data files
- Create charts and visualizations (matplotlib, seaborn)
- Generate reports (PDF, PPTX, Excel)
- Perform calculations and data transformations

## Pre-installed Libraries
pandas, numpy, matplotlib, seaborn, scikit-learn, openpyxl, python-pptx

## Input Files
- User-uploaded files are available at `/home/user/{filename}`
- Always check the file exists before processing

### Mounting spilled tool outputs / AgentChat files

When a prior tool returned `fileId` / `outputRef.fileId` (large LinkedIn search, spilled JSON, etc.), pass it into `code_interpreter` via the `files` argument — do **not** paste the JSON into `code`:

```json
{
  "code": "import json\nwith open('/home/user/search.json') as f:\n    payload = json.load(f)\nitems = payload['result']['items']\nprint(len(items))",
  "files": [{ "fileId": "<spill-or-agent-chat-file-id>", "filename": "search.json" }]
}
```

The mounted file appears at `/home/user/{filename}`. Use the same parsed rows to write CSV under `/home/user/output/` and to call `arxena.bulk_upsert` — never invent sample rows when the real `fileId` exists.

## Output Files
- Charts: Save to `/home/user/output/` directory - these are automatically returned as downloadable URLs
- For matplotlib: `plt.savefig('/home/user/output/chart.png')`
- Generated files: Save to `/home/user/output/{filename}`

## Anti-patterns

- Embedding multi-KB JSON literals inside the `code` string (causes parse errors and wastes tokens).
- Hand-writing "demo" or "sample" CSV rows when a spilled `fileId` with real results is available.
- Calling web search to figure out how to export LinkedIn/tool results — mount the spill file and parse it.

## Example: Create a Bar Chart
```python
import matplotlib.pyplot as plt
import os

# Data
months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
sales = [100, 150, 200, 175, 250, 300]

# Create chart
plt.figure(figsize=(10, 6))
plt.bar(months, sales, color='skyblue')
plt.title('Monthly Sales')
plt.xlabel('Month')
plt.ylabel('Sales')
plt.tight_layout()

# Save to output directory
os.makedirs('/home/user/output', exist_ok=True)
plt.savefig('/home/user/output/sales_chart.png')
print('Chart saved!')
```

## Example: Analyze CSV
```python
import pandas as pd
import matplotlib.pyplot as plt
import os

# Load data
df = pd.read_csv('/home/user/data.csv')
print(f"Loaded {len(df)} rows")

# Create visualization
plt.figure(figsize=(10, 6))
df.groupby('category')['value'].mean().plot(kind='bar')
plt.title('Average Value by Category')
plt.tight_layout()

os.makedirs('/home/user/output', exist_ok=True)
plt.savefig('/home/user/output/analysis.png')
print('Analysis complete!')
```

## Calling Arxena Tools from Python (MCP Bridge)

**An `arxena` variable is already bound in your code's scope.** Do NOT write
`import arxena` — there is no Python package by that name. The helper is an
instance of a class that has been pre-instantiated for you; just call methods
on it directly.

Real catalog tools follow the pattern `find_many_<object>` / `find_one_<object>` /
`create_one_<object>` / `create_many_<object>` / `update_one_<object>` / `update_many_<object>` /
`delete_one_<object>` / `delete_many_<object>` / `group_by_<object>` —
e.g. `find_many_companies`, `find_one_company`, `create_one_person`.
Call `arxena.list_tools()` to discover exact names. Catalog tools are routed
through `execute_tool` automatically, and the helper raises an Exception on
server-side failures with the error message.

```python
# List catalog tools (flat list, not grouped)
tools = arxena.list_tools()
print(f"{len(tools)} catalog tools available")
for tool in tools[:5]:
    print(f"- {tool['name']}")

# Find records — returns { 'records': [...], 'count': '5' }
# Filters are top-level field → operator objects (never filters/where wrappers)
companies = arxena.call_tool('find_many_companies', {
    'name': {'ilike': '%Acme%'},
    'limit': 5,
    'select': ['id', 'name'],
})
for c in companies['records']:
    print(c['name'], c.get('employees'))

# Create a record — arguments match the tool's inputSchema directly,
# no nested 'data' wrapper.
result = arxena.call_tool('create_one_company', {
    'name': 'Acme Corp',
    'domainName': {'primaryLinkUrl': 'https://acme.com'},
    'position': 'first',
})
print(f"Created company id={result['id']}")

# Update a record
arxena.call_tool('update_one_person', {
    'id': 'person-uuid-here',
    'jobTitle': 'CEO',
})
```

This lets you orchestrate multi-step data workflows in a single sandbox
execution — faster than an equivalent chain of individual tool calls from
the agent, and the computation stays server-side.

## Schema inspection: do it at the LLM level, not inside the sandbox

If you need to know a tool's input schema (e.g. field names for `create_one_company`), call `learn_tools` as an LLM-level tool call **before** entering the sandbox:

```
learn_tools(["create_one_company", "create_one_person"])
```

Do NOT call `arxena.call_tool('learn_tools', ...)` from inside the sandbox to learn schemas — that costs a full round-trip, adds output to the conversation context, and is unnecessary when you can inspect the schema for free before writing any code. Only use `arxena.call_tool('learn_tools', ...)` inside the sandbox if you discover at runtime that you need a schema you could not have anticipated beforehand.

## One sandbox run per task

Each `code_interpreter` call is a round-trip: it adds latency, accumulates output in the conversation, and increases cost. Design your code to complete the entire task in one call:
- Read and parse the input file in the same cell that processes it — never read in two parts.
- Do all schema inspection at the LLM level upfront (see above).
- Write all records and print the summary in the same run.

Multiple sandbox calls are acceptable only when the user asks a follow-up question that changes the task scope, or when a genuine runtime error forces a corrective retry.

### Bulk helpers (use these for imports)

For bulk writes, prefer these higher-level helpers over hand-rolled loops:

```python
# Idempotent batched write (max 200/batch, paginates to completion).
# Dedupes on unique fields server-side; safe to re-run.
summary = arxena.bulk_upsert('people', records)  # { 'created': C, 'updated': U, 'upserted': N, 'failed': 0, 'errors': [] }

# Bounded { value: id } map for resolving relations to IDs, scoped to the
# values you pass (NOT the whole table). Link to-one relations via the scalar
# FK (e.g. record['companyId'] = company_ids[...]), never a nested {'id': ...}.
company_ids = arxena.lookup_by('companies', 'name', ['Acme', 'Globex'])
```

For importing CSV/Excel/spreadsheet data, load the `data-manipulation` skill for the full recipe.
