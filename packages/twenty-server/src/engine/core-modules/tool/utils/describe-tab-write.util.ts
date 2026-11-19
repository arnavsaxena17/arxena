export type TabWriteCounts = {
  newRows: number;
  alreadyOnTab: number;
};

// The tab upsert merges a row into one that is already there (same LinkedIn
// URL, or same name and company). A merged row is not a find, so a search
// reports both counts: rows written alone made an old tab look like new results
export const toTabWriteCounts = ({
  createdCount,
  updatedCount,
}: {
  createdCount: number;
  updatedCount: number;
}): TabWriteCounts => ({
  newRows: createdCount,
  alreadyOnTab: updatedCount,
});

export const describeTabWrite = (
  { newRows, alreadyOnTab }: TabWriteCounts,
  tab: 'people' | 'companies',
): string => {
  const rowWord = (count: number) => (count === 1 ? 'row' : 'rows');

  if (newRows === 0 && alreadyOnTab === 0) {
    return `Nothing was written to the ${tab} tab.`;
  }

  if (newRows === 0) {
    return `0 new ${tab} on the tab: all ${alreadyOnTab} ${rowWord(alreadyOnTab)} were already there, so this search found no one new. Report newRows, not the tab total.`;
  }

  return `${newRows} new ${rowWord(newRows)} added to the ${tab} tab; ${alreadyOnTab} ${rowWord(alreadyOnTab)} were already there. Report newRows, not the tab total.`;
};
