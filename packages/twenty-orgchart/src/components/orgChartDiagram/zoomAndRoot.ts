import * as go from 'gojs';

const normStr = (v: unknown): string =>
  typeof v === 'string' ? v.trim().toLowerCase() : '';

const parentKeyOnData = (d: go.ObjectData): go.Key | undefined => {
  const p = d.parent;
  if (p === undefined || p === null) return undefined;
  return p as go.Key;
};

const isRootNodeData = (model: go.TreeModel, d: go.ObjectData): boolean => {
  const pk = parentKeyOnData(d);
  if (pk === undefined) return true;
  return model.findNodeDataForKey(pk) === null;
};

const countSubtreeNodes = (model: go.TreeModel, rootKey: go.Key): number => {
  const childrenByParent = new Map<go.Key, go.Key[]>();
  for (const d of model.nodeDataArray) {
    const k = d.key as go.Key;
    const pk = parentKeyOnData(d);
    if (pk === undefined) continue;
    if (model.findNodeDataForKey(pk) === null) continue;
    const list = childrenByParent.get(pk) ?? [];
    list.push(k);
    childrenByParent.set(pk, list);
  }
  let n = 0;
  const stack: go.Key[] = [rootKey];
  const seen = new Set<go.Key>();
  while (stack.length > 0) {
    const k = stack.pop()!;
    if (seen.has(k)) continue;
    seen.add(k);
    n += 1;
    const ch = childrenByParent.get(k);
    if (ch) {
      for (let i = 0; i < ch.length; i += 1) stack.push(ch[i]!);
    }
  }
  return n;
};

const pickOrgChartRootData = (model: go.TreeModel): go.ObjectData | null => {
  const roots = model.nodeDataArray.filter((d) => isRootNodeData(model, d));
  if (roots.length === 0) return null;
  if (roots.length === 1) return roots[0]!;

  const ceoByStd = roots.find(
    (d) => normStr(d.std_function) === 'ceo' && normStr(d.std_grade) === 'ceo',
  );
  if (ceoByStd) return ceoByStd;

  const ceoByHeadline = roots.find((d) => {
    const h = normStr(d.headline);
    return (
      /\bceo\b/u.test(h) ||
      h.includes('chief executive') ||
      h.includes('ceo leadership')
    );
  });
  if (ceoByHeadline) return ceoByHeadline;

  let best = roots[0]!;
  let bestCount = countSubtreeNodes(model, best.key as go.Key);
  for (let i = 1; i < roots.length; i += 1) {
    const r = roots[i]!;
    const c = countSubtreeNodes(model, r.key as go.Key);
    if (c > bestCount) {
      best = r;
      bestCount = c;
    }
  }
  return best;
};

export const getOrgChartRootNode = (diagram: go.Diagram): go.Node | null => {
  const { model } = diagram;
  if (model instanceof go.TreeModel) {
    const data = pickOrgChartRootData(model);
    if (data !== null) {
      const node = diagram.findNodeForKey(data.key as go.Key);
      if (node) return node;
    }
  }
  const fromTree = diagram.findTreeRoots().first();
  if (fromTree) return fromTree;
  return diagram.nodes.first();
};

export const applyZoomAroundNode = (
  diagram: go.Diagram,
  node: go.Node,
): boolean => {
  const key = node.data?.key as go.Key | undefined;
  const part = key !== undefined ? diagram.findNodeForKey(key) : node;
  if (!part || !(part instanceof go.Node)) return false;

  const raw = part.actualBounds;
  if (raw.width < 4 || raw.height < 4) return false;

  const padded = raw.copy().inflate(140, 140);
  diagram.zoomToRect(padded, go.AutoScale.Uniform);
  diagram.centerRect(part.actualBounds);

  const lo = diagram.minScale;
  const hi = diagram.maxScale;
  const nextScale = Math.max(lo, Math.min(hi, diagram.scale * 0.5));
  diagram.scale = nextScale;
  diagram.centerRect(part.actualBounds);
  diagram.commandHandler.scrollToPart(part);

  const vb = diagram.viewportBounds;
  if (vb.height > 0 && Number.isFinite(vb.height)) {
    const nudgeY = vb.height * 0.3;
    const pos = diagram.position;
    diagram.position = new go.Point(pos.x, pos.y + nudgeY);
  }

  return true;
};

