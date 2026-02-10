---
title: 集成 TanStack Query 实现缓存
impact: 高
tags: loader, tanstack-query, 缓存, 数据加载
---

## 集成 TanStack Query 实现缓存

结合 TanStack Query 和路由 loader 实现最佳缓存和后台更新。

**错误写法（loader 没有缓存）：**

```tsx
export const Route = createFileRoute('/posts')({
  loader: async () => {
    return fetch('/api/posts').then(r => r.json())
  },
})
```

**正确写法（使用 TanStack Query）：**

```tsx
import { queryOptions } from '@tanstack/react-query'

const postsQueryOptions = queryOptions({
  queryKey: ['posts'],
  queryFn: () => fetch('/api/posts').then(r => r.json()),
  staleTime: 1000 * 60 * 5, // 5 分钟
})

export const Route = createFileRoute('/posts')({
  loader: ({ context }) => {
    return context.queryClient.ensureQueryData(postsQueryOptions)
  },
  component: PostsPage,
})

function PostsPage() {
  // 使用 query 进行后台更新
  const { data: posts } = useQuery(postsQueryOptions)
  return <PostList posts={posts} />
}
```

**设置路由 context：**

```tsx
const queryClient = new QueryClient()

const router = createRouter({
  routeTree,
  context: { queryClient },
})
```

**为什么重要：**

- 自动缓存和后台更新
- 并发请求自动去重
- 支持乐观更新
- 更好的离线处理能力
