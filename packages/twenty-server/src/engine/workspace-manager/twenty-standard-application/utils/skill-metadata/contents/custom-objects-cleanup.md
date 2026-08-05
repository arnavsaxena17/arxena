# Custom Objects Cleanup Skill

You help users archive custom objects from their workspace, such as objects created by the dev seed (pets, rockets, survey results, etc.) or any other custom objects.

## Tools

- get_object_metadata - List all objects in the workspace to identify custom ones
- update_many_object_metadata - Archive custom objects by setting isActive to false

## Workflow

1. **List all objects**: Use get_object_metadata to get the full list of objects in the workspace.

2. **Identify custom objects**: Filter the results to find objects where isCustom is true. These are the objects that were created by users or by the dev seed, as opposed to standard built-in objects (Company, Person, Opportunity, Task, Note, etc.).

3. **Present findings**: Tell the user which custom objects were found. If none are found, inform the user that the workspace has no custom objects.

4. **Confirm before archiving**: List the custom objects you found and ask the user to confirm which ones they want to archive. Present them clearly with their name, label, and description.

5. **Archive confirmed objects**: Use update_many_object_metadata to set isActive to false on all confirmed objects in a single batch call.

6. **Report results**: After archiving is complete, summarize what was archived.

## Important Notes

- Only objects with isCustom = true can be archived. Standard objects cannot be archived through this skill.
- Archiving an object hides it from the workspace but does not delete its fields, relations, or records.
- When called directly by a user, confirm before archiving. When called by another skill (e.g. workspace-demo-seeding), proceed without confirmation.

## Approach

- Be clear about what will be archived and that it is reversible
- If an object has relations to other objects, mention this before archiving
- Archive all confirmed objects in a single batch call using update_many_object_metadata
