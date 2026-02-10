# zustand-persist

使用 persist middleware 实现状态持久化。

## 规则

1. 使用 `persist` 中间件包装 store
2. 指定唯一的 `name` 作为存储 key
3. 使用 `partialize` 选择需要持久化的字段
4. 使用 `storage` 选项自定义存储后端

## 基础用法

```tsx
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface SettingsState {
  theme: 'light' | 'dark'
  language: string
  setTheme: (theme: 'light' | 'dark') => void
  setLanguage: (lang: string) => void
}

const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      language: 'en',
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'settings-storage',  // localStorage key
    }
  )
)
```

## 部分持久化

```tsx
const useStore = create<State>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      tempData: null,  // 不需要持久化
      // ...actions
    }),
    {
      name: 'auth-storage',
      // 只持久化 user 和 token
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
    }
  )
)
```

## 自定义存储后端

```tsx
// 使用 sessionStorage
const useStore = create<State>()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'session-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)

// 自定义异步存储 (如 Tauri Stronghold)
const customStorage = {
  getItem: async (name: string) => {
    const value = await secureStorage.get(name)
    return value ? JSON.parse(value) : null
  },
  setItem: async (name: string, value: unknown) => {
    await secureStorage.set(name, JSON.stringify(value))
  },
  removeItem: async (name: string) => {
    await secureStorage.remove(name)
  },
}

const useSecureStore = create<State>()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'secure-storage',
      storage: createJSONStorage(() => customStorage),
    }
  )
)
```

## Hydration 处理

```tsx
// 检查 hydration 状态
const useStore = create<State & { _hasHydrated: boolean }>()(
  persist(
    (set) => ({
      // ...state
      _hasHydrated: false,
    }),
    {
      name: 'my-storage',
      onRehydrateStorage: () => (state) => {
        state?._hasHydrated = true
      },
    }
  )
)

// 组件中等待 hydration
function App() {
  const hasHydrated = useStore((state) => state._hasHydrated)

  if (!hasHydrated) {
    return <Loading />
  }

  return <MainApp />
}

// 或使用 onFinishHydration
useStore.persist.onFinishHydration((state) => {
  console.log('Hydration finished')
  state.init?.()
})
```

## 版本迁移

```tsx
const useStore = create<State>()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'my-storage',
      version: 2,  // 当前版本
      migrate: (persistedState, version) => {
        if (version === 0) {
          // 从 v0 迁移到 v1
          persistedState.newField = 'default'
        }
        if (version === 1) {
          // 从 v1 迁移到 v2
          delete persistedState.oldField
        }
        return persistedState as State
      },
    }
  )
)
```

## 注意事项

- 不要持久化敏感数据到 localStorage（考虑加密存储）
- 不要持久化临时 UI 状态
- 注意 SSR/RSC 场景的 hydration 问题
- 大型数据考虑使用 IndexedDB
