# 配对功能实现设计

## 概述

本文档详细说明设备配对功能的实现方案。配对是文件传输的前置步骤——所有传输都需要先建立配对关系。

### 设计原则

1. **业务与网络分离**：配对业务逻辑在 `src-tauri`，网络能力在 `libs/core`
2. **配对优先**：所有传输都需要先建立设备配对关系
3. **双向确认**：配对需要双方确认，防止单方面添加
4. **不缓存地址**：已配对设备仅存 PeerId，每次通过 DHT 重新查找地址，适应移动网络

### 相关文档

- [配对与传输设计](./pairing-transfer-design.md) - 产品设计和用户流程
- [Phase 2 路线图](../roadmap/phase-2-pairing.md) - 阶段任务规划

---

## 网络层能力（已实现）

`libs/core` 提供的 `NetClient<Req, Resp>` 已实现以下能力：

| 分类 | 方法 | 说明 |
|------|------|------|
| 连接 | `dial(peer_id)` | 连接到指定 Peer |
| DHT 引导 | `bootstrap()` | 加入 DHT 网络 |
| DHT Record | `put_record(record)` | 存储键值对 |
| DHT Record | `get_record(key)` | 查询键值对 |
| DHT Record | `remove_record(key)` | 删除键值对 |
| DHT Provider | `start_provide(key)` | 宣布 Provider |
| DHT Provider | `stop_provide(key)` | 停止 Provider |
| DHT Provider | `get_providers(key)` | 查询 Provider |
| DHT 查询 | `get_closest_peers(key)` | 查询最近节点 |
| Request-Response | `send_request(peer_id, req)` | 发送请求，等待响应 |
| Request-Response | `send_response(pending_id, resp)` | 回复入站请求 |

**入站请求事件**：当收到对端请求时，`NodeEvent::InboundRequest { peer_id, pending_id, request }` 会被推送到事件接收器。`pending_id` 用于后续调用 `send_response` 回复。

**关键约束**：`NetClient` 的泛型参数 `Req` 和 `Resp` 必须实现 `CborMessage` trait（即 `Debug + Clone + Serialize + Deserialize + Send + Sync + 'static`）。当前 `src-tauri` 中使用 `NetClient<(), ()>`，需要替换为实际的消息类型。

---

## 第一步：定义应用层消息类型

在实现配对之前，需要先定义 Request-Response 协议的消息类型，替换当前的 `NetClient<(), ()>`。

### 消息枚举

```rust
// src-tauri/src/protocol.rs

use serde::{Deserialize, Serialize};

/// 应用层请求类型
///
/// 所有通过 request-response 协议发送的请求都包含在此枚举中。
/// 后续新增功能（如文件传输）可直接扩展变体。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppRequest {
    /// 配对请求
    Pairing(PairingRequest),
    // 预留：FileTransfer(FileTransferRequest),
}

/// 应用层响应类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppResponse {
    /// 配对响应
    Pairing(PairingResponse),
    // 预留：FileTransfer(FileTransferResponse),
}
```

### 修改 NetClient 实例化

```rust
// src-tauri/src/commands/mod.rs

// 之前：
pub type NetClientState = Mutex<Option<NetClient<(), ()>>>;
let (client, mut receiver) = swarm_p2p_core::start::<(), ()>(keypair, config)?;

// 之后：
pub type NetClientState = Mutex<Option<NetClient<AppRequest, AppResponse>>>;
let (client, mut receiver) = swarm_p2p_core::start::<AppRequest, AppResponse>(keypair, config)?;
```

### 事件类型变化

修改后 `NodeEvent` 的泛型参数从 `()` 变为 `AppRequest`：

```rust
// 之前：NodeEvent<()>  → InboundRequest.request 是 ()，无意义
// 之后：NodeEvent<AppRequest> → InboundRequest.request 是 AppRequest

// 前端需要处理新的事件：
NodeEvent::InboundRequest {
    peer_id,
    pending_id,   // 用于 send_response 回复
    request: AppRequest::Pairing(pairing_request),
}
```

