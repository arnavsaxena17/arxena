// ModalContext.tsx
import { Modal } from '@/ui/layout/modal/components/Modal';
import React, { createContext, ReactNode, useContext, useState } from 'react';

interface ModalContextType {
  isOpen: boolean;
  modalContent: React.ReactElement | null;  // Changed from ReactNode to ReactElement
  openModal: (content: React.ReactElement) => void;  // Changed from ReactNode to ReactElement
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [modalContent, setModalContent] = useState<React.ReactElement | null>(null);

  const openModal = (content: React.ReactElement) => {
    setModalContent(content);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setModalContent(null);
  };

  return (
    <ModalContext.Provider value={{ isOpen, modalContent, openModal, closeModal }}>
      {children}
      {isOpen && modalContent && (
        // modal props have changed and have to be accordingly adjusted. earlier modal props had only on close and on enter. now it has isClosable, onClose, onEnter, modalVariant, padding, size, className, hotkeyScope. removed it now
        <Modal>
          {modalContent}
        </Modal>
      )}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};