import { type OutreachEphemeralPerson } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import {
  compactPeople,
  mergePeople,
} from 'src/engine/core-modules/outreach-command/utils/merge-people.util';
import {
  normalizeCompanyName,
  normalizeLinkedinProfileKey,
  personIdentityKeys,
} from 'src/engine/core-modules/outreach-command/utils/person-identity.util';
import { toEphemeralPerson } from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool';

const person = (
  name: string,
  companyName: string,
  linkedinUrl = '',
): OutreachEphemeralPerson =>
  toEphemeralPerson({ name, companyName, linkedinUrl, title: 'MD' });

describe('mergePeople', () => {
  it('treats country-subdomain and www forms of one profile as one person', () => {
    const merged = mergePeople(
      [
        person(
          'Manis Kumar',
          'Saffron',
          'https://www.linkedin.com/in/manis-kumar-b10a57124',
        ),
      ],
      [
        person(
          'Manis Kumar',
          'Saffron',
          'https://in.linkedin.com/in/manis-kumar-b10a57124/?trk=x',
        ),
      ],
    );

    expect(merged).toHaveLength(1);
  });

  it('merges a row without a URL into the same name at the same company', () => {
    const merged = mergePeople(
      [person('Sanjay Purohit', 'Sapphire Foods')],
      [
        person(
          'Sanjay Purohit',
          'Sapphire Foods',
          'https://in.linkedin.com/in/sanjaypurohit',
        ),
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].linkedinUrl).toContain('sanjaypurohit');
  });

  it('merges one name at one company found through two different profiles', () => {
    const merged = mergePeople(
      [
        person(
          'Raj Mehta',
          'Little Italy',
          'https://in.linkedin.com/in/raj-mehta-1',
        ),
      ],
      [
        person(
          'Raj Mehta',
          'Little Italy',
          'https://in.linkedin.com/in/raj-mehta-2',
        ),
      ],
    );

    expect(merged).toHaveLength(1);
  });

  it('keeps the same name at different companies as two people', () => {
    const merged = mergePeople(
      [
        person(
          'Raj Mehta',
          'Little Italy',
          'https://in.linkedin.com/in/raj-mehta-1',
        ),
      ],
      [
        person(
          'Raj Mehta',
          'Other Co',
          'https://in.linkedin.com/in/raj-mehta-2',
        ),
      ],
    );

    expect(merged).toHaveLength(2);
  });

  it('keeps ids unique', () => {
    const first = person('A B', 'Co', 'https://in.linkedin.com/in/a-b-1');
    const second = {
      ...person('C D', 'Co', 'https://in.linkedin.com/in/c-d-2'),
      id: first.id,
    };
    const merged = mergePeople([first], [second]);

    expect(new Set(merged.map((entry) => entry.id)).size).toBe(2);
  });

  it('merges one person read under a one-letter spelling slip when one row has no URL', () => {
    const merged = mergePeople(
      [person('Krishna Kumar Chutani', "Haldiram's")],
      [
        person(
          'Krishan Kumar Chutani',
          "Haldiram's",
          'https://in.linkedin.com/in/krishanchutani',
        ),
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].linkedinUrl).toBe(
      'https://in.linkedin.com/in/krishanchutani',
    );
  });

  it('keeps two similarly named people apart when both have different profile URLs', () => {
    const merged = mergePeople(
      [
        person(
          'Krishna Kumar Chutani',
          "Haldiram's",
          'https://in.linkedin.com/in/a',
        ),
      ],
      [
        person(
          'Krishan Kumar Chutani',
          "Haldiram's",
          'https://in.linkedin.com/in/b',
        ),
      ],
    );

    expect(merged).toHaveLength(2);
  });

  it('keeps similar names at different companies apart', () => {
    const merged = mergePeople(
      [person('Krishna Kumar Chutani', "Haldiram's")],
      [person('Krishan Kumar Chutani', 'Bikano')],
    );

    expect(merged).toHaveLength(2);
  });

  it('merges otherFields surgically: keeps existing keys, adds and updates from incoming', () => {
    const existing = {
      ...person(
        'Sachin Kesharwani',
        'HAPPY FACES',
        'https://www.linkedin.com/in/sachin-kesharwani',
      ),
      otherFields: {
        isProfileAuthentic: true,
        authenticityReason: 'Name matches',
        connections: 100,
      },
    };
    const incoming = {
      ...person(
        'Sachin Kesharwani',
        'HAPPY FACES',
        'https://www.linkedin.com/in/sachin-kesharwani',
      ),
      otherFields: {
        connections: 500,
        followers: 1264,
        educationSchools: 'IGNOU',
      },
    };

    const merged = mergePeople([existing], [incoming]);

    expect(merged).toHaveLength(1);
    expect(merged[0].otherFields).toEqual({
      isProfileAuthentic: true,
      authenticityReason: 'Name matches',
      connections: 500,
      followers: 1264,
      educationSchools: 'IGNOU',
    });
  });
});

