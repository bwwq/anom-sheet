# Anom Sheet

黑灰风格的多人车卡档案管理站点，用于创建、维护和分享风险部外勤人员档案。

一键安装：`curl -fsSL https://raw.githubusercontent.com/bwwq/anom-sheet/main/deploy-vps-docker.sh | PORT=6699 bash`

## 功能

- 用户注册和登录，首位注册者自动成为 admin
- 每个普通用户管理自己的车卡
- admin 可查看档案概览并管理用户账号
- 车卡包含身份、背景、属性、技能、异常抗性、状态、装备和后续记录
- 本人导出页显示单行 `.st 属性/技能名 数值 ...` 指令
- 临时分享链接提供 KP 审核视图，不展示导出指令
- 头像上传支持 jpg、png、webp，前端会压缩大图

## 技术栈

- Vinext / Next app router
- React 19
- Tailwind CSS 4
- Cloudflare D1
- Cloudflare R2，上传失败时会回退到 D1 内联图片存储
- Drizzle schema and migrations

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
pnpm install
pnpm dev
```

常用命令：

```bash
pnpm lint
pnpm build
pnpm db:generate
```

如果当前 shell 没有 `pnpm`，也可以直接使用 `node_modules/.bin` 下的脚本。

## 数据与部署

`.openai/hosting.json` 声明了 Sites 需要的逻辑绑定：

```json
{
  "d1": "DB",
  "r2": "FILES"
}
```

数据库结构在 `db/schema.ts`，运行时初始化在 `db/migrate.ts`，迁移文件在 `drizzle/`。

## 主要目录

- `app/`: 页面和 API 路由
- `components/field-card-app.tsx`: 主客户端应用
- `components/ui/`: 基础 UI 组件
- `lib/card-model.ts`: 车卡数据模型、默认值、导出指令和摘要
- `lib/server/`: 服务端认证、卡片读取和密码工具
- `db/`: D1 schema、连接和运行时迁移
- `drizzle/`: 迁移 SQL 与快照
