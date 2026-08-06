# AutoBuff Monitor Web

登录页将系统定位为 AutoBuff 客户端与网页控制台的统一协同入口，网页端集中承载远程监控、设备管理、地图共享、版本控制及后续扩展能力。

Vue 3 编写的远程纯标注监控网页。登录账号后直接查看该账号客户端上报的实时监控，不再创建监控会话或使用公开 Token 链接。

完整功能、实现状态、接口和后续事项见
[WEB功能与实现记录.md](./WEB功能与实现记录.md)。后续 Web 功能改动应同步更新该文档。

## 开发

```bash
npm install
npm run dev
```

开发服务器会把 `/api` 和 `/ws` 代理到 `127.0.0.1:28672`。

只调试网页、直接使用线上后端和线上数据库时运行：

```bash
npm run dev:online
```

浏览器访问 `http://127.0.0.1:5173`。该模式下上传、覆盖、删除、封禁等操作会
真实修改线上数据，仅用于明确需要生产数据的人工调试。

## 构建

```bash
npm run build
```

将生成的 `dist` 内容复制到服务器 `/var/www/autobuff-monitor`，由 Nginx 通过 `https://buff.juanwang.cc` 提供访问。

当前联调地址：

- 注册：`https://buff.juanwang.cc/register`
- 登录：`https://buff.juanwang.cc/login`
- 健康检查：`https://buff.juanwang.cc/api/healthz`

## 路由

- `/login`：登录
- `/register`：注册
- `/functions`：登录后的功能中心
- `/clients`：当前账号的客户端管理
- `/admin/users`：超级管理员用户管理
- `/admin/invite-codes`：超级管理员生成和查看一次性限时注册邀请码
- `/dashboard`：登录后的纯标注监控
- `/dashboard/minimal`：需要登录的极简伪装页（「服务器存储监控」）
- `/settings`：账号与 Bark 通知设置

极简页上的黑话（磁盘、流量、写入锁定等）与真实含义的对照，见
[极简模式黑话对照表.md](./极简模式黑话对照表.md)。
