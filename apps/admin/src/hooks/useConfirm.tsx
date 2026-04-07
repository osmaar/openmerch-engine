import { modals } from '@mantine/modals';
import { Text } from '@mantine/core';
import { useT } from '../i18n/useTranslation.js';

export function useConfirm() {
  const t = useT();

  const confirm = (title: string, message: string, onConfirm: () => void) => {
    modals.openConfirmModal({
      title,
      centered: true,
      children: <Text size="sm">{message}</Text>,
      labels: { confirm: t('Confirm'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm,
    });
  };

  return confirm;
}
