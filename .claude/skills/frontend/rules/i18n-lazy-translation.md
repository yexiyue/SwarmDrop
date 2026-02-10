---
title: 使用 msg 宏进行延迟翻译
impact: 中高
tags: 国际化, i18n, msg, 延迟翻译, Lingui
---

## 使用 msg 宏进行延迟翻译

使用 `msg` 宏创建消息描述符，实现延迟翻译，适用于需要预定义消息的场景。

**错误写法（在组件外直接翻译）：**

```tsx
// ❌ 这样写会导致语言切换时不更新
const statusMessages = {
  open: '开放',
  closed: '已关闭',
  pending: '待处理',
}
```

**正确写法（使用 msg 延迟翻译）：**

```tsx
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'

// 在模块级别定义消息描述符
const statusMessages = {
  open: msg`Open`,
  closed: msg`Closed`,
  pending: msg`Pending`,
}

function StatusBadge({ status }) {
  const { _ } = useLingui()

  // 在组件内部翻译
  return <span>{_(statusMessages[status])}</span>
}
```

**定义颜色/选项列表：**

```tsx
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'

const connectionTypes = [
  { value: 'lan', label: msg`Local Network` },
  { value: 'dcutr', label: msg`Direct Connection` },
  { value: 'relay', label: msg`Relay Server` },
]

function ConnectionSelect() {
  const { _ } = useLingui()

  return (
    <select>
      {connectionTypes.map(({ value, label }) => (
        <option key={value} value={value}>
          {_(label)}
        </option>
      ))}
    </select>
  )
}
```

**结合 Trans 组件使用：**

```tsx
import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react'

const welcomeMessage = msg`Welcome to SwarmDrop`

function Header() {
  return (
    <h1>
      <Trans id={welcomeMessage.id} />
    </h1>
  )
}
```

**为什么重要：**

- 允许在组件外定义可翻译消息
- 语言切换时自动更新
- 适用于配置对象、常量定义
- 消息仍会被正确提取到翻译目录
