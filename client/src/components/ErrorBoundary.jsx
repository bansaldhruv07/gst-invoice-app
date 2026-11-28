// Shown instead of a blank page if a screen fails to draw.
import { Component } from "react";
import { Logo } from "./Logo";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("Screen error:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="min-h-screen grid place-items-center bg-slate-50 p-6 text-center">
        <div className="max-w-sm">
          <Logo className="w-12 h-12 mx-auto" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Something went wrong</h1>
          <p className="mt-2 text-slate-600">Your saved records are safe. Reload the page to continue.</p>
          <button type="button" onClick={() => window.location.reload()} className="btn-primary mt-6">Reload</button>
        </div>
      </div>
    );
  }
}
