import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Center, Stack, Text, Title, ThemeIcon } from '@mantine/core';
import { AlertTriangle } from 'lucide-react';
import { useT } from '../i18n/useTranslation.js';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

function ErrorFallback() {
  const t = useT();

  return (
    <Center h="100vh" px="md">
      <Stack align="center" gap="sm" maw={420}>
        <ThemeIcon size={56} radius="xl" color="red" variant="light">
          <AlertTriangle size={28} />
        </ThemeIcon>
        <Title order={3} ta="center">{t('Something went wrong')}</Title>
        <Text c="dimmed" ta="center">
          {t('An unexpected error occurred. Please reload the page.')}
        </Text>
        <Button onClick={() => window.location.reload()} mt="sm">
          {t('Reload Page')}
        </Button>
      </Stack>
    </Center>
  );
}

/**
 * Catches render errors anywhere in its subtree and shows a recoverable
 * fallback instead of leaving the admin panel on a blank white screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
