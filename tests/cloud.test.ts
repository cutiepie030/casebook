import 'fake-indexeddb/auto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), auth: { getUser: vi.fn() } }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mock }));
import { db } from '../src/db/database';
import { fresh, type Backup } from '../src/domain/models';
import { saveDoc, exportData } from '../src/services/data';
import { loadClient, VaultSync, fingerprint, clearCache } from '../src/services/cloud';
let remote: { revision: number; payload: Backup | null };
let allowed = true;
beforeEach(async () => {
  await clearCache();
  allowed = true;
  remote = {
    revision: 3,
    payload: {
      format: 'CASEBOOK',
      schemaVersion: 1,
      appVersion: '2.0',
      exportedAt: new Date().toISOString(),
      docs: [{ ...fresh('case'), title: 'Cloud case' }],
      links: [],
      sessions: [],
    },
  };
  mock.from.mockImplementation((table: string) => ({
    select: () => ({
      maybeSingle: async () => ({
        data:
          table === 'casebook_members'
            ? allowed
              ? { user_id: 'owner' }
              : null
            : structuredClone(remote),
        error: null,
      }),
    }),
  }));
  mock.auth.getUser.mockResolvedValue({ data: { user: { id: 'owner' } } });
  mock.rpc.mockImplementation(async (_name, args) => {
    if (args.expected_revision !== remote.revision)
      return { data: null, error: { code: '40001', message: 'CASEBOOK_CONFLICT' } };
    remote = { revision: remote.revision + 1, payload: structuredClone(args.new_payload) };
    return { data: remote.revision, error: null };
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ url: 'https://example.supabase.co', publishableKey: 'public' }),
    })),
  );
  await loadClient();
});
afterEach(() => vi.unstubAllGlobals());
it('loads private cloud data and saves edits with the expected revision', async () => {
  const sync = new VaultSync(vi.fn());
  await sync.initialize();
  const doc = (await db.docs.toArray())[0];
  await saveDoc({ ...doc, title: 'Edited' });
  await sync.tick();
  expect(remote.payload?.docs[0].title).toBe('Edited');
  expect(sync.revision).toBe(4);
  expect(await sync.hasPending()).toBe(false);
});
it('a stale device cannot overwrite cloud content; pending edits remain downloadable', async () => {
  const report = vi.fn(),
    sync = new VaultSync(report);
  await sync.initialize();
  const doc = (await db.docs.toArray())[0];
  await saveDoc({ ...doc, title: 'Local draft' });
  remote.revision++;
  await sync.tick();
  expect(sync.stopped).toBe(true);
  expect(remote.payload?.docs[0].title).toBe('Cloud case');
  expect((await exportData()).docs[0].title).toBe('Local draft');
  expect(report.mock.lastCall?.[1]).toBe(true);
});
it('network failure keeps pending edits and retries rather than marking them saved', async () => {
  const sync = new VaultSync(vi.fn());
  await sync.initialize();
  const doc = (await db.docs.toArray())[0];
  await saveDoc({ ...doc, title: 'Pending' });
  mock.rpc.mockResolvedValueOnce({ data: null, error: { code: 'network', message: 'offline' } });
  await sync.tick();
  expect(await sync.hasPending()).toBe(true);
  expect(sync.lastError).not.toBe('');
  await sync.tick();
  expect(remote.payload?.docs[0].title).toBe('Pending');
  expect(sync.lastError).toBe('');
});
it('re-login recovers unsaved local changes instead of clearing them', async () => {
  const first = new VaultSync(vi.fn());
  await first.initialize();
  const doc = (await db.docs.toArray())[0];
  await saveDoc({ ...doc, title: 'Recovered' });
  const second = new VaultSync(vi.fn());
  await second.initialize();
  expect((await db.docs.toArray())[0].title).toBe('Recovered');
  await second.tick();
  expect(remote.payload?.docs[0].title).toBe('Recovered');
});
it('remote updates pause editing instead of replacing a mounted editor', async () => {
  const sync = new VaultSync(vi.fn());
  await sync.initialize();
  const before = fingerprint(await exportData());
  remote.revision++;
  remote.payload!.docs[0].title = 'Other device';
  await sync.tick();
  expect(sync.stopped).toBe(true);
  expect(fingerprint(await exportData())).toBe(before);
});
it('an uninvited account cannot open the vault', async () => {
  allowed = false;
  await expect(new VaultSync(vi.fn()).initialize()).rejects.toThrow('没有访问');
});
it('edits made during an in-flight upload remain pending for the next save', async () => {
  const sync = new VaultSync(vi.fn());
  await sync.initialize();
  const doc = (await db.docs.toArray())[0];
  await saveDoc({ ...doc, title: 'First edit' });
  let complete!: (value: unknown) => void;
  mock.rpc.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const request = sync.tick();
  await vi.waitFor(() => expect(complete).toBeTypeOf('function'));
  const current = (await db.docs.toArray())[0];
  await saveDoc({ ...current, title: 'Second edit' });
  complete({ data: 4, error: null });
  await request;
  expect(await sync.hasPending()).toBe(true);
  remote.revision = 4;
  await sync.tick();
  expect(remote.payload?.docs[0].title).toBe('Second edit');
});
