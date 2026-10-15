import { z } from 'zod';
export const kinds = ['case', 'question', 'company', 'review', 'practice'] as const;
export type Kind = (typeof kinds)[number];
export const roleOptions = ['人力资源', '互联网运营', '综合职能', '央国企'];
export const caseStates = ['待核实', '已核实', '面试拟稿', '假设案例'];
export const categories = [
  '自我介绍',
  '求职动机',
  '职业规划',
  '优点与缺点',
  '实习结束原因',
  '反问环节',
  '宝洁八大问',
  '团队合作',
  '领导力',
  '解决冲突',
  '抗压能力',
  '主动学习',
  '创新能力',
  '失败与复盘',
  '跨部门沟通',
  '多任务管理',
  'HR 专业问题',
  'HR 情景模拟',
  '招聘流程与人才管理',
  '产品运营',
  '内容运营',
  '活动运营',
  '数据分析',
  '综合管理',
  '行业理解',
];
export const forms = ['单面', '群面', '半结构化面试', 'Case Interview', 'AI 面试', '英语面试'];
export const documentSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[A-Za-z0-9_-]+$/),
    kind: z.enum(kinds),
    title: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    revision: z.number().int().nonnegative(),
    deletedAt: z.iso.datetime().nullable(),
    demo: z.boolean(),
    favorite: z.boolean(),
    tags: z.array(z.string()),
    roles: z.array(z.string()),
    fields: z.record(z.string(), z.string()),
  })
  .strict();
export type Doc = z.infer<typeof documentSchema>;
export const linkSchema = z
  .object({
    id: z.string(),
    from: z.string(),
    to: z.string(),
    angle: z.string(),
    focus: z.string(),
    order: z.number(),
    deletedAt: z.iso.datetime().nullable(),
  })
  .strict();
export type Link = z.infer<typeof linkSchema>;
export const sessionSchema = z
  .object({
    id: z.string(),
    companyId: z.string(),
    date: z.string(),
    round: z.string(),
    format: z.string(),
    status: z.string(),
  })
  .strict();
export type Session = z.infer<typeof sessionSchema>;
export const backupSchema = z
  .object({
    format: z.literal('CASEBOOK'),
    schemaVersion: z.literal(1),
    appVersion: z.string(),
    exportedAt: z.iso.datetime(),
    docs: z.array(documentSchema),
    links: z.array(linkSchema),
    sessions: z.array(sessionSchema),
  })
  .strict();
export type Backup = z.infer<typeof backupSchema>;
export const labels: Record<Kind, string> = {
  case: '案例',
  question: '面试题',
  company: '公司备战',
  review: '面试复盘',
  practice: '练习记录',
};
export function fresh(kind: Kind): Doc {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    kind,
    title: '',
    createdAt: now,
    updatedAt: now,
    revision: 0,
    deletedAt: null,
    demo: false,
    favorite: false,
    tags: [],
    roles: [],
    fields:
      kind === 'case'
        ? { status: '待核实' }
        : kind === 'question'
          ? { mastery: '待复习', importance: '一般', difficulty: '适中', category: '团队合作' }
          : kind === 'company'
            ? { progress: '准备中' }
            : {},
  };
}
export function plain(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}
export function searchable(d: Doc) {
  return [d.title, ...d.tags, ...d.roles, ...Object.values(d.fields).map(plain)]
    .join(' ')
    .toLocaleLowerCase();
}