---

## 配对码设计

### 格式规范

```
字符集: 0123456789 (纯数字)
长度:   6 位
组合数: 10^6 = 1,000,000 (100 万)
有效期: 默认 5 分钟
示例:   382 519 (显示时 3+3 分组，手机弹数字键盘)
```

### DHT 使用策略

6 位配对码信息量有限，无法直接编码 PeerId + 加密密钥等完整信息。采用 **配对码 → DHT Record → PeerId** 的间接方案：

```mermaid
flowchart LR
    subgraph 发起方
        A1[生成 6 位随机码] --> A2["putRecord(SHA256(code), NodeInfo)"]
        A2 --> A3["startProvide(SHA256(peer_id))"]
    end

    subgraph 加入方
        B1[输入配对码] --> B2["getRecord(SHA256(code))"]
        B2 --> B3["获取 PeerId"]
        B3 --> B4["dial(peer_id)"]
    end

    subgraph 后续重连
        C1[已配对设备] --> C2["getProviders(SHA256(peer_id))"]
        C2 --> C3["dial(peer_id)"]
    end
```

**双重机制**：

| 机制 | Key | 用途 | 生命周期 |
|------|-----|------|----------|
| `putRecord` | `SHA256(code)` | 配对码 → PeerId 映射 | 配对完成或过期后删除 |
| `startProvide` | `SHA256(peer_id)` | 宣布节点在线状态 | 节点运行期间持续 |

**为什么不缓存地址？**
- 移动网络地址频繁变化
- `startProvide` 会持续向 DHT 更新路由信息
- 每次通过 `getProviders` 获取当前地址，保证可达性

### 数据结构

```rust
// src-tauri/src/pairing/code.rs

/// 配对码字符集 (纯数字)
const CHARSET: &[u8] = b"0123456789";
const CODE_LENGTH: usize = 6;

/// 配对码信息（返回给前端显示）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingCodeInfo {
    /// 6 位配对码
    pub code: String,
    /// 创建时间戳 (毫秒)
    pub created_at: i64,
    /// 过期时间戳 (毫秒)
    pub expires_at: i64,
}

/// DHT Record 中存储的内容（配对码 → 节点信息）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShareCodeRecord {
    /// 发起方 PeerId
    pub peer_id: String,
    /// 发起方设备名称
    pub device_name: String,
    /// 发起方 OS 类型
    pub os: String,
    /// 创建时间戳 (秒)
    pub created_at: u64,
    /// 过期时间戳 (秒)
    pub expires_at: u64,
}
```

### 生成与验证

```rust
// src-tauri/src/pairing/code.rs

use rand::Rng;
use sha2::{Sha256, Digest};

impl PairingCodeInfo {
    /// 生成新的配对码
    pub fn generate(expires_in_secs: u64) -> Self {
        let mut rng = rand::thread_rng();
        let code: String = (0..CODE_LENGTH)
            .map(|_| CHARSET[rng.gen_range(0..CHARSET.len())] as char)
            .collect();

        let now = chrono::Utc::now().timestamp_millis();

        Self {
            code,
            created_at: now,
            expires_at: now + (expires_in_secs * 1000) as i64,
        }
    }

    /// 检查是否过期
    pub fn is_expired(&self) -> bool {
        chrono::Utc::now().timestamp_millis() > self.expires_at
    }

    /// 计算 DHT Record Key
    pub fn dht_key(&self) -> Vec<u8> {
        sha256(self.code.as_bytes())
    }
}

/// 验证配对码格式
pub fn validate_code(code: &str) -> bool {
    code.len() == CODE_LENGTH
        && code.bytes().all(|b| CHARSET.contains(&b))
}

/// 格式化显示 (382519 -> 382 519)
pub fn format_code_display(code: &str) -> String {
    if code.len() == 6 {
        format!("{} {}", &code[0..3], &code[3..6])
    } else {
        code.to_string()
    }
}

/// SHA256 哈希
fn sha256(data: &[u8]) -> Vec<u8> {
    Sha256::digest(data).to_vec()
}

/// 计算 PeerId 的 DHT Provider Key
pub fn peer_provide_key(peer_id: &str) -> Vec<u8> {
    sha256(peer_id.as_bytes())
}
```

