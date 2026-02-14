# SwarmDrop

<p align="center">
  <img src="public/favicon.png" width="120" alt="SwarmDrop Logo">
</p>

<p align="center">
  <strong>去中心化、跨网络、端到端加密的文件传输工具</strong>
</p>

<p align="center">
  <a href="https://github.com/yexiyue/SwarmDrop/releases">
    <img src="https://img.shields.io/github/v/release/yexiyue/SwarmDrop" alt="Release">
  </a>
  <a href="https://github.com/yexiyue/SwarmDrop/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  </a>
  <a href="https://tauri.app">
    <img src="https://img.shields.io/badge/built%20with-Tauri-FFC131?logo=tauri" alt="Tauri">
  </a>
</p>

<p align="center">
  <a href="https://github.com/yexiyue/SwarmDrop/releases">下载</a> •
  <a href="#特性">特性</a> •
  <a href="#安装">安装</a> •
  <a href="#使用">使用</a> •
  <a href="#开发">开发</a>
</p>

---

## 简介

**SwarmDrop** 是一款无需账号、无需服务器的点对点文件传输工具，定位为"跨网络版的 LocalSend"。

利用 libp2p 网络协议，SwarmDrop 支持：
- 📡 **跨网络传输** - 不局限于局域网，通过互联网连接任意设备
- 🔒 **端到端加密** - 所有传输内容均加密，确保隐私安全
- 🚀 **零配置** - 无需注册账号，开箱即用
- 📱 **全平台** - 支持 Windows、macOS、Linux、Android、iOS

## 特性

| 功能 | 状态 |
|------|------|
| P2P 网络连接 (libp2p) | ✅ 已完成 |
| mDNS 局域网发现 | ✅ 已完成 |
| DHT 跨网络发现 | ✅ 已完成 |
| Relay / DCUtR 穿透 | ✅ 已完成 |
| 设备配对系统 | ✅ 已完成 |
| 6位数字配对码 | ✅ 已完成 |
| 端到端加密传输 | 🚧 进行中 |
| 文件传输 | 🚧 进行中 |
| 生物识别解锁 | ✅ 已完成 |

## 安装

### 下载预编译版本

前往 [Releases](https://github.com/yexiyue/SwarmDrop/releases) 页面下载对应平台的安装包：

- **Windows**: `.msi` 或 `.exe`
- **macOS**: `.dmg` (Universal)
- **Linux**: `.AppImage` 或 `.deb`
- **Android**: `.apk`

### 从源码构建

#### 环境要求

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+
- [Rust](https://rust-lang.org/) 1.80+
- [Android Studio](https://developer.android.com/studio) (Android 构建需要)

#### 构建步骤

```bash
# 克隆仓库
git clone https://github.com/yexiyue/SwarmDrop.git
cd SwarmDrop

# 初始化子模块
git submodule update --init --recursive

# 安装依赖
pnpm install

# 开发模式（桌面端）
pnpm tauri dev

# 构建桌面端
pnpm tauri build

# Android 开发
pnpm android:dev

# Android 构建
pnpm android:build
```

## 使用

### 快速开始

1. **启动应用** - 首次启动需要设置安全密码
2. **启动节点** - 点击网络状态条启动 P2P 节点
3. **添加设备** - 
   - 方式一：通过 6 位配对码连接
   - 方式二：扫描设备发现的附近设备
4. **发送文件** - 选择已配对设备发送文件

### 配对流程

1. 在目标设备上选择"生成配对码"
2. 在当前设备上选择"输入配对码"
3. 输入显示的 6 位数字
4. 双方确认配对请求
5. 配对完成，开始传输

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript 5.8 + Vite 7 |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 状态管理 | Zustand 5 |
| 路由 | TanStack Router |
| 国际化 | Lingui (8 语言支持) |
| 后端 | Rust 2021 + Tauri 2 |
| P2P 网络 | libp2p 0.56 |
| 加密 | Stronghold + Ed25519 |

## 项目结构

```
swarmdrop/
├── src/                    # 前端源码
│   ├── commands/           # Tauri IPC 封装
│   ├── components/         # React 组件
│   ├── routes/             # TanStack Router 路由
│   ├── stores/             # Zustand 状态管理
│   └── locales/            # 国际化翻译
├── src-tauri/              # Tauri Rust 后端
│   ├── src/commands/       # 命令处理器
│   ├── src/network/        # P2P 网络管理
│   └── gen/android/        # Android 生成代码
├── libs/core/              # P2P 核心库 (子模块)
└── docs/                   # 文档站点
```

## 开发

```bash
# 安装依赖
pnpm install

# 桌面端开发
pnpm tauri dev

# Android 开发
pnpm android:dev

# 提取翻译字符串
pnpm i18n:extract

# 构建
pnpm build          # 前端构建
pnpm tauri build    # 桌面端构建
pnpm android:build  # Android 构建
```

## 国际化

SwarmDrop 支持 8 种语言：
- 简体中文 (zh)
- 繁体中文 (zh-TW)
- English (en)
- 日本語 (ja)
- 한국어 (ko)
- Español (es)
- Français (fr)
- Deutsch (de)

## 路线图

- [x] Phase 1: 网络层 (libp2p, mDNS, DHT, Relay)
- [x] Phase 2: 设备配对系统
- [ ] Phase 3: 文件传输 (Request-Response, 进度显示)
- [ ] Phase 4: 移动端优化 (二维码配对, HTTP 桥接)

## 安全

- 设备身份使用 Ed25519 密钥对
- 私钥存储在系统密钥库 (Stronghold)
- 支持生物识别解锁 (FaceID / TouchID / Windows Hello)
- 所有传输内容端到端加密

## 贡献

欢迎提交 Issue 和 PR！

1. Fork 本项目
2. 创建分支 (`git checkout -b feature/amazing`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing`)
5. 创建 Pull Request

## 许可

[MIT](LICENSE) © 2025 SwarmDrop Contributors

---

<p align="center">
  Made with ❤️ using <a href="https://tauri.app">Tauri</a> and <a href="https://libp2p.io">libp2p</a>
</p>
