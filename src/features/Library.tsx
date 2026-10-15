import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, LayoutGrid, List, Plus } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import type { Doc, Kind } from '../domain/models';
import { labels, searchable, roleOptions, caseStates, categories } from '../domain/models';
import { createDoc, saveDoc } from '../services/data';
import { DocCard, Empty, Primary, Badge } from '../components/Common';
export function Library({
  kind,
  docs,
  notify,
}: {
  kind: Kind;
  docs: Doc[];
  notify: (s: string) => void;
}) {
  const nav = useNavigate();
  const [search, setSearch] = useState(''),
    [role, setRole] = useState(''),
    [state, setState] = useState(''),
    [tag, setTag] = useState(''),
    [org, setOrg] = useState(''),
    [favorite, setFavorite] = useState(false),
    [view, setView] = useState('grid'),
    [showDemo, setShowDemo] = useState(false);
  const items = docs.filter((d) => d.kind === kind && !d.deletedAt && (!d.demo || showDemo));
  const tags = [...new Set(items.flatMap((d) => d.tags))];
  const orgs = [...new Set(items.map((d) => d.fields.organization).filter(Boolean))];
  const filtered = useMemo(
    () =>
      items
        .filter(
          (d) =>
            searchable(d).includes(search.toLowerCase()) &&
            (!role || d.roles.includes(role)) &&
            (!state ||
              [
                d.fields.status,
                d.fields.mastery,
                d.fields.category,
                d.fields.progress,
                d.fields.result,
              ].includes(state)) &&
            (!tag || d.tags.includes(tag)) &&
            (!org || d.fields.organization === org) &&
            (!favorite || d.favorite),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [items, search, role, state, tag, org, favorite],
  );
  const title =
    kind === 'case'
      ? '把经历，变成你的底气。'
      : kind === 'question'
        ? '每个好回答，都有迹可循。'
        : kind === 'company'
          ? '为每一次机会，认真准备。'
          : '让每一场面试，都有所收获。';
  const english = {
    case: 'MY CASES',
    question: 'QUESTION BANK',
    company: 'COMPANY PREP',
    review: 'INTERVIEW REVIEWS',
    practice: 'PRACTICE',
  }[kind];
  async function add() {
    try {
      const d = await createDoc(kind);
      nav(`/${kind}/${d.id}?edit=1`);
    } catch (e) {
      notify(String(e));
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{english}</span>
          <h1>
            {labels[kind]}
            {kind === 'case' ? '库' : kind === 'question' ? '库' : ''}
          </h1>
          <p>{title}</p>
        </div>
        <Primary onClick={add}>新建{labels[kind]}</Primary>
      </div>
      <div className="filter-bar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="搜索当前列表"
            placeholder={`搜索${labels[kind]}、关键词或正文…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select aria-label="岗位筛选" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">所有岗位方向</option>
          {roleOptions.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select aria-label="状态筛选" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">{kind === 'question' ? '分类 / 复习状态' : '所有状态'}</option>
          {(kind === 'case'
            ? caseStates
            : kind === 'question'
              ? ['待复习', '学习中', '已掌握', ...categories]
              : kind === 'company'
                ? [
                    '准备中',
                    '已投递',
                    '面试中',
                    '等待结果',
                    '已获 Offer',
                    '已结束',
                    '历史备战',
                    '拟取消',
                  ]
                : ['待反馈', '通过', '未通过']
          ).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          className={`btn ${favorite ? 'chosen' : ''}`}
          onClick={() => setFavorite(!favorite)}
        >
          ☆ 收藏
        </button>
      </div>
      <div className="list-meta">
        <label className="check-label demo-toggle">
          <input
            type="checkbox"
            checked={showDemo}
            onChange={(e) => setShowDemo(e.target.checked)}
          />
          包含演示内容
        </label>
        <div>
          <SlidersHorizontal size={14} />
          <span>
            {filtered.length} 条{labels[kind]}
          </span>
          {tags.length > 0 && (
            <select aria-label="标签筛选" value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">全部标签</option>
              {tags.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          )}
          {kind === 'case' && orgs.length > 0 && (
            <select aria-label="所属组织筛选" value={org} onChange={(e) => setOrg(e.target.value)}>
              <option value="">全部组织</option>
              {orgs.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <button
            className={`icon-btn ${view === 'grid' ? 'chosen' : ''}`}
            aria-label="卡片视图"
            onClick={() => setView('grid')}
          >
            <LayoutGrid size={17} />
          </button>
          <button
            className={`icon-btn ${view === 'list' ? 'chosen' : ''}`}
            aria-label="列表视图"
            onClick={() => setView('list')}
          >
            <List size={18} />
          </button>
        </div>
      </div>
      {!filtered.length ? (
        <Empty
          title={items.length ? '没有找到匹配内容' : `写下你的第一条${labels[kind]}`}
          action={<Primary onClick={add}>新建{labels[kind]}</Primary>}
        />
      ) : view === 'grid' ? (
        <div className="cards-grid">
          {filtered.map((d) => (
            <DocCard
              key={d.id}
              doc={d}
              onFavorite={async (doc) => {
                try {
                  await saveDoc({ ...doc, favorite: !doc.favorite });
                } catch (e) {
                  notify(String(e));
                }
              }}
            />
          ))}
          <button className="new-card" onClick={add}>
            <span>
              <Plus size={23} />
            </span>
            新建{labels[kind]}
            <small>把值得记住的，留在这里</small>
          </button>
        </div>
      ) : (
        <div className="panel">
          {filtered.map((d) => (
            <Link className="content-row" key={d.id} to={`/${kind}/${d.id}`}>
              <span>{d.title || '未命名'}</span>
              <div>
                {d.demo && <Badge tone="demo">DEMO</Badge>}
                <Badge>{d.fields.status || d.fields.mastery || d.fields.progress || '查看'}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