---

## 配对协议消息

```rust
// src-tauri/src/protocol.rs (续)

/// 配对请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairingRequest {
    /// 请求 ID (UUID)
    pub request_id: String,
    /// 请求方设备名称
    pub device_name: String,
    /// 请求方 OS 类型
    pub os: String,
    /// 配对方式
    pub method: PairingMethod,
    /// 时间戳 (毫秒)
    pub timestamp: u64,
}

/// 配对响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairingResponse {
    /// 对应的请求 ID
    pub request_id: String,
    /// 是否接受
    pub accepted: bool,
    /// 拒绝原因
    pub reject_reason: Option<String>,
    /// 响应方设备名称
    pub device_name: String,
    /// 响应方 OS 类型
    pub os: String,
}

/// 配对方式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PairingMethod {
    /// 通过配对码（跨网络）
    Code { code: String },
    /// 局域网直连（mDNS 发现后）
    Direct,
}
```

---

## 配对流程

### 跨网络配对（配对码方式）

```mermaid
sequenceDiagram
    participant A as 设备 A (发起方)
    participant DHT as DHT 网络
    participant B as 设备 B (加入方)

    Note over A: 节点启动时
    A->>DHT: startProvide(SHA256(peer_id))

    Note over A: 用户点击"生成配对码"
    A->>A: 生成随机 6 位码 (如 382519)
    A->>A: 创建 ShareCodeRecord
    A->>DHT: putRecord(SHA256("382519"), record)
    A->>A: 显示配对码，启动倒计时

    Note over B: 用户输入配对码
    B->>B: 验证格式
    B->>DHT: getRecord(SHA256("382519"))
    DHT->>B: 返回 ShareCodeRecord (含 PeerId)
    B->>B: 检查是否过期
    B->>A: dial(peer_id) + send_request(PairingRequest)

    Note over A: 收到 InboundRequest 事件
    A->>A: 弹窗显示："设备 B 请求配对"
    Note over A: 用户点击"接受"
    A->>B: send_response(pending_id, PairingResponse{accepted: true})

    Note over A,B: 双方保存 PairedDevice (仅 PeerId)
    A->>DHT: remove_record(SHA256("382519"))
```

### 局域网配对（mDNS 直连）

```mermaid
sequenceDiagram
    participant A as 设备 A
    participant B as 设备 B

    Note over A,B: mDNS 互相发现，已建立连接

    Note over A: 用户在附近设备列表选择 B
    A->>B: send_request(PairingRequest{method: Direct})

    Note over B: 收到 InboundRequest 事件
    B->>B: 弹窗："设备 A 请求配对"
    Note over B: 用户点击"接受"
    B->>A: send_response(pending_id, PairingResponse{accepted: true})

    Note over A,B: 双方保存 PairedDevice
```

### 已配对设备重连

```mermaid
sequenceDiagram
    participant A as 设备 A
    participant DHT as DHT 网络
    participant B as 设备 B (已配对)

    Note over A: 节点启动
    A->>DHT: startProvide(SHA256(peer_id))

    Note over B: 用户选择已配对设备 A
    B->>B: 读取本地 PairedDevice.peer_id
    B->>A: dial(peer_id)
    Note over B: libp2p 自动通过 DHT/mDNS 解析地址

    Note over A,B: 连接建立，可传输文件
```

---

## 配对管理器

### 状态机

