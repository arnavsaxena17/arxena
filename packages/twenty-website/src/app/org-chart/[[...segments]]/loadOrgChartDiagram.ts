const ORG_CHART_DIAGRAM_LOAD_MAX_ATTEMPTS = 4;
const ORG_CHART_DIAGRAM_LOAD_RETRY_MS = 350;

export const loadOrgChartDiagramComponent = async () => {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= ORG_CHART_DIAGRAM_LOAD_MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      const mod = await import('twenty-orgchart');
      return mod.OrgChartDiagram;
    } catch (error) {
      lastError = error;
      console.error(
        `OrgChartDiagram chunk load attempt ${attempt} failed`,
        error,
      );

      if (attempt < ORG_CHART_DIAGRAM_LOAD_MAX_ATTEMPTS) {
        await new Promise((resolve) => {
          window.setTimeout(
            resolve,
            ORG_CHART_DIAGRAM_LOAD_RETRY_MS * attempt,
          );
        });
      }
    }
  }

  throw lastError;
};
