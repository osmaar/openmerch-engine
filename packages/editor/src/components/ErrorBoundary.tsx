import { Component, type ErrorInfo, type ReactNode } from 'react';
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        height: '100%',
        minHeight: '100vh',
        width: '100%',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center',
        padding: '0 16px',
        background: '#fff',
      }}
    >
      <AlertTriangle size={40} color="#c0392b" />
      <div style={{ fontSize: 18, fontWeight: 600, color: '#333' }}>
        {t('Something went wrong')}
      </div>
      <div style={{ fontSize: 14, color: '#666', maxWidth: 420 }}>
        {t('An unexpected error occurred. Please reload the page.')}
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 8,
          padding: '8px 20px',
          fontSize: 14,
          fontWeight: 600,
          color: '#fff',
          background: '#4A90D9',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        {t('Reload Page')}
      </button>
    </div>
  );
}

// Must be a class component — React error boundaries require getDerivedStateFromError/componentDidCatch, hooks can't implement them.
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
