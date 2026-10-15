import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  MessagesSquare,
  Building2,
  Bookmark,
  Plus,
  Layers,
  Sun,
  CalendarDays,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { db } from '../db/database';
import { createDoc, saveDoc } from '../services/data';
import type { Doc, Kind } from '../domain/models';
import { MigrationPanel } from '../components/MigrationPanel';
import { DocCard, Badge, Empty } from '../components/Common';
export function Dashboard({ docs, notify }: { docs: Doc[]; notify: (s: string) => void }) {
  const nav = useNavigate();
  const active = docs.filter(
    (d) => !d.deletedAt && (!d.demo || !docs.some((x) => x.fields.libraryBatch)),
  );
  const cases = active.filter((d) => d.kind === 'case'),
    questions = active.filter((d) => d.kind === 'question'),
    companies = active.filter(
      (d) =>
        d.kind === 'company' &&
        !['已结束', '已获 Offer', '历史备战', '拟取消'].includes(d.fields.progress),
    ),
    review = questions.filter((d) => d.favorite || d.fields.mastery !== '已掌握');
  const recent =
    useLiveQuery(() => db.meta.filter((m) => m.key.startsWith('recent:')).toArray()) || [];
  const recentQuestions = recent
    .sort((a, b) => b.value.localeCompare(a.value))
    .map((m) => active.find((d) => d.id === m.key.slice(7) && d.kind === 'question'))
    .filter((x): x is Doc => !!x)
    .slice(0, 4);
  const sessions = useLiveQuery(() => db.sessions.toArray()) || [];
  const upcoming = sessions
    .filter(
      (s) =>
        s.status === '待面试' &&
        s.date &&
        new Date(s.date).getTime() >= Date.now() &&
        companies.some((c) => c.id === s.companyId),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  const last = useLiveQuery(() => db.meta.get('lastBackup'));
  async function add(kind: Kind) {
    try {
      const d = await createDoc(kind);
      nav(`/${kind}/${d.id}?edit=1`);
    } catch (e) {
      notify(String(e));
    }
  }
  const stats = [
    {
      label: '积累的真实底稿',
      name: '已收录案例',
      value: cases.length,
      Icon: BookOpen,
      to: '/case',
      tone: 'purple',
    },
    {
      label: '让每个回答更从容',
      name: '已收录面试题',
      value: questions.length,
      Icon: MessagesSquare,
      to: '/question',
      tone: 'pink',
    },
    {
      label: '下一站，新的可能',
      name: '正在准备的公司',
      value: companies.length,
      Icon: Building2,
      to: '/company',
      tone: 'green',
    },
    {
      label: '温故，然后知新',
      name: '收藏 / 待复习',
      value: review.length,
      Icon: Bookmark,
      to: '/flashcards',
      tone: 'amber',
    },
  ];
  return (
    <>
      <div className="dashboard-greeting">
        <div>
          <span className="eyebrow">YOUR INTERVIEW CASEBOOK</span>
          <h1>
            每段经历，都值得被看见<span className="period">。</span>
          </h1>
          <p>把经历整理成故事，让每一次面试准备更从容。</p>
        </div>
        <div className="date-chip">
          <Sun size={19} />
          <span>
            {new Date().toLocaleDateString('zh-CN', {
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </span>
        </div>
      </div>
      {!active.some((d) => !d.demo) && <MigrationPanel />}
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-label">
            <span /> ONE STORY, MANY POSSIBILITIES
          </div>
          <h2>准备好，讲出你的故事。</h2>
          <p>
            经历是你的底稿，表达让它发光。
            <br />
            从一个案例开始，构建属于你的面试答案。
          </p>
          <button className="btn dark" onClick={() => add('case')}>
            <Plus size={17} /> 记录一个新案例 <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit" />
          <div className="paper paper-back">
            <span>YOUR NEXT CHAPTER</span>
            <i />
            <i />
            <i />
          </div>
          <div className="paper paper-front">
            <div className="paper-header">
              <BookOpen size={18} />
              <span>MY STORY</span>
              <span>✦</span>
            </div>
            <div className="paper-title">
              小小经历，
              <br />
              大大可能。
            </div>
            <div className="paper-tags">
              <b>主动学习</b>
              <b>解决问题</b>
            </div>
            <div className="paper-line" />
            <div className="paper-line short" />
            <div className="paper-foot">
              <span>KEEP GROWING</span>
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="art-sticker">
            <Sparkles size={22} />
          </div>
          <div className="art-caption">
            Collect your stories.
            <br />
            Connect your possibilities.
          </div>
        </div>
      </section>
      <div className="stats-grid">
        {stats.map((s) => (
          <Link to={s.to} className="stat" key={s.to}>
            <div className="stat-top">
              <span className={`stat-icon ${s.tone}`}>
                <s.Icon size={19} />
              </span>
              <ArrowUpRight size={15} />
            </div>
            <strong>{s.value.toString().padStart(2, '0')}</strong>
            <span>{s.name}</span>
            <small>{s.label}</small>
          </Link>
        ))}
      </div>
      <div className="quick-actions">
        <span>开始今天的准备</span>
        <button onClick={() => add('case')}>
          <Plus size={16} />
          新建案例
        </button>
        <button onClick={() => add('question')}>
          <MessagesSquare size={16} />
          新建面试题
        </button>
        <Link to="/flashcards">
          <Layers size={16} />
          速记复习
        </Link>
        <Link to="/company">
          <Building2 size={16} />
          公司备战
        </Link>
      </div>
      <div className="dashboard-columns">
        <section>
          <div className="section-heading">
            <div>
              <h2>
                最近整理的案例 <span>Recent stories</span>
              </h2>
              <p>每一次整理，都是对自己的重新认识。</p>
            </div>
            <Link to="/case" className="text-link">
              查看全部 <ArrowRight size={15} />
            </Link>
          </div>
          {cases.length ? (
            <div className="cards-grid dashboard-cases">
              {[...cases]
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .slice(0, 2)
                .map((d) => (
                  <DocCard
                    key={d.id}
                    doc={d}
                    onFavorite={async (d) => {
                      try {
                        await saveDoc({ ...d, favorite: !d.favorite });
                      } catch (e) {
                        notify(String(e));
                      }
                    }}
                  />
                ))}
            </div>
          ) : (
            <Empty
              title="你的故事，从这里开始"
              action={
                <button className="btn" onClick={() => add('case')}>
                  记录第一个案例
                </button>
              }
            />
          )}
          <div className="section-heading lower">
            <h2>
              最近浏览的题目 <span>Keep exploring</span>
            </h2>
            <Link to="/question" className="text-link">
              前往题库 <ArrowRight size={15} />
            </Link>
          </div>
          <div className="panel">
            {recentQuestions.length ? (
              recentQuestions.map((q) => (
                <Link className="content-row" key={q.id} to={`/question/${q.id}`}>
                  <span className="question-bullet">Q</span>
                  <span>{q.title || '未命名题目'}</span>
                  <Badge>{q.fields.mastery || '待复习'}</Badge>
                  <ArrowUpRight size={15} />
                </Link>
              ))
            ) : (
              <div className="soft-empty">还没有浏览记录，去题库寻找你的下一个好回答。</div>
            )}
          </div>
        </section>
        <aside>
          <div className="section-heading">
            <h2>
              近期面试 <span>Upcoming</span>
            </h2>
            <CalendarDays size={17} />
          </div>
          <section className="panel upcoming">
            {upcoming.length ? (
              upcoming.map((s) => {
                const c = companies.find((c) => c.id === s.companyId)!;
                const date = new Date(s.date);
                return (
                  <Link key={s.id} className="interview-row" to={`/company/${c.id}`}>
                    <div className="calendar-block">
                      <small>{date.getMonth() + 1} 月</small>
                      <strong>{date.getDate()}</strong>
                    </div>
                    <div>
                      <strong>{c.title}</strong>
                      <p>
                        {s.round} · {s.format}
                      </p>
                      <small>
                        {date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        {c.demo ? ' · DEMO' : ''}
                      </small>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="soft-empty">
                <CalendarDays size={26} />
                <h3>给下一次机会留个位置</h3>
                <p>
                  在公司备战中添加面试安排，
                  <br />
                  这里会为你记录即将到来的日程。
                </p>
              </div>
            )}
            <Link to="/company" className="btn subtle full-width">
              管理面试安排 <ArrowUpRight size={15} />
            </Link>
          </section>
          <section className="review-callout">
            <span className="eyebrow">A LITTLE EVERY DAY</span>
            <div className="callout-icon">
              <Layers size={24} />
            </div>
            <h3>5 分钟，让表达更清晰。</h3>
            <p>
              翻一张卡片，回忆一个故事。
              <br />
              把熟悉的经历，变成从容的回答。
            </p>
            <Link className="text-link" to="/flashcards?focus=1">
              开启面试前突击 <ArrowRight size={16} />
            </Link>
          </section>
          <Link className="backup-mini" to="/settings">
            <CheckCircle2 size={17} />
            <div>
              <strong>你的积累，随身可用</strong>
              <small>
                {last
                  ? `上次备份：${new Date(last.value).toLocaleDateString('zh-CN')}`
                  : '建议今天导出一份 JSON 备份'}
              </small>
            </div>
            <ArrowUpRight size={15} />
          </Link>
        </aside>
      </div>
      <footer className="page-footer">
        CASEBOOK <span>每一次认真准备，都会成为你的底气。</span>
        <span>LOCAL FIRST · MADE FOR YOUR NEXT CHAPTER</span>
      </footer>
    </>
  );
}
