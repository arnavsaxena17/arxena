import { useMemo } from 'react';

import {
    getProxiedImageUrl,
    type OrgChartNodeData,
    processOrgChartToNodeData,
} from 'twenty-shared';

const readImageFromRawCandidate = (
  raw?: Record<string, unknown>,
  fallback?: string,
): string => {
  if (!raw) return fallback ?? '';

  const candidateImage = raw.image;
  const profilePictureUrl = raw.profile_picture_url;
  const pictureUrl = raw.picture_url;
  const picture = raw.picture;

  const candidates = [candidateImage, profilePictureUrl, pictureUrl, picture];
  const found = candidates.find(
    (value) => {
      if (typeof value !== 'string') return false;
      const trimmed = value.trim();
      if (!trimmed) return false;
      const lowered = trimmed.toLowerCase();
      return lowered !== 'null' && lowered !== 'undefined' && lowered !== 'none' && lowered !== '0';
    },
  );

  return found && typeof found === 'string' ? found : (fallback ?? '');
};

export const PERSON_ROW_HEIGHT = 48;

const sanitizeTreeNodeDataArray = (
  nodes: OrgChartNodeData[],
): OrgChartNodeData[] => {
  const byKey = new Map<number, OrgChartNodeData>();
  const sanitized: OrgChartNodeData[] = [];

  for (const node of nodes) {
    if (typeof node.key !== 'number') {
      continue;
    }
    if (byKey.has(node.key)) {
      continue;
    }
    const cloned = { ...node } as OrgChartNodeData;
    byKey.set(cloned.key, cloned);
    sanitized.push(cloned);
  }

  for (const node of sanitized) {
    const parent = node.parent;
    if (typeof parent !== 'number') {
      node.parent = undefined;
      continue;
    }
    if (parent === node.key || !byKey.has(parent)) {
      node.parent = undefined;
      continue;
    }

    const visited = new Set<number>([node.key]);
    let cursor = parent;
    let hasCycle = false;

    while (typeof cursor === 'number') {
      if (visited.has(cursor)) {
        hasCycle = true;
        break;
      }
      visited.add(cursor);
      const parentNode = byKey.get(cursor);
      if (!parentNode || typeof parentNode.parent !== 'number') {
        break;
      }
      cursor = parentNode.parent;
    }

    if (hasCycle) {
      node.parent = undefined;
    }
  }

  return sanitized;
};

export const useOrgChartNodeDataArray = ({
  orgData,
  enrichedNodes,
  baseUrl,
}: {
  orgData: Record<string, unknown> | null;
  enrichedNodes: Record<
    string,
    { people: Array<{ fullName: string; headline: string; linkedinUrl?: string; email?: string; phone?: string; raw?: unknown }>; nodeState: OrgChartNodeData['nodeState'] }
  >;
  baseUrl: string;
}): OrgChartNodeData[] => {
  return useMemo(() => {
    if (!orgData) return [];
    const base = sanitizeTreeNodeDataArray(processOrgChartToNodeData(orgData));
    const apiBase = baseUrl.replace(/\/$/, '');
    const rewriteImage = (url: string) => getProxiedImageUrl(url, apiBase);

    if (Object.keys(enrichedNodes).length === 0) {
      return base.map((node) => {
        const out = { ...node } as OrgChartNodeData;
        for (let i = 0; i < 4; i++) {
          const key = `image_${i}` as keyof OrgChartNodeData;
          const val = out[key];
          if (typeof val === 'string' && val) {
            (out as Record<string, string>)[key] = rewriteImage(val);
          }
        }
        return out;
      });
    }

    return base.map((node) => {
      const enriched = enrichedNodes[String(node.key)];
      if (!enriched) {
        const out = { ...node } as OrgChartNodeData;
        for (let i = 0; i < 4; i++) {
          const key = `image_${i}` as keyof OrgChartNodeData;
          const val = out[key];
          if (typeof val === 'string' && val) {
            (out as Record<string, string>)[key] = rewriteImage(val);
          }
        }
        return out;
      }

      const merged = { ...node } as OrgChartNodeData;
      const displayedCount = Math.min(enriched.people.length, 4);
      const totalCount = enriched.people.length;

      enriched.people.slice(0, 4).forEach((p, i) => {
        merged[`name_${i}`] = p.fullName;
        merged[`title_${i}`] = p.headline;
        merged[`linkedin_url_${i}`] = p.linkedinUrl ?? '';
        merged[`email_${i}`] = p.email ?? '';
        merged[`phone_${i}`] = p.phone ?? '';
        const existingImage = merged[`image_${i}`];
        const mergedImage =
          typeof existingImage === 'string' ? existingImage : undefined;
        const enrichedImage = readImageFromRawCandidate(
          (p.raw as Record<string, unknown>) ?? undefined,
          mergedImage,
        );
        merged[`image_${i}`] = rewriteImage(enrichedImage || '') || enrichedImage;
      });
      merged.height_0 = displayedCount >= 1 ? PERSON_ROW_HEIGHT : 0;
      merged.height_1 = displayedCount >= 2 ? PERSON_ROW_HEIGHT : 0;
      merged.height_2 = displayedCount >= 3 ? PERSON_ROW_HEIGHT : 0;
      merged.height_3 = displayedCount >= 4 ? PERSON_ROW_HEIGHT : 0;
      merged.nodeState = enriched.nodeState;
      merged.total_people = totalCount;
      return merged;
    });
  }, [orgData, enrichedNodes, baseUrl]);
};

