import { findBestLinkedinParameterMatch } from 'src/engine/core-modules/candidate-search/utils/linkedin-parameter-resolver.util';

describe('findBestLinkedinParameterMatch', () => {
  it('normalizes a company slug and prefers the exact normalized title', () => {
    const result = findBestLinkedinParameterMatch(
      [
        { id: '15115627', title: 'P D hinduja national hospital and research centre' },
        { id: '946958', title: 'Hinduja Hospital' },
      ],
      'hinduja-hospital',
    );

    expect(result).toEqual({
      id: '946958',
      title: 'Hinduja Hospital',
    });
  });

  it('ignores one-character words and scores unique whole-word matches', () => {
    const result = findBestLinkedinParameterMatch(
      [
        { id: 'wrong', title: 'P D Example Research Centre' },
        { id: 'right', title: 'Example Hospital Group' },
      ],
      'example-hospital',
    );

    expect(result?.id).toBe('right');
  });

  it('returns null when no whole words match', () => {
    const result = findBestLinkedinParameterMatch(
      [{ id: '1', title: 'Alpha Health' }],
      'beta-hospital',
    );

    expect(result).toBeNull();
  });
});
