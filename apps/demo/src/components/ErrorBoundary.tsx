import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

function ErrorFallback() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        height: '100vh',
        fontFamily: 'system-ui',
        textAlign: 'center',
        padding: '0 16px',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600, color: '#333' }}>Something went wrong</div>
      <div style={{ fontSize: 14, color: '#666', maxWidth: 420 }}>
        An unexpected error occurred. Please reload the page.
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
        Reload Page
      </button>
    </div>
  );
}

/**
 * Catches render errors anywhere in its subtree and shows a recoverable
 * fallback instead of leaving the demo app on a blank white screen.
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
