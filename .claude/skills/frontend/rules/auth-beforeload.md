---
title: 使用 beforeLoad 进行认证检查
impact: 中高
tags: 认证, beforeLoad, 守卫, 重定向
---

## 使用 beforeLoad 进行认证检查

使用 `beforeLoad` 进行认证检查，而不是组件级检查。防止受保护内容闪烁。

**错误写法（组件级认证检查）：**

```tsx
function DashboardPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: '/login' }) // 重定向前内容会闪烁！
    }
  }, [isAuthenticated])

  return <Dashboard />
}
```

**正确写法（beforeLoad 守卫）：**

```tsx
export const Route = createFileRoute('/dashboard')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
  component: DashboardPage,
})
```

**为什么重要：**

- 受保护内容不会闪烁
- 在路由加载前运行，而非加载后
- 跨路由的一致认证行为
- 组件代码更简洁（只处理正常路径）
