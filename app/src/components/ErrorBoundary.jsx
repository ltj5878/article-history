import { Component } from 'react';

const showTechnicalDetails = import.meta.env.DEV;

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
        <div className="render-error" role="alert">
          <h3>{this.props.label || '渲染错误'}</h3>
          <p>这个区域暂时无法显示，可以尝试重新渲染。</p>
          <button type="button" onClick={() => this.setState({ error: null })}>重试</button>
          {showTechnicalDetails && (
            <details>
              <summary>开发信息</summary>
              <pre>{String(this.state.error?.stack || this.state.error)}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
