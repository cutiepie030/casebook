# CASEBOOK

私人面试案例管理与复习工作台。React、TypeScript、Vite、Dexie、Supabase Auth / PostgreSQL。

## 私人空间

仅受邀账号可进入。每次打开页面需要邮箱和密码；登录会话仅驻留页面内存。浏览器使用独立页面缓存，约每 3 秒将修改保存到私人云端。请以顶部同步状态为准；未同步时保留页面并下载备份。其他设备有更新时会暂停编辑，防止旧版本覆盖新版本。

退出时保存编辑、同步并清除当前页面缓存。刷新后重新登录可恢复同一页面中未同步的草稿。不要在不受信任的设备上编辑私人资料。

## 部署

1. 在 Supabase 新项目执行 `supabase/schema.sql`，关闭公开注册，并创建个人 Auth 账号。
2. 管理员向 `casebook_members` 添加该 Auth 用户的 UUID。未受邀账号没有读写权限。
3. 在 `public/cloud-config.json` 配置 `url` 和 `publishableKey`。只使用可公开的 publishable key，禁止使用 service-role / secret key。
4. 私人案例只通过受保护的数据库导入，或登录后的一次性迁移入口导入。勿加入公开源码或 docs 文件。
5. 执行 `pnpm install --frozen-lockfile`、`pnpm test`、`pnpm build`，发布 `main` 分支 `/docs`。

数据库通过 RLS 限制读取；写入函数检查受邀身份，并使用 revision 原子检查防止并发覆盖。管理员应检查安全建议，定期备份。浏览器缓存和导入快照不能替代独立备份。

GitHub Pages 仅承载程序，无私人资料。无需把原始案例或密码提交至 GitHub。
