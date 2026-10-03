import {
  IconBrandLinkedin,
  IconCopy,
  IconDotsVertical,
  IconExternalLink,
} from 'twenty-ui/icon';
import { LightIconButton } from 'twenty-ui/input';
import { MenuItem } from 'twenty-ui/navigation';

import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';

// Record plumbing (IDs, record links) kept out of the header itself
type CandidateDrawerMoreDropdownProps = {
  dropdownId: string;
  personId?: string;
  candidateId?: string;
  email: string;
  phone: string;
  profileUrl: string;
  onOpenRecord: (
    objectNameSingular: 'person' | 'candidate',
    recordId: string,
  ) => void;
  onCopy: (text: string, label: string) => void;
};

export const CandidateDrawerMoreDropdown = ({
  dropdownId,
  personId,
  candidateId,
  email,
  phone,
  profileUrl,
  onOpenRecord,
  onCopy,
}: CandidateDrawerMoreDropdownProps) => {
  const { closeDropdown } = useCloseDropdown();
  const hasSeparateCandidate =
    candidateId !== undefined && candidateId !== personId;

  const runAndClose = (action: () => void) => () => {
    action();
    closeDropdown(dropdownId);
  };

  return (
    <Dropdown
      dropdownId={dropdownId}
      dropdownPlacement="bottom-end"
      clickableComponent={
        <LightIconButton
          Icon={IconDotsVertical}
          accent="tertiary"
          aria-label="More"
        />
      }
      dropdownComponents={
        <DropdownContent>
          <DropdownMenuItemsContainer>
            {personId !== undefined && (
              <MenuItem
                LeftIcon={IconExternalLink}
                text="Open person record"
                onClick={runAndClose(() => onOpenRecord('person', personId))}
              />
            )}
            {hasSeparateCandidate && (
              <MenuItem
                LeftIcon={IconExternalLink}
                text="Open candidate record"
                onClick={runAndClose(() =>
                  onOpenRecord('candidate', candidateId),
                )}
              />
            )}
            {profileUrl.length > 0 && (
              <MenuItem
                LeftIcon={IconBrandLinkedin}
                text="Open LinkedIn profile"
                onClick={runAndClose(() => {
                  window.open(profileUrl, '_blank', 'noopener,noreferrer');
                })}
              />
            )}
          </DropdownMenuItemsContainer>
          <DropdownMenuSeparator />
          <DropdownMenuItemsContainer>
            {email.length > 0 && (
              <MenuItem
                LeftIcon={IconCopy}
                text="Copy email"
                contextualText={email}
                onClick={runAndClose(() => onCopy(email, 'Email'))}
              />
            )}
            {phone.length > 0 && (
              <MenuItem
                LeftIcon={IconCopy}
                text="Copy phone"
                contextualText={phone}
                onClick={runAndClose(() => onCopy(phone, 'Phone number'))}
              />
            )}
            {personId !== undefined && (
              <MenuItem
                LeftIcon={IconCopy}
                text="Copy person ID"
                contextualText={`${personId.slice(0, 8)}…`}
                onClick={runAndClose(() => onCopy(personId, 'Person ID'))}
              />
            )}
            {hasSeparateCandidate && (
              <MenuItem
                LeftIcon={IconCopy}
                text="Copy candidate ID"
                contextualText={`${candidateId.slice(0, 8)}…`}
                onClick={runAndClose(() => onCopy(candidateId, 'Candidate ID'))}
              />
            )}
          </DropdownMenuItemsContainer>
        </DropdownContent>
      }
    />
  );
};
