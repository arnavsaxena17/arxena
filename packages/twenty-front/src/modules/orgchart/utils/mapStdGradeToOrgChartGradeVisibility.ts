import {
  DEFAULT_ORG_CHART_GRADE_VISIBILITY,
  type OrgChartGradeVisibility,
} from 'twenty-shared/utils';

// Map resolved std_grade into org-chart grade-tier visibility for client filter.
export const mapStdGradeToOrgChartGradeVisibility = (
  stdGrade?: string,
): OrgChartGradeVisibility => {
  const grade = (stdGrade ?? '').trim().toLowerCase();

  if (
    grade === 'leadership' ||
    grade === 'ceo' ||
    grade === 'senior'
  ) {
    return {
      leadership: true,
      managers: false,
      executives: false,
    };
  }

  if (grade === 'mid') {
    return {
      leadership: false,
      managers: true,
      executives: false,
    };
  }

  if (grade === 'entry') {
    return {
      leadership: false,
      managers: false,
      executives: true,
    };
  }

  return DEFAULT_ORG_CHART_GRADE_VISIBILITY;
};
