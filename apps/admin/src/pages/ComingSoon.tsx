import { Stack, Title, Text } from '@mantine/core';
import { Construction } from 'lucide-react';

export function ComingSoon({ title }: { title: string }) {
  return (
    <Stack align="center" justify="center" h="60vh" gap="xs">
      <Construction size={48} opacity={0.3} />
      <Title order={3} c="dimmed">{title}</Title>
      <Text size="sm" c="dimmed">Coming soon</Text>
    </Stack>
  );
}
