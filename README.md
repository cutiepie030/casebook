# CASEBOOK

个人面试案例管理与复习工作台。React、TypeScript、Vite、Dexie / IndexedDB。

## 在线使用

GitHub Pages 仅发布程序，不包含个人简历、面试案例或备战资料。资料保存在当前浏览器，不自动上传或跨设备同步。

- 在 Mac 本地 CASEBOOK 正常运行时，使用「从本机迁移现有资料」，在本地弹窗确认复制。
- 也可从本地设置导出 JSON，再在在线版设置中导入。导入合并默认保留已有内容。
- 请定期导出 JSON 备份。清除浏览器网站数据可能丢失记录。

## 开发与发布

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
```

构建输出为 `docs/`。GitHub Pages 使用 `main` 分支的 `/docs` 目录。项目使用 Hash 路由，刷新详情页不会产生路由404。当前基础路径为 `/casebook/`。

所有个人数据文件、截图、整理报告和本地数据库都不在此仓库中。勿将私人JSON备份或包含个人数据的本地项目完整复制进公开仓库。
