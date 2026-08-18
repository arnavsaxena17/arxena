import { InformationBannerComponentInstanceContext } from '@/information-banner/states/contexts/InformationBannerComponentInstanceContext';
import { informationBannerIsOpenComponentState } from '@/information-banner/states/informationBannerIsOpenComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useContext } from 'react';
import {
  Banner,
  type BannerColor,
  type BannerVariant,
} from 'twenty-ui/feedback';
import { type IconComponent, IconX } from 'twenty-ui/icon';
import { Button, IconButton } from 'twenty-ui/input';
import { ThemeContext, themeCssVariables } from 'twenty-ui/theme-constants';

const StyledText = styled.div`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledInvertedIconButton = styled(IconButton)`
  color: var(--t-font-color-white) !important;
`;

const StyledContent = styled.div`
  align-items: center;
  display: flex;
  flex: 1;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  min-width: 0;
`;

const StyledActions = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
`;

export const InformationBanner = ({
  message,
  color = 'blue',
  variant = 'primary',
  buttonTitle,
  buttonIcon,
  buttonOnClick,
  isButtonDisabled = false,
  onClose,
  componentInstanceId,
}: {
  message: string;
  color?: BannerColor;
  variant?: BannerVariant;
  buttonTitle?: string;
  buttonIcon?: IconComponent;
  buttonOnClick?: () => void;
  isButtonDisabled?: boolean;
  onClose?: () => void;
  componentInstanceId: string;
}) => {
  const informationBannerIsOpen = useAtomComponentStateValue(
    informationBannerIsOpenComponentState,
    componentInstanceId,
  );

  const { colorScheme } = useContext(ThemeContext);
  const isPrimary = variant === 'primary';
  const invertControls = isPrimary || colorScheme === 'dark';
  const buttonAccent = color === 'danger' ? 'danger' : 'blue';

  return (
    <InformationBannerComponentInstanceContext.Provider
      value={{
        instanceId: componentInstanceId,
      }}
    >
      {informationBannerIsOpen && (
        <Banner color={color} variant={variant}>
          <StyledContent>
            <StyledText>{message}</StyledText>
            {buttonTitle && buttonOnClick && (
              <StyledActions>
                <Button
                  variant="secondary"
                  accent={buttonAccent}
                  title={buttonTitle}
                  Icon={buttonIcon}
                  size="small"
                  inverted={invertControls}
                  onClick={buttonOnClick}
                  disabled={isButtonDisabled}
                />
              </StyledActions>
            )}
          </StyledContent>
          {onClose &&
            (invertControls ? (
              <StyledInvertedIconButton
                Icon={IconX}
                size="small"
                variant="tertiary"
                onClick={onClose}
                ariaLabel={t`Close banner`}
              />
            ) : (
              <IconButton
                Icon={IconX}
                size="small"
                variant="tertiary"
                accent={buttonAccent}
                onClick={onClose}
                ariaLabel={t`Close banner`}
              />
            ))}
        </Banner>
      )}
    </InformationBannerComponentInstanceContext.Provider>
  );
};