describe('person identity keys', () => {
  it('treats legal-entity suffixes as the same employer', () => {
    expect(normalizeCompanyName('Jubilant FoodWorks Ltd.')).toBe(
      'jubilant foodworks',
    );
    expect(normalizeCompanyName('Jubilant FoodWorks Private Limited')).toBe(
      'jubilant foodworks',
    );
    expect(normalizeCompanyName('Jubilant FoodWorks')).toBe(
      'jubilant foodworks',
    );
  });

  it('keeps words that name a different employer', () => {
    expect(normalizeCompanyName('Haldiram Group')).not.toBe(
      normalizeCompanyName('Haldiram'),
    );
  });

  it('reduces every form of one profile URL to one key', () => {
    const forms = [
      'https://www.linkedin.com/in/Naveen-SupplyChain-Strategy/',
      'https://in.linkedin.com/in/naveen-supplychain-strategy?trk=public_profile',
      'linkedin.com/in/naveen-supplychain-strategy',
      'naveen-supplychain-strategy',
    ];

    expect(new Set(forms.map(normalizeLinkedinProfileKey)).size).toBe(1);
  });

  it('keeps an opaque member id apart from a vanity slug', () => {
    expect(
      normalizeLinkedinProfileKey(
        'https://www.linkedin.com/in/ACwAAAOe40MBPIme-JeJEEBEnnp0xtsjypwL6ks',
      ),
    ).toBe('li:member:acwaaaoe40mbpime-jejeebennp0xtsjypwl6ks');
    expect(
      normalizeLinkedinProfileKey(
        'https://in.linkedin.com/in/naveen-supplychain-strategy',
      ),
    ).toBe('li:in:naveen-supplychain-strategy');
  });

  it('uses a personal email as a key but not a shared inbox', () => {
    expect(
      personIdentityKeys({
        name: 'Naveen Srivastava',
        email: 'naveen@jubilant.com',
      }),
    ).toContain('email:naveen@jubilant.com');
    expect(
      personIdentityKeys({
        name: 'Naveen Srivastava',
        email: 'info@jubilant.com',
      }),
    ).not.toContain('email:info@jubilant.com');
  });

  it('shares the name + employer key across URL forms and suffixes', () => {
    const harvest = personIdentityKeys({
      name: 'Naveen Srivastava',
      companyName: 'Jubilant FoodWorks Ltd.',
      linkedinUrl:
        'https://www.linkedin.com/in/ACwAAAOe40MBPIme-JeJEEBEnnp0xtsjypwL6ks',
    });
    const google = personIdentityKeys({
      name: 'Naveen Srivastava',
      companyName: 'Jubilant FoodWorks',
      linkedinUrl: 'https://in.linkedin.com/in/naveen-supplychain-strategy',
    });

    expect(google.some((key) => harvest.includes(key))).toBe(true);
  });
});

// The exact pair from project b47222b6: one Harvest row and one Google row for
// the same person, with different URL forms and an employer suffix difference.
describe('one person found through two providers', () => {
  const harvestRow = () =>
    person(
      'Naveen Srivastava',
      'Jubilant FoodWorks Ltd.',
      'https://www.linkedin.com/in/ACwAAAOe40MBPIme-JeJEEBEnnp0xtsjypwL6ks',
    );
  const googleRow = () =>
    person(
      'Naveen Srivastava',
      'Jubilant FoodWorks',
      'https://in.linkedin.com/in/naveen-supplychain-strategy',
    );

  it('collapses the pair when the harvest row lands first', () => {
    const merged = mergePeople([harvestRow()], [googleRow()]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(harvestRow().id);
  });

  it('collapses the pair when the google row lands first', () => {
    const merged = mergePeople([googleRow()], [harvestRow()]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(googleRow().id);
  });

  it('keeps finding the merged row through the URL form it absorbed', () => {
    const merged = mergePeople(
      [googleRow(), harvestRow()],
      [
        person(
          'Naveen Srivastava',
          'JFL',
          'https://www.linkedin.com/in/ACwAAAOe40MBPIme-JeJEEBEnnp0xtsjypwL6ks',
        ),
      ],
    );

    expect(merged).toHaveLength(1);
  });

  it('collapses the pair when neither row has a profile URL', () => {
    const merged = mergePeople(
      [person('Naveen Srivastava', 'Jubilant FoodWorks')],
      [person('Naveen Srivastava', 'Jubilant FoodWorks Ltd.')],
    );

    expect(merged).toHaveLength(1);
  });

  it('compacts an already-duplicated list without adding rows', () => {
    const compacted = compactPeople([googleRow(), harvestRow()]);

    expect(compacted).toHaveLength(1);
  });

  it('keeps a different person with the same name at another employer', () => {
    const merged = mergePeople(
      [googleRow()],
      [
        person(
          'Naveen Srivastava',
          'Hatsun Agro',
          'https://in.linkedin.com/in/naveen-srivastava-hatsun',
        ),
      ],
    );

    expect(merged).toHaveLength(2);
  });
});
