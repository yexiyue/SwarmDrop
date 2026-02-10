---
title: 使用 Trans 组件进行 JSX 翻译
impact: 高
tags: 国际化, i18n, Trans, JSX, Lingui
---

## 使用 Trans 组件进行 JSX 翻译

使用 `Trans` 组件包裹需要翻译的 JSX 内容，支持富文本和变量插值。

**错误写法（硬编码字符串）：**

```tsx
function Welcome({ name }) {
  return (
    <div>
      <h1>Welcome to SwarmDrop</h1>
      <p>Hello {name}, ready to transfer files?</p>
    </div>
  )
}
```

**正确写法（使用 Trans 组件）：**

```tsx
import { Trans } from '@lingui/react/macro'

function Welcome({ name }) {
  return (
    <div>
      <h1>
        <Trans>Welcome to SwarmDrop</Trans>
      </h1>
      <p>
        <Trans>Hello {name}, ready to transfer files?</Trans>
      </p>
    </div>
  )
}
```

**支持富文本和嵌套元素：**

```tsx
import { Trans } from '@lingui/react/macro'

function Documentation() {
  return (
    <p>
      <Trans>
        Read the <a href="/docs">documentation</a> for more info.
      </Trans>
    </p>
  )
}
```

**为什么重要：**

- 保持代码清晰可读
- 自动提取消息到翻译目录
- 支持 JSX 元素内的变量和组件
- 构建时自动转换为 ICU MessageFormat
