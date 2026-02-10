---
title: 动态加载消息目录
impact: 中
tags: 国际化, i18n, 动态加载, 性能, 代码分割, Lingui
---

## 动态加载消息目录

使用动态导入按需加载语言包，减少初始包体积。

**错误写法（静态导入所有语言）：**

```tsx
// ❌ 所有语言包都打进初始包
import { messages as en } from './locales/en/messages'
import { messages as zh } from './locales/zh/messages'
import { messages as ja } from './locales/ja/messages'

i18n.load({ en, zh, ja })
```

**正确写法（动态加载）：**

```tsx
// i18n.ts
import { i18n } from '@lingui/core'

export const locales = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
}

export const defaultLocale = 'en'

export async function dynamicActivate(locale: string) {
  const { messages } = await import(`./locales/${locale}/messages`)
  i18n.load(locale, messages)
  i18n.activate(locale)
}
```

**在应用入口使用：**

```tsx
import React, { useEffect } from 'react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { defaultLocale, dynamicActivate } from './i18n'

function App() {
  useEffect(() => {
    dynamicActivate(defaultLocale)
  }, [])

  return (
    <I18nProvider i18n={i18n}>
      <YourApp />
    </I18nProvider>
  )
}
```

**语言切换：**

```tsx
import { dynamicActivate, locales } from './i18n'

function LanguageSwitcher() {
  const handleChange = async (locale: string) => {
    await dynamicActivate(locale)
    // 可选：保存到 localStorage
    localStorage.setItem('locale', locale)
  }

  return (
    <select onChange={(e) => handleChange(e.target.value)}>
      {Object.entries(locales).map(([code, name]) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
    </select>
  )
}
```

**构建输出结构：**

```
dist/
├── main.ab4626ef.js          # 主包（不含语言包）
├── i18n-en.c433b3bd.chunk.js # 英语包
├── i18n-zh.f0cf2e3d.chunk.js # 中文包
└── i18n-ja.a1b2c3d4.chunk.js # 日语包
```

**为什么重要：**

- 每次只加载一个语言包
- 显著减少初始加载体积
- 切换语言时按需加载
- Vite/Webpack 自动代码分割
