import { Outlet } from 'react-router-dom';
import {
  AppShell,
  ScrollArea,
  Group,
  Text,
  Code,
  ActionIcon,
  useMantineColorScheme,
  Box,
} from '@mantine/core';
import {
  LayoutDashboard,
  ShirtIcon,
  PenTool,
  Settings,
  Printer,
  Sun,
  Moon,
  ShoppingCart,
  Image,
} from 'lucide-react';
import { LinksGroup } from './LinksGroup.js';
import { UserButton } from './UserButton.js';

const navData = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
  {
    icon: ShirtIcon,
    label: 'Products',
    to: '/products',
  },
  {
    icon: PenTool,
    label: 'Designs',
    links: [
      { label: 'All Designs', link: '/designs' },
      { label: 'Templates', link: '/templates' },
    ],
  },
  {
    icon: Image,
    label: 'Assets',
    links: [
      { label: 'Cliparts', link: '/cliparts' },
      { label: 'Shapes', link: '/shapes' },
      { label: 'Fonts', link: '/fonts' },
    ],
  },
  {
    icon: Printer,
    label: 'Printing',
    to: '/printing',
  },
  {
    icon: ShoppingCart,
    label: 'Orders',
    to: '/orders',
  },
  {
    icon: Settings,
    label: 'Settings',
    initiallyOpened: false,
    links: [
      { label: 'General', link: '/settings' },
      { label: 'Languages', link: '/settings/languages' },
    ],
  },
];

export function Layout() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const links = navData.map((item) => <LinksGroup {...item} key={item.label} />);

  return (
    <AppShell
      navbar={{ width: 260, breakpoint: 0 }}
      padding="lg"
    >
      <AppShell.Navbar
        p="md"
        pb={0}
        style={{
          background: isDark ? '#0a0a0f' : '#1a1a2e',
          borderRight: `1px solid ${isDark ? '#222' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <Box
          pb="md"
          mb="sm"
          style={{ borderBottom: `1px solid ${isDark ? '#222' : 'rgba(255,255,255,0.08)'}` }}
        >
          <Group justify="space-between">
            <div>
              <Text size="lg" fw={800} c="white" style={{ letterSpacing: 0.5 }}>
                OpenMerch
              </Text>
            </div>
            <Group gap="xs">
              <Code fw={600} style={{ background: 'rgba(255,255,255,0.08)', color: '#888' }}>
                v0.0.1
              </Code>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={toggleColorScheme}
                title={isDark ? 'Light mode' : 'Dark mode'}
              >
                {isDark ? <Sun size={14} color="#ffd43b" /> : <Moon size={14} color="#888" />}
              </ActionIcon>
            </Group>
          </Group>
        </Box>

        {/* Links */}
        <ScrollArea style={{ flex: 1 }} scrollbarSize={4}>
          <Box py="xs">
            {links}
          </Box>
        </ScrollArea>

        {/* Footer */}
        <Box
          pt="sm"
          mt="sm"
          style={{ borderTop: `1px solid ${isDark ? '#222' : 'rgba(255,255,255,0.08)'}` }}
        >
          <UserButton />
        </Box>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
