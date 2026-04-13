/**
 * Minimal shape checks for transformed candidate rows (job datatable / stream).
 */
export function assertCandidateRowHasTableFields(row: Record<string, unknown>): void {
  const hasName =
    (typeof row.name === 'string' && row.name.trim().length > 0) ||
    (typeof row.full_name === 'string' && row.full_name.trim().length > 0) ||
    (typeof row.fullName === 'string' && row.fullName.trim().length > 0);
  if (!hasName) {
    throw new Error(
      'Candidate row missing name / full_name / fullName for table display',
    );
  }
}
