// The campaigns the golden sets were labelled against. In production this text
// comes from the filter's own criteria plus the workspace ICP at run time.
// Each subject gets its own context: company facts go to the company filter,
// title and location facts to the people filter.
export const GOLDEN_COMPANY_CONTEXT = [
  'Sender company: Arxena',
  'What the sender sells: AI outbound sales agents for B2B software companies',
  'Ideal customer: B2B software / SaaS product companies with 50 to 1000 employees. Not enterprises above 1000, teams under 50, IT services or consulting firms, schools, funds, agencies or non-profits.',
  'Target locations: India, United States',
].join('\n');

export const GOLDEN_PEOPLE_CONTEXT = [
  'Sender company: Arxena',
  'What the sender sells: AI outbound sales agents for B2B software companies',
  'Target titles: VP Sales, Head of Sales, Sales Director, CRO, RevOps lead, Founder (small companies)',
  'Target locations: India, United States',
].join('\n');
