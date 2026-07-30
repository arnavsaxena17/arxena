import { DATABASE_CRUD_TOOL_ACCESS } from '@/ai/constants/object-database-crud-tool-access.const';
import {
  canExposeDatabaseCrudReadTools,
  canExposeDatabaseCrudWriteTools,
  getObjectDatabaseCrudToolAccess,
} from '@/ai/utils/get-object-database-crud-tool-access.util';

describe('getObjectDatabaseCrudToolAccess', () => {
  it('defaults to all for unspecified objects', () => {
    expect(getObjectDatabaseCrudToolAccess({ nameSingular: 'candidate' })).toBe(
      DATABASE_CRUD_TOOL_ACCESS.ALL,
    );
  });

  it('returns none for video interview objects', () => {
    expect(
      getObjectDatabaseCrudToolAccess({ nameSingular: 'videoInterview' }),
    ).toBe(DATABASE_CRUD_TOOL_ACCESS.NONE);
    expect(
      getObjectDatabaseCrudToolAccess({
        nameSingular: 'videoInterviewTemplate',
      }),
    ).toBe(DATABASE_CRUD_TOOL_ACCESS.NONE);
  });

  it('returns read for orgChart', () => {
    expect(getObjectDatabaseCrudToolAccess({ nameSingular: 'orgChart' })).toBe(
      DATABASE_CRUD_TOOL_ACCESS.READ,
    );
  });
});

describe('canExposeDatabaseCrudReadTools / WriteTools', () => {
  it('exposes neither for none', () => {
    expect(
      canExposeDatabaseCrudReadTools({ nameSingular: 'videoInterview' }),
    ).toBe(false);
    expect(
      canExposeDatabaseCrudWriteTools({ nameSingular: 'videoInterview' }),
    ).toBe(false);
  });

  it('exposes read only for orgChart', () => {
    expect(canExposeDatabaseCrudReadTools({ nameSingular: 'orgChart' })).toBe(
      true,
    );
    expect(canExposeDatabaseCrudWriteTools({ nameSingular: 'orgChart' })).toBe(
      false,
    );
  });

  it('exposes both for default objects', () => {
    expect(canExposeDatabaseCrudReadTools({ nameSingular: 'person' })).toBe(
      true,
    );
    expect(canExposeDatabaseCrudWriteTools({ nameSingular: 'person' })).toBe(
      true,
    );
  });
});
