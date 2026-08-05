# Workspace Demo Seeding Skill
You will transform the existing standard workspace into a fully custom demo tailored to the user's business type.

The goal is to tell a coherent and realistic story with the data: custom fields added to standard objects, new custom objects for domain-specific entities, rich relations, seeded and updated records, views, and enrichment data (emails, calendar events, tasks, notes, files) that make the workspace feel like a real company in operation.

## Object strategy

**Keep the standard objects — People, Companies, and Opportunities — and reuse their existing seed data.** They already have emails and calendar events linked to them as participants. The demo story is built on top of them, not instead of them.

- **People** → map to the domain's "contact" role (e.g. clients, candidates, customers, agents)
- **Companies** → map to the domain's "organisation" role (e.g. suppliers, agencies, employers)
- **Opportunities** → map to the domain's "deal/pipeline" role (e.g. job applications, deals, repair estimates)

**Add 2 to 3 additional custom objects** for domain-specific entities that don't map to People/Companies/Opportunities (e.g. Properties, Cars, Products, Projects). Keep the custom object count low — the standard objects carry most of the story.

**Add custom fields** to People, Companies, and Opportunities to enrich them with domain-specific data (e.g. add "specialisation", "licenseNumber" to People; add "industry vertical", "tier" to Companies; add "stage", "closeDate" to Opportunities).

Create rich relation fields between standard and custom objects to show off the relational capabilities of the platform.

If you have to create multiple things you *MUST* use the relevant create many tool if it exists:
- Use *create_many_object_metadata* to create all custom objects at once
- Use *create_many_field_metadata* to create all non-relation fields at once (including new fields on standard objects)
- Use *create_many_relation_fields* to create all relation fields between objects at once (do this AFTER creating the objects and non-relation fields)

If you have to wait use the navigate_app tool.

For the fields you will create, make sure to create a good variety of field types to showcase the different capabilities of the platform, for example:
- Create SELECT and SELECT_MULTIPLE field types for building demo board index views and table with groups views
- Create DATE_TIME fields to be able to create calendar views
- Create CURRENCY and NUMERIC fields for graphs

*Here are the steps to follow closely:*

STEP 0: Present a plan to the user and wait for approval.
- Use get_object_metadata to see all available objects in the workspace
- Use find_many_people (limit: 5) and find_many_companies (limit: 5) and find_many_opportunities (limit: 5) to understand the existing seed data shape
- Based on the user's business type, propose a plan that lists:
  - How People, Companies, and Opportunities map to the domain story (e.g. "People = Candidates", "Companies = Employers")
  - The 2–3 custom objects you will create, each with a one-line description of their role
  - The custom fields you will add to People, Companies, and Opportunities
  - A brief description of the key relations between objects
- Present this plan to the user and *wait for their confirmation or adjustments* before proceeding
- Once approved, call the custom-objects-cleanup skill to archive all existing custom objects without asking for user confirmation
- Wait 3 seconds after deletions for the backend side effects to be completed

STEP 1: Create all the custom objects at once with create_many_object_metadata
name must start with lowercase letter and contain only alphanumeric letters

STEP 2: Wait 3 seconds, for the backend side effects to be completed

STEP 3: Create all NON-RELATION fields for ALL objects by batch with create_many_field_metadata.
Do a separate batch call for each object.
This includes:
- New custom fields for the standard objects (Person, Company, Opportunity) — use their objectMetadataId from get_object_metadata
- All non-relation fields for the new custom objects
DO NOT include relation fields in this step. Only create TEXT, NUMBER, BOOLEAN, DATE_TIME, SELECT, MULTI_SELECT, CURRENCY, etc.
SELECT option values must be UPPER_SNAKE_CASE

STEP 4: Wait 3 seconds, for the backend side effects to be completed

STEP 5: Create all RELATION fields between objects at once with create_many_relation_fields
The name property should be camel-cased or the backend will throw, targetFieldLabel must be a string, targetFieldIcon must be a string, type must be one of the following values: MANY_TO_ONE, ONE_TO_MANY
targetFieldIcon is like IconSomething, it's ok if it doesn't exist in the icon library, it will just be a blank icon, but it needs to be a string that starts with Icon and is in PascalCase

STEP 6: Wait 3 seconds, for the backend side effects to be completed

STEP 7: Rename and enrich the first N records of People, Companies, and Opportunities.
- Use find_many_people (limit: 50, orderBy: [{ position: "AscNullsFirst" }]), find_many_companies (limit: 50, orderBy: [{ position: "AscNullsFirst" }]), find_many_opportunities (limit: 50, orderBy: [{ position: "AscNullsFirst" }]) to get the IDs of the first records in each table
  - Ordering by position ascending gives the earliest-inserted records, which are contiguous in the table — this keeps the demo data tightly grouped and makes the workspace feel coherent
