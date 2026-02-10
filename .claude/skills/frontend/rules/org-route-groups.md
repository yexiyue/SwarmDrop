---
title: 使用路由分组仅用于组织
impact: 中
tags: 组织, 路由分组, 结构
---

## 使用路由分组仅用于组织

使用 `(括号)` 的路由分组可以组织文件而不影响 URL。

**错误写法（将组织与 URL 结构混合）：**

```
routes/
├── admin/
│   ├── users.tsx       # /admin/users
│   └── settings.tsx    # /admin/settings
```

**正确写法（纯粹的组织）：**

```
routes/
├── (admin)/            # 仅用于组织，不影响 URL
│   ├── users.tsx       # /users
│   └── settings.tsx    # /settings
├── (marketing)/
│   ├── pricing.tsx     # /pricing
│   └── about.tsx       # /about
```

**使用场景：**
- 按团队或领域分组路由
- 分离公开路由和内部路由
- 组织大型路由目录

**为什么重要：**
- URL 保持简洁和语义化
- 文件组织反映团队结构
- 按领域轻松查找路由
