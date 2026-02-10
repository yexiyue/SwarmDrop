---
title: 优先使用生成的 ID
impact: 中
tags: 国际化, i18n, ID, 消息提取, Lingui
---

## 优先使用生成的 ID

优先使用 Lingui 自动生成的消息 ID，而非手动指定显式 ID。

**显式 ID 写法：**

```tsx
import { Trans } from '@lingui/react/macro'

// 需要手动管理 ID
<Trans id="header.welcome">Welcome to SwarmDrop</Trans>
<Trans id="header.subtitle">Secure file transfer</Trans>
```

**生成 ID 写法（推荐）：**

```tsx
import { Trans } from '@lingui/react/macro'

// 自动生成短哈希 ID
<Trans>Welcome to SwarmDrop</Trans>
<Trans>Secure file transfer</Trans>
```

**提取后的目录文件：**

```po
# 生成 ID 示例
#: src/App.tsx:5
msgid "Welcome to SwarmDrop"
msgstr "欢迎使用 SwarmDrop"

#: src/App.tsx:6
msgid "Secure file transfer"
msgstr "安全文件传输"
```

**使用 context 区分相同文本：**

```tsx
import { Trans } from '@lingui/react/macro'

// "right" 有不同含义时使用 context
<Trans context="direction">right</Trans>
<Trans context="correctness">right</Trans>
```

**生成 ID 的优势：**

| 优势 | 说明 |
|------|------|
| 避免命名问题 | 不需要为每个消息想名字 |
| 更好的开发体验 | 搜索文本直接定位到代码 |
| 自动去重 | 相同消息自动合并 |
| 更小的包体积 | 短哈希 ID 比长命名更小 |
| 避免 ID 冲突 | 不会有命名空间冲突 |

**何时使用显式 ID：**

- 需要与翻译管理系统（TMS）集成
- 非技术人员需要直接修改翻译
- 消息内容可能频繁变化但 ID 需保持稳定

**为什么重要：**

- 减少开发时的认知负担
- 代码更简洁可读
- 自动处理消息去重
- 构建时生成优化的短 ID
