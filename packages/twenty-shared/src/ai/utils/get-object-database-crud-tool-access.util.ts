import {
  DATABASE_CRUD_TOOL_ACCESS,
  OBJECT_DATABASE_CRUD_TOOL_ACCESS,
  type DatabaseCrudToolAccess,
} from '../constants/object-database-crud-tool-access.const';

export const getObjectDatabaseCrudToolAccess = ({
  nameSingular,
}: {
  nameSingular: string;
}): DatabaseCrudToolAccess => {
  return (
    OBJECT_DATABASE_CRUD_TOOL_ACCESS[
      nameSingular as keyof typeof OBJECT_DATABASE_CRUD_TOOL_ACCESS
    ] ?? DATABASE_CRUD_TOOL_ACCESS.ALL
  );
};

export const canExposeDatabaseCrudReadTools = ({
  nameSingular,
}: {
  nameSingular: string;
}): boolean => {
  return (
    getObjectDatabaseCrudToolAccess({ nameSingular }) !==
    DATABASE_CRUD_TOOL_ACCESS.NONE
  );
};

export const canExposeDatabaseCrudWriteTools = ({
  nameSingular,
}: {
  nameSingular: string;
}): boolean => {
  return (
    getObjectDatabaseCrudToolAccess({ nameSingular }) ===
    DATABASE_CRUD_TOOL_ACCESS.ALL
  );
};
