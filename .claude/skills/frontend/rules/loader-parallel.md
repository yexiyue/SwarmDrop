---
title: 使用 loaderDeps 并行加载数据
impact: 高
tags: loader, 数据加载, 并行, 性能
---

## 使用 loaderDeps 并行加载数据

`loaderDeps` 使 TanStack Router 能够并行加载数据，并将依赖项包含在缓存键中。

**错误写法（在组件内获取数据，造成瀑布流）：**

```tsx
export const Route = createFileRoute('/users/$userId')({
  component: UserPage,
})

function UserPage() {
  const { userId } = Route.useParams()
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetchUser(userId).then(setUser) // 瀑布流！
  }, [userId])

  if (!user) return <Loading />
  return <UserProfile user={user} />
}
```

**正确写法（使用 loader 和 deps）：**

```tsx
export const Route = createFileRoute('/users/$userId')({
  loaderDeps: ({ params }) => ({ userId: params.userId }),
  loader: async ({ deps }) => {
    return fetchUser(deps.userId)
  },
  component: UserPage,
})

function UserPage() {
  const user = Route.useLoaderData()
  return <UserProfile user={user} />
}
```

**为什么重要：**

- 数据与路由解析并行加载
- 依赖变化时自动使缓存失效
- 组件无需处理加载状态
- 配合 pending/error boundaries 提供更好的用户体验
