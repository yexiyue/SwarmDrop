---
title: 使用无路径布局保护路由
impact: 中高
tags: 认证, 无路径, 布局, 守卫
---

## 使用无路径布局保护路由

使用 `_authenticated` 无路径布局通过单个守卫保护多个路由。

**错误写法（在每个路由重复认证逻辑）：**

```tsx
// routes/dashboard.tsx
export const Route = createFileRoute('/dashboard')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) throw redirect({ to: '/login' })
  },
})

// routes/settings.tsx
export const Route = createFileRoute('/settings')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) throw redirect({ to: '/login' })
  },
})
```

**正确写法（单个无路径守卫）：**

```tsx
// routes/_authenticated.tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
  component: () => <Outlet />,
})
```

```
routes/
├── _authenticated.tsx          # 认证守卫
├── _authenticated/
│   ├── dashboard.tsx           # /dashboard (受保护)
│   ├── settings.tsx            # /settings (受保护)
│   └── profile.tsx             # /profile (受保护)
├── login.tsx                   # /login (公开)
└── register.tsx                # /register (公开)
```

**为什么重要：**

- DRY 原则 - 单一认证检查点
- 轻松添加新的受保护路由
- 公开路由和受保护路由清晰分离
- 认证视图共享布局
