import { useEffect, useState } from 'react';
import { Title, Paper, Table, ActionIcon, Group, Text, Stack, Badge } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Trash2, Download, PenTool } from 'lucide-react';
import { listDesigns, deleteDesign } from '../services/api.js';
import type { Design } from '../services/api.js';
import { useConfirm } from '../hooks/useConfirm.js';

export function Designs() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();

  const load = () => {
    setLoading(true);
    listDesigns().then(setDesigns).catch(() => setDesigns([])).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id: string) => {
    confirm('Delete Design', 'Are you sure you want to delete this design? This action cannot be undone.', async () => {
      await deleteDesign(id).catch(() => {});
      notifications.show({ title: 'Design deleted', message: 'The design has been deleted', color: 'red' });
      load();
    });
  };

  const handleDownload = (d: Design) => {
    const blob = new Blob([JSON.stringify(d.designData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${d.name}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Title order={2} mb="lg">Saved Designs</Title>

      <Paper radius="md" withBorder>
        {loading ? (
          <Text c="dimmed" ta="center" p="xl" size="sm">Loading...</Text>
        ) : designs.length === 0 ? (
          <Stack align="center" p="xl" gap="xs">
            <PenTool size={40} opacity={0.3} />
            <Text c="dimmed" size="sm">No designs yet</Text>
            <Text c="dimmed" size="xs">Designs appear here when users save from the editor</Text>
          </Stack>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Product</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th>Updated</Table.Th>
                <Table.Th w={100}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {designs.map((d) => (
                <Table.Tr key={d.id}>
                  <Table.Td fw={500}>{d.name}</Table.Td>
                  <Table.Td><Badge variant="light" color="gray" size="sm">{d.productId.substring(0, 8)}...</Badge></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{new Date(d.createdAt).toLocaleString()}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{new Date(d.updatedAt).toLocaleString()}</Text></Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end">
                      <ActionIcon variant="subtle" color="blue" onClick={() => handleDownload(d)} title="Download JSON">
                        <Download size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(d.id)} title="Delete">
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </div>
  );
}
