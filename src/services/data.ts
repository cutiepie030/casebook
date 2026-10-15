import { db, type CasebookDB } from '../db/database';
import {
  caseStates,
  categories,
  forms,
  backupSchema,
  documentSchema,
  fresh,
  type Backup,
  type Doc,
  type Link,
  type Kind,
} from '../domain/models';
export class ConflictError extends Error {
  constructor() {
    super('这条内容已在其他页面修改。请先复制当前文字，再重新打开最新内容。');
  }
}
export async function saveDoc(d: Doc, database: CasebookDB = db) {
  documentSchema.parse(d);
  return database.transaction('rw', database.docs, async () => {
    const old = await database.docs.get(d.id);
    if ((!old && d.revision > 0) || (old && old.revision !== d.revision)) throw new ConflictError();
    const saved = { ...d, revision: d.revision + 1, updatedAt: new Date().toISOString() };
    await database.docs.put(saved);
    return saved;
  });
}
export async function removeDoc(id: string, database: CasebookDB = db) {
  const d = await database.docs.get(id);
  if (d) await saveDoc({ ...d, deletedAt: new Date().toISOString() }, database);
}
export async function exportData(database: CasebookDB = db): Promise<Backup> {
  return database.transaction(
    'r',
    [database.docs, database.links, database.sessions],
    async () => ({
      format: 'CASEBOOK',
      schemaVersion: 1,
      appVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      docs: await database.docs.toArray(),
      links: await database.links.toArray(),
      sessions: await database.sessions.toArray(),
    }),
  );
}
export function validateBackup(raw: unknown): Backup {
  const b = backupSchema.parse(raw);
  for (const d of b.docs) {
    const checks =
      d.kind === 'case'
        ? { status: caseStates }
        : d.kind === 'question'
          ? {
              category: categories,
              format: forms,
              mastery: ['待复习', '学习中', '已掌握'],
              importance: ['一般', '重要', '高频'],
              difficulty: ['基础', '适中', '挑战'],
            }
          : {};
    for (const [key, options] of Object.entries(checks)) {
      if (d.fields[key] && !options.includes(d.fields[key])) throw Error('备份含无效字段：' + key);
    }
  }
  for (const values of [b.docs, b.links, b.sessions])
    if (new Set(values.map((x) => x.id)).size !== values.length) throw Error('备份含重复 ID');
  const docs = new Map(b.docs.map((d) => [d.id, d]));
  const pairs = new Set<string>();
  for (const l of b.links) {
    const a = docs.get(l.from),
      c = docs.get(l.to);
    if (!a || !c) throw Error('备份含缺失内容的关联');
    if (!(
      (a.kind === 'question' && c.kind === 'case') ||
      (a.kind === 'company' && (c.kind === 'question' || c.kind === 'case'))
    ))
      throw Error('关联类型不合法');
    const pair = l.from + '|' + l.to;
    if (pairs.has(pair)) throw Error('备份含重复关联');
    pairs.add(pair);
  }
  for (const s of b.sessions)
    if (docs.get(s.companyId)?.kind !== 'company') throw Error('面试安排缺少对应公司');
  for (const d of b.docs) {
    if (
      d.kind === 'review' &&
      d.fields.companyId &&
      docs.get(d.fields.companyId)?.kind !== 'company'
    )
      throw Error('复盘缺少对应公司');
    if (
      d.kind === 'practice' &&
      d.fields.companyId &&
      docs.get(d.fields.companyId)?.kind !== 'company'
    )
      throw Error('练习缺少对应公司');
    if (
      d.kind === 'practice' &&
      d.fields.questionId &&
      docs.get(d.fields.questionId)?.kind !== 'question'
    )
      throw Error('练习缺少对应题目');
  }
  return b;
}
export async function restoreData(
  raw: unknown,
  mode: 'merge' | 'replace',
  preferImport = false,
  database: CasebookDB = db,
) {
  const b = validateBackup(raw);
  await database.transaction(
    'rw',
    [database.docs, database.links, database.sessions, database.snapshots],
    async () => {
      const before = await exportData(database);
      await database.snapshots.put({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        data: JSON.stringify(before),
      });
      if (mode === 'replace') {
        await database.docs.clear();
        await database.links.clear();
        await database.sessions.clear();
        await database.docs.bulkPut(
          b.docs.map((d) => ({
            ...d,
            revision:
              Math.max(d.revision, before.docs.find((x) => x.id === d.id)?.revision ?? 0) + 1,
          })),
        );
        await database.links.bulkPut(b.links);
        await database.sessions.bulkPut(b.sessions);
      } else {
        for (const d of b.docs) {
          const old = await database.docs.get(d.id);
          if (!old || preferImport)
            await database.docs.put({
              ...d,
              revision: Math.max(old?.revision ?? 0, d.revision) + 1,
            });
        }
        for (const s of b.sessions)
          if (preferImport || !(await database.sessions.get(s.id))) await database.sessions.put(s);
        for (const l of b.links) {
          const old = await database.links.get(l.id);
          const pair = await database.links
            .where('from')
            .equals(l.from)
            .filter((x) => x.to === l.to)
            .first();
          if (pair && pair.id !== l.id) {
            if (preferImport) await database.links.put({ ...l, id: pair.id });
          } else if (!old || preferImport) await database.links.put(l);
        }
      }
      validateBackup({
        ...b,
        docs: await database.docs.toArray(),
        links: await database.links.toArray(),
        sessions: await database.sessions.toArray(),
      });
      const snaps = await database.snapshots.orderBy('at').reverse().toArray();
      for (const s of snaps.slice(5)) await database.snapshots.delete(s.id);
    },
  );
}
export function downloadBackup(b: Backup) {
  const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CASEBOOK-备份-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function addLink(from: string, to: string, database: CasebookDB = db) {
  return database.transaction('rw', [database.docs, database.links], async () => {
    const a = await database.docs.get(from),
      b = await database.docs.get(to);
    if (!a || !b || a.deletedAt || b.deletedAt) throw Error('关联内容已不存在或已移入回收站');
    if (!(
      (a.kind === 'question' && b.kind === 'case') ||
      (a.kind === 'company' && ['case', 'question'].includes(b.kind))
    ))
      throw Error('关联类型不合法');
    const exists = await database.links
      .where('from')
      .equals(from)
      .filter((l) => l.to === to)
      .first();
    if (exists) {
      await database.links.update(exists.id, { deletedAt: null });
      return;
    }
    const link: Link = {
      id: crypto.randomUUID(),
      from,
      to,
      angle: '',
      focus: '',
      order: Date.now(),
      deletedAt: null,
    };
    await database.links.add(link);
  });
}
export async function purgeDoc(id: string) {
  await db.transaction('rw', [db.docs, db.links, db.sessions], async () => {
    await db.links.filter((l) => l.from === id || l.to === id).delete();
    await db.sessions.where('companyId').equals(id).delete();
    const refs = await db.docs.toArray();
    for (const d of refs) {
      let changed = false;
      for (const key of ['companyId', 'questionId'])
        if (d.fields[key] === id) {
          d.fields[key] = '';
          changed = true;
        }
      if (changed) await db.docs.put({ ...d, revision: d.revision + 1 });
    }
    await db.docs.delete(id);
  });
}
export async function createDoc(kind: Kind) {
  const d = await saveDoc(fresh(kind));
  return d;
}
