# 求知台

一个面向 PC 个人用户的本地 AI 职场意见应用：用户描述真实困境，系统随机抽取立场不同的顾问并行回应。产品不替用户生成统一结论，而是用分歧帮助用户梳理问题、看到代价，最后记录自己的决定。

完整产品与交互说明见 [求知台-产品需求与交互设计.md](./outputs/求知台-产品需求与交互设计.md)。

## 当前实现

- 8 个固定顾问视角：张一鸣、乔布斯、Naval、张雪峰、芒格、塔勒布、阿里、字节
- 默认随机 4 张卡，隐藏控制可选择 1–8 张并重新抽取
- Three.js / React Three Fiber 黑洞场景，单行重力卡轨，卡面完成后“融化”并突出文字
- 8 张原创黑白金抽象 WebP 卡面，不含肖像、公司 Logo 或参考音乐原文件
- 提交后保留原始问题与问题镜像；顾问按真实完成顺序落位，失败卡自动退出
- 每位顾问独立多轮对话，默认带入原始问题与最近 20 条上下文
- Mock 流式 AI 默认启用；没有 API Key 也可完整演示和测试
- 讯飞 MaaS OpenAI-compatible HTTP 适配器已预留，可切换 `deepseek-v4-pro`
- Better Auth 用户名/密码登录，6 位验证码只打印后端控制台
- SQLite 本地存储卡牌包、对话和决定；验证码与请求 IP 仅保存加盐哈希
- 历史查看、重命名、删除、清空、Markdown 导出
- 原创 Tone.js 低保真氛围声；仅参考给定音乐的安静情绪，不复制或分发原曲

## 本地运行

要求 Node.js `>=22.13.0` 与 pnpm。

```bash
pnpm install
cp .env.example .env.local
pnpm db:setup
pnpm dev
```

打开 <http://localhost:3000>。

默认 `.env.example` 中 `MOCK_AI=true`，不需要填写任何 API Key。注册时点击“生成验证码”，在运行 `pnpm dev` 的终端中会看到：

```text
[求知台验证码] 用户 your_name：123456（5 分钟内有效）
```

验证码 5 分钟有效，60 秒冷却，最多尝试 5 次；用户名或 IP 每小时最多获取 10 次。

## 切换真实模型

在 `.env.local` 中设置：

```bash
MOCK_AI=false
XFYUN_API_BASE=https://maas-api.cn-huabei-1.xf-yun.com/v2
XFYUN_API_KEY=你的密钥
XFYUN_MODEL_ID=deepseek-v4-pro
```

密钥只从服务端环境变量读取，不会进入浏览器、SQLite 或 Git。当前实现使用 HTTP 流式协议，关闭联网搜索，由应用维护顾问提示词和每张卡的独立上下文。

填入真实凭据后可单独执行最小联网冒烟测试：

```bash
pnpm test:smoke-real
```

脚本在缺少密钥或模型 ID 时会直接拒绝运行，不会意外发起请求。

## 验收命令

```bash
pnpm lint
pnpm test:unit
pnpm test:e2e
pnpm build
```

当前验收基线为 17 个单元/集成用例与 2 条 Chromium 端到端主链路。覆盖随机抽卡、完成顺序、失败回收、重抽事务、注册限制与哈希、用户隔离、级联删除、上下文窗口、导出转义，以及以下真实页面流程：

1. 控制台验证码注册并保持 7 天会话
2. 选择 1–8 张卡并获得并行流式意见，验证单卡失败与重新抽取
3. 问题镜像、卡片完成态、单行卡轨与融化文字效果
4. 单顾问追问、停止生成、个人决定保存
5. 历史分页、选中卡恢复、重命名、导出、删除与清空
6. Tone.js 自动启声、注销重登和账号级联注销

## 数据与运维

- 数据文件：`data/qiuzhitai.db`（已被 Git 忽略）
- 初始化/迁移：`pnpm db:setup`
- CLI 重置密码：

```bash
pnpm user:reset-password <用户名> <新密码>
```

- 账号注销需要当前密码，并删除该用户的本地账号、会话、卡牌包和全部对话
- 产品面向最新版 Chrome 桌面端，建议视口宽度至少 1024px
