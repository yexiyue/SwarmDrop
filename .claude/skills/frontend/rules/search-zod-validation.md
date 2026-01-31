---
title: 始终使用 Zod 验证搜索参数
impact: 中高
tags: 搜索参数, 验证, zod, 类型安全
---

## 始终使用 Zod 验证搜索参数

使用 Zod schema 验证和定义搜索参数类型，并提供合理的默认值。

**错误写法（未验证的搜索参数）：**

```tsx
export const Route = createFileRoute('/products')({
  component: ProductsPage,
})

function ProductsPage() {
  const search = Route.useSearch() // any 类型，可能出现运行时错误
  const page = search.page || 1  // 手动设置默认值，没有验证
}
```

**正确写法（Zod 验证）：**

```tsx
import { z } from 'zod'

const productSearchSchema = z.object({
  page: z.number().int().nonnegative().catch(1),
  filter: z.string().catch(''),
  sort: z.enum(['newest', 'oldest', 'price']).catch('newest'),
  category: z.string().optional(),
})

export const Route = createFileRoute('/products')({
  validateSearch: productSearchSchema,
  component: ProductsPage,
})

function ProductsPage() {
  const { page, filter, sort } = Route.useSearch()
  // 所有值都是类型化且经过验证的！
}
```

**为什么重要：**

- 搜索参数完全类型安全
- 无效 URL 优雅地回退到默认值
- URL 状态的自文档化 API
- 防止格式错误的 URL 导致运行时错误
