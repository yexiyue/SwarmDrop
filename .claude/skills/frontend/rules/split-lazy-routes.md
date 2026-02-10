---
title: 使用 .lazy.tsx 进行组件代码分割
impact: 中
tags: 代码分割, 懒加载, 性能, 打包
---

## 使用 .lazy.tsx 进行组件代码分割

将路由文件拆分为关键路径（loader）和懒加载（component）部分，实现最佳代码分割。

**错误写法（所有内容在一个文件中）：**

```tsx
// routes/posts.tsx - 整个文件都在初始包中
import { HeavyEditor } from './heavy-editor'

export const Route = createFileRoute('/posts')({
  loader: fetchPosts,
  component: PostsPage,
})

function PostsPage() {
  return <HeavyEditor /> // 用户导航到这里之前就已加载
}
```

**正确写法（拆分成两个文件）：**

```tsx
// routes/posts.tsx - 关键路径（loader，预取时总是需要）
export const Route = createFileRoute('/posts')({
  loader: fetchPosts,
})
```

```tsx
// routes/posts.lazy.tsx - 懒加载组件
import { createLazyFileRoute } from '@tanstack/react-router'
import { HeavyEditor } from './heavy-editor'

export const Route = createLazyFileRoute('/posts')({
  component: PostsPage,
  pendingComponent: () => <div>加载中...</div>,
  errorComponent: ({ error }) => <div>错误: {error.message}</div>,
})

function PostsPage() {
  return <HeavyEditor />
}
```

**文件内容分配：**

| 文件 | 包含内容 |
|------|----------|
| `route.tsx` | loader, validateSearch, beforeLoad, context |
| `route.lazy.tsx` | component, pendingComponent, errorComponent |

**为什么重要：**

- 更小的初始包体积
- 更快的首页加载速度
- 组件仅在需要时加载
- loader 仍然可以预取数据
