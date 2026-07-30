# AutoBuff Monitor Web

Vue 3 编写的远程纯标注监控网页。登录账号后直接查看该账号客户端上报的实时监控，不再创建监控会话或使用公开 Token 链接。

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
- `/dashboard`：登录后的纯标注监控
- `/dashboard/minimal`：需要登录的极简伪装页（「服务器存储监控」）
- `/settings`：账号与 Bark 通知设置

极简页上的黑话（磁盘、流量、写入锁定等）与真实含义的对照，见
[极简模式黑话对照表.md](./极简模式黑话对照表.md)。
