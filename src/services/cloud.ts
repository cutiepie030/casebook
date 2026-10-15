import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db/database';
import { exportData, validateBackup } from './data';
import type { Backup } from '../domain/models';
export type CloudConfig = { url: string; publishableKey: string };
let client: SupabaseClient | undefined;
export async function loadClient() {
  const response = await fetch('/casebook/' + 'cloud-config.json', { cache: 'no-store' });
  if (!response.ok) throw Error('云端空间尚未配置，请等待管理员完成连接。');
  const config: CloudConfig = await response.json();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url) || !config.publishableKey)
    throw Error('云端配置无效。');
  client ??= createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}
export function cloud() {
  if (!client) throw Error('请先登录');
  return client;
}
export function fingerprint(b: Backup) {
  return JSON.stringify({
    docs: [...b.docs].sort((a, b) => a.id.localeCompare(b.id)),
    links: [...b.links].sort((a, b) => a.id.localeCompare(b.id)),
    sessions: [...b.sessions].sort((a, b) => a.id.localeCompare(b.id)),
  });
}
export async function clearCache() {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
}
export async function replaceCache(raw: unknown) {
  const b = validateBackup(raw);
  await db.transaction('rw', [db.docs, db.links, db.sessions], async () => {
    await db.docs.clear();
    await db.links.clear();
    await db.sessions.clear();
    await db.docs.bulkPut(b.docs);
    await db.links.bulkPut(b.links);
    await db.sessions.bulkPut(b.sessions);
  });
}
export async function readVault(metadataOnly = false) {
  const { data, error } = await cloud()
    .from('casebook_vaults')
    .select(metadataOnly ? 'revision' : 'revision,payload')
    .maybeSingle();
  if (error) throw Error('无法连接私人空间，请检查网络后重试。');
  return data as { revision: number; payload: Backup | null } | null;
}
export async function writeVault(revision: number, payload: Backup) {
  const { data, error } = await cloud().rpc('casebook_save', {
    expected_revision: revision,
    new_payload: payload,
  });
  if (error) {
    if (error.code === '40001' || error.message.includes('CASEBOOK_CONFLICT'))
      throw Error('另一台设备已保存新内容。当前编辑已保留，请先下载备份，再重新登录查看云端版本。');
    throw Error('云端保存失败，当前编辑仍保留在此页面，请保持页面打开并重试。');
  }
  return Number(data);
}
export class VaultSync {
  revision = 0;
  baseline = '';
  stopped = false;
  busy = false;
  lastError = '';
  constructor(public report: (message: string, blocked?: boolean) => void) {}
  async initialize() {
    const { data, error } = await cloud().from('casebook_members').select('user_id').maybeSingle();
    if (error || !data) throw Error('此账号没有访问私人案例库的权限。');
    const remote = await readVault();
    const {
      data: { user },
    } = await cloud().auth.getUser();
    if (!user) throw Error('登录已失效，请重试。');
    const owner = await db.meta.get('cloud-owner'),
      previous = await db.meta.get('cloud-state');
    const local = await exportData();
    if (owner?.value === user.id && previous) {
      const saved = JSON.parse(previous.value) as { revision: number; baseline: string };
      if (fingerprint(local) !== saved.baseline) {
        this.revision = saved.revision;
        this.baseline = saved.baseline;
        // Keep unsaved edits. A CAS on the next tick will detect a newer cloud version.
        return;
      }
    }
    await clearCache();
    if (remote?.payload) await replaceCache(remote.payload);
    this.revision = remote?.revision ?? 0;
    this.baseline = fingerprint(await exportData());
    await db.meta.put({ key: 'cloud-owner', value: user.id });
    await this.remember();
  }
  async remember() {
    await db.meta.put({
      key: 'cloud-state',
      value: JSON.stringify({ revision: this.revision, baseline: this.baseline }),
    });
  }
  async hasPending() {
    return fingerprint(await exportData()) !== this.baseline;
  }
  async tick() {
    if (this.busy || this.stopped) return;
    this.busy = true;
    try {
      const current = await exportData(),
        hash = fingerprint(current);
      if (this.stopped) return;
      if (hash !== this.baseline) {
        this.report('正在保存到私人云端…');
        this.revision = await writeVault(this.revision, current);
        this.baseline = hash;
        await this.remember();
      } else {
        const remote = await readVault(true);
        if (this.stopped) return;
        if (remote && remote.revision !== this.revision) {
          // An editor may be typing while the request is in flight. Never replace live forms.
          this.lastError = '其他设备有更新，请先下载备份，再重新登录载入最新内容。';
          this.report(this.lastError, true);
          this.stopped = true;
          return;
        }
      }
      this.lastError = '';
      this.report('已保存到私人云端');
    } catch (e) {
      const message = e instanceof Error ? e.message : '连接暂时不可用，请重试';
      this.lastError = message;
      const conflict = message.includes('另一台设备');
      if (conflict) this.stopped = true;
      this.report(message, conflict);
    } finally {
      this.busy = false;
    }
  }
}
