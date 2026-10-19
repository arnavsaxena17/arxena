import {
  DEFAULT_FITMENT_THRESHOLD,
  FAKE_PROFILE_THRESHOLD_ENV,
  FITMENT_THRESHOLD_ENV,
  SAME_PERSON_THRESHOLD_ENV,
  getFakeProfileThreshold,
  getFitmentThreshold,
  getSamePersonThreshold,
  resolveFitmentThreshold,
} from 'src/engine/core-modules/candidate-sourcing/services/fitment/fitment-threshold.util';

const env = (value?: string) =>
  value === undefined ? {} : { [FITMENT_THRESHOLD_ENV]: value };

describe('getFitmentThreshold', () => {
  it('should default to 50%', () => {
    expect(getFitmentThreshold(env())).toBe(DEFAULT_FITMENT_THRESHOLD);
    expect(DEFAULT_FITMENT_THRESHOLD).toBe(0.5);
  });

  it.each([
    ['0.6', 0.6],
    ['60', 0.6],
    ['60%', 0.6],
    [' 75 ', 0.75],
    ['1', 1],
  ])('should read %s as %d', (raw, expected) => {
    expect(getFitmentThreshold(env(raw))).toBeCloseTo(expected);
  });

  it.each(['', 'abc', '0', '-1', '101', 'NaN'])(
    'should ignore %j and keep the default',
    (raw) => {
      expect(getFitmentThreshold(env(raw))).toBe(DEFAULT_FITMENT_THRESHOLD);
    },
  );
});

describe('resolveFitmentThreshold', () => {
  it('should let a request raise the bar', () => {
    expect(resolveFitmentThreshold(0.7, env('0.5'))).toBe(0.7);
  });

  it('should never let a request go below the server bar', () => {
    expect(resolveFitmentThreshold(0.2, env('0.6'))).toBe(0.6);
  });

  it('should use the server bar when nothing is requested', () => {
    expect(resolveFitmentThreshold(undefined, env('0.65'))).toBe(0.65);
  });

  it('should cap a request at 100%', () => {
    expect(resolveFitmentThreshold(4, env())).toBe(1);
  });
});

describe('the other yes/no bars', () => {
  it('should default the fake-profile and same-person bars to 50%', () => {
    expect(getFakeProfileThreshold({})).toBe(0.5);
    expect(getSamePersonThreshold({})).toBe(0.5);
  });

  it('should read each bar from its own variable, independently of the fitment bar', () => {
    const settings = {
      [FITMENT_THRESHOLD_ENV]: '0.6',
      [FAKE_PROFILE_THRESHOLD_ENV]: '70%',
      [SAME_PERSON_THRESHOLD_ENV]: '0.9',
    };

    expect(getFitmentThreshold(settings)).toBeCloseTo(0.6);
    expect(getFakeProfileThreshold(settings)).toBeCloseTo(0.7);
    expect(getSamePersonThreshold(settings)).toBeCloseTo(0.9);
  });

  it('should ignore an invalid value', () => {
    expect(
      getSamePersonThreshold({ [SAME_PERSON_THRESHOLD_ENV]: 'high' }),
    ).toBe(0.5);
  });
});
