import { Button } from '@/ui/input/button/components/Button';

export const VideoInterviewModalCloseButton = ({
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
