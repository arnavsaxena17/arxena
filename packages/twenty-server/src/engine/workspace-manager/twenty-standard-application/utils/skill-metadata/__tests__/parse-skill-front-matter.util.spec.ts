import { parseSkillFrontMatter } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/parse-skill-front-matter.util';

const parse = (text: string) => parseSkillFrontMatter('test.md', text);

describe('parseSkillFrontMatter', () => {
  it('should read a full front matter block', () => {
    expect(
      parse(`label: Find Role
icon: IconUserSearch
description: |-
  Find the CEO of each company
priority: 25
routes:
  - when: |-
      Get the CEO of each company ("founders of these")
    sections: [people, list-building]
    hint: |-
      and follow it: one call, no questions.
  - when: |-
      A second request
`),
    ).toEqual({
      label: 'Find Role',
      icon: 'IconUserSearch',
      description: 'Find the CEO of each company',
      priority: 25,
      routes: [
        {
          when: 'Get the CEO of each company ("founders of these")',
          sections: ['people', 'list-building'],
          hint: 'and follow it: one call, no questions.',
        },
        { when: 'A second request' },
      ],
    });
  });

  it('should keep quotes, backticks and colons inside block text as written', () => {
    const frontMatter = parse(`description: |-
  Use \`search\`: "quoted" text — with a dash
priority: 1
routes:
  - when: |-
      anything
`);

    expect(frontMatter.description).toBe(
      'Use `search`: "quoted" text — with a dash',
    );
  });

  it('should keep the line breaks of a multi-line block', () => {
    const frontMatter = parse(`description: |-
  first line
  second line
priority: 1
routes:
  - when: |-
      one
      two
`);

    expect(frontMatter.description).toBe('first line\nsecond line');
    expect(frontMatter.routes[0].when).toBe('one\ntwo');
  });

  it('should accept ordinary YAML such as quoted strings and flow lists', () => {
    const frontMatter = parse(`description: "A quoted: description"
priority: 3
routes:
  - when: 'Single quoted'
    sections: [a, b]
`);

    expect(frontMatter.description).toBe('A quoted: description');
    expect(frontMatter.routes[0]).toEqual({
      when: 'Single quoted',
      sections: ['a', 'b'],
    });
  });

  it.each([
    ['an unknown key', 'colour: red\ndescription: |-\n  x\npriority: 1\nroutes:\n  - when: |-\n      y\n', 'unknown key "colour"'],
    ['no description', 'priority: 1\nroutes:\n  - when: |-\n      y\n', 'no description'],
    ['no priority', 'description: |-\n  x\nroutes:\n  - when: |-\n      y\n', 'no numeric priority'],
    ['a priority that is text', 'description: |-\n  x\npriority: high\nroutes:\n  - when: |-\n      y\n', 'no numeric priority'],
    ['no routes', 'description: |-\n  x\npriority: 1\n', 'no routes'],
    ['a route without when', 'description: |-\n  x\npriority: 1\nroutes:\n  - hint: |-\n      y\n', 'a route without "when"'],
    ['an unknown route key', 'description: |-\n  x\npriority: 1\nroutes:\n  - when: |-\n      y\n    colour: red\n', 'unknown route key "colour"'],
    ['sections that are not a list', 'description: |-\n  x\npriority: 1\nroutes:\n  - when: |-\n      y\n    sections: people\n', '"sections" that is not a list'],
    ['invalid YAML', 'description: [unclosed\n', 'is not valid YAML'],
    ['a list instead of a mapping', '- a\n- b\n', 'must be a mapping'],
  ])('should reject %s and name the file', (_label, text, message) => {
    expect(() => parse(text)).toThrow('Skill test.md: front matter');
    expect(() => parse(text)).toThrow(message);
  });
});