```mermaid
stateDiagram-v2
    [*] --> Idle

    state "发起方流程" as sender {
        Idle --> WaitingForPeer: generate_code()
        WaitingForPeer --> Idle: 超时/取消
        WaitingForPeer --> PendingConfirm: 收到 PairingRequest
        PendingConfirm --> Paired: 用户接受
        PendingConfirm --> Idle: 用户拒绝
    }

    state "加入方流程" as joiner {
        Idle --> Connecting: connect_with_code()
        Connecting --> WaitingResponse: 发送请求成功
        Connecting --> Idle: DHT 查询失败
        WaitingResponse --> Paired: 对方接受
        WaitingResponse --> Idle: 对方拒绝/超时
    }

    state "局域网配对" as lan {
        Idle --> WaitingResponse: request_pairing(peer_id)
    }

    Paired --> [*]
```

### 核心结构

```rust
// src-tauri/src/pairing/manager.rs

use std::collections::HashMap;
use tokio::sync::RwLock;
use swarm_p2p_core::NetClient;
use crate::protocol::{AppRequest, AppResponse, PairingRequest, PairingResponse};

/// 配对管理器
pub struct PairingManager {
    /// 网络客户端
    net_client: NetClient<AppRequest, AppResponse>,
    /// 当前活跃的配对码
    active_code: RwLock<Option<ActiveCode>>,
    /// 待确认的入站配对请求 (request_id -> PendingInbound)
    pending_inbound: RwLock<HashMap<String, PendingInbound>>,
    /// 本机设备信息
    local_device: LocalDeviceInfo,
}

struct ActiveCode {
    info: PairingCodeInfo,
    dht_key: Vec<u8>,
}

/// 待确认的入站请求
struct PendingInbound {
    request: PairingRequest,
    peer_id: PeerId,
    /// send_response 所需的 pending_id
    pending_id: u64,
    received_at: i64,
}

struct LocalDeviceInfo {
    device_name: String,
    os: String,
}
```

### 核心方法

