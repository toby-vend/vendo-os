/**
 * Error boundary — wraps the whole dashboard so a runtime error in one
 * tab doesn't take the entire page down. Renders a small recovery card
 * with a "Refresh" affordance and (in internal mode only) the underlying
 * error message.
 *
 * React requires a class component for `componentDidCatch`, so this is
 * the one class in the bundle.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** When true, show the error message + stack. Off for client-mode. */
  showDetails: boolean;
  children: ReactNode;
}

interface State {
  err: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    // Log to the browser console so devs can see the stack. We don't
    // beacon anywhere here — Phase 4 may wire a /api/report-errors hook.
    console.error('[client-report] error caught by ErrorBoundary:', err, info);
  }

  reset = (): void => {
    this.setState({ err: null });
  };

  render(): ReactNode {
    const { err } = this.state;
    if (!err) return this.props.children;

    return (
      <div className="vr-error-card">
        <div className="vr-error-mark">⚠</div>
        <h2 className="vr-error-title">Something went wrong rendering the report</h2>
        <p className="vr-error-body">
          The page hit an unexpected error. Try refreshing — if it keeps
          happening, let us know and we'll investigate.
        </p>
        {this.props.showDetails && (
          <details className="vr-error-details">
            <summary>Error details</summary>
            <pre className="vr-error-pre">{err.message}{err.stack ? `\n\n${err.stack}` : ''}</pre>
          </details>
        )}
        <div className="vr-error-actions">
          <button type="button" className="vr-btn" onClick={this.reset}>
            Try again
          </button>
          <button type="button" className="vr-btn vr-btn-primary" onClick={() => window.location.reload()}>
            Refresh page
          </button>
        </div>
      </div>
    );
  }
}
