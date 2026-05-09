import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 12, color: '#9C1A1F', background: '#FBF7EE', height: '100%', overflow: 'auto' }}>
          <h3 style={{ fontFamily: 'sans-serif', margin: '0 0 8px 0' }}>{this.props.label || '渲染错误'}</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{String(this.state.error?.stack || this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
