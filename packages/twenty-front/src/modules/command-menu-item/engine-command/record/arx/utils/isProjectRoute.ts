export const isProjectRoute = (pathname: string): boolean => {
  return pathname.includes('/project/') || pathname.includes('/job/');
};

export const getProjectIdFromPathname = (
  pathname: string,
): string | undefined => {
  const projectMatch = pathname.split('/project/')[1]?.split('/')[0];
  if (projectMatch) {
    return projectMatch;
  }

  return pathname.split('/job/')[1]?.split('/')[0];
};
