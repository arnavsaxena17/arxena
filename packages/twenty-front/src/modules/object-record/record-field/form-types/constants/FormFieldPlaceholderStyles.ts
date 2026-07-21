import { css } from '@emotion/react';

export const FORM_FIELD_PLACEHOLDER_STYLES = (props: {
  theme: ThemeType;
}) => css`
  color: ${props.theme.font.color.light};
  font-size: ${props.theme.font.size.md};
  font-weight: ${props.theme.font.weight.medium};
`;
