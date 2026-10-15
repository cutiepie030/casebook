import Dexie, { type Table } from 'dexie';
import type { Doc, Link, Session } from '../domain/models';
class CasebookDB extends Dexie {
  docs!: Table<Doc, string>;
  links!: Table<Link, string>;
  sessions!: Table<Session, string>;
  meta!: Table<{ key: string; value: string }, string>;
  snapshots!: Table<{ id: string; at: string; data: string }, string>;
  constructor(name = 'casebook') {
    super(name);
    this.version(1).stores({
      docs: 'id,kind,updatedAt,deletedAt',
      links: 'id,from,to,deletedAt',
      sessions: 'id,companyId,date',
      meta: 'key',
      snapshots: 'id,at',
    });
  }
}
export { CasebookDB };
// Isolate live editors in different tabs; retain a tab's pending edits across reloads.
const tabId =
  typeof sessionStorage === 'undefined'
    ? 'test'
    : sessionStorage.getItem('casebook-tab') || crypto.randomUUID();
if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('casebook-tab', tabId);
export const db = new CasebookDB('casebook-private-' + tabId);
