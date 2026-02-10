# zustand-slices

大型应用使用 slices 模式组织状态。

## 规则

1. 将相关的状态和 actions 组织到独立的 slice 中
2. 使用 `StateCreator` 类型确保类型安全
3. 在主 store 中合并所有 slices
4. Slice 之间可以通过 `get()` 访问其他 slice 的状态

## 基础 Slices 模式

```tsx
import { create, StateCreator } from 'zustand'

// 定义 slice 类型
interface BearSlice {
  bears: number
  addBear: () => void
}

interface FishSlice {
  fishes: number
  addFish: () => void
}

// 创建 bear slice
const createBearSlice: StateCreator<
  BearSlice & FishSlice,  // 完整 store 类型
  [],
  [],
  BearSlice  // 当前 slice 类型
> = (set) => ({
  bears: 0,
  addBear: () => set((state) => ({ bears: state.bears + 1 })),
})

// 创建 fish slice
const createFishSlice: StateCreator<
  BearSlice & FishSlice,
  [],
  [],
  FishSlice
> = (set) => ({
  fishes: 0,
  addFish: () => set((state) => ({ fishes: state.fishes + 1 })),
})

// 合并 slices
const useBoundStore = create<BearSlice & FishSlice>()((...a) => ({
  ...createBearSlice(...a),
  ...createFishSlice(...a),
}))
```

## Slice 间交互

```tsx
interface SharedSlice {
  addBoth: () => void
  getBoth: () => number
}

const createSharedSlice: StateCreator<
  BearSlice & FishSlice & SharedSlice,
  [],
  [],
  SharedSlice
> = (set, get) => ({
  addBoth: () => {
    get().addBear()
    get().addFish()
  },
  getBoth: () => get().bears + get().fishes,
})

// 合并所有 slices
const useBoundStore = create<BearSlice & FishSlice & SharedSlice>()(
  (...a) => ({
    ...createBearSlice(...a),
    ...createFishSlice(...a),
    ...createSharedSlice(...a),
  })
)
```

## 配合中间件使用

```tsx
import { persist } from 'zustand/middleware'

const useBoundStore = create<BearSlice & FishSlice>()(
  persist(
    (...a) => ({
      ...createBearSlice(...a),
      ...createFishSlice(...a),
    }),
    { name: 'bound-store' }
  )
)
```

## 文件组织建议

```
stores/
├── index.ts              # 导出合并后的 store
├── slices/
│   ├── bearSlice.ts      # Bear slice
│   ├── fishSlice.ts      # Fish slice
│   └── sharedSlice.ts    # 共享 slice
└── types.ts              # 类型定义
```

## 何时使用

- Store 状态超过 5-10 个字段
- 多个领域的状态需要组织
- 团队协作，需要清晰的代码边界
- 需要复用某些 slice 到其他 store