```rust
impl PairingManager {
    /// 节点启动时调用 - 在 DHT 宣布在线
    pub async fn announce_online(&self, peer_id: &PeerId) -> Result<()> {
        let key = RecordKey::new(&peer_provide_key(&peer_id.to_string()));
        self.net_client.start_provide(key).await?;
        Ok(())
    }

    /// 生成配对码 (发起方)
    pub async fn generate_code(&self, expires_in_secs: u64) -> Result<PairingCodeInfo> {
        // 1. 清理已有配对码
        self.cancel_code().await?;

        // 2. 生成配对码
        let info = PairingCodeInfo::generate(expires_in_secs);
        let dht_key = info.dht_key();

        // 3. 构造 DHT Record
        let record = ShareCodeRecord {
            peer_id: self.local_peer_id().to_string(),
            device_name: self.local_device.device_name.clone(),
            os: self.local_device.os.clone(),
            created_at: current_secs(),
            expires_at: current_secs() + expires_in_secs,
        };

        // 4. 发布到 DHT
        let value = ciborium_to_vec(&record)?;  // CBOR 编码
        let record = Record {
            key: RecordKey::new(&dht_key),
            value,
            publisher: None,
            expires: None,
        };
        self.net_client.put_record(record).await?;

        // 5. 保存并启动过期定时器
        *self.active_code.write().await = Some(ActiveCode {
            info: info.clone(),
            dht_key,
        });
        self.start_expiry_timer(expires_in_secs);

        Ok(info)
    }

    /// 取消配对码
    pub async fn cancel_code(&self) -> Result<()> {
        if let Some(active) = self.active_code.write().await.take() {
            self.net_client
                .remove_record(RecordKey::new(&active.dht_key))
                .await?;
        }
        Ok(())
    }

    /// 通过配对码连接 (加入方)
    pub async fn connect_with_code(&self, code: String) -> Result<PairingResponse> {
        // 1. 验证格式
        if !validate_code(&code) {
            return Err(AppError::Peer("无效的配对码格式".into()));
        }

        // 2. 从 DHT 查询
        let dht_key = sha256(code.as_bytes());
        let result = self.net_client
            .get_record(RecordKey::new(&dht_key))
            .await?;

        // 3. 解码 Record
        let share_record: ShareCodeRecord = ciborium_from_reader(&result.record.value[..])?;

        // 4. 检查过期
        if share_record.expires_at < current_secs() {
            return Err(AppError::Peer("配对码已过期".into()));
        }

        // 5. 解析 PeerId 并连接
        let peer_id: PeerId = share_record.peer_id.parse()
            .map_err(|_| AppError::Peer("无效的 PeerId".into()))?;

        self.net_client.dial(peer_id).await?;

        // 6. 发送配对请求
        let request = PairingRequest {
            request_id: uuid::Uuid::new_v4().to_string(),
            device_name: self.local_device.device_name.clone(),
            os: self.local_device.os.clone(),
            method: PairingMethod::Code { code },
            timestamp: current_millis(),
        };

        let resp = self.net_client
            .send_request(peer_id, AppRequest::Pairing(request))
            .await?;

        // 7. 解包响应
        match resp {
            AppResponse::Pairing(pairing_resp) => Ok(pairing_resp),
            _ => Err(AppError::Peer("意外的响应类型".into())),
        }
    }

    /// 处理入站配对请求 (由事件循环调用)
    ///
    /// 收到请求后暂存，等待用户通过 UI 确认/拒绝
    pub async fn on_inbound_pairing(
        &self,
        peer_id: PeerId,
        pending_id: u64,
        request: PairingRequest,
    ) {
        self.pending_inbound.write().await.insert(
            request.request_id.clone(),
            PendingInbound {
                request,
                peer_id,
                pending_id,
                received_at: current_millis(),
            },
        );
        // 通知前端弹窗 (通过 Tauri 事件)
    }

    /// 接受配对请求 (用户点击"接受"后调用)
    pub async fn accept_pairing(&self, request_id: &str) -> Result<PeerId> {
        let pending = self.pending_inbound.write().await
            .remove(request_id)
            .ok_or(AppError::Peer("请求不存在或已过期".into()))?;

        let response = AppResponse::Pairing(PairingResponse {
            request_id: request_id.to_string(),
            accepted: true,
            reject_reason: None,
            device_name: self.local_device.device_name.clone(),
            os: self.local_device.os.clone(),
        });

        // 通过 pending_id 回复原始请求
        self.net_client
            .send_response(pending.pending_id, response)
            .await?;

        Ok(pending.peer_id)
    }

    /// 拒绝配对请求
    pub async fn reject_pairing(&self, request_id: &str, reason: Option<String>) -> Result<()> {
        let pending = self.pending_inbound.write().await
            .remove(request_id)
            .ok_or(AppError::Peer("请求不存在或已过期".into()))?;

        let response = AppResponse::Pairing(PairingResponse {
            request_id: request_id.to_string(),
            accepted: false,
            reject_reason: reason,
            device_name: self.local_device.device_name.clone(),
            os: self.local_device.os.clone(),
        });

        self.net_client
            .send_response(pending.pending_id, response)
            .await?;

        Ok(())
    }

    /// 向局域网附近设备发起配对 (mDNS 发现的)
    pub async fn request_direct_pairing(&self, peer_id: PeerId) -> Result<PairingResponse> {
        let request = PairingRequest {
            request_id: uuid::Uuid::new_v4().to_string(),
            device_name: self.local_device.device_name.clone(),
            os: self.local_device.os.clone(),
            method: PairingMethod::Direct,
            timestamp: current_millis(),
        };

        let resp = self.net_client
            .send_request(peer_id, AppRequest::Pairing(request))
            .await?;

        match resp {
            AppResponse::Pairing(pairing_resp) => Ok(pairing_resp),
            _ => Err(AppError::Peer("意外的响应类型".into())),
        }
    }
}
```

---

## Tauri 命令

