---
title: 使用下划线前缀创建无路径布局路由
impact: 高
tags: 组织, 布局, 无路径
---

## 使用下划线前缀创建无路径布局路由

无路径布局路由可以为子路由提供共享 UI 或逻辑，而不会在 URL 中添加路径段。

**错误写法（添加不必要的 URL 段）：**

```tsx
// routes/auth/login.tsx -> /auth/login
// routes/auth/register.tsx -> /auth/register
// 在 URL 中添加了不需要的 /auth/ 前缀
```

**正确写法（无路径布局）：**

```tsx
// routes/_auth.tsx - 不影响 URL 的布局
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="auth-container">
      <Outlet />
    </div>
  )
}
```

```
routes/
├── _auth.tsx           # 无路径布局（不影响 URL）
├── _auth/
│   ├── login.tsx       # /login
│   └── register.tsx    # /register
```

**为什么重要：**
- URL 保持简洁，没有人为的路径段
- 在相关路由之间共享布局/逻辑
- 非常适合认证守卫、主题或共享 UI
