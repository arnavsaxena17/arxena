export const areStringArraysEqual = (
  left: string[] | undefined | null,
  right: string[] | undefined | null,
): boolean => {
  const normalizedLeft = [...(left ?? [])].sort();
  const normalizedRight = [...(right ?? [])].sort();

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every(
    (value, index) => value === normalizedRight[index],
  );
};
