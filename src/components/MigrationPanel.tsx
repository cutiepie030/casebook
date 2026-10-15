import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Download } from 'lucide-react';
import { restoreData, validateBackup } from '../services/data';
const LOCAL = 'http://localhost:4173';
export function MigrationPanel() {
  const [status, setStatus] = useState(''),
    [waiting, setWaiting] = useState(false);
  const popup = useRef<Window | null>(null),
    channel = useRef('');
  useEffect(() => {
    const receive = async (event: MessageEvent) => {
      if (
        event.origin !== LOCAL ||
        event.source !== popup.current ||
        !channel.current ||
        event.data?.channel !== channel.current ||
        event.data?.type !== 'CASEBOOK_TRANSFER'
      )
        return;
      setWaiting(true);
      try {
        const backup = validateBackup(event.data.backup);
        await restoreData(backup, 'merge', false);
        popup.current?.postMessage(
          { type: 'CASEBOOK_TRANSFER_DONE', channel: channel.current },
          LOCAL,
        );
        channel.current = '';
        setStatus(
          `迁移完成：${backup.docs.filter((d) => d.kind === 'case' && !d.deletedAt && !d.demo).length}个案例，资料已载入，顶部显示“已保存到私人云端”后即可在其他设备登录查看。`,
        );
      } catch {
        setStatus('资料未能迁移，原有内容保留。可使用下方 JSON 备份导入。');
      } finally {
        setWaiting(false);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  function start() {
    channel.current = crypto.randomUUID();
    const params = new URLSearchParams({
      transferTo: window.location.href,
      channel: channel.current,
    });
    popup.current = window.open(
      LOCAL + '/?' + params,
      'casebook-transfer',
      'popup,width=760,height=700',
    );
    if (!popup.current) {
      setStatus('弹窗被浏览器拦截，请允许此站点弹窗后重试。');
      return;
    }
    setWaiting(true);
    setStatus('请在新窗口确认迁移；若打不开，请先在Mac双击启动本地CASEBOOK。');
  }
  return (
    <section className="panel storage-panel imported-library">
      <div className="section-title">
        <h2>把本机 CASEBOOK 资料带过来</h2>
        <Download size={20} />
      </div>
      <p>
        先在 Mac 启动本地
        CASEBOOK，再点击下方按钮，在新窗口确认。资料将复制到你登录的私人云端空间，不会写入公开
        GitHub 仓库。
      </p>
      <button className="btn primary" onClick={start}>
        <ArrowUpRight size={16} />
        {waiting ? '重新打开迁移窗口' : '从本机迁移现有资料'}
      </button>
      <small className="muted"> 也可以在本地设置中导出 JSON，再在此页面导入。</small>
      {status && <p role="status">{status}</p>}
    </section>
  );
}