```rust
// src-tauri/src/commands/pairing.rs

use tauri::State;
use crate::pairing::PairingManager;

/// 生成配对码
#[tauri::command]
pub async fn generate_pairing_code(
    manager: State<'_, PairingManager>,
    expires_in_secs: Option<u64>,
) -> AppResult<PairingCodeInfo> {
    manager.generate_code(expires_in_secs.unwrap_or(300)).await
}

/// 取消配对码
#[tauri::command]
pub async fn cancel_pairing_code(
    manager: State<'_, PairingManager>,
) -> AppResult<()> {
    manager.cancel_code().await
}

/// 通过配对码连接
#[tauri::command]
pub async fn connect_with_pairing_code(
    manager: State<'_, PairingManager>,
    code: String,
) -> AppResult<PairingResponse> {
    manager.connect_with_code(code).await
}

/// 向附近设备发起配对
#[tauri::command]
pub async fn request_direct_pairing(
    manager: State<'_, PairingManager>,
    peer_id: String,
) -> AppResult<PairingResponse> {
    let peer_id: PeerId = peer_id.parse()
        .map_err(|_| AppError::Peer("无效的 PeerId".into()))?;
    manager.request_direct_pairing(peer_id).await
}

/// 接受配对请求
#[tauri::command]
pub async fn accept_pairing(
    manager: State<'_, PairingManager>,
    request_id: String,
) -> AppResult<String> {
    let peer_id = manager.accept_pairing(&request_id).await?;
    Ok(peer_id.to_string())
}

/// 拒绝配对请求
#[tauri::command]
pub async fn reject_pairing(
    manager: State<'_, PairingManager>,
    request_id: String,
    reason: Option<String>,
) -> AppResult<()> {
    manager.reject_pairing(&request_id, reason).await
}
```

---

## 前端集成

### 事件处理

`NodeEvent<AppRequest>` 序列化后通过 Tauri Channel 推送到前端。需要在 `handleEvent` 中增加对 `inboundRequest` 事件的处理：

```typescript
// src/commands/network.ts - 扩展 NodeEvent 类型

interface InboundPairingRequestEvent {
  type: "inboundRequest";
  peerId: string;
  pendingId: number;
  request: {
    Pairing: {
      request_id: string;
      device_name: string;
      os: string;
      method: { Code: { code: string } } | "Direct";
      timestamp: number;
    };
  };
}
```

### 配对 Store

```typescript
// src/stores/pairing-store.ts

interface PairingState {
  /** 当前配对码（发起方） */
  activeCode: PairingCodeInfo | null;
  /** 待确认的入站请求 */
  pendingRequests: InboundPairingRequest[];
  /** 连接状态 */
  connectStatus: "idle" | "connecting" | "waiting" | "success" | "error";
  connectError: string | null;

  // Actions
  generateCode: (expiresSecs?: number) => Promise<void>;
  cancelCode: () => Promise<void>;
  connectWithCode: (code: string) => Promise<void>;
  requestDirectPairing: (peerId: string) => Promise<void>;
  acceptPairing: (requestId: string) => Promise<void>;
  rejectPairing: (requestId: string, reason?: string) => Promise<void>;
  handleInboundRequest: (event: InboundPairingRequestEvent) => void;
}

interface PairingCodeInfo {
  code: string;
  createdAt: number;
  expiresAt: number;
}

interface InboundPairingRequest {
  requestId: string;
  peerId: string;
  pendingId: number;
  deviceName: string;
  os: string;
  method: "code" | "direct";
  receivedAt: number;
}
```

---

## 文件结构

```
src-tauri/src/
├── lib.rs
├── error.rs                    # 已有
├── protocol.rs                 # [新增] AppRequest/AppResponse + 配对消息
├── commands/
│   ├── mod.rs                  # [修改] NetClient 泛型 + 注册新命令
│   ├── identity.rs             # 已有
│   └── pairing.rs              # [新增] 配对 Tauri 命令
└── pairing/
    ├── mod.rs                  # [新增] 模块导出
    ├── code.rs                 # [新增] 配对码生成/验证/DHT Key
    └── manager.rs              # [新增] PairingManager

src/
├── commands/
│   ├── network.ts              # [修改] 扩展 NodeEvent 类型
│   └── pairing.ts              # [新增] 配对 invoke 封装
├── stores/
│   ├── network-store.ts        # [修改] 处理 inboundRequest 事件
│   ├── secret-store.ts         # [修改] 配对成功后保存 PairedDevice
│   └── pairing-store.ts        # [新增] 配对流程状态管理
└── components/
    └── pairing/                # [新增] 配对 UI 组件
        ├── pairing-code-display.tsx
        ├── pairing-code-input.tsx
        └── pairing-request-dialog.tsx
```

