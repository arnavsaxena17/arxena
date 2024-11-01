import { Img } from '@react-email/components';

const logoStyle = {
  marginBottom: '40px',
};

export const Logo = () => {
  return (
    <Img
      crossOrigin="anonymous"
      src="/icons/arxena/arxena-icon-black.jpg"
      alt="Twenty logo"
      width="40"
      height="40"
      style={logoStyle}
    />
  );
};
