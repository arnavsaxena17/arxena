import { Img } from '@react-email/components';

const logoStyle = {
  marginBottom: '40px',
};

export const Logo = () => {
  // const defaultPrimaryLogoUrl = `${window.location.origin}/icons/windows11/Square150x150Logo.scale-100.png`;

  return (
    <Img
      src="https://app.arxena.com/icons/windows11/Square150x150Logo.scale-100.png"
      alt="Arxena logo"
      width="40"
      height="40"
      style={logoStyle}
    />
  );
};
