---
title: 使用 Plural 处理复数形式
impact: 中
tags: 国际化, i18n, Plural, 复数, ICU, Lingui
---

## 使用 Plural 处理复数形式

使用 `Plural` 组件或 `plural` 宏正确处理不同语言的复数规则。

**错误写法（手动拼接复数）：**

```tsx
function FileCount({ count }) {
  return (
    <span>
      {count} {count === 1 ? 'file' : 'files'}
    </span>
  )
}
```

**正确写法（使用 Plural 组件）：**

```tsx
import { Plural } from '@lingui/react/macro'

function FileCount({ count }) {
  return (
    <Plural
      value={count}
      one="# file"
      other="# files"
    />
  )
}
```

**处理零值和富文本：**

```tsx
import { Plural } from '@lingui/react/macro'

function DeviceCount({ count }) {
  return (
    <Plural
      value={count}
      _0="No devices found"
      one={<span>Found <strong>#</strong> device</span>}
      other={<span>Found <strong>#</strong> devices</span>}
    />
  )
}
```

**使用 plural 宏（非 JSX 场景）：**

```tsx
import { plural } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'

function TransferStatus({ fileCount }) {
  const { t } = useLingui()

  const message = t(plural(fileCount, {
    one: 'Transferring # file...',
    other: 'Transferring # files...',
  }))

  return <div>{message}</div>
}
```

**CLDR 复数类别：**

| 类别 | 说明 |
|------|------|
| `zero` | 零（某些语言需要） |
| `one` | 单数 |
| `two` | 双数（阿拉伯语等） |
| `few` | 少量（俄语等） |
| `many` | 多量（波兰语等） |
| `other` | 其他（必需） |

**为什么重要：**

- 不同语言有不同的复数规则
- 英语只有 one/other，但俄语有 one/few/many/other
- `#` 占位符会被替换为实际数字
- 翻译人员可以添加所需的复数形式
