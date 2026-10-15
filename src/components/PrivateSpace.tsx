import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, LockKeyhole, LogOut, Cloud } from 'lucide-react';
import { loadClient, cloud, clearCache, VaultSync } from '../services/cloud';
import { liveQuery } from 'dexie';
import { fingerprint } from '../services/cloud';
import { flushEditors } from '../services/editorFlush';
import { downloadBackup, exportData } from '../services/data';
export function PrivateSpace({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false),
    [configured, setConfigured] = useState(false),
    [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState('');
  const [status, setStatus] = useState(''),
    [blocked, setBlocked] = useState(false);
  const pending = useRef(false);
  const sync = useRef<VaultSync | null>(null);
  useEffect(() => {
    let active = true;
    void loadClient()
      .then(() => {
        if (active) setConfigured(true);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const changes = liveQuery(() => exportData()).subscribe((value) => {
      pending.current = fingerprint(value) !== sync.current?.baseline;
      if (pending.current && !sync.current?.stopped) setStatus('有编辑待保存到云端…');
    });
    const timer = setInterval(() => void sync.current?.tick(), 3000);
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current || sync.current?.busy || status !== '已保存到私人云端')
        event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    const { data } = cloud().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (sync.current) sync.current.stopped = true;
        setReady(false);
        setError('会话已结束，请重新登录。');
      }
    });
    return () => {
      changes.unsubscribe();
      clearInterval(timer);
      window.removeEventListener('beforeunload', warn);
      data.subscription.unsubscribe();
    };
  }, [ready, status]);
  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await cloud().auth.signInWithPassword({ email: email.trim(), password });
      setPassword('');
      if (result.error) throw Error('账号或密码不正确，或暂时无法连接。请重试。');
      const controller = new VaultSync((message, conflict) => {
        setStatus(message);
        setBlocked(!!conflict);
      });
      await controller.initialize();
      sync.current = controller;
      setStatus('正在核对云端保存状态…');
      setBlocked(false);
      setReady(true);
    } catch (e) {
      await cloud().auth.signOut({ scope: 'local' });
      setError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (!(await flushEditors())) {
      setStatus('编辑尚未保存，请先处理编辑器提示');
      return;
    }
    const controller = sync.current;
    await controller?.tick();
    if (controller?.busy) {
      setStatus('正在保存，请稍后再退出');
      return;
    }
    if (
      (controller?.lastError || (await controller?.hasPending())) &&
      !confirm('当前可能有尚未同步的编辑，请先下载备份。仍要退出并清除此设备缓存吗？')
    )
      return;
    if (controller) controller.stopped = true;
    setReady(false);
    await cloud().auth.signOut({ scope: 'local' });
    await clearCache();
    setError('');
  }
  if (!ready)
    return (
      <main className="auth-screen">
        <section className="auth-card panel">
          <span className="brand-mark">
            <BookOpen size={24} />
          </span>
          <span className="eyebrow">YOUR PRIVATE CASEBOOK</span>
          <h1>每段经历，都有回响。</h1>
          <p>登录你的私人空间，继续积累与下一次面试有关的故事。</p>
          <form onSubmit={login}>
            <label className="field">
              <span>登录账号（邮箱）</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span>密码</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="btn primary" disabled={!configured || busy}>
              <LockKeyhole size={16} />
              {busy ? '正在打开私人空间…' : '登录私人案例库'}
            </button>
          </form>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <small>仅限受邀账号。每次打开需登录，密码由身份服务验证。</small>
        </section>
      </main>
    );
  return (
    <>
      <div className={`cloud-bar ${blocked ? 'cloud-warning' : ''}`}>
        <Cloud size={16} />
        <span role="status">{status}</span>
        <button className="btn small" onClick={() => void sync.current?.tick()}>
          立即同步
        </button>
        <button
          className="btn small"
          onClick={() =>
            void flushEditors().then((ok) => {
              if (ok) return exportData().then(downloadBackup);
            })
          }
        >
          下载备份
        </button>
        <button className="btn small" onClick={() => void logout()}>
          <LogOut size={14} />
          退出登录
        </button>
      </div>
      <div className={blocked ? 'cloud-blocked' : ''}>{children}</div>
    </>
  );
}
