import * as React from 'react';
import styled from '@emotion/styled';
import { useRecoilValue } from 'recoil';
import { IconComponent, IconSend, IconRefresh } from 'twenty-ui';

import { useTabList } from '@/ui/layout/tab/hooks/useTabList';
import { TabListScope } from '@/ui/layout/tab/scopes/TabListScope';
import { ScrollWrapper } from '@/ui/utilities/scroll/components/ScrollWrapper';
import { IconArrowBackUp, IconUserCircle } from 'twenty-ui';

import { Chat } from './Chat';

import { ReactNode } from 'react';
import { Button } from '@/ui/input/button/components/Button';



type SingleTabProps = {
  title: string;
  Icon?: IconComponent;
  id: string;
  hide?: boolean;
  disabled?: boolean;
  hasBetaPill?: boolean;
};

type TabListProps = {
  tabListId: string;
  tabs: SingleTabProps[];
  loading?: boolean;
};

const StyledContainer = styled.div`
  border-bottom: ${({ theme }) => `1px solid ${theme.border.color.light}`};
  box-sizing: border-box;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  height: 40px;
  padding-left: ${({ theme }) => theme.spacing(2)};
  user-select: none;
`;

const handleSubmit = () => {
  console.log('Submit');
};
const handleShareJD = () => {
  console.log('Share JD');
}

export const ChatList = () => {




  return (
      <ScrollWrapper hideY>
        <StyledContainer>
    
        <Button Icon={IconSend} title="Reply" variant="secondary" accent="default" onClick={handleSubmit} />
        <Button Icon={IconRefresh} title="Refetch" variant="secondary" accent="default" onClick={handleSubmit} />
        <Button Icon={IconUserCircle} title="Share" variant="secondary" accent="default" onClick={handleSubmit} />
          </StyledContainer>

        
      </ScrollWrapper>
  );
};
