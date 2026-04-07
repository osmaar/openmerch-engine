import { Stack, Title, Text } from '@mantine/core';
import { Construction } from 'lucide-react';
import { useT } from '../i18n/useTranslation.js';

export function ComingSoon({ title }: { title: string }) {
  const t = useT();
  return (
    <Stack align="center" justify="center" h="60vh" gap="xs">
      <Construction size={48} opacity={0.3} />
      <Title order={3} c="dimmed">{title}</Title>
      <Text size="sm" c="dimmed">{t('Coming soon')}</Text>
    </Stack>
  );
}
