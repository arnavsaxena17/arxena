import { ScrollWrapper } from '@/ui/utilities/scroll/components/ScrollWrapper';
import styled from '@emotion/styled';
import { useId } from 'react';

const StyledDropdownMenuItemsExternalContainer = styled.div<{
  hasMaxHeight?: boolean;
  isJobDetailsForm?: boolean;
}>`
  --padding: ${({ theme }) => theme.spacing(1)};

  align-items: flex-start;
  display: flex;

  flex-direction: column;
  max-height: ${({ hasMaxHeight }) => (hasMaxHeight ? '188px' : 'none')};

  padding: var(--padding);

  width: calc(100% - 2 * var(--padding));

  background: ${({ theme, isJobDetailsForm }) => isJobDetailsForm ? theme.color.gray10 : 'transparent'};
  box-shadow: ${({ theme, isJobDetailsForm }) => isJobDetailsForm ? theme.boxShadow.light : 'none'};
  border-radius: ${({ theme, isJobDetailsForm }) => isJobDetailsForm ? theme.border.radius.md : 'none'};
`;

const StyledDropdownMenuItemsInternalContainer = styled.div`
  align-items: stretch;
  display: flex;

  flex-direction: column;
  gap: 2px;
  height: 100%;
  width: 100%;
`;

const StyledScrollWrapper = styled(ScrollWrapper)`
  width: 100%;
`;

// TODO: refactor this, the dropdown should handle the max height behavior + scroll with the size middleware
// We should instead create a DropdownMenuItemsContainerScrollable or take for granted that it is the default behavior
export const DropdownMenuItemsContainer = ({
  children,
  hasMaxHeight,
  className,
  scrollable = true,
  isJobDetailsForm = false,
}: {
  children: React.ReactNode;
  hasMaxHeight?: boolean;
  className?: string;
  scrollable?: boolean;
  isJobDetailsForm?: boolean;
}) => {
  const id = useId();

  return scrollable !== true ? (
    <StyledDropdownMenuItemsExternalContainer
      hasMaxHeight={hasMaxHeight}
      className={className}
      isJobDetailsForm={isJobDetailsForm}
      role="listbox"
    >
      {hasMaxHeight ? (
        <StyledScrollWrapper
          contextProviderName="dropdownMenuItemsContainer"
          componentInstanceId={`scroll-wrapper-dropdown-menu-${id}`}
        >
          <StyledDropdownMenuItemsInternalContainer>
            {children}
          </StyledDropdownMenuItemsInternalContainer>
        </StyledScrollWrapper>
      ) : (
        <StyledDropdownMenuItemsInternalContainer>
          {children}
        </StyledDropdownMenuItemsInternalContainer>
      )}
    </StyledDropdownMenuItemsExternalContainer>
  ) : (
    <ScrollWrapper
      contextProviderName="dropdownMenuItemsContainer"
      componentInstanceId={`scroll-wrapper-dropdown-menu-${id}`}
      heightMode="fit-content"
    >
      <StyledDropdownMenuItemsExternalContainer
        hasMaxHeight={hasMaxHeight}
        className={className}
        isJobDetailsForm={isJobDetailsForm}
        role="listbox"
      >
        <StyledDropdownMenuItemsInternalContainer>
          {children}
        </StyledDropdownMenuItemsInternalContainer>
      </StyledDropdownMenuItemsExternalContainer>
    </ScrollWrapper>
  );
};
