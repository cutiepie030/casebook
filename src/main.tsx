import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/main.css';
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <div style={{ padding: 48, fontFamily: 'sans-serif' }}>
        <h1>页面遇到了问题</h1>
        <p>已保存的资料仍在本地数据库中。请刷新重试。</p>
        <pre>{this.state.error}</pre>
        <button onClick={() => location.reload()}>刷新页面</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
