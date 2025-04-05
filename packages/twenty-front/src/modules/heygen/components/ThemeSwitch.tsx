'use client';

import styled from '@emotion/styled';
import { useIsSSR } from '@react-aria/ssr';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { useTheme } from 'next-themes';

const StyledThemeButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(1)};
  cursor: pointer;
  transition: opacity 0.2s;
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.secondary};

  &:hover {
    opacity: 0.8;
  }
`;

export const ThemeSwitch = () => {
  const { theme, setTheme } = useTheme();
  const isSSR = useIsSSR();

  const handleThemeChange = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const isLight = theme === 'light' || isSSR;

  return (
    <StyledThemeButton
      onClick={handleThemeChange}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
    >
      {isLight ? <IconSun size={24} /> : <IconMoon size={24} />}
    </StyledThemeButton>
  );
};
