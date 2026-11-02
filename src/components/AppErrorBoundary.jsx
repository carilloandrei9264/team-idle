import { Component } from "react";

export default class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="app-error" role="alert">
        <div className="app-error__panel">
          <p className="app-error__eyebrow">TrustHome</p>
          <h1>Something went wrong</h1>
          <p>This page could not load correctly. Reload to try again.</p>
          <button type="button" className="btn btn--primary" onClick={this.handleReload}>
            Reload page
          </button>
        </div>
      </main>
    );
  }
}
