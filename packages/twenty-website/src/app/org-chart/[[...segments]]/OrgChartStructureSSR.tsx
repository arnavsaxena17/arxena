import {
  OrgChartNodeData,
  isMaskedName,
} from 'twenty-shared/utils';

type TreeNode = OrgChartNodeData & { children: TreeNode[] };

function buildTree(nodes: OrgChartNodeData[]): TreeNode[] {
  const byKey = new Map<number, TreeNode>();
  for (const node of nodes) {
    byKey.set(node.key, { ...node, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of nodes) {
    const treeNode = byKey.get(node.key)!;
    const parentKey = node.parent;
    if (parentKey === undefined || parentKey === 0) {
      roots.push(treeNode);
    } else {
      const parent = byKey.get(parentKey);
      if (parent) parent.children.push(treeNode);
      else roots.push(treeNode);
    }
  }
  return roots;
}

function getPeopleFromNode(
  node: OrgChartNodeData,
  excludeMaskedNames: boolean,
): { name: string; title: string }[] {
  const people: { name: string; title: string }[] = [];
  for (let i = 0; i < 4; i++) {
    const name = node[`name_${i}`];
    const title = node[`title_${i}`];
    const nameStr =
      name !== undefined && name !== null && name !== ''
        ? String(name).trim()
        : '';
    const titleStr =
      title !== undefined && title !== null && title !== ''
        ? String(title).trim()
        : '';
    if (nameStr || titleStr) {
      if (excludeMaskedNames && nameStr && isMaskedName(nameStr)) {
        continue;
      }
      people.push({ name: nameStr, title: titleStr });
    }
  }
  return people;
}

function OrgChartNodeList({ node }: { node: TreeNode }) {
  const people = getPeopleFromNode(node, true);

  return (
    <li>
      <span className="org-role">{node.headline}</span>
      {people.length > 0 && (
        <ul aria-label={`People in ${node.headline}`}>
          {people.map((p, i) => (
            <li key={i}>
              {p.name && <strong>{p.name}</strong>}
              {p.name && p.title && ' — '}
              {p.title && <span>{p.title}</span>}
            </li>
          ))}
        </ul>
      )}
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <OrgChartNodeList key={child.key} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

type OrgChartStructureSSRProps = {
  nodeDataArray: OrgChartNodeData[];
  companyName: string;
  locationName?: string;
  industry?: string;
  country?: string;
  functionRoot?: string;
};

export function OrgChartStructureSSR({
  nodeDataArray,
  companyName,
  locationName,
  industry,
  country,
  functionRoot,
}: OrgChartStructureSSRProps) {
  if (nodeDataArray.length === 0) return null;

  const tree = buildTree(nodeDataArray);

  const employees = nodeDataArray.flatMap((node) => {
    const people = getPeopleFromNode(node, true);
    return people
      .filter((p) => p.name || p.title)
      .map((p) => ({
        '@type': 'Person' as const,
        name: p.name || undefined,
        jobTitle: p.title || undefined,
        worksFor: {
          '@type': 'Organization' as const,
          name: companyName,
        },
      }));
  });

  const descParts = [
    `Org structure and organization structure of ${companyName}.`,
    `View ${companyName} executive team, leadership, management hierarchy, HR team, departments.`,
  ];
  if (functionRoot) {
    descParts.push(`${companyName} ${functionRoot} team.`);
  }
  if (country || locationName) {
    descParts.push(`${companyName} ${country ?? locationName ?? ''} office.`);
  }
  descParts.push('Recruitment, talent mapping, people analytics.');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: companyName,
    description: descParts.join(' '),
    ...(industry && { industry }),
    ...((country || locationName) && {
      areaServed: {
        '@type': 'Place' as const,
        name: country ?? locationName,
      },
    }),
    ...(employees.length > 0 && { employee: employees }),
  };

  return (
    <section
      aria-label={`${companyName} leadership, management and team structure`}
      style={{
        padding: '24px 0',
        borderTop: '1px solid #e5e5e5',
        marginTop: 24,
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h2 style={{ fontSize: '1.25rem', marginBottom: 16 }}>
        {companyName} Leadership &amp; Team Structure
      </h2>
      <nav aria-label="Organization hierarchy">
        <ol style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
          {tree.map((node) => (
            <OrgChartNodeList key={node.key} node={node} />
          ))}
        </ol>
      </nav>
    </section>
  );
}
