export type SystemInfo = {
  os: string;
  arch: string;
};

export const getArxenaAppBaseUrl = (): string => {
  return window.location.hostname === 'localhost'
    ? 'http://localhost:5050'
    : 'https://arxena.com';
};

export const detectOS = (userAgent: string): string => {
  const ua = userAgent.toLowerCase();
  if (
    ua.includes('mac os x') ||
    ua.includes('macintosh') ||
    ua.includes('darwin')
  ) {
    return 'darwin';
  }
  if (ua.includes('windows') || ua.includes('win64') || ua.includes('win32')) {
    return 'windows';
  }
  if (
    ua.includes('linux') ||
    ua.includes('x11') ||
    ua.includes('ubuntu') ||
    ua.includes('fedora') ||
    ua.includes('debian')
  ) {
    return 'linux';
  }
  return 'unknown';
};

export const detectArchitecture = (): string => {
  const platform = window.navigator.platform.toLowerCase();
  const userAgent = window.navigator.userAgent.toLowerCase();
  const cpuClass = (navigator as { cpuClass?: string }).cpuClass;
  if (
    platform.includes('arm') ||
    userAgent.includes('arm') ||
    userAgent.includes('aarch64')
  ) {
    return 'arm64';
  }
  if (
    platform.includes('x64') ||
    platform.includes('x86_64') ||
    platform.includes('amd64') ||
    userAgent.includes('x64') ||
    userAgent.includes('x86_64') ||
    userAgent.includes('amd64') ||
    (cpuClass && cpuClass.includes('64'))
  ) {
    return 'x64';
  }
  return 'x64';
};

export const getRecommendedFormat = (os: string): string => {
  switch (os.toLowerCase()) {
    case 'darwin':
      return 'dmg';
    case 'linux':
      return 'appimage';
    case 'windows':
      return 'exe';
    default:
      return '';
  }
};

export const getFormatLabel = (os: string, format: string): string => {
  switch (format) {
    case 'dmg':
      return 'DMG Installer';
    case 'appimage':
      return 'AppImage';
    case 'exe':
      return 'Windows Installer';
    case 'deb':
      return 'DEB Package';
    default:
      return 'Installer';
  }
};

export const getOSName = (os: string): string => {
  switch (os.toLowerCase()) {
    case 'windows':
      return 'Windows';
    case 'darwin':
      return 'macOS';
    case 'linux':
      return 'Linux';
    case 'unknown':
      return 'Unknown Operating System';
    default:
      return `${os.charAt(0).toUpperCase()}${os.slice(1)}`;
  }
};

export const getSystemInfo = (): SystemInfo => {
  const userAgent = window.navigator.userAgent;
  const os = detectOS(userAgent);
  const arch = detectArchitecture();
  return { os, arch };
};

export const triggerArxenaAppDownload = (systemInfo: SystemInfo): void => {
  const baseUrl = getArxenaAppBaseUrl();
  const format = getRecommendedFormat(systemInfo.os);
  const downloadUrl = `${baseUrl}/download-app?arch=${systemInfo.arch}&format=${format}`;
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', '');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
