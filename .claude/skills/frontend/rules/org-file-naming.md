---
title: 使用点号表示嵌套，避免深层目录
impact: 高
tags: 组织, 文件命名, 路由
---

## 使用点号表示嵌套，避免深层目录

TanStack Router 支持点号表示法来表示路由嵌套，减少目录深度，提高文件可发现性。

**错误写法（深层目录嵌套）：**

```
routes/
├── users/
│   ├── index.tsx
│   └── [userId]/
│       ├── index.tsx
│       └── settings/
│           └── index.tsx
```

**正确写法（扁平化 + 点号表示法）：**

```
routes/
├── users.tsx           # /users 布局
├── users.index.tsx     # /users
├── users.$userId.tsx   # /users/:userId
└── users.$userId.settings.tsx  # /users/:userId/settings
```

**为什么重要：**
- 更容易查找和导航路由文件
- 减少 `../../../` 这种难以维护的导入
- 相关路由在文件列表中自然分组
- 更好地配合 IDE 文件搜索功能
