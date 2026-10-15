import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Download,
  Upload,
  ShieldCheck,
  HardDrive,
  Trash2,
  RotateCcw,
  Database,
  CheckCircle2,
} from 'lucide-react';
import { db } from '../db/database';
import {
  exportData,
  downloadBackup,
  validateBackup,
  restoreData,
  saveDoc,
  purgeDoc,
} from '../services/data';
import { labels, type Doc, type Backup } from '../domain/models';
import { MigrationPanel } from '../components/MigrationPanel';
import { Modal, Badge, Empty } from '../components/Common';
export function Settings({ docs, notify }: { docs: Doc[]; notify: (s: string) => void }) {
  const [preview, setPreview] = useState<Backup | null>(null),
    [mode, setMode] = useState<'merge' | 'replace'>('merge'),
    [prefer, setPrefer] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [backed, setBacked] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [persist, setPersist] = useState<boolean | undefined>(),
    [estimate, setEstimate] = useState<StorageEstimate>();
  const last = useLiveQuery(() => db.meta.get('lastBackup'));
  const snapshots = useLiveQuery(() => db.snapshots.orderBy('at').reverse().toArray()) || [];
  const trash = docs.filter((d) => d.deletedAt);
  useEffect(() => {
    void navigator.storage?.persisted().then(setPersist);
    void navigator.storage?.estimate().then(setEstimate);
  }, []);
  async function backup() {
    downloadBackup(await exportData());
    await db.meta.put({ key: 'lastBackup', value: new Date().toISOString() });
    setBacked(true);
    notify('已发起备份下载，请确认文件已保存到下载文件夹');
  }
  async function file(file: File | undefined) {
    setError('');
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setError('备份超过 25 MB，请检查文件。');
      return;
    }
    try {
      const b = validateBackup(JSON.parse(await file.text()));
      setPreview(b);
      setMode('merge');
      setConfirmed(false);
      setBacked(false);
      setPrefer(false);
    } catch (e) {
      setError(`无法导入：${e instanceof Error ? e.message : '文件无效'}。原有数据未更改。`);
    }
  }
  const conflicts =
    preview?.docs.filter((d) =>
      docs.some((x) => x.id === d.id && JSON.stringify(x) !== JSON.stringify(d)),
    ).length || 0;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR DATA, YOUR CONTROL</span>
          <h1>设置与数据保护</h1>
          <p>长期积累的资料，值得被认真保管。</p>
        </div>
      </div>
      <MigrationPanel />
      <div className="settings-grid">
        <section className="panel settings-card">
          <span className="stat-icon purple">
            <Download size={22} />
          </span>
          <h2>为你的积累，留一份备份。</h2>
          <p>
            导出全部案例、题目、关联、公司备战、面试安排、复盘、练习记录与回收站，保存为可迁移的
            JSON 文件。
          </p>
          <div className="backup-status">
            <CheckCircle2 size={17} />
            {last
              ? `上次导出：${new Date(last.value).toLocaleString('zh-CN')}`
              : '还没有导出过备份，建议现在创建一份。'}
          </div>
          <button className="btn primary" onClick={() => backup().catch((e) => notify(String(e)))}>
            <Download size={16} />
            导出完整备份
          </button>
          <small>建议每周及重要编辑后备份，并在其他磁盘保留一份副本。</small>
        </section>
        <section className="panel settings-card">
          <span className="stat-icon pink">
            <Upload size={22} />
          </span>
          <h2>从备份恢复</h2>
          <p>导入前会检查文件格式、版本、重复 ID 和关联完整性。先预览，再选择合并或替换。</p>
          <label className="btn file-button">
            <Upload size={16} />
            选择 JSON 备份
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                void file(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <small>支持 CASEBOOK v1 备份格式，暂不支持 Word、PDF 或任意 JSON。</small>
        </section>
      </div>
      <section className="panel storage-panel">
        <div className="section-title">
          <h2>
            <HardDrive size={19} /> 浏览器工作缓存
          </h2>
          <Badge tone="green">私人云端 + 工作缓存</Badge>
        </div>
        <p>
          登录后从私人数据库载入资料。编辑先保存在当前页面缓存，再自动同步到云端；请确认顶部显示“已保存到私人云端”后关闭页面。退出登录会清除此页面缓存。
        </p>
        <div className="storage-facts">
          <div>
            <span>固定访问地址</span>
            <strong>当前网页地址</strong>
          </div>
          <div>
            <span>当前存储占用</span>
            <strong>
              {estimate?.usage !== undefined
                ? `${(estimate.usage / 1024 / 1024).toFixed(2)} MB`
                : '浏览器未提供'}
            </strong>
          </div>
          <div>
            <span>持久存储保护</span>
            <strong>{persist === undefined ? '不可用' : persist ? '已获准' : '尚未获准'}</strong>
          </div>
        </div>
        <button
          className="btn"
          onClick={async () => {
            try {
              const result = await navigator.storage?.persist();
              setPersist(result);
              notify(
                result
                  ? '浏览器已允许持久存储，仍需定期备份'
                  : '浏览器未授予持久存储，请定期导出备份',
              );
            } catch (e) {
              notify(String(e));
            }
          }}
        >
          <ShieldCheck size={16} />
          申请浏览器持久存储
        </button>
        <div className="notice">
          换设备后登录同一账号即可载入已同步的资料。导入前快照只保存在当前页面缓存；建议定期下载独立 JSON 备份。
        </div>
      </section>
      <section className="panel storage-panel">
        <div className="section-title">
          <h2>
            <Database size={18} /> 导入前恢复快照
          </h2>
          <Badge>{snapshots.length} / 5</Badge>
        </div>
        <p>每次导入前自动保存，最多保留最近 5 份。恢复快照同样会先保留当前数据。</p>
        {snapshots.length ? (
          snapshots.map((s) => (
            <div className="content-row" key={s.id}>
              <span>{new Date(s.at).toLocaleString('zh-CN')}</span>
              <button
                className="btn small"
                onClick={() => {
                  try {
                    setPreview(validateBackup(JSON.parse(s.data)));
                    setMode('replace');
                    setConfirmed(false);
                    setBacked(false);
                  } catch (e) {
                    notify(String(e));
                  }
                }}
              >
                <RotateCcw size={14} />
                预览恢复
              </button>
            </div>
          ))
        ) : (
          <p className="muted">尚未执行导入。</p>
        )}
      </section>
      <section className="panel storage-panel">
        <div className="section-title">
          <h2>
            <Trash2 size={18} /> 回收站
          </h2>
          <Badge>{trash.length} 条内容</Badge>
        </div>
        <p>删除的内容不会自动清空，恢复后原有关联会重新显示。</p>
        {trash.length ? (
          trash.map((d) => (
            <div className="content-row" key={d.id}>
              <Badge>{labels[d.kind]}</Badge>
              <span>{d.title || '未命名'}</span>
              <button
                className="btn small"
                onClick={async () => {
                  try {
                    await saveDoc({ ...d, deletedAt: null });
                    notify('已恢复内容');
                  } catch (e) {
                    notify(String(e));
                  }
                }}
              >
                恢复
              </button>
              <button
                className="btn small danger-text"
                onClick={async () => {
                  if (
                    window.confirm(
                      `永久删除「${d.title || '未命名'}」及相关引用？此操作不能撤销，请先备份。`,
                    )
                  ) {
                    try {
                      await purgeDoc(d.id);
                      notify('已永久删除');
                    } catch (e) {
                      notify(String(e));
                    }
                  }
                }}
              >
                永久删除
              </button>
            </div>
          ))
        ) : (
          <Empty title="回收站是空的" description="移入回收站的内容会出现在这里。" />
        )}
      </section>
      <section className="panel storage-panel">
        <h2>关于 CASEBOOK</h2>
        <p>
          版本 2.0 · 私人账号登录，云端保存。仅受邀账号可访问；不开放注册。
        </p>
        <p>
          使用建议：先建立真实案例，再关联问题；按公司整理备战内容，面试前用速记复习，面试后记录复盘。任何未经核实的数据都应保持“待核实”或“假设案例”状态。
        </p>
      </section>
      {preview && (
        <Modal
          title="备份导入预览"
          onClose={() => {
            if (!busy) setPreview(null);
          }}
          wide
        >
          <p>
            备份时间：{new Date(preview.exportedAt).toLocaleString('zh-CN')} · 格式 v
            {preview.schemaVersion}
          </p>
          <div className="import-counts">
            {(['case', 'question', 'company', 'review', 'practice'] as const).map((k) => (
              <div key={k}>
                <strong>{preview.docs.filter((d) => d.kind === k).length}</strong>
                <span>{labels[k]}</span>
              </div>
            ))}
          </div>
          <p>
            {preview.links.length} 条关联 · {preview.sessions.length} 场面试安排 · {conflicts} 条同
            ID 内容存在差异
          </p>
          <label className="field">
            <span>导入策略</span>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as 'merge' | 'replace');
                setConfirmed(false);
              }}
            >
              <option value="merge">合并：保留现有内容，加入新 ID</option>
              <option value="replace">替换：用备份完整替换现有内容</option>
            </select>
          </label>
          {mode === 'merge' ? (
            <label className="check-label">
              <input
                type="checkbox"
                checked={prefer}
                onChange={(e) => setPrefer(e.target.checked)}
              />
              同 ID 内容冲突时，使用备份版本覆盖本地（默认保留本地）
            </label>
          ) : (
            <div className="notice">
              替换会覆盖当前全部业务数据。请先下载当前备份，并确认文件已成功保存。
              <button className="btn small" onClick={() => void backup()}>
                下载当前备份
              </button>
            </div>
          )}
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {mode === 'replace'
              ? '我已保存当前备份，并确认替换全部数据'
              : '我已检查导入内容及冲突处理策略'}
          </label>
          <div className="modal-actions">
            <button className="btn" disabled={busy} onClick={() => setPreview(null)}>
              取消
            </button>
            <button
              className="btn primary"
              disabled={busy || !confirmed || (mode === 'replace' && !backed)}
              onClick={async () => {
                setBusy(true);
                try {
                  await restoreData(preview, mode, prefer);
                  setPreview(null);
                  notify('导入完成，导入前快照已保留');
                } catch (e) {
                  notify(`导入失败，原有数据未改变：${String(e)}`);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? '正在恢复…' : '确认导入'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
