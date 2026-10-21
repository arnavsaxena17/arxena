import { type OutreachEphemeralPerson } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import {
  mergePeople,
  toEphemeralPerson,
} from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool';

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
