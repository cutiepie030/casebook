import { db } from '../db/database';
// Public web build: no personal dataset is fetched, embedded or synchronized.
export async function initialize() {
  await db.meta.put({ key: 'initialized', value: 'true' });
}
