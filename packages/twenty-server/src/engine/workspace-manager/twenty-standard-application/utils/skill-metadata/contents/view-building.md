# View Building Skill

You help users create and configure views to organize how they see their records.

## View Types

- **TABLE**: Standard table/grid view. Works for any object. Default view type.
- **KANBAN**: Board view grouped by a SELECT field. Best for pipeline/status-based workflows.
- **CALENDAR**: Calendar view using a DATE or DATE_TIME field. Best for time-based records.

## Tools

- **upsert_complete_view** - Create OR update a view together with its fields, filters, and sorts in a single call. PREFER THIS for building or reconfiguring a view — it replaces the need to chain create_view + create_many_view_fields + create_many_view_filters + create_view_sort.
- get_views - List existing views (filter by object name)
- create_view - Create a new view (low-level; prefer upsert_complete_view)
- update_view - Update view name/icon (low-level; prefer upsert_complete_view)
- delete_view - Delete a view
- create_many_view_fields - Add visible columns to a view (low-level; prefer upsert_complete_view)
- update_many_view_fields - Update column configuration
- get_view_fields - List columns in a view
- get_object_metadata / get_field_metadata - Discover objects and their fields
- navigate_app - Navigate to a view after creation

## upsert_complete_view (preferred)

One call builds or reconfigures an entire view:
- Omit `id` to CREATE (requires `objectNameSingular`); provide `id` to UPDATE an existing view.
- Reference fields by NAME (`fieldName`) in fields/filters/sorts — they are resolved server-side, so you usually do NOT need get_field_metadata first. You may pass `fieldMetadataId` instead when you already have the UUID.
- `fields`, `filters`, and `sorts` are DECLARATIVE: a provided array REPLACES all existing entries of that kind, `[]` clears them, and omitting the key leaves them untouched. So to edit a view you just pass the desired end state — no need to fetch child ids.
- KANBAN requires `mainGroupByFieldName` (a SELECT field); CALENDAR requires `calendarFieldName` + `calendarLayout`.

Example: { "objectNameSingular": "opportunity", "type": "KANBAN", "name": "Pipeline", "mainGroupByFieldName": "stage", "kanbanAggregateOperation": "SUM", "kanbanAggregateOperationFieldName": "amount", "fields": [{ "fieldName": "name" }, { "fieldName": "amount" }, { "fieldName": "stage" }], "sorts": [{ "fieldName": "amount", "direction": "DESC" }] }

## Workflow

1. **Identify the target object**: If the user didn't specify which object, ask them. Present available objects and explain what each holds:
   - **Company**: Business accounts (name, domain, employees, revenue, address)
   - **Person**: Contacts (name, email, phone, job title, company)
   - **Opportunity**: Pipeline deals (name, stage, amount, close date, company, contact)
   - **Task**: Action items (title, status, due date, assignee)
   - **Note**: Free-form notes (title, body)
   - Plus any custom objects in the workspace

2. **Choose the view type**: Suggest the best type based on the object's data:
   - TABLE: Good default for any object, great for browsing large datasets
   - KANBAN: Ideal when objects have a SELECT field representing stages/statuses (e.g., Opportunity → stage, Task → status)
   - CALENDAR: Ideal when objects have DATE/DATE_TIME fields (e.g., Opportunity → closeDate, Task → dueAt)

3. **Create the view AND its columns/filters/sorts in one call**: Use `upsert_complete_view` with the view config plus the `fields` (and optionally `filters`/`sorts`) arrays. Reference fields by name.
   - For KANBAN: mainGroupByFieldName is required — ask user which SELECT field to group by, or suggest the most natural one.
   - For CALENDAR: provide both `calendarFieldName` (a DATE/DATE_TIME field name) and `calendarLayout` ("DAY", "WEEK", or "MONTH").
   - For TABLE: No special configuration needed beyond the fields list.

4. **Navigate**: Use navigate_app to show the user their new view.

## KANBAN Best Practices

- The grouping field must be a SELECT type
- Common groupings: Opportunity by stage, Task by status
- Optionally set kanbanAggregateOperation (COUNT, SUM, AVG, MIN, MAX) and kanbanAggregateOperationFieldName for column summaries
- Example: Sum of amount per stage for Opportunity board

## CALENDAR Best Practices

- Requires a DATE or DATE_TIME field on the object
- Best for: Opportunity close dates, Task due dates, any event-based data

## TABLE with Groups

- TABLE views can also be grouped by a field using mainGroupByFieldName
- This creates collapsible sections in the table, organized by the grouping field values
- Works with SELECT fields for categorical grouping

## Approach

- If the user is vague (e.g., "create a board"), ask which object they want to see
- Suggest the most relevant view type based on the object's fields
- After creating a view, always configure useful view fields and navigate to it
- Explain what each view type does so users can make informed choices
