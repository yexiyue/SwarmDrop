---
name: frontend
description: 前端开发最佳实践指南。包含 TanStack Router、Zustand 状态管理、Lingui 国际化、React 等库的最佳实践和模式。当编写、审查或重构前端代码时使用。触发场景包括：路由配置、数据加载、搜索参数、认证守卫、代码分割、导航模式、状态管理、全局状态、Store 设计、国际化翻译、多语言支持等。
---

# 前端最佳实践

前端开发的类型安全和性能优化指南，包含 TanStack Router、Zustand 状态管理和 Lingui 国际化相关规则。

## 何时使用

在以下场景参考这些指南：
- 创建新路由或路由配置
- 使用 loader 实现数据加载
- 处理 search params 和 URL 状态
- 设置认证和受保护路由
- 组织路由文件和代码分割
- 实现导航模式
- 设计全局状态管理 (Zustand)
- 创建 Store、Slices 和 Selectors
- 持久化状态到 localStorage 或自定义存储
- 添加多语言支持和国际化
- 处理翻译消息和复数形式

## TanStack Router 规则分类

| 优先级 | 分类 | 影响 | 前缀 |
|--------|------|------|------|
| 1 | 路由组织 | 高 | `org-` |
| 2 | 数据加载 | 高 | `loader-` |
| 3 | 搜索参数 | 中高 | `search-` |
| 4 | 认证守卫 | 中高 | `auth-` |
| 5 | 代码分割 | 中 | `split-` |
| 6 | 导航模式 | 中 | `nav-` |

## Zustand 状态管理规则分类

| 优先级 | 分类 | 影响 | 前缀 |
|--------|------|------|------|
| 1 | Store 模式 | 高 | `zustand-` |
| 2 | Selectors | 高 | `zustand-` |
| 3 | Slices 模式 | 中高 | `zustand-` |
| 4 | 持久化 | 中 | `zustand-` |
| 5 | TypeScript | 中 | `zustand-` |

## Lingui 国际化规则分类

| 优先级 | 分类 | 影响 | 前缀 |
|--------|------|------|------|
| 1 | JSX 翻译 | 高 | `i18n-` |
| 2 | Hook 翻译 | 高 | `i18n-` |
| 3 | 延迟翻译 | 中高 | `i18n-` |
| 4 | 复数处理 | 中 | `i18n-` |
| 5 | 动态加载 | 中 | `i18n-` |
| 6 | ID 策略 | 中 | `i18n-` |

## 快速参考

### 1. 路由组织 (高优先级)

- `org-file-naming` - 使用 `.` 表示嵌套，避免深层目录
- `org-pathless-layout` - 使用 `_` 前缀创建无路径布局路由
- `org-route-groups` - 使用 `(group)` 目录仅用于组织

### 2. 数据加载 (高优先级)

- `loader-parallel` - 使用 loaderDeps 并行加载数据
- `loader-tanstack-query` - 集成 TanStack Query 实现缓存

### 3. 搜索参数 (中高优先级)

- `search-zod-validation` - 始终使用 Zod 验证搜索参数

### 4. 认证守卫 (中高优先级)

- `auth-beforeload` - 使用 beforeLoad 进行认证检查
- `auth-pathless-guard` - 使用 `_authenticated` 布局保护路由

### 5. 代码分割 (中优先级)

- `split-lazy-routes` - 使用 `.lazy.tsx` 进行组件代码分割

### 6. 导航模式 (中优先级)

- `nav-link-component` - 优先使用 Link 组件而非 useNavigate
- `nav-preload-intent` - 使用 preload="intent" 加速导航

### Zustand 状态管理规则

### 1. Store 模式 (高优先级)

- `zustand-store-pattern` - 使用 hook-based store 模式，保持简洁

### 2. Selectors (高优先级)

- `zustand-selectors` - 使用 selectors 避免不必要的重渲染

### 3. Slices 模式 (中高优先级)

- `zustand-slices` - 大型应用使用 slices 模式组织状态

### 4. 持久化 (中优先级)