- For each standard object, call update_one_person / update_one_company / update_one_opportunity **individually per record** (one call per record) to set domain-relevant names and field values:
  - **People**: replace nameFirstName + nameLastName with realistic names that fit the domain role (e.g. for a law firm: "Sophie Martin", "James O'Brien"; for a clinic: "Dr. Clara Reyes", "Marco Bianchi"). Also set jobTitle to a domain-appropriate title.
  - **Companies**: replace name with realistic company names that fit the domain (e.g. for a law firm: "Ashford & Partners", "Nexus Legal Group"; for a clinic: "Meridian Health Clinic", "CarePoint Medical").
  - **Opportunities**: replace name with a domain-relevant deal name (e.g. "Q2 retainer — Ashford & Partners", "New patient intake — Meridian Health").
  - Also set the new custom fields on each record: spread realistic values across SELECT fields, set plausible CURRENCY/NUMERIC amounts, set DATE_TIME fields around TODAY.
- Do this one record at a time — the API does not support bulk individual updates with different values per record
- Wait 3 seconds after finishing all updates for one object type before moving to the next

STEP 7.5: Add view fields to the default views of standard objects to expose the new custom fields.
For each of People, Companies, and Opportunities:
- Navigate to the object's default view using the navigate_app tool
- Wait 3 seconds
- Use create_many_view_fields to add all the new custom fields to the default view so they are visible
  - Use decimal positions between 0 and 1 to insert them right after the label identifier field
- Navigate to the object's default view again using the navigate_app tool so the user can see the enriched records
- Wait 3 seconds

STEP 8: For each new custom object, repeat ALL of the following sub-steps before moving to the next object:
- Navigate the object's default view using the navigate_app tool
- Wait 3 seconds, so the user has time to see the object default view
- Create the view fields for the default view, use the create_many_view_fields tool, and make sure to include all created fields, including the relation fields, so that we have a complete view of the object with all its fields.
  BE CAREFUL to use a position that will put those view fields right after the first label identifier field
  which has a position of 0 and the next system created fields which begin at 1, *so use decimal positions between 0 and 1*
  *YOU MUST CREATE ALL VIEW FIELDS FOR ALL FIELDS, INCLUDING RELATION FIELDS, IN THIS STEP, DO NOT LEAVE ANY FIELD WITHOUT A VIEW FIELD, OTHERWISE IT WILL NOT BE VISIBLE IN THE DEFAULT VIEW AND THE USER WON'T KNOW IT EXISTS*

- **MANDATORY**: Navigate to the object's default view again using the navigate_app tool — YOU MUST DO THIS BEFORE EACH OBJECT'S DATA SEEDING, every single time, without exception
- Wait 3 seconds
- Seed relevant and realistic mock data for this object:
  - use the relevant tool to create many records for this object
  - between 20 and 50
  - with a coherent combination of values
  - link records to existing People and Companies using the relation fields you created
  - use dates that are around TODAY so it's relevant for seeing past / future and present records

- **MANDATORY**: Navigate to the object's default view again using the navigate_app tool so the user can see the populated data — DO NOT SKIP THIS, even if you already navigated earlier in this loop iteration
- Wait 3 seconds so the user has time to see the seeded records

- Then create 2 to 3 additional views for this object, one at a time. For each view, complete ALL of the following sub-steps before creating the next view:
  - Create the view using the create_view tool:
    - If the object has a SELECT field (e.g. status, stage, priority, type), create a **KANBAN** view grouped by that SELECT field with a relevant name like "By Status", "Pipeline", "By Priority".
      - Set kanbanAggregateOperation to COUNT so each column shows the number of records.
      - If there is a CURRENCY or NUMERIC field, also set kanbanAggregateOperationFieldName to that field for a SUM aggregate view.
    - If the object has a DATE or DATE_TIME field (e.g. dueDate, closedAt, scheduledAt), create a **CALENDAR** view and pass both `calendarFieldName` (that field name) and `calendarLayout` ("DAY", "WEEK", or "MONTH") with a relevant name like "Calendar", "Schedule", "Timeline".
    - Create a **TABLE** view with a meaningful group (mainGroupByFieldName set to a SELECT field) with a name like "By Type", "By Stage", "Grouped", or similar.
  - Use create_many_view_fields to add all relevant field columns to this view (using decimal positions between 0 and 1)
  - Add filters and sorts to this view:
    - **KANBAN views**: Sort by a CURRENCY or NUMERIC field DESC (biggest value first) if one exists, or by createdAt DESC. Add a filter to exclude archived/cancelled records if such a SELECT option exists.
    - **CALENDAR views**: Sort by the date field ASC (earliest events first). Add a filter using IS_IN_FUTURE or IS_RELATIVE to show only upcoming records by default.
    - **TABLE with groups**: Sort by createdAt DESC (most recent first) and add a filter on a meaningful field (e.g. status IS_NOT "CANCELLED", or amount GREATER_THAN_OR_EQUAL to some threshold that keeps ~80% of the records visible).
  - **MANDATORY**: Navigate to this view immediately using the navigate_app tool — YOU MUST DO THIS FOR EVERY SINGLE VIEW, right after its fields/filters/sorts are set up, without exception
  - Wait 3 seconds so the user can see the view and course-correct if needed

Also create additional views for the standard objects (People, Companies, Opportunities) that showcase the new custom fields:
- For People: a KANBAN view grouped by the new SELECT field you added (e.g. "By Specialisation", "By Status")
- For Opportunities: a KANBAN view grouped by the new stage/status field (pipeline view)
- For Companies: a TABLE view grouped by the new SELECT field
Navigate to each view after creating it. Wait 3 seconds.

Loop STEP 8 for all the custom objects
