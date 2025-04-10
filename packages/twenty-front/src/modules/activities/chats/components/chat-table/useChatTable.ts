import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useTheme } from '@emotion/react';
import { IconCopy } from '@tabler/icons-react';
import axios from 'axios';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { useRecoilState } from 'recoil';
import { PersonNode } from 'twenty-shared';
import { TableData } from './types';

type UseChatTableReturn = {
  selectedIds: string[];
  isAttachmentPanelOpen: boolean;
  currentPersonIndex: number;
  isChatOpen: boolean;
  currentCandidate: PersonNode | null;
  selectedPeople: PersonNode[];
  handleCheckboxChange: (individualId: string) => void;
  handleSelectAll: () => void;
  handleViewChats: () => void;
  handleViewCVs: () => void;
  clearSelection: () => void;
  handlePrevCandidate: () => void;
  handleNextCandidate: () => void;
  prepareTableData: (individuals: PersonNode[]) => TableData[];
  createCandidateShortlists: () => Promise<void>;
  createChatBasedShortlistDelivery: () => Promise<void>;
  createUpdateCandidateStatus: () => Promise<void>;
  setIsAttachmentPanelOpen: (value: boolean) => void;
  setIsChatOpen: (value: boolean) => void;
};

export const useChatTable = (individuals: PersonNode[], onSelectionChange?: (selectedIds: string[]) => void): UseChatTableReturn => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAttachmentPanelOpen, setIsAttachmentPanelOpen] = useState(false);
  const [currentPersonIndex, setCurrentPersonIndex] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();
  const theme = useTheme();

  const handleCheckboxChange = (individualId: string): void => {
    const newSelectedIds = selectedIds.includes(individualId)
      ? selectedIds.filter(id => id !== individualId)
      : [...selectedIds, individualId];

    setSelectedIds(newSelectedIds);
    onSelectionChange?.(newSelectedIds);
  };

  const handleSelectAll = (): void => {
    const newSelectedIds = selectedIds.length === individuals.length ? [] : individuals.map(individual => individual.id);
    setSelectedIds(newSelectedIds);
    onSelectionChange?.(newSelectedIds);
  };

  const handleViewChats = (): void => {
    if (selectedIds.length > 0) {
      setIsChatOpen(true);
    }
  };

  const handleViewCVs = (): void => {
    setCurrentPersonIndex(0);
    setIsAttachmentPanelOpen(true);
  };

  const clearSelection = (): void => {
    setSelectedIds([]);
    onSelectionChange?.([]);
  };

  const handlePrevCandidate = (): void => {
    setCurrentPersonIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextCandidate = (): void => {
    setCurrentPersonIndex(prev => Math.min(selectedIds.length - 1, prev + 1));
  };

  const currentCandidate = selectedIds.length > 0 
    ? individuals.find(individual => individual.id === selectedIds[currentPersonIndex]) ?? null 
    : null;
  const selectedPeople = individuals.filter(individual => selectedIds.includes(individual.id));
  const selectedCandidateIds = selectedPeople.map(person => person.candidates.edges[0].node.id);

  const prepareTableData = (individuals: PersonNode[]): TableData[] => {
    return individuals.map(individual => ({
      id: individual.id,
      name: `${individual.name.firstName} ${individual.name.lastName}`,
      candidateStatus: individual.candidates?.edges[0]?.node?.candConversationStatus || 'N/A',
      startDate: individual?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.createdAt 
        ? dayjs(individual.candidates.edges[0].node.whatsappMessages.edges[0].node.createdAt).format('MMM D, HH:mm')
        : 'N/A',
      status: individual.candidates?.edges[0]?.node?.status || 'N/A',
      salary: individual.salary || 'N/A',
      city: individual.city || 'N/A',
      jobTitle: individual.jobTitle || 'N/A',
      checkbox: selectedIds.includes(individual.id)
    }));
  };

  const createCandidateShortlists = async (): Promise<void> => {
    try {
      await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/create-shortlist',
        { candidateIds: selectedCandidateIds },
        { headers: { authorization: `Bearer ${tokenPair?.accessToken?.token}`, 'content-type': 'application/json', 'x-schema-version': '66' } },
      );
      enqueueSnackBar('Shortlist created successfully', {
        variant: SnackBarVariant.Success,
        icon: React.createElement(IconCopy, { size: theme.icon.size.md }),
        duration: 2000,
      });
    } catch (error) {
      enqueueSnackBar('Error creating shortlist', {
        variant: SnackBarVariant.Error,
        icon: React.createElement(IconCopy, { size: theme.icon.size.md }),
        duration: 2000,
      });
    }
  };

  const createChatBasedShortlistDelivery = async (): Promise<void> => {
    try {
      await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/chat-based-shortlist-delivery',
        { candidateIds: selectedCandidateIds },
        { headers: { authorization: `Bearer ${tokenPair?.accessToken?.token}`, 'content-type': 'application/json', 'x-schema-version': '66' } },
      );
      enqueueSnackBar('Shortlist created successfully', {
        variant: SnackBarVariant.Success,
        icon: React.createElement(IconCopy, { size: theme.icon.size.md }),
        duration: 2000,
      });
    } catch (error) {
      enqueueSnackBar('Error creating shortlist', {
        variant: SnackBarVariant.Error,
        icon: React.createElement(IconCopy, { size: theme.icon.size.md }),
        duration: 2000,
      });
    }
  };

  const createUpdateCandidateStatus = async (): Promise<void> => {
    try {
      await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/refresh-chat-status-by-candidates',
        { candidateIds: selectedCandidateIds },
        { headers: { authorization: `Bearer ${tokenPair?.accessToken?.token}`, 'content-type': 'application/json', 'x-schema-version': '66' } },
      );
      enqueueSnackBar('Status updated successfully', {
        variant: SnackBarVariant.Success,
        icon: React.createElement(IconCopy, { size: theme.icon.size.md }),
        duration: 2000,
      });
    } catch (error) {
      enqueueSnackBar('Error updating status', {
        variant: SnackBarVariant.Error,
        icon: React.createElement(IconCopy, { size: theme.icon.size.md }),
        duration: 2000,
      });
    }
  };

  return {
    selectedIds,
    isAttachmentPanelOpen,
    currentPersonIndex,
    isChatOpen,
    currentCandidate,
    selectedPeople,
    handleCheckboxChange,
    handleSelectAll,
    handleViewChats,
    handleViewCVs,
    clearSelection,
    handlePrevCandidate,
    handleNextCandidate,
    prepareTableData,
    createCandidateShortlists,
    createChatBasedShortlistDelivery,
    createUpdateCandidateStatus,
    setIsAttachmentPanelOpen,
    setIsChatOpen,
  };
}; 