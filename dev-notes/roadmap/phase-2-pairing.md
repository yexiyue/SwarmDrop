# Phase 2: 设备配对

> **范围**: 仅桌面端 (Windows / macOS / Linux)
>
> **参考**: [implementation-roadmap.md](implementation-roadmap.md) 查看整体规划

## 目标

实现设备间的配对机制，包括分享码生成/解析、设备身份管理、以及基于 DHT 的设备发现与连接。

**注意**：本阶段仅针对桌面端之间的配对。移动端配对将在 Phase 4 使用二维码 + HTTP 方案实现。

## 前置条件

- Phase 1 网络连接已完成
- libp2p Swarm 能正常运行
- mDNS 和 DHT 功能可用

## 核心任务

### 2.1 设备身份管理

**目标**：管理本机设备身份，包括密钥、名称、指纹

**技术细节**：
- 使用 Ed25519 密钥对作为设备标识
- 密钥持久化存储到本地
- 生成人类可读的设备指纹

**数据模型**：
```rust
struct DeviceIdentity {
    keypair: Keypair,           // Ed25519 密钥对
    peer_id: PeerId,            // 从公钥派生
    name: String,               // 用户设置的设备名
    fingerprint: String,        // 8 字符指纹 (如 A1B2:C3D4)
    created_at: i64,            // 创建时间戳
}
```

**实现步骤**：
1. 创建 `src-tauri/src/identity/mod.rs` 模块
2. 实现密钥生成和加载逻辑
3. 实现指纹生成算法（公钥哈希截取）
4. 持久化到本地文件（`~/.swarmdrop/identity.json`）
5. 提供 Tauri 命令接口

**Tauri 命令**：
```rust
#[tauri::command]
fn get_device_identity() -> DeviceIdentity;

#[tauri::command]
fn set_device_name(name: String) -> Result<(), String>;

#[tauri::command]
fn regenerate_identity() -> DeviceIdentity;
```

**验收标准**：
- [ ] 首次启动自动生成身份
- [ ] 重启后能加载已有身份
- [ ] 设备名可修改
- [ ] 指纹格式正确且稳定

---

### 2.2 分享码生成

**目标**：生成 6 位分享码，编码传输会话信息

**分享码格式**：
```
字符集：A-Z 0-9（去除易混淆字符 0/O, 1/I/L）
实际字符集：ABCDEFGHJKMNPQRSTUVWXYZ23456789 (32 字符)
长度：6 位
组合数：32^6 ≈ 10 亿
```

**编码内容**：
```rust
struct ShareCodePayload {
    peer_id: PeerId,            // 发送方 PeerId (压缩)
    session_id: [u8; 8],        // 会话 ID (64 bit)
    encryption_key: [u8; 32],   // 对称加密密钥
    created_at: u32,            // 创建时间 (秒级时间戳)
    expires_in: u16,            // 有效期 (秒)
}
```

**编码方案**：
由于 6 位 Base32 只能编码约 30 bit，无法直接编码完整信息。采用以下方案：

```
分享码 = Base32(session_id_short)  // 6 字符
完整信息通过 DHT 发布
```

或者使用更长的分享码（如 12 位）直接编码更多信息。

**推荐方案（短码 + DHT）**：
```
1. 生成随机 session_id
2. 分享码 = Base32Encode(session_id[0..4])  // 6-8 字符
3. 在 DHT 发布完整的 ShareCodePayload
4. 接收方通过分享码查询 DHT 获取完整信息
```

**实现步骤**：
1. 创建 `src-tauri/src/pairing/mod.rs` 模块
2. 实现 Base32 编码/解码（自定义字符集）
3. 实现 `ShareCodePayload` 序列化
4. 实现分享码生成逻辑
5. 管理分享码生命周期（过期清理）

**Tauri 命令**：
```rust
#[tauri::command]
async fn create_share_code(expires_in_secs: u32) -> Result<ShareCode, String>;

#[tauri::command]
fn get_active_share_codes() -> Vec<ShareCode>;

#[tauri::command]
fn revoke_share_code(code: String) -> Result<(), String>;
```

