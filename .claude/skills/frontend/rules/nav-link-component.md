---
title: 优先使用 Link 组件而非 useNavigate
impact: 中
tags: 导航, Link, 声明式, 无障碍
---

## 优先使用 Link 组件而非 useNavigate

使用 `Link` 组件进行声明式导航。将 `useNavigate` 保留给编程式场景。

**错误写法（对链接使用命令式导航）：**

```tsx
function NavItem({ to, children }) {
  const navigate = useNavigate()

  return (
    <button onClick={() => navigate({ to })}>
      {children}
    </button>
  )
}
```

**正确写法（声明式 Link）：**

```tsx
import { Link } from '@tanstack/react-router'

function NavItem({ to, children }) {
  return (
    <Link
      to={to}
      className="nav-link"
      activeProps={{ className: 'nav-link active' }}
      preload="intent"
    >
      {children}
    </Link>
  )
}
```

**何时使用 useNavigate：**

```tsx
// 表单提交后
const navigate = useNavigate()

async function handleSubmit(data) {
  await saveData(data)
  navigate({ to: '/success' })
}

// 基于状态的条件导航
useEffect(() => {
  if (shouldRedirect) {
    navigate({ to: '/other', replace: true })
  }
}, [shouldRedirect])
```

**为什么重要：**

- 更好的无障碍性（正确的锚点语义）
- 自动处理激活状态
- 支持悬停/聚焦时预加载
- 真实链接带来的 SEO 收益
