import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CasebookDB } from '../src/db/database';
import { fresh, searchable } from '../src/domain/models';
import { saveDoc, removeDoc, exportData, validateBackup, restoreData, addLink } from '../src/services/data';
let db: CasebookDB;
beforeEach(() => {
  db = new CasebookDB(`test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  await db.delete();
});
describe('本地资料生命周期', () => {
  it('创建、修改、关闭数据库再打开仍保留数据，并可软删除与恢复', async () => {
    const d = await saveDoc({ ...fresh('case'), title: '真实案例' }, db);
    const edited = await saveDoc({ ...d, fields: { status: '待核实', action: '主动协调' } }, db);
    db.close();
    await db.open();
    expect((await db.docs.get(d.id))?.fields.action).toBe('主动协调');
    await removeDoc(d.id, db);
    const removed = (await db.docs.get(d.id))!;
    expect(removed.deletedAt).not.toBeNull();
    await saveDoc({ ...removed, deletedAt: null }, db);
    expect((await db.docs.get(d.id))?.deletedAt).toBeNull();
    expect(edited.revision).toBe(2);
  });
  it('检测同版本编辑冲突，不静默覆盖', async () => {
    const d = await saveDoc(fresh('case'), db);
    await saveDoc({ ...d, title: '新版本' }, db);
    await expect(saveDoc({ ...d, title: '旧版本覆盖' }, db)).rejects.toThrow('其他页面');
    expect((await db.docs.get(d.id))?.title).toBe('新版本');
  });
  it('题目只保存引用，修改案例后读取最新内容', async () => {
    const c = await saveDoc({ ...fresh('case'), title: '原案例' }, db);
    const q = await saveDoc({ ...fresh('question'), title: '协作经历' }, db);
    await db.links.add({
      id: 'rel',
      from: q.id,
      to: c.id,
      angle: '突出沟通',
      focus: '目标',
      order: 1,
      deletedAt: null,
    });
    await saveDoc({ ...c, title: '更新后的案例' }, db);
    const l = (await db.links.get('rel'))!;
    expect((await db.docs.get(l.to))?.title).toBe('更新后的案例');
    expect((await db.docs.get(q.id))?.fields).not.toHaveProperty('situation');
  });
  it('JSON 导出替换恢复字段、回收站、关联和面试安排', async () => {
    const c = await saveDoc(fresh('case'), db);
    const q = await saveDoc(fresh('question'), db);
    const co = await saveDoc(fresh('company'), db);
    await db.links.add({
      id: 'a',
      from: q.id,
      to: c.id,
      angle: '角度',
      focus: '关键词',
      order: 1,
      deletedAt: null,
    });
    await db.sessions.add({
      id: 's',
      companyId: co.id,
      date: '2026-10-20T14:00',
      round: '一面',
      format: '单面',
      status: '待面试',
    });
    await removeDoc(c.id, db);
    const before = await exportData(db);
    await db.docs.clear();
    await db.links.clear();
    await db.sessions.clear();
    await restoreData(JSON.parse(JSON.stringify(before)), 'replace', false, db);
    const after = await exportData(db);
    expect(after.docs.map(({ revision, ...d }) => d)).toEqual(
      before.docs.map(({ revision, ...d }) => d),
    );
    expect(after.links).toEqual(before.links);
    expect(after.sessions).toEqual(before.sessions);
    expect(await db.snapshots.count()).toBe(1);
  });
  it('无效文件、重复 ID 与悬空关联均不改变原库', async () => {
    const d = await saveDoc({ ...fresh('case'), title: '保留资料' }, db);
    const b = await exportData(db);
    for (const invalid of [
      {},
      { ...b, schemaVersion: 99 },
      { ...b, docs: [d, d] },
      {
        ...b,
        links: [
          { id: 'x', from: 'missing', to: d.id, angle: '', focus: '', order: 0, deletedAt: null },
        ],
      },
    ]) {
      await expect(restoreData(invalid, 'replace', false, db)).rejects.toThrow();
      expect((await db.docs.get(d.id))?.title).toBe('保留资料');
    }
    expect(await db.snapshots.count()).toBe(0);
  });
  it('事务写入失败时回滚替换与快照', async () => {
    const local = await saveDoc({ ...fresh('case'), title: '安全保留' }, db);
    const incoming = {
      ...(await exportData(db)),
      docs: [{ ...fresh('question'), title: '导入内容' }],
    };
    const reject = () => {
      throw Error('模拟磁盘写入失败');
    };
    db.docs.hook('creating', reject);
    await expect(restoreData(incoming, 'replace', false, db)).rejects.toThrow('模拟磁盘');
    db.docs.hook('creating').unsubscribe(reject);
    expect((await db.docs.get(local.id))?.title).toBe('安全保留');
    expect(await db.snapshots.count()).toBe(0);
  });
  it('合并默认保留本地，明确选择才覆盖', async () => {
    const local = await saveDoc({ ...fresh('case'), title: '本地' }, db);
    const b = await exportData(db);
    b.docs[0] = { ...local, title: '备份' };
    await restoreData(b, 'merge', false, db);
    expect((await db.docs.get(local.id))?.title).toBe('本地');
    await restoreData(b, 'merge', true, db);
    expect((await db.docs.get(local.id))?.title).toBe('备份');
  });
  it('正文与中文标签可搜索，空备份有效', () => {
    const d = { ...fresh('case'), tags: ['领导力'], fields: { action: '<p>跨部门沟通</p>' } };
    expect(searchable(d)).toContain('跨部门沟通');
    expect(searchable(d)).toContain('领导力');
    expect(
      validateBackup({
        format: 'CASEBOOK',
        schemaVersion: 1,
        appVersion: '1',
        exportedAt: new Date().toISOString(),
        docs: [],
        links: [],
        sessions: [],
      }).docs,
    ).toEqual([]);
  });
});

describe('导入边界', () => {
  it('合并后出现类型冲突时整体回滚', async () => {
    const local = await saveDoc({ ...fresh('case'), title: '本地案例' }, db);
    const importedQuestion = { ...fresh('question'), id: local.id };
    const incomingCase = { ...fresh('case'), id: 'new-case' };
    const b = {
      ...(await exportData(db)),
      docs: [importedQuestion, incomingCase],
      links: [
        {
          id: 'l',
          from: importedQuestion.id,
          to: incomingCase.id,
          angle: '',
          focus: '',
          order: 1,
          deletedAt: null,
        },
      ],
    };
    await expect(restoreData(b, 'merge', false, db)).rejects.toThrow('关联类型');
    expect(await db.docs.count()).toBe(1);
    expect((await db.docs.get(local.id))?.kind).toBe('case');
    expect(await db.links.count()).toBe(0);
  });
  it('非法案例状态和日期不能作为合法备份导入', async () => {
    const d = fresh('case');
    const b = { ...(await exportData(db)), docs: [{ ...d, fields: { status: '自动认证' } }] };
    expect(() => validateBackup(b)).toThrow('无效字段');
    expect(() => validateBackup({ ...b, docs: [{ ...d, createdAt: '昨天' }] })).toThrow();
  });
});

describe('并发与引用保护', () => {
  it('旧页面不能重新写回已被替换移除的内容', async () => {
    const d = await saveDoc(fresh('case'), db);
    await db.docs.delete(d.id);
    await expect(saveDoc({ ...d, title: '旧页面' }, db)).rejects.toThrow('其他页面');
    expect(await db.docs.count()).toBe(0);
  });
  it('重复点击只创建一条关联，已删除对象不能继续关联', async () => {
    const c = await saveDoc(fresh('case'), db),
      q = await saveDoc(fresh('question'), db);
    await Promise.all([addLink(q.id, c.id, db), addLink(q.id, c.id, db)]);
    expect(await db.links.count()).toBe(1);
    await removeDoc(c.id, db);
    await expect(addLink(q.id, c.id, db)).rejects.toThrow('回收站');
  });
});