**验收标准**：
- [ ] 生成的分享码格式正确
- [ ] 分享码能正确编码/解码
- [ ] 过期的分享码自动失效
- [ ] 可手动撤销分享码

---

### 2.3 DHT Provider 发布

**目标**：将分享码会话信息发布到 DHT 网络

**技术细节**：
- 使用 Kademlia `PUT_PROVIDER` 发布
- Key = SHA256(session_id)
- Value = 序列化的 ShareCodePayload

**实现步骤**：
1. 计算 DHT Key：`Sha256::digest(session_id)`
2. 调用 Kademlia `start_providing(key)`
3. 监听 `ProviderAdded` 事件确认发布成功
4. 分享码过期后停止提供

**数据流**：
```
发送方：
1. 生成 ShareCodePayload
2. 计算 key = hash(session_id)
3. PUT_PROVIDER(key, self.peer_id)
4. 等待接收方连接

接收方：
1. 解析分享码得到 session_id
2. 计算 key = hash(session_id)
3. GET_PROVIDERS(key) -> peer_id
4. 连接 peer_id
```

**验收标准**：
- [ ] Provider 能成功发布到 DHT
- [ ] 其他节点能查询到 Provider
- [ ] 分享码过期后 Provider 自动移除

---

### 2.4 分享码解析与连接

**目标**：通过分享码找到发送方并建立连接

**实现步骤**：
1. 解析分享码得到 session_id
2. 在 DHT 查询 `GET_PROVIDERS(hash(session_id))`
3. 获取发送方 PeerId
4. 建立 P2P 连接
5. 进行握手确认

**握手协议**：
```rust
// 接收方 -> 发送方
struct PairingRequest {
    session_id: [u8; 8],
    receiver_peer_id: PeerId,
    receiver_name: String,
}

// 发送方 -> 接收方
struct PairingResponse {
    accepted: bool,
    sender_name: String,
    file_list: Vec<FileInfo>,   // 待传输文件列表
    encryption_key: [u8; 32],   // 加密密钥
}
```

**Tauri 命令**：
```rust
#[tauri::command]
async fn connect_with_share_code(code: String) -> Result<PairingInfo, String>;
```

**前端事件**：
```typescript
// 发送方收到连接请求
listen('pairing-request', (event: PairingRequest) => { ... });

// 连接状态变化
listen('pairing-status', (event: PairingStatus) => { ... });
```

**验收标准**：
- [ ] 正确分享码能成功连接
- [ ] 错误分享码给出明确提示
- [ ] 过期分享码提示已过期
- [ ] 连接建立后显示对方设备名

---

### 2.5 局域网直连配对

**目标**：局域网内设备无需分享码直接配对

**实现步骤**：
1. 从 mDNS 发现的设备列表选择
2. 发起配对请求
3. 对方确认后建立连接

**配对流程**：
```
发送方：
1. 选择附近设备
2. 发送 DirectPairingRequest

接收方：
1. 收到请求，弹窗确认
2. 用户选择接受/拒绝
3. 发送 DirectPairingResponse

发送方：
4. 收到响应，配对完成
```

**Tauri 命令**：
```rust
#[tauri::command]
async fn request_direct_pairing(peer_id: String) -> Result<(), String>;

#[tauri::command]
fn respond_to_pairing(peer_id: String, accept: bool);
```

**验收标准**：
- [ ] 点击附近设备能发起配对
- [ ] 对方能收到配对请求弹窗
- [ ] 拒绝后连接不会建立
- [ ] 接受后连接正常建立

---

### 2.6 配对会话管理

**目标**：管理所有活跃的配对会话

