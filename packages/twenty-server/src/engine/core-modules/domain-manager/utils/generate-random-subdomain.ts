export const generateRandomSubdomain = () => {
  const prefixes = [
    'cool',
    'smart',
    'witty',
    'bouncy',
    'graceful',
    'colorful',
  ];
  const suffixes = [
    'raccoon',
    'panda',
    'panther',
    'octopus',
    'crocodile',
    'seal',
  ];

  const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];

  return `${randomPrefix}-${randomSuffix}`;
};
