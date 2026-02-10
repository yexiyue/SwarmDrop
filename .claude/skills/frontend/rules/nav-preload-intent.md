---
title: 使用 preload="intent" 加速导航
impact: 中
tags: 导航, 预加载, 性能, 用户体验
---

## 使用 preload="intent" 加速导航

在悬停/聚焦时启用预加载，使导航感觉瞬时完成。

**错误写法（没有预加载）：**

```tsx
<Link to="/dashboard">仪表盘</Link>
```

**正确写法（意图预加载）：**

```tsx
<Link to="/dashboard" preload="intent">
  仪表盘
</Link>
```

**预加载选项：**

| 值 | 行为 |
|-------|----------|
| `false` | 不预加载（默认） |
| `"intent"` | 悬停/聚焦时预加载（50ms 防抖） |
| `"viewport"` | 链接进入视口时预加载 |
| `"render"` | 链接渲染时立即预加载 |

**全局配置：**

```tsx
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0, // 始终获取最新数据
})
```

**为什么重要：**

- 接近瞬时的导航体验
- 用户点击前数据已加载
- 更好的感知性能
- 不会浪费请求（仅在有意图时触发）
