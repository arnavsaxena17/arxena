'use client';

import styled from '@emotion/styled';

const StyledSection = styled.section`
  max-width: 820px;
  margin: 0 auto;
  padding: 64px 24px 96px;
`;

const StyledHeadline = styled.h1`
  font-size: clamp(2rem, 4vw, 2.5rem);
  font-weight: 600;
  line-height: 1.2;
  margin: 0 0 32px 0;
  color: #141414;
`;

const StyledHeading = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: #141414;
  margin: 40px 0 16px 0;
  font-family: var(--font-inter);
`;

const StyledParagraph = styled.p`
  font-size: 16px;
  line-height: 1.7;
  color: #474747;
  margin: 0 0 20px 0;
  font-family: var(--font-inter);
`;

const StyledList = styled.ul`
  margin: 0 0 20px 0;
  padding-left: 24px;
  font-size: 16px;
  line-height: 1.7;
  color: #474747;
  font-family: var(--font-inter);
`;

const StyledTableWrap = styled.div`
  overflow-x: auto;
  margin: 0 0 20px 0;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;
  line-height: 1.5;
  color: #474747;
  font-family: var(--font-inter);

  th,
  td {
    text-align: left;
    padding: 12px 14px;
    border-bottom: 1px solid #e5e5e5;
    vertical-align: top;
  }

  th {
    font-weight: 600;
    color: #141414;
    white-space: nowrap;
  }
`;

const ROWS = [
  ['1. Trial', 'Month 1', '8,000', 'Intern', 'Joining'],
  ['2. Trial', 'Months 2-3', '15,000', 'Intern', 'Month 1 check-in'],
  [
    '3. Confirmed',
    'Months 4-6',
    '25,000-30,000 (fixed at confirmation)',
    'Full-time employee',
    'Month 3 confirmation review',
  ],
  [
    '4. Established',
    'Months 7-12',
    '50,000',
    'Full-time employee',
    'Month 6 review',
  ],
  [
    '5. Senior',
    'Months 13-18',
    '75,000',
    'Full-time employee',
    'Month 12 review',
  ],
  [
    '6. Lead',
    'Month 19 onwards',
    '1,00,000',
    'Full-time employee',
    'Month 18 review',
  ],
];

const GATES: Array<[string, string]> = [
  [
    'Month 1 check-in',
    'reliability and learning speed. Shows up, finishes assigned work, takes feedback.',
  ],
  [
    'Month 3 confirmation',
    'owns a defined task end to end with light supervision. Sets the position inside the 25,000-30,000 band.',
  ],
  [
    'Month 6 review',
    'owns a recurring workstream and its results, with quality that holds without close review.',
  ],
  [
    'Month 12 review',
    'works independently, improves the process, and can take on new problems without being directed.',
  ],
  [
    'Month 18 review',
    'leads a workstream or guides other interns, and the business can support the cost.',
  ],
];

export const InternProgressionContent = () => (
  <StyledSection>
    <StyledHeadline>Intern to Full-Time Progression Plan</StyledHeadline>

    <StyledHeading>Overview</StyledHeading>
    <StyledParagraph>
      Pay rises in six steps over 18 months, from INR 8,000 to INR 1,00,000 a
      month. A confirmation review at the end of month 3 decides whether the
      intern becomes a full-time employee. Each later raise follows a review,
      so it is earned by outcomes and not by time alone. All figures are
      monthly, in INR, before deductions.
    </StyledParagraph>

    <StyledHeading>Progression</StyledHeading>
    <StyledTableWrap>
      <StyledTable>
        <thead>
          <tr>
            <th>Phase</th>
            <th>Timeline</th>
            <th>Monthly pay (INR)</th>
            <th>Status</th>
            <th>Unlocked by</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row[0]}>
              {row.map((cell) => (
                <td key={cell}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </StyledTable>
    </StyledTableWrap>
    <StyledParagraph>
      A raise takes effect on the first day of the month after its review.
      Phases never overlap: the month 3 review is the single point where pay
      moves from the trial scale to the confirmed band.
    </StyledParagraph>

    <StyledHeading>Review gates</StyledHeading>
    <StyledParagraph>
      Every step is decided on three questions: what did you own, how good was
      it, and how much help did it need. A review can confirm the raise, hold
      pay for one more cycle, or end the engagement.
    </StyledParagraph>
    <StyledList>
      {GATES.map(([title, text]) => (
        <li key={title}>
          <strong>{title}:</strong> {text}
        </li>
      ))}
    </StyledList>

    <StyledHeading>Terms</StyledHeading>
    <StyledList>
      <li>
        <strong>Status:</strong> phases 1-2 are an internship. From
        confirmation (phase 3) the person is a full-time employee under an
        employment contract, with PF, gratuity and notice period as per
        applicable law and the contract.
      </li>
      <li>
        <strong>Upper steps are conditional:</strong> the 50,000, 75,000 and
        1,00,000 steps depend on individual performance and on the company
        being able to fund them. A step can be deferred if either is not met.
      </li>
      <li>
        <strong>Variable pay:</strong> variable pay is negotiated separately at each review.
      </li>
      <li>
        <strong>IP and confidentiality:</strong> all work created for the
        company belongs to the company, and an IP assignment and
        confidentiality agreement is signed on joining.
      </li>
      <li>
        <strong>Notice:</strong> the notice period is 1 day. After submitting a
        resignation, the employee does not need to come in from the next day.
      </li>
      <li>
        <strong>Not a guarantee:</strong> this document describes how pay can
        progress. It is not a promise of any specific raise or date.
      </li>
    </StyledList>
  </StyledSection>
);
