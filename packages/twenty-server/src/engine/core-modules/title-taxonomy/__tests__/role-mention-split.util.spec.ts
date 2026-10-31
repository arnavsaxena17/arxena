import {
  splitRoleMention,
  toSearchTerms,
} from 'src/engine/core-modules/title-taxonomy/role-mention-split.util';

describe('splitRoleMention', () => {
  it('should split a shared head into one role per function', () => {
    expect(splitRoleMention('Head of Supply Chain / Logistics')).toEqual([
      'Head of Supply Chain',
      'Head of Logistics',
    ]);
    expect(splitRoleMention('Head of Supply Chain & Logistics')).toEqual([
      'Head of Supply Chain',
      'Head of Logistics',
    ]);
    expect(splitRoleMention('Head of Supply Chain and Logistics')).toEqual([
      'Head of Supply Chain',
      'Head of Logistics',
    ]);
  });

  it('should split a shared tail into one role per function', () => {
    expect(splitRoleMention('Supply Chain / Logistics Head')).toEqual([
      'Supply Chain Head',
      'Logistics Head',
    ]);
    expect(splitRoleMention('Procurement & Logistics Head')).toEqual([
      'Procurement Head',
      'Logistics Head',
    ]);
  });

  it('should keep full roles that each carry their own head', () => {
    expect(splitRoleMention('Procurement Head / Purchase Head')).toEqual([
      'Procurement Head',
      'Purchase Head',
    ]);
  });

  it('should split two short designations', () => {
    expect(splitRoleMention('MD / CEO')).toEqual(['MD', 'CEO']);
  });

  it('should split a coordinated phrase with no shared word', () => {
    expect(splitRoleMention('Sales & Marketing Head')).toEqual([
      'Sales Head',
      'Marketing Head',
    ]);
  });

  it('should keep a compound that names one function', () => {
    for (const compound of [
      'Research & Development Head',
      'Health & Safety Head',
      'Health, Safety & Environment Head',
      'Mergers & Acquisitions Head',
      'Sales & Operations Planning Head',
      'Learning & Development Head',
      'Diversity & Inclusion Head',
      'Monitoring & Evaluation Head',
    ]) {
      expect(splitRoleMention(compound)).toEqual([compound]);
    }
  });

  it('should leave a single designation alone', () => {
    expect(splitRoleMention('Chief Procurement Officer')).toEqual([
      'Chief Procurement Officer',
    ]);
    expect(splitRoleMention('Head of Supply Chain')).toEqual([
      'Head of Supply Chain',
    ]);
    expect(splitRoleMention('VP Sales & Marketing')).toEqual([
      'VP Sales',
      'VP Marketing',
    ]);
  });

  it('should not invent a shared head for a whole second designation', () => {
    expect(splitRoleMention('Chief of Staff / CEO')).toEqual([
      'Chief of Staff / CEO',
    ]);
  });

  it('should not split without a coordinator between words', () => {
    expect(splitRoleMention('Sandwich Maker')).toEqual(['Sandwich Maker']);
    expect(splitRoleMention('Brand Manager')).toEqual(['Brand Manager']);
  });
});

describe('toSearchTerms', () => {
  it('should never put a slash or quote into a query term', () => {
    expect(
      toSearchTerms(['Head of Supply Chain / Logistics', '"Procurement" Head']),
    ).toEqual([
      'Head of Supply Chain',
      'Head of Logistics',
      'Procurement Head',
    ]);
  });

  it('should keep a one-function compound whole', () => {
    expect(toSearchTerms(['Head of R&D'])).toEqual(['Head of R&D']);
  });
});
