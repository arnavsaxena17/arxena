export const isPrivateOrLocalClientIp = (ip: string): boolean => {
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
    return true;
  }
  if (ip.includes(':')) {
    return false;
  }
  if (ip.startsWith('127.') || ip.startsWith('10.')) {
    return true;
  }
  if (ip.startsWith('192.168.')) {
    return true;
  }
  const secondOctet = Number(ip.split('.')[1]);
  if (ip.startsWith('172.') && secondOctet >= 16 && secondOctet <= 31) {
    return true;
  }
  return false;
};
