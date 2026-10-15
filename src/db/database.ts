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
export const db = new CasebookDB();
