import {
    isIpv4InCidr,
    normalizeIpOrCidr,
} from '../org-chart-ip-cidr.util';

describe('org-chart-ip-cidr.util', () => {
  it('normalizeIpOrCidr accepts IPv4', () => {
    expect(normalizeIpOrCidr('203.0.113.10')).toBe('203.0.113.10');
  });

  it('normalizeIpOrCidr accepts CIDR', () => {
    expect(normalizeIpOrCidr('43.173.0.0/16')).toBe('43.173.0.0/16');
  });

  it('normalizeIpOrCidr rejects invalid CIDR', () => {
    expect(normalizeIpOrCidr('999.0.0.0/16')).toBeNull();
    expect(normalizeIpOrCidr('43.173.0.0/33')).toBeNull();
  });

  it('isIpv4InCidr matches hosts in range', () => {
    expect(isIpv4InCidr('43.173.180.243', '43.173.0.0/16')).toBe(true);
    expect(isIpv4InCidr('43.172.195.86', '43.173.0.0/16')).toBe(false);
  });
});
