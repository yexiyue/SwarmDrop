# zustand-typescript

正确使用 TypeScript 类型定义。

## 规则

1. 始终为 store 定义完整的类型接口
2. 使用 `create<State>()()` 双括号语法确保类型推断
3. 使用 `StateCreator` 类型定义 slice
4. 分离状态类型和 actions 类型（可选但推荐）

## 基础类型定义

```tsx
import { create } from 'zustand'

// ✅ 定义完整的 state 接口
interface BearState {
  bears: number
  food: number
  increase: (by: number) => void
  reset: () => void
}

// ✅ 使用双括号语法 create<Type>()()
const useBearStore = create<BearState>()((set) => ({
  bears: 0,
  food: 10,
  increase: (by) => set((state) => ({ bears: state.bears + by })),
  reset: () => set({ bears: 0 }),
}))
```

## 分离状态和 Actions

```tsx
// 状态类型
interface CounterState {
  count: number
  lastUpdated: Date | null
}

// Actions 类型
interface CounterActions {
  increment: () => void
  decrement: () => void
  reset: () => void
}

// 合并类型
type CounterStore = CounterState & CounterActions

const useCounterStore = create<CounterStore>()((set) => ({
  // 状态
  count: 0,
  lastUpdated: null,
  // Actions
  increment: () => set((state) => ({
    count: state.count + 1,
    lastUpdated: new Date(),
  })),
  decrement: () => set((state) => ({
    count: state.count - 1,
    lastUpdated: new Date(),
  })),
  reset: () => set({ count: 0, lastUpdated: null }),
}))
```

## 配合中间件的类型

```tsx
import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'

interface State {
  count: number
  increment: () => void
}

// 中间件顺序：从外到内
const useStore = create<State>()(
  devtools(
    persist(
      (set) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
      }),
      { name: 'counter-storage' }
    ),
    { name: 'counter-store' }
  )
)
```

## Slices 的类型定义

```tsx
import { StateCreator } from 'zustand'

interface BearSlice {
  bears: number
  addBear: () => void
}

interface FishSlice {
  fishes: number
  addFish: () => void
}

type Store = BearSlice & FishSlice

// StateCreator 类型参数：
// 1. 完整 store 类型
// 2. 中间件类型（空数组表示无中间件）
// 3. 中间件类型（空数组表示无中间件）
// 4. 当前 slice 类型
const createBearSlice: StateCreator<Store, [], [], BearSlice> = (set) => ({
  bears: 0,
  addBear: () => set((state) => ({ bears: state.bears + 1 })),
})

const createFishSlice: StateCreator<Store, [], [], FishSlice> = (set) => ({
  fishes: 0,
  addFish: () => set((state) => ({ fishes: state.fishes + 1 })),
})
```

## 在组件外使用 Store

```tsx
// 获取当前状态
const bears = useBearStore.getState().bears

// 订阅变化
const unsubscribe = useBearStore.subscribe(
  (state) => console.log('Bears:', state.bears)
)

// 设置状态
useBearStore.setState({ bears: 10 })

// 类型安全的 selector
const selectBears = (state: BearState) => state.bears
```

## 常见错误

```tsx
// ❌ 忘记双括号 - 类型推断会失败
const useStore = create<State>((set) => ({ /* ... */ }))

// ❌ 类型不完整
interface State {
  count: number
  // 缺少 increment 的类型定义
}
const useStore = create<State>()((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),  // 类型错误
}))

// ❌ set 函数参数类型错误
const useStore = create<State>()((set) => ({
  count: 0,
  increment: () => set({ count: 'string' }),  // 应该是 number
}))
```

## 工具类型

```tsx
// 提取 store 状态类型
type StoreState = ReturnType<typeof useStore.getState>

// 提取单个字段类型
type Count = StoreState['count']
```
