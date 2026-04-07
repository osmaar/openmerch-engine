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
  Menu,
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
  Globe,
  Check,
} from 'lucide-react';
import { LinksGroup } from './LinksGroup.js';
import { useT, useI18nStore } from '../i18n/useTranslation.js';

export function Layout() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const t = useT();
  const currentLang = useI18nStore((s) => s.currentLang);
  const availableLangs = useI18nStore((s) => s.availableLangs);
  const setLang = useI18nStore((s) => s.setLang);

  const navData = [
    { icon: LayoutDashboard, label: t('Dashboard'), to: '/' },
    {
      icon: ShirtIcon,
      label: t('Products'),
      to: '/products',
    },
    {
      icon: PenTool,
      label: t('Designs'),
      links: [
        { label: t('Customer Designs'), link: '/designs' },
        { label: t('Templates'), link: '/templates' },
      ],
    },
    {
      icon: Image,
      label: t('Assets'),
      links: [
        { label: t('Cliparts'), link: '/cliparts' },
        { label: t('Shapes'), link: '/shapes' },
        { label: t('Fonts'), link: '/fonts' },
      ],
    },
    {
      icon: Printer,
      label: t('Printing'),
      to: '/printing',
    },
    {
      icon: ShoppingCart,
      label: t('Orders'),
      to: '/orders',
    },
    {
      icon: Settings,
      label: t('Settings'),
      initiallyOpened: false,
      links: [
        { label: t('General'), link: '/settings' },
        { label: t('Languages'), link: '/settings/languages' },
      ],
    },
  ];

  const langs = [
    { id: 'en', name: 'English', flag: '\u{1F1FA}\u{1F1F8}' },
    ...Object.values(availableLangs).filter((l) => l.code !== 'en').map((l) => ({ id: l.code, name: l.name, flag: l.flag })),
  ];

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
              <Menu shadow="md" position="bottom-end" width={180}>
                <Menu.Target>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    title={t('Languages')}
                  >
                    <Globe size={14} color="#888" />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{t('Languages')}</Menu.Label>
                  {langs.map((l) => (
                    <Menu.Item
                      key={l.id}
                      leftSection={<span style={{ fontSize: 16 }}>{l.flag}</span>}
                      rightSection={currentLang === l.id ? <Check size={14} /> : null}
                      onClick={() => setLang(l.id)}
                    >
                      {l.name}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={toggleColorScheme}
                title={isDark ? t('Light mode') : t('Dark mode')}
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
          pb="sm"
          style={{ borderTop: `1px solid ${isDark ? '#222' : 'rgba(255,255,255,0.08)'}` }}
        >
          <Text size="xs" c="dimmed" ta="center" style={{ lineHeight: 1.5 }}>
            © {new Date().getFullYear()} OpenMerch Engine
            <br />
            {t('Open Source')} · MIT
          </Text>
        </Box>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
