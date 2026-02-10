# zustand-selectors

使用 selectors 避免不必要的重渲染。

## 规则

1. 始终使用 selector 函数选择需要的状态片段
2. **优先使用 `createWithEqualityFn` 创建 store**，自动应用 shallow 比较
3. 如果 store 已用 `create` 创建，使用 `useShallow` 选择多个值
4. 避免在 selector 中创建新对象/数组
5. 考虑使用自动生成 selectors 的模式

## 正确示例

```tsx
import { useShallow } from 'zustand/react/shallow'

// ✅ 选择单个值 - 最简单高效
function BearCounter() {
  const bears = useBearStore((state) => state.bears)
  return <span>{bears}</span>
}

// ✅ 选择 action - 不会导致重渲染
function AddButton() {
  const addBear = useBearStore((state) => state.addBear)
  return <button onClick={addBear}>Add</button>
}

// ✅ 使用 useShallow 选择多个值
function BearStats() {
  const { bears, food } = useBearStore(
    useShallow((state) => ({ bears: state.bears, food: state.food }))
  )
  return <div>{bears} bears with {food} food</div>
}

// ✅ 使用数组解构配合 useShallow
function BearInfo() {
  const [bears, food] = useBearStore(
    useShallow((state) => [state.bears, state.food])
  )
  return <div>{bears} - {food}</div>
}
```

## 错误示例

```tsx
// ❌ 选择整个 store - 任何状态变化都会重渲染
function BearCounter() {
  const store = useBearStore()  // 不要这样做
  return <span>{store.bears}</span>
}

// ❌ 在 selector 中创建新对象 - 每次都会重渲染
function BearStats() {
  const stats = useBearStore((state) => ({
    bears: state.bears,
    food: state.food,
  }))  // 没有 useShallow，每次都是新对象
  return <div>{stats.bears}</div>
}

// ❌ 在 selector 中计算衍生值（如果计算开销大）
function ExpensiveComponent() {
  const total = useBearStore((state) =>
    state.items.reduce((sum, i) => sum + i.price, 0)  // 每次渲染都计算
  )
}
```

## 自动生成 Selectors 模式

```tsx
import { StoreApi, UseBoundStore } from 'zustand'

type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never

const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(
  _store: S
) => {
  const store = _store as WithSelectors<typeof _store>
  store.use = {}
  for (const k of Object.keys(store.getState())) {
    ;(store.use as any)[k] = () => store((s) => s[k as keyof typeof s])
  }
  return store
}

// 使用
const useBearStore = createSelectors(useBearStoreBase)

// 组件中
const bears = useBearStore.use.bears()
const increment = useBearStore.use.increment()
```

## 使用 createWithEqualityFn 省略 useShallow

使用 `createWithEqualityFn` 创建 store 时指定默认的 equality function，之后使用时无需每次传入 `useShallow`：

```tsx
import { createWithEqualityFn } from 'zustand/traditional'
import { shallow } from 'zustand/shallow'

interface BearState {
  bears: number
  food: number
  addBear: () => void
}

// ✅ 创建时指定 shallow 作为默认比较函数
const useBearStore = createWithEqualityFn<BearState>()(
  (set) => ({
    bears: 0,
    food: 10,
    addBear: () => set((state) => ({ bears: state.bears + 1 })),
  }),
  shallow  // 默认使用 shallow 比较
)

// ✅ 使用时无需 useShallow，直接选择多个值
function BearStats() {
  const { bears, food } = useBearStore((state) => ({
    bears: state.bears,
    food: state.food,
  }))
  return <div>{bears} bears with {food} food</div>
}

// ✅ 也可以在单次调用时覆盖比较函数
const bears = useBearStore((s) => s.bears, Object.is)
```

## 性能提示

- 单个原始值：直接 selector
- 多个值：**优先使用 `createWithEqualityFn`**，次选 `useShallow`
- 衍生数据：考虑在 store 中预计算或使用 `useMemo`
- **新建 store 时统一使用 `createWithEqualityFn`**，避免每次使用时都要记住加 `useShallow`
