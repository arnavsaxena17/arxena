const BASE = process.env.BACKEND_BASE_URL || 'http://localhost:3000';
const COMPANY = 'litify';

async function jget(label, url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch {}

  const out = {
    label,
    url,
    status: res.status,
    ok: res.ok,
  };

  if (body?.result) {
    out.count_org = body.result.count_org ?? null;
    out.country = body.result.country ?? null;
    out.type = body.result.type ?? null;
    try {
      const org = JSON.parse(body.result.orgchart || '[]');
      out.org_nodes = org.length;
      out.leadership_nodes = org.filter((n) => (n?.std_grade_category || '').toLowerCase() === 'senior').length;
      out.function_roots = [...new Set(org.map((n) => (n?.std_function_root || '').toLowerCase()).filter(Boolean))].slice(0, 20);
    } catch {
      out.org_nodes = null;
    }
  }
  return out;
}

(async () => {
  const calls = [
    {
      label: 'preview render load (base org chart route)',
      url: `${BASE}/org-chart/${COMPANY}`,
    },
    {
      label: 'full org chart load / full company selected / global',
      url: `${BASE}/org-chart/${COMPANY}?country=global&functionRoot=fullcompany`,
    },
    {
      label: 'leadership load (derived from fullcompany response)',
      url: `${BASE}/org-chart/${COMPANY}?country=global&functionRoot=fullcompany`,
    },
    {
      label: 'technology function load',
      url: `${BASE}/org-chart/${COMPANY}?country=global&functionRoot=technology`,
    },
    {
      label: 'hr function load (global)',
      url: `${BASE}/org-chart/${COMPANY}?country=global&functionRoot=human+resources`,
    },
    {
      label: 'hr function load (united states)',
      url: `${BASE}/org-chart/${COMPANY}?country=united+states&functionRoot=human+resources`,
    },
    {
      label: 'company employee count by linkedin url',
      url: `${BASE}/org-chart/companies/employee-count?linkedinUrl=https%3A%2F%2Fwww.linkedin.com%2Fcompany%2Flitify%2F`,
    },
  ];

  const results = [];
  for (const c of calls) {
    try {
      results.push(await jget(c.label, c.url));
    } catch (e) {
      results.push({ label: c.label, url: c.url, ok: false, error: String(e) });
    }
  }

  // Explicit HR leadership node presence check (backend data availability for node action attempt)
  const full = results.find((r) => r.label.includes('full org chart'));
  let hrLeadershipAvailable = null;
  try {
    const res = await fetch(`${BASE}/org-chart/${COMPANY}?country=global&functionRoot=fullcompany`, {
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json();
    const org = JSON.parse(body?.result?.orgchart || '[]');
    hrLeadershipAvailable = org.some((n) => String(n?.headline || '').toLowerCase().includes('human resources leadership'));
  } catch {}

  const summary = {
    backend: BASE,
    company: COMPANY,
    hrLeadershipNodePresentInBackendData: hrLeadershipAvailable,
    results,
  };

  console.log(JSON.stringify(summary, null, 2));
})();
