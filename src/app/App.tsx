import { useState, useEffect, useCallback, lazy, Suspense, type ReactNode } from 'react';
import { createHashRouter, RouterProvider, Link, NavLink, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  LayoutDashboard,
  BookOpen,
  MessagesSquare,
  Building2,
  Layers,
  Mic,
  NotebookPen,
  Settings as SettingsIcon,
  Search,
  Command,
  ArrowUpRight,
  Menu,
  X,
  HardDrive,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { db } from '../db/database';
import { initialize } from '../services/initialize';
import { labels, searchable, type Doc } from '../domain/models';
import { Dashboard } from '../features/Dashboard';
import { Library } from '../features/Library';
const Detail = lazy(() => import('../features/Detail').then((m) => ({ default: m.Detail })));
import { Study } from '../features/Study';
import { Settings } from '../features/Settings';
import { Modal, Badge } from '../components/Common';
const navigation = [
  { to: '/', label: '总览', en: 'Overview', Icon: LayoutDashboard },
  { to: '/case', label: '案例库', en: 'My Cases', Icon: BookOpen },
  { to: '/question', label: '面试题库', en: 'Question Bank', Icon: MessagesSquare },
  { to: '/company', label: '公司备战', en: 'Company Prep', Icon: Building2 },
  { to: '/flashcards', label: '速记卡片', en: 'Flashcards', Icon: Layers },
  { to: '/practice', label: '自主练习', en: 'Practice', Icon: Mic },
  { to: '/review', label: '面试复盘', en: 'Interview Reviews', Icon: NotebookPen },
];
function Shell() {
  const location = useLocation();
  const docs = useLiveQuery(() => db.docs.toArray());
  const [ready, setReady] = useState(false),
    [initError, setInitError] = useState(''),
    [searchOpen, setSearchOpen] = useState(false),
    [query, setQuery] = useState(''),
    [toast, setToast] = useState(''),
    [mobile, setMobile] = useState(false);
  const notify = useCallback((s: string) => setToast(s), []);
  useEffect(() => {
    void initialize()
      .then(() => setReady(true))
      .catch((e) => setInitError(String(e)));
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 6500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((x) => !x);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setMobile(false);
      }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);
  useEffect(() => {
    setMobile(false);
    setSearchOpen(false);
  }, [location.pathname]);
  const parts = location.pathname.split('/').filter(Boolean);
  const kind = parts[0];
  const title =
    navigation.find((n) => n.to === `/${kind}`)?.label || (kind === 'settings' ? '设置' : '总览');
  let page: ReactNode;
  if (initError)
    page = (
      <div className="empty">
        <h2>无法载入工作台</h2>
        <p>{initError}</p>
        <p>请检查浏览器是否允许网站存储，并使用普通浏览模式。</p>
      </div>
    );
  else if (!docs || !ready) page = <div className="empty">正在整理你的工作台…</div>;
  else if (parts.length === 2 && ['case', 'question', 'company', 'review'].includes(kind))
    page = <Detail docs={docs} notify={notify} />;
  else if (['case', 'question', 'company', 'review'].includes(kind))
    page = (
      <Library
        key={kind}
        kind={kind as 'case' | 'question' | 'company' | 'review'}
        docs={docs}
        notify={notify}
      />
    );
  else if (kind === 'flashcards' || kind === 'practice')
    page = <Study key={kind} docs={docs} practice={kind === 'practice'} notify={notify} />;
  else if (kind === 'settings') page = <Settings docs={docs} notify={notify} />;
  else if (parts.length)
    page = (
      <div className="empty">
        <h2>页面不存在</h2>
        <Link className="btn" to="/">
          返回总览
        </Link>
      </div>
    );
  else page = <Dashboard docs={docs} notify={notify} />;
  const results = query.trim()
    ? (docs || []).filter((d) => !d.deletedAt && searchable(d).includes(query.trim().toLowerCase()))
    : [];
  return (
    <div className="app">
      <aside className={`sidebar ${mobile ? 'open' : ''}`}>
        <Link className="brand" to="/">
          <span className="brand-mark">
            <BookOpen size={21} />
          </span>
          <span>
            CASEBOOK<small>每段经历，都有回响</small>
          </span>
        </Link>
        <button className="sidebar-search" onClick={() => setSearchOpen(true)}>
          <Search size={16} />
          <span>搜索你的知识库</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="nav-caption">我的面试工作台</div>
        <nav>
          {navigation.map(({ to, label, en, Icon }) => (
            <NavLink
              to={to}
              end={to === '/'}
              key={to}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <Icon size={18} />
              <div>
                {label}
                <small>{en}</small>
              </div>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span>✦</span>
            <p>
              你走过的每一步，
              <br />
              都是下一次出发的底气。
            </p>
          </div>
          <NavLink className="nav-item settings-link" to="/settings">
            <SettingsIcon size={18} />
            <div>
              设置与备份<small>Settings</small>
            </div>
          </NavLink>
          <div className="local-status">
            <span />
            <span>本地空间 · 资料仅你可见</span>
            <HardDrive size={13} />
          </div>
        </div>
      </aside>
      {mobile && (
        <button aria-label="收起导航" className="sidebar-scrim" onClick={() => setMobile(false)} />
      )}
      <div className="workspace">
        <header className="topbar">
          <div>
            <button
              className="icon-btn mobile-toggle"
              aria-label="展开导航"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span>我的空间</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div>
            <span className="topbar-status">
              <span /> 本地已就绪
            </span>
            <button className="icon-btn" aria-label="全局搜索" onClick={() => setSearchOpen(true)}>
              <Search size={18} />
            </button>
            <div className="avatar">我</div>
          </div>
        </header>
        <main key={location.pathname}>
          <Suspense fallback={<div className="empty">正在打开内容…</div>}>{page}</Suspense>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button className="icon-btn" aria-label="关闭提示" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {searchOpen && (
        <Modal title="搜索你的知识库" onClose={() => setSearchOpen(false)} wide>
          <div className="global-search-input">
            <Search size={20} />
            <input
              autoFocus
              aria-label="全局搜索"
              placeholder="搜索案例、题目、公司、标签或正文…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>ESC</kbd>
          </div>
          <div className="search-results">
            {query.trim() ? (
              results.length ? (
                (['case', 'question', 'company', 'review', 'practice'] as const).map((k) => {
                  const group = results.filter((d) => d.kind === k);
                  return group.length ? (
                    <section key={k}>
                      <h3>
                        {labels[k]} · {group.length}
                      </h3>
                      {group.slice(0, 30).map((d) => (
                        <Link
                          key={d.id}
                          className="content-row"
                          onClick={() => setSearchOpen(false)}
                          to={k === 'practice' ? '/practice' : `/${k}/${d.id}`}
                        >
                          <span>{d.title || '未命名'}</span>
                          {d.demo && <Badge tone="demo">DEMO</Badge>}
                          <ArrowUpRight size={16} />
                        </Link>
                      ))}
                    </section>
                  ) : null;
                })
              ) : (
                <p className="soft-empty">没有匹配内容，试试其他关键词。</p>
              )
            ) : (
              <div className="soft-empty">
                <Command size={26} />
                <p>从记得的一点线索，找到完整的故事。</p>
                <small>支持搜索全文、标签、公司和岗位方向</small>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
const router = createHashRouter([{ path: '*', element: <Shell /> }]);
export function App() {
  return <RouterProvider router={router} />;
}
