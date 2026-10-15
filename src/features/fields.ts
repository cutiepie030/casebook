import { caseStates, categories, forms } from '../domain/models';
export type Field = {
  key: string;
  label: string;
  type?: 'rich' | 'textarea' | 'date' | 'month' | 'datetime-local' | 'select';
  options?: string[];
  hint?: string;
};
export const fields: Record<string, Field[]> = {
  case: [
    { key: 'organization', label: '所属组织 / 公司' },
    { key: 'project', label: '项目名称' },
    { key: 'keywords', label: '关键词', hint: '便于全文搜索，可用顿号分隔。' },
    { key: 'start', label: '开始时间', type: 'month' },
    { key: 'end', label: '结束时间', type: 'month' },
    {
      key: 'experience',
      label: '经历类型',
      type: 'select',
      options: ['实习经历', '校园经历', '个人项目', '工作经历', '其他'],
    },
    { key: 'status', label: '案例状态', type: 'select', options: caseStates },
    { key: 'situation', label: 'S · 背景 Situation', type: 'rich' },
    { key: 'task', label: 'T · 任务 Task', type: 'rich' },
    { key: 'action', label: 'A · 行动 Action', type: 'rich' },
    { key: 'result', label: 'R · 结果 Result', type: 'rich' },
    {
      key: 'metrics',
      label: '核心数据',
      type: 'textarea',
      hint: '请标明数据来源，尚未核实的数据不要作为真实业绩。',
    },
    { key: 'contribution', label: '个人职责与贡献', type: 'textarea' },
    { key: 'difficulty', label: '遇到的困难', type: 'textarea' },
    { key: 'reflection', label: '反思与收获', type: 'rich' },
    { key: 'highlights', label: '可复用的回答亮点', type: 'textarea' },
    { key: 'caution', label: '注意事项', type: 'textarea' },
  ],
  question: [
    { key: 'category', label: '问题分类', type: 'select', options: categories },
    { key: 'format', label: '面试形式', type: 'select', options: forms },
    { key: 'difficulty', label: '难度', type: 'select', options: ['基础', '适中', '挑战'] },
    { key: 'importance', label: '重要程度', type: 'select', options: ['一般', '重要', '高频'] },
    { key: 'mastery', label: '复习状态', type: 'select', options: ['待复习', '学习中', '已掌握'] },
    { key: 'full', label: '完整版回答', type: 'rich' },
    { key: 'short', label: '简短版回答 / 核心思路', type: 'rich' },
    { key: 'keywords', label: '速记关键词', hint: '建议 3—6 个，用顿号或逗号分隔。' },
    { key: 'caution', label: '回答注意事项', type: 'textarea' },
  ],
  company: [
    { key: 'company', label: '公司名称' },
    { key: 'position', label: '岗位名称' },
    { key: 'location', label: '工作地点' },
    {
      key: 'progress',
      label: '面试进度',
      type: 'select',
      options: [
        '准备中',
        '已投递',
        '面试中',
        '等待结果',
        '已获 Offer',
        '已结束',
        '历史备战',
        '拟取消',
      ],
    },
    { key: 'jd', label: 'JD 原文 / 摘要', type: 'rich' },
    { key: 'requirements', label: '岗位要求', type: 'textarea' },
    { key: 'intro', label: '自我介绍', type: 'rich' },
    { key: 'whyCompany', label: '为什么投递这家公司', type: 'rich' },
    { key: 'whyRole', label: '为什么选择这个岗位', type: 'rich' },
    { key: 'understanding', label: '公司与行业理解', type: 'rich' },
    { key: 'ask', label: '反问问题', type: 'rich' },
    { key: 'notes', label: '面试笔记', type: 'rich' },
  ],
  review: [
    { key: 'companyName', label: '公司及岗位' },
    { key: 'date', label: '面试日期', type: 'date' },
    { key: 'round', label: '面试轮次' },
    { key: 'format', label: '面试形式', type: 'select', options: forms },
    {
      key: 'questions',
      label: '实际被问到的问题',
      type: 'textarea',
      hint: '每行一个问题，可以一键选择加入题库。',
    },
    { key: 'answer', label: '自己的回答思路', type: 'rich' },
    { key: 'strength', label: '回答得好的地方', type: 'rich' },
    { key: 'weakness', label: '表现不足的地方', type: 'rich' },
    { key: 'improvement', label: '需要改进的内容', type: 'rich' },
    {
      key: 'result',
      label: '面试结果',
      type: 'select',
      options: ['待反馈', '通过', '未通过', '进入下一轮', '已获 Offer'],
    },
  ],
  practice: [],
};

const sourceFields: Field[] = [
  { key: 'sources', label: '资料来源与溯源', type: 'textarea' },
  { key: 'versionNotes', label: '版本差异与核实事项', type: 'textarea' },
];
for (const kind of ['case', 'question', 'company', 'review']) fields[kind].push(...sourceFields);
fields.question.push(
  { key: 'answerStatus', label: '回答来源状态' },
  { key: 'versions', label: '同题历史版本（仅供对照）', type: 'textarea' },
);
fields.company.push({ key: 'sourceNotes', label: '公司信息核验提示', type: 'textarea' });
