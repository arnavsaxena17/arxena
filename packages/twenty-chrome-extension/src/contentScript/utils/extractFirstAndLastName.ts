// Separate first name and last name from a full name.
const extractFirstAndLastName = (fullName: string) => {
  const firstSpaceIndex = fullName.indexOf(' ');
  const lastSpaceIndex = fullName.lastIndexOf(' ');
  const firstName = fullName.substring(0, firstSpaceIndex);
  const lastName = fullName.substring(lastSpaceIndex + 1);
  return { firstName, lastName };
};

export default extractFirstAndLastName;
