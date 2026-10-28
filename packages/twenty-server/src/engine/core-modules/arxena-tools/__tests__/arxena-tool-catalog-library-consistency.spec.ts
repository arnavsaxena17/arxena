import { ARXENA_TOOL_CATALOG } from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-catalog.const';
import { UNLISTED_LIBRARY_TOOLS } from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-listing.const';
import { allTools } from 'src/engine/core-modules/arxena-tools/library/tools/index';

describe('Arxena tool catalog and library', () => {
  const libraryToolNames = new Set<string>(
    allTools.map((tool) => tool.definition.name),
  );
  const catalogToolNames = new Set(
    ARXENA_TOOL_CATALOG.map((entry) => entry.name),
  );
  it('should have a library handler for every catalog tool', () => {
    expect(
      [...catalogToolNames].filter((name) => !libraryToolNames.has(name)),
    ).toEqual([]);
  });

  it('should list every other library tool as deliberately unlisted', () => {
    expect(
      [...libraryToolNames]
        .filter(
          (name) =>
            !catalogToolNames.has(name) && !UNLISTED_LIBRARY_TOOLS.has(name),
        )
        .sort(),
    ).toEqual([]);
  });

  it('should not keep an unlisted entry for a tool that no longer exists', () => {
    expect(
      [...UNLISTED_LIBRARY_TOOLS].filter((name) => !libraryToolNames.has(name)),
    ).toEqual([]);
  });
});
