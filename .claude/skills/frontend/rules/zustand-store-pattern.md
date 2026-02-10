# zustand-store-pattern

使用 hook-based store 模式，保持简洁。

## 规则

1. 使用 `create` 函数创建 store，返回一个 hook
2. 状态和 actions 定义在同一个对象中
3. 使用 `set` 函数更新状态，支持函数式更新
4. Store 命名使用 `use` 前缀 + 领域名 + `Store` 后缀

## 正确示例

```tsx
import { create } from 'zustand'

interface CounterState {
  count: number
  increment: () => void
  decrement: () => void
  reset: () => void
}

// ✅ 简洁的 store 定义
export const useCounterStore = create<CounterState>()((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
}))

// ✅ 在组件中使用
function Counter() {
  const { count, increment } = useCounterStore()
  return <button onClick={increment}>{count}</button>
}
```

## 错误示例

```tsx
// ❌ 不要在 store 外部定义 actions
const increment = () => useCounterStore.setState((s) => ({ count: s.count + 1 }))

// ❌ 不要使用 class 或复杂的工厂模式
class CounterStore {
  count = 0
  increment() { this.count++ }
}

// ❌ 不要忘记类型注解
const useStore = create((set) => ({  // 缺少类型
  count: 0,
}))
```

## 进阶：使用 get 访问当前状态

```tsx
const useStore = create<State>()((set, get) => ({
  items: [],
  addItem: (item) => set({ items: [...get().items, item] }),
  getTotal: () => get().items.reduce((sum, i) => sum + i.price, 0),
}))
```

## 何时使用

- 需要跨组件共享的客户端状态
- 不适合 URL 参数或 Context 的全局状态
- 需要在组件外部访问状态（如事件处理器、工具函数）
