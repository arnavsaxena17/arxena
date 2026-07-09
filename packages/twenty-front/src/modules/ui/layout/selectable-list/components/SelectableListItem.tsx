import { useSelectableList } from '@/ui/layout/selectable-list/hooks/useSelectableList';
import { ReactNode, useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';

type SelectableListItemProps = {
  itemId: string;
  children: ReactNode;
};

export const SelectableListItem = ({
  itemId,
  children,
}: SelectableListItemProps) => {
  const { isSelectedItemIdSelector } = useSelectableList();

  const isSelectedItemId = useRecoilValue(isSelectedItemIdSelector(itemId));

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSelectedItemId) {
      scrollRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isSelectedItemId]);

  return <div ref={scrollRef}>{children}</div>;
};
