export const ColumnType = {
  empty: 'empty',
  ignored: 'ignored',
  matched: 'matched',
  matchedCheckbox: 'matchedCheckbox',
  matchedSelect: 'matchedSelect',
  matchedSelectOptions: 'matchedSelectOptions',
} as const;

export type MatchedOptions<T> = {
  entry: string;
  value?: T;
};

type EmptyColumn = { type: typeof ColumnType.empty; index: number; header: string };

type IgnoredColumn = {
  type: typeof ColumnType.ignored;
  index: number;
  header: string;
};

type MatchedColumn<T> = {
  type: typeof ColumnType.matched;
  index: number;
  header: string;
  value: T;
};

type MatchedSwitchColumn<T> = {
  type: typeof ColumnType.matchedCheckbox;
  index: number;
  header: string;
  value: T;
};

export type MatchedSelectColumn<T> = {
  type: typeof ColumnType.matchedSelect;
  index: number;
  header: string;
  value: T;
  matchedOptions: Partial<MatchedOptions<T>>[];
};

export type MatchedSelectOptionsColumn<T> = {
  type: typeof ColumnType.matchedSelectOptions;
  index: number;
  header: string;
  value: T;
  matchedOptions: MatchedOptions<T>[];
};

export type Column<T extends string> =
  | EmptyColumn
  | IgnoredColumn
  | MatchedColumn<T>
  | MatchedSwitchColumn<T>
  | MatchedSelectColumn<T>
  | MatchedSelectOptionsColumn<T>;

export type Columns<T extends string> = Column<T>[];
