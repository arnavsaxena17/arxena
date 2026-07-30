// Controls which database CRUD tools appear in the AI / MCP tool catalog
// (and which operations execute_tool may run) for a given object nameSingular.
// Objects omitted here default to 'all'.
//
// - 'all'  — find + create/update/delete/upsert (still gated by automation blocks)
// - 'read' — find_many / find_one / group_by only
// - 'none' — no database CRUD tools for this object
export const DATABASE_CRUD_TOOL_ACCESS = {
  ALL: 'all',
  READ: 'read',
  NONE: 'none',
} as const;

export type DatabaseCrudToolAccess =
  (typeof DATABASE_CRUD_TOOL_ACCESS)[keyof typeof DATABASE_CRUD_TOOL_ACCESS];

export const OBJECT_DATABASE_CRUD_TOOL_ACCESS = {
  videoInterview: DATABASE_CRUD_TOOL_ACCESS.NONE,
  videoInterviewResponse: DATABASE_CRUD_TOOL_ACCESS.NONE,
  videoInterviewQuestion: DATABASE_CRUD_TOOL_ACCESS.NONE,
  videoInterviewTemplate: DATABASE_CRUD_TOOL_ACCESS.NONE,
  videoInterviewModel: DATABASE_CRUD_TOOL_ACCESS.NONE,
  orgChart: DATABASE_CRUD_TOOL_ACCESS.READ,
} as const satisfies Record<string, DatabaseCrudToolAccess>;
