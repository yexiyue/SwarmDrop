---
title: 使用 useLingui hook 进行字符串翻译
impact: 高
tags: 国际化, i18n, useLingui, hook, Lingui
---

## 使用 useLingui hook 进行字符串翻译

对于非 JSX 场景（如属性、变量）使用 `useLingui` hook 的 `t` 函数进行翻译。

**错误写法（硬编码属性）：**

```tsx
function SearchInput() {
  return (
    <input
      type="text"
      placeholder="Search devices..."
      aria-label="Search"
    />
  )
}
```

**正确写法（使用 useLingui）：**

```tsx
import { useLingui } from '@lingui/react/macro'

function SearchInput() {
  const { t } = useLingui()

  return (
    <input
      type="text"
      placeholder={t`Search devices...`}
      aria-label={t`Search`}
    />
  )
}
```

**处理变量插值：**

```tsx
import { useLingui } from '@lingui/react/macro'

function StatusMessage({ count, name }) {
  const { t } = useLingui()

  const message = t`Hello ${name}, you have ${count} new messages`

  return <span>{message}</span>
}
```

**在 useMemo 中安全使用：**

```tsx
import { useLingui } from '@lingui/react/macro'
import { useMemo } from 'react'

function Component() {
  // ✅ 正确：t 的引用会在语言切换时更新
  const { t } = useLingui()

  const welcomeMessage = useMemo(() => {
    return t`Welcome to SwarmDrop`
  }, [t]) // t 作为依赖项

  return <h1>{welcomeMessage}</h1>
}
```

**为什么重要：**

- 适用于元素属性（placeholder、aria-label 等）
- 安全支持 React memoization
- 语言切换时自动更新
- 与 Trans 组件配合使用覆盖所有场景
