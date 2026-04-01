import { UnstyledButton, Group, Avatar, Text, Box } from '@mantine/core';
import { ChevronRight } from 'lucide-react';

export function UserButton() {
  return (
    <UnstyledButton
      style={{
        display: 'block',
        width: '100%',
        padding: '10px 12px',
        borderRadius: 8,
        color: '#ccc',
      }}
    >
      <Group>
        <Avatar radius="xl" size="sm" color="blue">M</Avatar>
        <Box style={{ flex: 1 }}>
          <Text size="xs" fw={500} c="white">Merchant</Text>
          <Text size="xs" c="dimmed">admin@openmerch.com</Text>
        </Box>
        <ChevronRight size={14} color="#666" />
      </Group>
    </UnstyledButton>
  );
}
