import { useEffect, useRef, type ReactNode } from 'react';
import { X, Plus, ArrowUpRight, BookOpen, Star } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import type { Doc } from '../domain/models';
import { plain, labels } from '../domain/models';
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>('input:not([type=checkbox]),textarea,button');
    first?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? 'wide' : ''}`}
        ref={dialogRef}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
          if (e.key === 'Tab') {
            const elements = Array.from(
              dialogRef.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input,textarea,select,a[href],[tabindex="0"]',
              ) || [],
            ).filter((el) => el.getClientRects().length > 0);
            const first = elements[0],
              last = elements.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="关闭" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Empty({
  title = '还没有内容',
  description = '从一个小小的记录开始，慢慢建立你的面试知识库。',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <BookOpen size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function DocCard({ doc, onFavorite }: { doc: Doc; onFavorite?: (d: Doc) => void }) {
  const excerpt =
    doc.fields.short || doc.fields.situation || doc.fields.jd || doc.fields.improvement || '';
  return (
    <article className="doc-card">
      <div className="card-top">
        <span className={`type-icon ${doc.kind}`}>
          <BookOpen size={19} />
        </span>
        <div className="badge-row">
          {doc.demo && <Badge tone="demo">DEMO</Badge>}
          {doc.fields.status && (
            <Badge tone={doc.fields.status === '已核实' ? 'green' : 'amber'}>
              {doc.fields.status}
            </Badge>
          )}
        </div>
        {onFavorite && (
          <button
            className={`icon-btn favorite ${doc.favorite ? 'selected' : ''}`}
            aria-label={doc.favorite ? '取消收藏' : '收藏'}
            onClick={() => onFavorite(doc)}
          >
            <Star size={17} fill={doc.favorite ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
      <RouterLink to={`/${doc.kind}/${doc.id}`} className="card-title">
        {doc.title || `未命名${labels[doc.kind]}`}
      </RouterLink>
      <p>{plain(excerpt).slice(0, 100) || '等待你写下第一段内容…'}</p>
      <div className="tag-row">
        {[...doc.roles, ...doc.tags].slice(0, 3).map((t, i) => (
          <Badge key={i}>{t}</Badge>
        ))}
      </div>
      <footer>
        <span>
          {new Date(doc.updatedAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}{' '}
          更新
        </span>
        <RouterLink to={`/${doc.kind}/${doc.id}`} aria-label={`打开${doc.title}`}>
          <ArrowUpRight size={17} />
        </RouterLink>
      </footer>
    </article>
  );
}
export function Primary({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="btn primary" onClick={onClick}>
      <Plus size={17} />
      {children}
    </button>
  );
}
export function richText(value: string) {
  return plain(value) || '尚未填写';
}
