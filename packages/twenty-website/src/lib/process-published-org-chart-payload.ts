import {
  extractOrgData,
  getProxiedImageUrl,
  processOrgChartToNodeData,
  OrgChartNodeData,
} from 'twenty-shared';

const proxyCandidateImageFields = (
  candidate: Record<string, unknown>,
  apiBase: string,
): Record<string, unknown> => {
  const out = { ...candidate };
  for (const key of ['image', 'profile_picture_url', 'profilePictureUrl']) {
    const value = out[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      out[key] = getProxiedImageUrl(value, apiBase);
    }
  }
  return out;
};

export const proxyOrgChartNodeImages = (
  node: OrgChartNodeData,
  apiBase: string,
): OrgChartNodeData => {
  const out = { ...node } as OrgChartNodeData;
  for (let i = 0; i < 16; i += 1) {
    const key = `image_${i}` as keyof OrgChartNodeData;
    const value = out[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      (out as Record<string, string>)[key] = getProxiedImageUrl(value, apiBase);
    }
  }

  const allCandidates = out.allCandidates;
  if (Array.isArray(allCandidates)) {
    out.allCandidates = allCandidates.map((candidate) => {
      if (
        candidate &&
        typeof candidate === 'object' &&
        !Array.isArray(candidate)
      ) {
        return proxyCandidateImageFields(
          candidate as Record<string, unknown>,
          apiBase,
        );
      }
      return candidate;
    });
  }

  return out;
};

export const processPublishedOrgChartPayload = (
  rawData: Record<string, unknown>,
  apiBase: string,
): {
  orgData: ReturnType<typeof extractOrgData>;
  nodeDataArray: OrgChartNodeData[];
} => {
  const orgData = extractOrgData(rawData);
  const rawNodeDataArray = orgData ? processOrgChartToNodeData(orgData) : [];
  const nodeDataArray = rawNodeDataArray.map((node) =>
    proxyOrgChartNodeImages(node, apiBase),
  );

  return { orgData, nodeDataArray };
};
