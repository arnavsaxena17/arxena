import {
  extractOrgData,
  getProxiedImageUrl,
  processOrgChartToNodeData,
  OrgChartNodeData,
} from 'twenty-shared';

export const processPublishedOrgChartPayload = (
  rawData: Record<string, unknown>,
  apiBase: string,
): {
  orgData: ReturnType<typeof extractOrgData>;
  nodeDataArray: OrgChartNodeData[];
} => {
  const orgData = extractOrgData(rawData);
  const rawNodeDataArray = orgData ? processOrgChartToNodeData(orgData) : [];
  const nodeDataArray = rawNodeDataArray.map((node) => {
    const out = { ...node } as OrgChartNodeData;
    for (let i = 0; i < 4; i++) {
      const key = `image_${i}` as keyof OrgChartNodeData;
      const val = out[key];
      if (typeof val === 'string' && val) {
        (out as Record<string, string>)[key] = getProxiedImageUrl(val, apiBase);
      }
    }
    return out;
  });

  return { orgData, nodeDataArray };
};