- `zustand-persist` - 使用 persist middleware 实现状态持久化

### 5. TypeScript (中优先级)

- `zustand-typescript` - 正确使用 TypeScript 类型定义

### Lingui 国际化规则

### 1. JSX 翻译 (高优先级)

- `i18n-trans-component` - 使用 Trans 组件进行 JSX 翻译

### 2. Hook 翻译 (高优先级)

- `i18n-uselingui-hook` - 使用 useLingui hook 进行字符串翻译

### 3. 延迟翻译 (中高优先级)

- `i18n-lazy-translation` - 使用 msg 宏进行延迟翻译

### 4. 复数处理 (中优先级)

- `i18n-plural-handling` - 使用 Plural 处理复数形式

### 5. 动态加载 (中优先级)

- `i18n-dynamic-loading` - 动态加载消息目录

### 6. ID 策略 (中优先级)

- `i18n-generated-ids` - 优先使用生成的 ID

## 关键模式

### 文件路由层级

```
routes/
├── __root.tsx              # 根布局
├── index.tsx               # /
├── _authenticated.tsx      # 无路径认证守卫布局
├── _authenticated/
│   ├── dashboard.tsx       # /dashboard (受保护)
│   └── settings.tsx        # /settings (受保护)
├── (auth)/                 # 路由分组 (不影响 URL)
│   ├── login.tsx           # /login
│   └── register.tsx        # /register
├── users.tsx               # /users 布局
├── users.index.tsx         # /users
├── users.$userId.tsx       # /users/:userId
└── posts.lazy.tsx          # 代码分割组件
```

### 类型安全的搜索参数

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z.object({
  page: z.number().catch(1),
  filter: z.string().catch(''),
  sort: z.enum(['newest', 'oldest']).catch('newest'),
})

export const Route = createFileRoute('/products')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ deps }) => fetchProducts(deps.page),
})
```

### 受保护路由模式

```tsx
// routes/_authenticated.tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
  component: () => <Outlet />,
})
```

### 代码分割模式

```tsx
// routes/posts.tsx (关键路径 - 始终加载)
export const Route = createFileRoute('/posts')({
  loader: fetchPosts,
})

// routes/posts.lazy.tsx (懒加载)
export const Route = createLazyFileRoute('/posts')({
  component: PostsComponent,
})
```

### Zustand 状态管理模式

```tsx
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

// 基础 Store 模式
interface BearState {
  bears: number
  increase: () => void
  reset: () => void
}

const useBearStore = create<BearState>()((set) => ({
  bears: 0,
  increase: () => set((state) => ({ bears: state.bears + 1 })),
  reset: () => set({ bears: 0 }),
}))

// 使用 selector 避免重渲染
function BearCounter() {
  const bears = useBearStore((state) => state.bears)
  return <h1>{bears} bears</h1>
}

// useShallow 选择多个值
function BearStats() {
  const { bears, increase } = useBearStore(
    useShallow((state) => ({ bears: state.bears, increase: state.increase }))
  )
  return <button onClick={increase}>{bears} bears</button>
}

// persist 中间件
const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'settings-storage' }
  )
)
```

### Lingui 国际化模式

```tsx
import { Trans, Plural } from '@lingui/react/macro'
import { useLingui } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'

// JSX 翻译
<Trans>Welcome to SwarmDrop</Trans>

// 属性翻译
function SearchInput() {
  const { t } = useLingui()
  return <input placeholder={t`Search...`} />
}

// 延迟翻译
const statusMessages = {
  online: msg`Online`,
  offline: msg`Offline`,
}

// 复数处理
<Plural
  value={count}
  one="# device"
  other="# devices"
/>
```

### Lingui 配置示例

```js
// lingui.config.js
import { defineConfig } from '@lingui/cli'

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'zh', 'ja'],
  catalogs: [{
    path: '<rootDir>/src/locales/{locale}/messages',
    include: ['src'],
  }],
})
```

## 如何使用

查看 `rules/` 目录下的各个规则文件获取详细说明和代码示例。
