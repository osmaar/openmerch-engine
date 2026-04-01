import { modals } from '@mantine/modals';
import { Text } from '@mantine/core';

export function useConfirm() {
  const confirm = (title: string, message: string, onConfirm: () => void) => {
    modals.openConfirmModal({
      title,
      centered: true,
      children: <Text size="sm">{message}</Text>,
      labels: { confirm: 'Confirm', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm,
    });
  };

  return confirm;
}
