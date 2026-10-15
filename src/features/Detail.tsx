import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link, useBlocker } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Star,
  Copy,
  Trash2,
  Check,
  Link2,
  Plus,
  ExternalLink,
  Pencil,
  ShieldCheck,
} from 'lucide-react';
import { db } from '../db/database';
import {
  fresh,
  labels,
  roleOptions,
  plain,
  forms,
  type Doc,
  type Link as Relation,
  type Session,
} from '../domain/models';
import { saveDoc, removeDoc, addLink } from '../services/data';
import { fields, type Field } from './fields';
import { Editor } from '../components/Editor';
import { RichText } from '../components/RichText';
import { Badge, Modal, Empty } from '../components/Common';
function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className={`field ${field.type === 'rich' || field.type === 'textarea' ? 'full' : ''}`}>
      <span>{field.label}</span>
      {field.type === 'rich' ? (
        <Editor label={field.label} value={value} onChange={onChange} />
      ) : field.type === 'textarea' ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">请选择</option>
          {field.options?.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      ) : (
        <input
          type={field.type || 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}{' '}
      {field.hint && <small>{field.hint}</small>}
    </label>
  );
}
export function Detail({ docs, notify }: { docs: Doc[]; notify: (s: string) => void }) {
  const { '*': path } = useParams();
  const id = path?.split('/')[1];
  const d = docs.find((d) => d.id === id);
  if (!d) return <Empty title="内容不存在" description="可能已被永久删除，或链接已失效。" />;
  return <DetailBody key={d.id} initial={d} docs={docs} notify={notify} />;
}
function DetailBody({
  initial,
  docs,
  notify,
}: {
  initial: Doc;
  docs: Doc[];
  notify: (s: string) => void;
}) {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(initial),
    [dirty, setDirty] = useState(false),
    [status, setStatus] = useState('已保存'),
    [deleteOpen, setDeleteOpen] = useState(false);
  const editing = params.has('edit');
  const ref = useRef(draft),
    dirtyRef = useRef(false),
    chain = useRef(Promise.resolve(true));
  ref.current = draft;
  const save = useCallback(() => {
    chain.current = chain.current.then(async () => {
      if (!dirtyRef.current) return true;
      const snapshot = ref.current;
      setStatus('保存中…');
      try {
        const saved = await saveDoc(snapshot);
        const unchanged = ref.current === snapshot;
        ref.current = unchanged ? saved : { ...ref.current, revision: saved.revision };
        setDraft(ref.current);
        if (unchanged) {
          dirtyRef.current = false;
          setDirty(false);
        }
        setStatus('已保存');
        return true;
      } catch (e) {
        setStatus('保存失败');
        notify(e instanceof Error ? e.message : String(e));
        return false;
      }
    });
    return chain.current;
  }, [notify]);
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state === 'blocked') {
      void save().then((ok) => {
        if (ok) blocker.proceed();
        else blocker.reset();
      });
    }
  }, [blocker, save]);
  useEffect(() => {
    if (dirty) {
      const timer = setTimeout(() => void save(), 800);
      return () => clearTimeout(timer);
    }
  }, [draft, dirty, save]);
  useEffect(() => {
    const handle = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, []);
  useEffect(() => {
    if (!dirtyRef.current && initial.revision > ref.current.revision) {
      ref.current = initial;
      setDraft(initial);
    }
  }, [initial]);
  useEffect(() => {
    void db.meta.put({ key: `recent:${initial.id}`, value: new Date().toISOString() });
  }, [initial.id]);
  function change(next: Doc) {
    ref.current = next;
    setDraft(next);
    dirtyRef.current = true;
    setDirty(true);
    setStatus('等待保存…');
  }
  function field(key: string, value: string) {
    change({ ...ref.current, fields: { ...ref.current.fields, [key]: value } });
  }
  async function finish() {
    if (await save()) setParams({});
  }
  async function favorite() {
    const next = { ...ref.current, favorite: !ref.current.favorite };
    change(next);
    await save();
  }
  async function copy() {
    if (!(await save())) return;
    const next = {
      ...ref.current,
      id: crypto.randomUUID(),
      title: `${ref.current.title || '未命名'}（副本）`,
      revision: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      favorite: false,
    };
    try {
      await saveDoc(next);
      const relations = await db.links
        .filter(
          (l) =>
            !l.deletedAt &&
            (l.from === initial.id || (initial.kind === 'case' && l.to === initial.id)),
        )
        .toArray();
      for (const l of relations)
        await db.links.add({
          ...l,
          id: crypto.randomUUID(),
          from: l.from === initial.id ? next.id : l.from,
          to: l.to === initial.id ? next.id : l.to,
        });
      nav(`/${next.kind}/${next.id}?edit=1`);
      notify('已复制内容和关联，真实性状态保持原样');
    } catch (e) {
      notify(String(e));
    }
  }
  if (initial.deletedAt)
    return (
      <Empty
        title="这条内容已在回收站"
        description="可前往设置恢复后继续查看。"
        action={
          <Link className="btn" to="/settings">
            前往回收站
          </Link>
        }
      />
    );
  return (
    <>
      <div className="detail-top">
        <Link className="back-link" to={`/${initial.kind}`}>
          <ArrowLeft size={16} />
          {labels[initial.kind]}
          {initial.kind === 'case' || initial.kind === 'question' ? '库' : ''}
        </Link>
        <div className="toolbar">
          <span className={`save-status ${status === '保存失败' ? 'error' : ''}`}>
            <Check size={13} />
            {status}
          </span>
          {status === '保存失败' && (
            <button className="btn small" onClick={() => void save()}>
              重试保存
            </button>
          )}
          {status === '保存失败' && (
            <button
              className="btn small"
              onClick={async () => {
                if (
                  window.confirm(
                    '读取最新版本会放弃当前未保存的修改，请先复制需要保留的文字。继续？',
                  )
                ) {
                  const latest = await db.docs.get(initial.id);
                  if (latest) {
                    dirtyRef.current = false;
                    setDirty(false);
                    ref.current = latest;
                    setDraft(latest);
                    setStatus('已保存');
                  }
                }
              }}
            >
              读取最新版本
            </button>
          )}
          <button
            className={`icon-btn ${draft.favorite ? 'selected' : ''}`}
            aria-label="收藏"
            onClick={favorite}
          >
            <Star size={18} fill={draft.favorite ? 'currentColor' : 'none'} />
          </button>
          <button className="icon-btn" aria-label="复制内容" onClick={copy}>
            <Copy size={17} />
          </button>
          <button
            className="icon-btn danger-text"
            aria-label="删除内容"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 size={17} />
          </button>
          <button
            className={`btn ${editing ? 'primary' : ''}`}
            onClick={editing ? finish : () => setParams({ edit: '1' })}
          >
            {editing ? <Check size={16} /> : <Pencil size={15} />}{' '}
            {editing ? '完成编辑' : '编辑内容'}
          </button>
        </div>
      </div>
      <div className="detail-heading">
        <div className="badge-row">
          <Badge>{labels[initial.kind]}</Badge>
          {draft.demo && <Badge tone="demo">DEMO · 演示内容</Badge>}
          {draft.fields.status && (
            <Badge tone={draft.fields.status === '已核实' ? 'green' : 'amber'}>
              {draft.fields.status}
            </Badge>
          )}
        </div>
        {editing ? (
          <input
            className="title-input"
            aria-label="标题"
            placeholder={`为这条${labels[initial.kind]}起个名字…`}
            value={draft.title}
            onChange={(e) => change({ ...ref.current, title: e.target.value })}
          />
        ) : (
          <h1>{draft.title || `未命名${labels[initial.kind]}`}</h1>
        )}
        <div className="tag-row">
          {[...draft.roles, ...draft.tags].map((t, i) => (
            <Badge key={i}>{t}</Badge>
          ))}
        </div>
      </div>
      {initial.kind === 'case' && draft.fields.status !== '已核实' && (
        <div className="notice">
          <ShieldCheck size={17} />
          <span>
            此案例尚未标记为已核实。引用时请核对经历与数据，勿将拟稿或假设内容作为真实业绩。
          </span>
        </div>
      )}
      <div className="detail-layout">
        <section className="panel document-panel">
          {editing ? (
            <div className="form-grid">
              <div className="field full">
                <span>岗位方向</span>
                <div className="option-row">
                  {roleOptions.map((r) => (
                    <label key={r}>
                      <input
                        type="checkbox"
                        checked={draft.roles.includes(r)}
                        onChange={(e) =>
                          change({
                            ...ref.current,
                            roles: e.target.checked
                              ? [...ref.current.roles, r]
                              : ref.current.roles.filter((x) => x !== r),
                          })
                        }
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </div>
              <label className="field full">
                <span>标签（用逗号分隔）</span>
                <input
                  defaultValue={draft.tags.join('，')}
                  onBlur={(e) =>
                    change({
                      ...ref.current,
                      tags: [
                        ...new Set(
                          e.target.value
                            .split(/[,，、]/)
                            .map((s) => s.trim())
                            .filter(Boolean),
                        ),
                      ],
                    })
                  }
                />
              </label>
              {initial.kind === 'review' && (
                <label className="field full">
                  <span>关联公司备战</span>
                  <select
                    value={draft.fields.companyId || ''}
                    onChange={(e) => field('companyId', e.target.value)}
                  >
                    <option value="">不关联</option>
                    {docs
                      .filter((d) => d.kind === 'company' && !d.deletedAt)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {fields[initial.kind].map((f) => (
                <FieldInput
                  key={f.key}
                  field={f}
                  value={draft.fields[f.key] || ''}
                  onChange={(v) => field(f.key, v)}
                />
              ))}
            </div>
          ) : (
            <div className="reading-content">
              {fields[initial.kind].map((f) => (
                <section key={f.key} className={`read-field ${f.type === 'rich' ? 'prose' : ''}`}>
                  <h3>{f.label}</h3>
                  <div className={!draft.fields[f.key] ? 'muted' : ''}>
                    {draft.fields[f.key] ? (
                      f.type === 'rich' ? (
                        <RichText value={draft.fields[f.key]} />
                      ) : (
                        draft.fields[f.key]
                      )
                    ) : (
                      '尚未填写'
                    )}
                  </div>
                </section>
              ))}
              {initial.kind === 'review' && draft.fields.companyId && (
                <Link to={`/company/${draft.fields.companyId}`} className="text-link">
                  查看关联公司备战 →
                </Link>
              )}
            </div>
          )}
          {initial.kind === 'review' && draft.fields.questions && (
            <div className="review-promote">
              <h3>将新问题加入题库</h3>
              {draft.fields.questions
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((q, i) => (
                  <div className="content-row" key={i}>
                    <span>{q}</span>
                    <button
                      className="btn small"
                      onClick={async () => {
                        if (
                          docs.some((d) => d.kind === 'question' && !d.deletedAt && d.title === q)
                        ) {
                          notify('题库中已存在同名问题');
                          return;
                        }
                        const next = { ...fresh('question'), title: q };
                        await saveDoc(next);
                        if (draft.fields.companyId) await addLink(draft.fields.companyId, next.id);
                        notify('已加入题库');
                      }}
                    >
                      加入题库
                    </button>
                  </div>
                ))}
            </div>
          )}
        </section>
        <aside className="detail-aside">
          {['case', 'question', 'company'].includes(initial.kind) && (
            <Relations doc={initial} docs={docs} notify={notify} />
          )}
          <section className="panel note-panel">
            <span className="eyebrow">A LITTLE REMINDER</span>
            <h3>好的回答，来自真实的你。</h3>
            <p>用具体行动讲清楚你的贡献，比堆砌漂亮的数字更有力量。</p>
          </section>
        </aside>
      </div>
      {initial.kind === 'company' && <Sessions company={initial} notify={notify} />}
      <div className="detail-bottom">
        创建于 {new Date(initial.createdAt).toLocaleDateString('zh-CN')} · 所有修改保存在此浏览器
      </div>
      {deleteOpen && (
        <Modal title={`删除这条${labels[initial.kind]}？`} onClose={() => setDeleteOpen(false)}>
          <p>内容将移入回收站，关联会保留。你可以在设置中恢复。</p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setDeleteOpen(false)}>
              取消
            </button>
            <button
              className="btn danger"
              onClick={async () => {
                if (!(await save())) return;
                try {
                  await removeDoc(initial.id);
                  setDeleteOpen(false);
                  nav(`/${initial.kind}`);
                  notify('已移入回收站，可在设置中恢复');
                } catch (e) {
                  notify(String(e));
                }
              }}
            >
              移入回收站
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Relations({ doc, docs, notify }: { doc: Doc; docs: Doc[]; notify: (s: string) => void }) {
  const links =
    useLiveQuery(
      () =>
        db.links
          .filter((l) => !l.deletedAt && (l.from === doc.id || l.to === doc.id))
          .sortBy('order'),
      [doc.id],
    ) || [];
  const [adding, setAdding] = useState(false),
    [search, setSearch] = useState(''),
    [edit, setEdit] = useState<Relation | null>(null);
  const types =
    doc.kind === 'case' ? ['question'] : doc.kind === 'question' ? ['case'] : ['case', 'question'];
  const candidates = docs.filter(
    (d) =>
      !d.deletedAt &&
      types.includes(d.kind) &&
      !links.some((l) => l.from === d.id || l.to === d.id) &&
      d.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="panel relations">
      <div className="section-title">
        <h3>
          <Link2 size={16} />{' '}
          {doc.kind === 'case'
            ? '关联题目与备战'
            : doc.kind === 'question'
              ? '关联案例'
              : '备战资料'}
        </h3>
        <button className="icon-btn" aria-label="添加关联" onClick={() => setAdding(true)}>
          <Plus size={17} />
        </button>
      </div>
      {links
        .filter(
          (l) => doc.kind !== 'question' || docs.find((d) => d.id === l.from)?.kind !== 'company',
        )
        .map((l) => {
          const other = docs.find((d) => d.id === (l.from === doc.id ? l.to : l.from));
          return (
            <div className="relation" key={l.id}>
              {other && !other.deletedAt ? (
                <>
                  <Link to={`/${other.kind}/${other.id}`}>
                    {other.title || '未命名'} <ExternalLink size={12} />
                  </Link>
                  <div className="badge-row">
                    {other.demo && <Badge tone="demo">DEMO</Badge>}
                    {other.fields.status && <Badge tone="amber">{other.fields.status}</Badge>}
                  </div>
                </>
              ) : (
                <span className="muted">关联内容已移入回收站</span>
              )}
              {l.angle && <p>{l.angle}</p>}
              {l.focus && <small>{l.focus}</small>}
              <div className="relation-actions">
                <button onClick={() => setEdit({ ...l })}>编辑角度 / 回答</button>
                <button
                  onClick={async () => {
                    await db.links.update(l.id, { deletedAt: new Date().toISOString() });
                    notify('已解除关联，原内容保留');
                  }}
                >
                  解除关联
                </button>
              </div>
            </div>
          );
        })}
      {!links.length && <p className="muted">引用已有内容，让每段经历被反复看见。</p>}
      <button className="btn subtle full-width" onClick={() => setAdding(true)}>
        <Plus size={15} /> 添加关联
      </button>
      {doc.kind === 'company' && (
        <Link className="btn full-width" to={`/flashcards?company=${doc.id}`}>
          按此公司复习 →
        </Link>
      )}
      {adding && (
        <Modal title="关联已有内容" onClose={() => setAdding(false)}>
          <input
            className="full-width"
            placeholder="搜索标题…"
            aria-label="搜索可关联内容"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="select-list">
            {candidates.map((d) => (
              <button
                className="content-row"
                key={d.id}
                onClick={async () => {
                  try {
                    await addLink(
                      doc.kind === 'case' ? d.id : doc.id,
                      doc.kind === 'case' ? doc.id : d.id,
                    );
                    notify('已建立关联');
                  } catch (e) {
                    notify(String(e));
                  }
                }}
              >
                <div>
                  <Badge>{labels[d.kind]}</Badge> {d.title || '未命名'}
                  {d.demo && <Badge tone="demo">DEMO</Badge>}
                </div>
                <Plus size={16} />
              </button>
            ))}
            {!candidates.length && (
              <p className="muted">没有可添加的内容，请先在案例库或题库创建。</p>
            )}
          </div>
        </Modal>
      )}
      {edit && (
        <Modal
          title={doc.kind === 'company' ? '推荐理由 / 公司定制回答' : '这段案例的回答角度'}
          onClose={() => setEdit(null)}
        >
          <label className="field">
            <span>{doc.kind === 'company' ? '公司定制回答 / 推荐理由' : '回答角度'}</span>
            <textarea
              rows={5}
              value={edit.angle}
              onChange={(e) => setEdit({ ...edit, angle: e.target.value })}
            />
          </label>
          <label className="field">
            <span>重点 / 关键词</span>
            <textarea
              value={edit.focus}
              onChange={(e) => setEdit({ ...edit, focus: e.target.value })}
            />
          </label>
          <div className="modal-actions">
            <button
              className="btn primary"
              onClick={async () => {
                await db.links.put(edit);
                setEdit(null);
                notify('关联内容已保存');
              }}
            >
              保存
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
function Sessions({ company, notify }: { company: Doc; notify: (s: string) => void }) {
  const sessions =
    useLiveQuery(
      () => db.sessions.where('companyId').equals(company.id).sortBy('date'),
      [company.id],
    ) || [];
  const [edit, setEdit] = useState<Session | null>(null);
  return (
    <section className="panel sessions">
      <div className="section-title">
        <h2>面试安排</h2>
        <button
          className="btn"
          onClick={() =>
            setEdit({
              id: crypto.randomUUID(),
              companyId: company.id,
              date: '',
              round: '第一轮',
              format: '单面',
              status: '待面试',
            })
          }
        >
          <Plus size={16} /> 添加面试
        </button>
      </div>
      {!sessions.length && <p className="muted">在这里安排面试时间，首页会提醒你近期的面试。</p>}
      {sessions.map((s) => (
        <div className="content-row" key={s.id}>
          <div>
            <strong>{s.round}</strong>
            <p>
              {s.date ? new Date(s.date).toLocaleString('zh-CN') : '时间待定'} · {s.format}
            </p>
          </div>
          <Badge>{s.status}</Badge>
          <button className="btn small" onClick={() => setEdit(s)}>
            编辑
          </button>
        </div>
      ))}
      {edit && (
        <Modal title="面试安排" onClose={() => setEdit(null)}>
          <div className="form-grid">
            {[
              { key: 'date', label: '面试时间', type: 'datetime-local' },
              { key: 'round', label: '当前轮次' },
              { key: 'format', label: '面试形式', type: 'select', options: forms },
              {
                key: 'status',
                label: '状态',
                type: 'select',
                options: ['待面试', '已完成', '已取消'],
              },
            ].map((f) => (
              <FieldInput
                key={f.key}
                field={f as Field}
                value={edit[f.key as keyof Session]}
                onChange={(v) => setEdit({ ...edit, [f.key]: v })}
              />
            ))}
          </div>
          <div className="modal-actions">
            <button
              className="btn danger-text"
              onClick={async () => {
                if (window.confirm('删除此面试安排？')) {
                  await db.sessions.delete(edit.id);
                  setEdit(null);
                }
              }}
            >
              删除安排
            </button>
            <button
              className="btn primary"
              onClick={async () => {
                await db.sessions.put(edit);
                setEdit(null);
                notify('面试安排已保存');
              }}
            >
              保存
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