---

## 实现步骤

### Step 1：消息类型与基础设施

- [ ] 创建 `src-tauri/src/protocol.rs` — 定义 `AppRequest`、`AppResponse`、`PairingRequest`、`PairingResponse`
- [ ] 修改 `commands/mod.rs` — `NetClient<(), ()>` → `NetClient<AppRequest, AppResponse>`
- [ ] 修改前端 `NodeEvent` 类型定义 — 扩展 `inboundRequest` 事件
- [ ] 验证：编译通过，启动正常，mDNS 发现不受影响

### Step 2：配对码生成

- [ ] 创建 `src-tauri/src/pairing/code.rs` — 配对码生成、验证、DHT Key 计算
- [ ] 单元测试：生成格式、字符集、过期判断、SHA256 Key 一致性

### Step 3：配对管理器

- [ ] 创建 `src-tauri/src/pairing/manager.rs` — PairingManager 核心逻辑
- [ ] 实现 `generate_code` — 生成码 + putRecord
- [ ] 实现 `connect_with_code` — getRecord + dial + send_request
- [ ] 实现 `on_inbound_pairing` / `accept_pairing` / `reject_pairing` — 入站处理
- [ ] 实现 `request_direct_pairing` — 局域网直连配对
- [ ] 实现 `announce_online` — 节点启动时 startProvide

### Step 4：Tauri 命令注册

- [ ] 创建 `src-tauri/src/commands/pairing.rs` — 封装 Tauri 命令
- [ ] 在 `lib.rs` 注册命令
- [ ] 在 `start` 命令中初始化 PairingManager 并存入 Tauri State

### Step 5：前端集成

- [ ] 创建 `src/commands/pairing.ts` — invoke 封装
- [ ] 创建 `src/stores/pairing-store.ts` — 状态管理
- [ ] 修改 `network-store.ts` — 路由 inboundRequest 事件到 pairing-store
- [ ] 实现配对 UI 组件

---

## 测试计划

### 单元测试

| 测试项 | 内容 |
|--------|------|
| 配对码生成 | 长度 6，纯数字 0-9 |
| 配对码验证 | 合法码通过，非数字字符拒绝，长度不对拒绝 |
| DHT Key | 相同配对码产生相同 Key |
| 过期判断 | 未过期返回 false，已过期返回 true |
| 消息序列化 | AppRequest/AppResponse 的 CBOR 往返一致 |

### 集成测试场景

| 场景 | 预期 |
|------|------|
| 正常配对码配对 | 双方成功配对，保存 PairedDevice |
| 过期配对码 | 提示"配对码已过期" |
| 格式错误配对码 | 提示"无效的配对码格式" |
| 不存在的配对码 | DHT 查询失败，提示"未找到设备" |
| 配对被拒绝 | 加入方收到 accepted=false |
| 局域网直连配对 | mDNS 发现后直接配对成功 |
| 配对码超时自动清理 | 过期后 DHT Record 被删除 |

---

## 安全考虑

1. **配对码有效期**：默认 5 分钟，过期后自动从 DHT 清除
2. **随机性**：使用 `rand::thread_rng()`（底层 ChaCha20），满足密码学安全要求
3. **双向确认**：配对必须双方明确同意
4. **DHT Record 不含敏感信息**：仅存 PeerId + 设备名 + 过期时间，不含密钥
5. **E2E 加密密钥协商**：留给 Phase 3 文件传输阶段，配对阶段不涉及