**数据模型**：
```rust
struct PairingSession {
    id: String,                     // 会话 ID
    peer_id: PeerId,                // 对方 PeerId
    peer_name: String,              // 对方设备名
    direction: Direction,           // Sending / Receiving
    state: SessionState,            // Pending / Connected / Transferring / Completed
    share_code: Option<String>,     // 使用的分享码
    created_at: i64,
    connected_at: Option<i64>,
}

enum SessionState {
    Pending,        // 等待连接
    Connected,      // 已连接，待确认传输
    Transferring,   // 传输中
    Completed,      // 完成
    Failed(String), // 失败
    Cancelled,      // 取消
}
```

**实现步骤**：
1. 创建 `SessionManager` 管理所有会话
2. 会话状态变化时通知前端
3. 实现会话超时机制
4. 支持取消会话

**Tauri 命令**：
```rust
#[tauri::command]
fn get_active_sessions() -> Vec<PairingSession>;

#[tauri::command]
fn cancel_session(session_id: String) -> Result<(), String>;
```

**验收标准**：
- [ ] 能查询所有活跃会话
- [ ] 会话状态实时更新
- [ ] 超时会话自动清理
- [ ] 可手动取消会话

---

### 2.7 配对确认 UI

**目标**：实现配对相关的前端界面

**界面组件**：

1. **分享码显示组件**
```tsx
interface ShareCodeDisplayProps {
  code: string;
  expiresAt: number;
  onCopy: () => void;
  onCancel: () => void;
}
```

2. **分享码输入组件**
```tsx
interface ShareCodeInputProps {
  onSubmit: (code: string) => void;
  loading: boolean;
  error?: string;
}
```

3. **配对请求弹窗**
```tsx
interface PairingRequestDialogProps {
  peerName: string;
  peerId: string;
  onAccept: () => void;
  onReject: () => void;
}
```

4. **附近设备列表**
```tsx
interface NearbyDevicesListProps {
  devices: DeviceInfo[];
  onSelect: (device: DeviceInfo) => void;
}
```

**验收标准**：
- [ ] 分享码大字体清晰显示
- [ ] 倒计时显示剩余有效期
- [ ] 输入框支持自动格式化
- [ ] 配对请求弹窗醒目

---

## 项目结构

```
src-tauri/src/
├── identity/
│   ├── mod.rs              # 模块导出
│   ├── keypair.rs          # 密钥管理
│   └── fingerprint.rs      # 指纹生成
├── pairing/
│   ├── mod.rs              # 模块导出
│   ├── share_code.rs       # 分享码编码/解码
│   ├── session.rs          # 会话管理
│   ├── direct.rs           # 局域网直连配对
│   └── handshake.rs        # 握手协议
└── network/
    └── ...                 # Phase 1 的网络模块

src/
├── components/
│   ├── ShareCodeDisplay.tsx
│   ├── ShareCodeInput.tsx
│   ├── PairingRequestDialog.tsx
│   └── NearbyDevicesList.tsx
└── hooks/
    ├── usePairing.ts
    └── useNearbyDevices.ts
```

---

## 测试计划

### 单元测试

- 分享码编码/解码正确性
- 指纹生成一致性
- 会话状态机转换

### 集成测试

- 完整配对流程（分享码方式）
- 完整配对流程（局域网直连）
- 配对超时处理
- 并发配对请求处理

### 测试场景

1. 正常分享码配对
2. 过期分享码
3. 错误分享码
4. 配对被拒绝
5. 配对超时
6. 多设备同时配对

---

## 风险与对策

| 风险 | 对策 |
|------|------|
| DHT 查询慢 | 显示"搜索中"状态，设置超时 |
| 分享码碰撞 | 使用足够长的随机数，检测碰撞 |
| 配对请求骚扰 | 支持屏蔽设备，限制请求频率 |

---

## 阶段产出

- [ ] 设备身份管理功能
- [ ] 分享码生成和解析
- [ ] DHT Provider 发布和查询
- [ ] 局域网直连配对
- [ ] 配对会话管理
- [ ] 配对相关 UI 组件

## 依赖关系

- 依赖 Phase 1 的网络连接能力
- 为 Phase 3 文件传输提供已配对的连接
