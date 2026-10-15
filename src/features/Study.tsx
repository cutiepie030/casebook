import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Shuffle,
  Check,
  Clock,
  Eye,
  Play,
  Pause,
  Square,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { db } from '../db/database';
import { fresh, plain, categories, type Doc } from '../domain/models';
import { saveDoc } from '../services/data';
import { Badge, Empty } from '../components/Common';
export function Study({
  docs,
  practice = false,
  notify,
}: {
  docs: Doc[];
  practice?: boolean;
  notify: (s: string) => void;
}) {
  const [params, setParams] = useSearchParams();
  const [company, setCompany] = useState(params.get('company') || ''),
    [category, setCategory] = useState(''),
    [onlyReview, setOnlyReview] = useState(false),
    [onlyFav, setOnlyFav] = useState(false),
    [order, setOrder] = useState<string[]>([]),
    [index, setIndex] = useState(0),
    [revealed, setRevealed] = useState(false),
    [running, setRunning] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [score, setScore] = useState('3'),
    [notes, setNotes] = useState(''),
    [improvement, setImprovement] = useState(''),
    [saved, setSaved] = useState(false),
    [remaining, setRemaining] = useState(300),
    [finished, setFinished] = useState(false);
  const focus = params.has('focus') && !practice;
  const tick = useRef<number>(0);
  const links = useLiveQuery(() => db.links.filter((l) => !l.deletedAt).toArray()) || [];
  const records =
    useLiveQuery(() =>
      db.docs
        .filter((d) => d.kind === 'practice' && !d.deletedAt)
        .reverse()
        .sortBy('createdAt'),
    ) || [];
  const available = useMemo(
    () =>
      docs.filter(
        (d) =>
          d.kind === 'question' &&
          (!d.demo || !docs.some((x) => x.fields.libraryBatch)) &&
          !d.deletedAt &&
          (!category || d.fields.category === category) &&
          (!company || links.some((l) => l.from === company && l.to === d.id)) &&
          (!onlyReview || d.fields.mastery !== '已掌握') &&
          (!onlyFav || d.favorite),
      ),
    [docs, category, company, links, onlyReview, onlyFav],
  );
  const key = available
    .map((d) => d.id)
    .sort()
    .join('|');
  const queue = useMemo(
    () =>
      order.length
        ? available.slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
        : available,
    [key, order, docs],
  );
  const q = queue[index % Math.max(queue.length, 1)];
  useEffect(() => {
    setIndex(0);
    setRevealed(false);
    setElapsed(0);
    setRunning(false);
    setSaved(false);
  }, [key]);
  useEffect(() => {
    if (!running) return;
    tick.current = Date.now();
    const t = setInterval(() => {
      const now = Date.now();
      setElapsed((x) => x + (now - tick.current) / 1000);
      tick.current = now;
    }, 250);
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => {
    if (!focus || finished) return;
    const end = Date.now() + remaining * 1000;
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemaining(left);
      if (!left) {
        setFinished(true);
        notify('5 分钟复习完成，你可以继续复习。');
      }
    }, 500);
    return () => clearInterval(t);
  }, [focus, finished]);
  useEffect(() => {
    document.body.classList.toggle('focus-mode', focus);
    return () => document.body.classList.remove('focus-mode');
  }, [focus]);
  function move(n: number) {
    setIndex((i) => (i + n + queue.length) % queue.length);
    setRevealed(false);
    setRunning(false);
    setElapsed(0);
    setNotes('');
    setImprovement('');
    setSaved(false);
  }
  function shuffle() {
    const ids = available.map((d) => d.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setOrder(ids);
    setIndex(0);
    setRevealed(false);
    setRunning(false);
    setElapsed(0);
    setSaved(false);
  }
  const associated = q
    ? links
        .filter((l) => l.from === q.id)
        .map((l) => ({ l, d: docs.find((d) => d.id === l.to && !d.deletedAt) }))
        .filter((x) => !!x.d)
    : [];
  const custom = q && company ? links.find((l) => l.from === company && l.to === q.id)?.angle : '';
  const minsec = (sec: number) =>
    `${Math.floor(sec / 60)
      .toString()
      .padStart(2, '0')}:${Math.floor(sec % 60)
      .toString()
      .padStart(2, '0')}`;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {practice ? 'PRACTICE MAKES PROGRESS' : 'SMALL CARDS, BIG CONFIDENCE'}
          </span>
          <h1>{practice ? '自主模拟面试' : focus ? '面试前 5 分钟' : '速记卡片'}</h1>
          <p>
            {practice
              ? '把答案说出来，让每一次练习都有收获。'
              : '先回忆，再翻开。让每一个故事，随时可以被想起。'}
          </p>
        </div>
        {!practice && (
          <button
            className="btn"
            onClick={() => {
              setFinished(false);
              setRemaining(300);
              setParams(
                focus
                  ? company
                    ? { company }
                    : {}
                  : { focus: '1', ...(company ? { company } : {}) },
              );
            }}
          >
            {focus ? <Minimize2 size={16} /> : <Maximize2 size={16} />}{' '}
            {focus ? '退出专注' : '5 分钟突击模式'}
          </button>
        )}
      </div>
      {focus && (
        <div className="focus-timer">
          <Clock size={18} />
          {finished ? '已完成 · 继续巩固' : minsec(remaining)}
        </div>
      )}
      <div className="filter-bar study-filters">
        <select
          aria-label="按公司复习"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        >
          <option value="">所有公司的题目</option>
          {docs
            .filter(
              (d) =>
                d.kind === 'company' &&
                !d.deletedAt &&
                (!d.demo || !docs.some((x) => x.fields.libraryBatch)),
            )
            .map((d) => (
              <option value={d.id} key={d.id}>
                {d.title}
              </option>
            ))}
        </select>
        <select
          aria-label="按分类复习"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">全部问题分类</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={onlyReview}
            onChange={(e) => setOnlyReview(e.target.checked)}
          />{' '}
          仅待复习
        </label>
        <label>
          <input type="checkbox" checked={onlyFav} onChange={(e) => setOnlyFav(e.target.checked)} />{' '}
          仅收藏
        </label>
        <button className="btn" onClick={shuffle}>
          <Shuffle size={15} />
          随机抽题
        </button>
      </div>
      {!q ? (
        <Empty
          title="这个范围还没有题目"
          description="先到题库添加问题，或在公司备战中关联高频问题。"
          action={
            <Link to="/question" className="btn primary">
              前往题库
            </Link>
          }
        />
      ) : (
        <>
          <div className="study-progress">
            <span>{practice ? '练习问题' : '复习进度'}</span>
            <span>
              {(index % queue.length) + 1} / {queue.length}
            </span>
          </div>
          <div className="progress-track">
            <i style={{ width: `${(((index % queue.length) + 1) / queue.length) * 100}%` }} />
          </div>
          <section className={`flashcard ${revealed ? 'revealed' : ''}`}>
            <div className="flashcard-top">
              <span className="eyebrow">
                {revealed ? 'THE ANSWER FRAMEWORK' : 'TAKE A MOMENT TO THINK'}
              </span>
              <div className="badge-row">
                {q.demo && <Badge tone="demo">DEMO</Badge>}
                <Badge>{q.fields.category || '通用面试'}</Badge>
                <Badge>{q.fields.mastery || '待复习'}</Badge>
              </div>
            </div>
            <h2>{q.title || '未命名题目'}</h2>
            {!revealed ? (
              <div className="recall">
                <p>
                  {practice
                    ? '先试着完整回答，再查看参考内容。'
                    : '这道题，你会选择哪段经历来回答？'}
                </p>
                <button className="btn" onClick={() => setRevealed(true)}>
                  <Eye size={17} />
                  {practice ? '查看参考回答' : '翻开卡片，查看思路'}
                </button>
                <small>给自己一点时间，先在心中组织答案。</small>
              </div>
            ) : (
              <div className="answer-content">
                <div>
                  <span className="field-label">{custom ? '公司定制回答' : '核心思路'}</span>
                  <p>
                    {custom ||
                      plain(q.fields.short || q.fields.full || '') ||
                      '尚未填写参考回答，去题目详情补充。'}
                  </p>
                </div>
                {q.fields.keywords && (
                  <div>
                    <span className="field-label">速记关键词</span>
                    <div className="keyword-row">
                      {q.fields.keywords
                        .split(/[,，、；;]/)
                        .filter(Boolean)
                        .map((k, i) => (
                          <span key={i}>{k}</span>
                        ))}
                    </div>
                  </div>
                )}
                {associated.map(({ l, d }) => (
                  <div className="answer-case" key={l.id}>
                    <div className="section-title">
                      <Link to={`/case/${d!.id}`}>{d!.title}</Link>
                      <div className="badge-row">
                        {d!.demo && <Badge tone="demo">DEMO</Badge>}
                        <Badge tone={d!.fields.status === '已核实' ? 'green' : 'amber'}>
                          {d!.fields.status || '待核实'}
                        </Badge>
                      </div>
                    </div>
                    {l.angle && (
                      <p>
                        <strong>回答角度：</strong>
                        {l.angle}
                      </p>
                    )}
                    {l.focus && (
                      <p>
                        <strong>重点：</strong>
                        {l.focus}
                      </p>
                    )}
                    <p>
                      <strong>回答框架：</strong>
                      {plain(d!.fields.highlights || d!.fields.action || '') || '尚未填写'}
                    </p>
                    <p>
                      <strong>核心数据：</strong>
                      {d!.fields.metrics || '暂无已记录数据'}
                    </p>
                    {d!.fields.caution && <small>{d!.fields.caution}</small>}
                  </div>
                ))}
                {q.fields.caution && <div className="caution">注意事项 · {q.fields.caution}</div>}
                <button className="text-link" onClick={() => setRevealed(false)}>
                  <RotateCw size={14} /> 隐藏答案，重新自测
                </button>
              </div>
            )}
          </section>
          {practice ? (
            <section className="panel practice-controls">
              <div className="timer-display">{minsec(elapsed)}</div>
              <div className="toolbar">
                <button className="btn primary" onClick={() => setRunning(!running)}>
                  {running ? <Pause size={16} /> : <Play size={16} />}{' '}
                  {running ? '暂停' : '开始计时'}
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setRunning(false);
                    setRevealed(true);
                  }}
                >
                  <Square size={15} />
                  结束回答
                </button>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>自我评分</span>
                  <select value={score} onChange={(e) => setScore(e.target.value)}>
                    {['1', '2', '3', '4', '5'].map((s) => (
                      <option key={s} value={s}>
                        {s} 分{s === '5' ? ' · 表达清晰' : s === '1' ? ' · 需要重练' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>回答中的问题</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="哪里卡住了？"
                  />
                </label>
                <label className="field full">
                  <span>下次如何改进</span>
                  <textarea
                    value={improvement}
                    onChange={(e) => setImprovement(e.target.value)}
                    placeholder="给自己一个具体的行动建议。"
                  />
                </label>
              </div>
              <button
                disabled={saved}
                className="btn primary"
                onClick={async () => {
                  try {
                    const rec = fresh('practice');
                    rec.title = q.title;
                    rec.demo = q.demo;
                    rec.fields = {
                      questionId: q.id,
                      companyId: company,
                      elapsed: String(Math.round(elapsed)),
                      score,
                      notes,
                      improvement,
                      questionSnapshot: q.title,
                    };
                    await saveDoc(rec);
                    setRunning(false);
                    setSaved(true);
                    notify('练习记录已保存');
                  } catch (e) {
                    notify(String(e));
                  }
                }}
              >
                {saved ? '已保存本次练习' : '保存练习记录'}
              </button>
            </section>
          ) : (
            <div className="mastery-actions">
              <button
                className="btn"
                onClick={async () => {
                  try {
                    await saveDoc({ ...q, fields: { ...q.fields, mastery: '待复习' } });
                    notify('已标记为需复习');
                  } catch (e) {
                    notify(String(e));
                  }
                }}
              >
                <RotateCw size={16} />
                还需复习
              </button>
              <button
                className="btn primary"
                onClick={async () => {
                  try {
                    await saveDoc({ ...q, fields: { ...q.fields, mastery: '已掌握' } });
                    notify('已标记掌握，继续加油');
                  } catch (e) {
                    notify(String(e));
                  }
                }}
              >
                <Check size={17} />
                我已掌握
              </button>
            </div>
          )}
          <div className="card-navigation">
            <button className="btn" onClick={() => move(-1)}>
              <ArrowLeft size={16} />
              上一题
            </button>
            <Link className="text-link" to={`/question/${q.id}`}>
              编辑这道题
            </Link>
            <button className="btn" onClick={() => move(1)}>
              下一题
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
      {practice && (
        <section className="practice-history">
          <div className="section-heading">
            <h2>练习足迹</h2>
            <span>{records.length} 次练习</span>
          </div>
          <div className="panel">
            {records.length ? (
              records.slice(0, 20).map((r) => (
                <div className="history-row" key={r.id}>
                  <div>
                    <strong>{r.title}</strong>
                    <small>
                      {new Date(r.createdAt).toLocaleString('zh-CN')} · {r.fields.elapsed} 秒 ·{' '}
                      {r.fields.score} 分
                    </small>
                    <p>{r.fields.notes}</p>
                    <p>{r.fields.improvement && `改进：${r.fields.improvement}`}</p>
                  </div>
                  <button
                    className="btn small"
                    onClick={async () => {
                      if (window.confirm('将这次练习记录移入回收站？'))
                        await saveDoc({ ...r, deletedAt: new Date().toISOString() });
                    }}
                  >
                    删除
                  </button>
                </div>
              ))
            ) : (
              <div className="soft-empty">完成第一次练习后，这里会留下你的进步。</div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
