# AutoBuff Monitor Web

Vue 3 编写的远程纯标注监控网页，包含注册、登录、监控会话管理和公开 Token 预览页面。

## 开发

```bash
npm install
npm run dev
```

开发服务器会把 `/api` 和 `/ws` 代理到 `127.0.0.1:28672`。

## 构建

```bash
npm run build
```

将生成的 `dist` 内容复制到服务器 `/var/www/autobuff-monitor`，由 Nginx 公网端口 `28671` 提供访问。

当前联调地址：

- 注册：`http://106.52.208.129:28671/register`
- 登录：`http://106.52.208.129:28671/login`
- 健康检查：`http://106.52.208.129:28671/api/healthz`

## 路由

- `/login`：登录
- `/register`：注册
- `/dashboard`：创建和查看监控会话
- `/preview/:token`：纯标注预览
- `/preview/:token/minimal`：极简伪装页（「服务器存储监控」）

极简页上的黑话（磁盘、流量、写入锁定等）与真实含义的对照，见
[极简模式黑话对照表.md](./极简模式黑话对照表.md)。
