import { Button } from '@/ui/input/button/components/Button';

export const AIInterviewModalCloseButton = ({
  closeModal,
}: {
  closeModal: () => void;
}) => {
  return (
    <Button
      variant="secondary"
      accent="danger"
      size="small"
      onClick={closeModal}
      justify="center"
      title="Close"
      type="submit"
    />
  );
};
