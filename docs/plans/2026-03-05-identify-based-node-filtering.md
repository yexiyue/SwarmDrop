# 基于 Identify 协议的节点过滤与中继追踪 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 通过 `agent_version` 区分 SwarmDrop 用户设备和基础设施节点（引导/中继），从设备列表中过滤掉非用户节点，并追踪当前连接的中继节点列表。

**Architecture:** 移除硬编码的 `bootstrap_peer_ids: HashSet<PeerId>` 机制，改为在 `DeviceManager.get_devices()` 中检查 peer 的 `agent_version` 是否以 `swarmdrop/` 开头来判断是否为用户设备。同时将 `relay_ready: bool` 升级为 `relay_peers: HashSet<PeerId>` 以追踪具体中继节点，`bootstrap_connected` 改为基于 `agent_version` 判断。

**Tech Stack:** Rust (Tauri 2 backend), TypeScript (React frontend), SeaORM 不涉及

---

## 变更概览

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src-tauri/src/device/mod.rs` | Modify | 添加 `is_swarmdrop_agent()` 辅助方法 |
| `src-tauri/src/device/manager.rs` | Modify | `get_devices()` 过滤非 SwarmDrop peer；添加 `is_swarmdrop_peer()` 方法 |
| `src-tauri/src/network/config.rs` | Modify | 移除 `bootstrap_peer_ids` 和 `NodeConfigResult` |
| `src-tauri/src/network/manager.rs` | Modify | 移除 `bootstrap_peer_ids`，`relay_ready: bool` → `relay_peers: HashSet<PeerId>` |
| `src-tauri/src/network/event_loop.rs` | Modify | 用 `agent_version` 判断 bootstrap，用 `relay_peers` 追踪中继 |
| `src-tauri/src/network/mod.rs` | Modify | `NetworkStatus` 中 `relay_ready` 保留兼容，新增 `relay_peers` 字段 |
| `src-tauri/src/commands/mod.rs` | Modify | `start()` 不再传 `bootstrap_peer_ids` |
| `src/commands/network.ts` | Modify | `NetworkStatus` 类型新增 `relayPeers` |

---

### Task 1: 添加 `is_swarmdrop_agent()` 辅助方法

**Files:**
- Modify: `src-tauri/src/device/mod.rs:38-47`

**Step 1: 在 `OsInfo` 的 impl 块顶部添加常量和辅助函数**

在 `impl OsInfo` 块中（`to_agent_version` 之前），添加：

```rust
/// SwarmDrop 客户端 agent_version 前缀
pub const AGENT_PREFIX: &str = "swarmdrop/";

/// 检查 agent_version 是否属于 SwarmDrop 客户端
pub fn is_swarmdrop_agent(agent_version: &str) -> bool {
    agent_version.starts_with(Self::AGENT_PREFIX)
}
```

**Step 2: 运行编译验证**

Run: `cd d:/workspace/swarmdrop/src-tauri && cargo check 2>&1 | head -5`
Expected: 编译通过（新方法暂未使用会有 warning，无所谓）

**Step 3: Commit**

```bash
git add src-tauri/src/device/mod.rs
git commit -m "feat: 添加 OsInfo::is_swarmdrop_agent() 辅助方法"
```

---

### Task 2: DeviceManager 过滤非 SwarmDrop 节点

**Files:**
- Modify: `src-tauri/src/device/manager.rs:147-156` (get_devices 方法)
- Modify: `src-tauri/src/device/manager.rs:208-212` (is_connected 方法附近)

**Step 1: 修改 `get_devices()` 的 `All`/`Connected` 分支，增加 agent_version 过滤**

在 `get_devices` 方法中，`DeviceFilter::All | DeviceFilter::Connected` 分支的 `.filter()` 链增加判断：

```rust
DeviceFilter::All | DeviceFilter::Connected => {
    let connected_only = matches!(filter, DeviceFilter::Connected);
    self.peers
        .iter()
        .filter(|entry| {
            let peer = entry.value();
            // 只返回 SwarmDrop 客户端（过滤掉引导/中继等基础设施节点）
            let is_app_peer = peer
                .agent_version
                .as_deref()
                .is_some_and(OsInfo::is_swarmdrop_agent);
            is_app_peer && (!connected_only || peer.is_connected)
        })
        .map(|entry| self.peer_to_device(entry.value()))
        .collect()
}
```

注意需要在文件顶部确认 `use super::OsInfo;` 已存在（已有 `use super::{ConnectionType, Device, DeviceStatus, OsInfo, PairedDeviceInfo};`）。

**Step 2: 添加 `is_swarmdrop_peer()` 方法**

在 `DeviceManager` impl 块中 `is_connected` 方法后面添加：

```rust
/// 检查指定 peer 是否为 SwarmDrop 客户端（而非基础设施节点）
pub fn is_swarmdrop_peer(&self, peer_id: &PeerId) -> bool {
    self.peers.get(peer_id).is_some_and(|e| {
        e.value()
            .agent_version
            .as_deref()
            .is_some_and(OsInfo::is_swarmdrop_agent)
    })
}
```

**Step 3: 修改 `connected_count` 和 `discovered_count` 也过滤基础设施节点**

```rust
/// 已连接的 SwarmDrop 客户端数量
pub fn connected_count(&self) -> usize {
    self.peers
        .iter()
        .filter(|e| {
            let p = e.value();
            p.is_connected
                && p.agent_version
                    .as_deref()
                    .is_some_and(OsInfo::is_swarmdrop_agent)
        })
        .count()
}

/// 已发现的 SwarmDrop 客户端数量
pub fn discovered_count(&self) -> usize {
    self.peers
        .iter()
        .filter(|e| {
            e.value()
                .agent_version
                .as_deref()
                .is_some_and(OsInfo::is_swarmdrop_agent)
        })
        .count()
}
```

**Step 4: 运行编译验证**

Run: `cd d:/workspace/swarmdrop/src-tauri && cargo check 2>&1 | head -5`
Expected: 编译通过

**Step 5: Commit**

```bash
git add src-tauri/src/device/manager.rs
git commit -m "feat: DeviceManager 通过 agent_version 过滤非 SwarmDrop 节点"
```

---

### Task 3: 移除 `bootstrap_peer_ids` 和简化 `NodeConfigResult`

**Files:**
- Modify: `src-tauri/src/network/config.rs`
- Modify: `src-tauri/src/commands/mod.rs:39-53`

**Step 1: 简化 `config.rs`**

1. 移除 `use std::collections::HashSet;`
2. 删除整个 `NodeConfigResult` struct
3. `create_node_config` 返回值改为直接返回 `NodeConfig`，移除 `bootstrap_peer_ids` 收集逻辑

```rust
use std::time::Duration;
use swarm_p2p_core::{
    libp2p::{multiaddr::Protocol, Multiaddr, PeerId},
    NodeConfig,
};

/// SwarmDrop 引导+中继节点
///
/// 使用 /ip4/ 格式，所有平台通用（Android 无 DNS transport）。
const BOOTSTRAP_NODES: &[&str] = &[
    "/ip4/47.115.172.218/tcp/4001/p2p/12D3KooWCq8xgrSap7VZZHpW7EYXw8zFmNEgru9D7cGHGW3bMASX",
    "/ip4/47.115.172.218/udp/4001/quic-v1/p2p/12D3KooWCq8xgrSap7VZZHpW7EYXw8zFmNEgru9D7cGHGW3bMASX",
];

/// 解析 Multiaddr 字符串列表为 (PeerId, Multiaddr) 对
fn parse_multiaddrs(addrs: &[impl AsRef<str>]) -> Vec<(PeerId, Multiaddr)> {
    addrs
        .iter()
        .filter_map(|s| {
            let addr: Multiaddr = s.as_ref().parse().ok()?;
            let peer_id = addr.iter().find_map(|p| match p {
                Protocol::P2p(id) => Some(id),
                _ => None,
            })?;
            Some((peer_id, addr))
        })
        .collect()
}

/// 创建 P2P 节点配置
///
/// `custom_bootstrap_nodes` — 用户自定义的额外引导节点地址，与默认节点合并
pub fn create_node_config(
    agent_version: String,
    custom_bootstrap_nodes: &[String],
) -> NodeConfig {
    let mut bootstrap_peers = parse_multiaddrs(BOOTSTRAP_NODES);

    // 合并自定义引导节点
    if !custom_bootstrap_nodes.is_empty() {
        let custom_peers = parse_multiaddrs(custom_bootstrap_nodes);
        tracing::info!("Parsed {} custom bootstrap peers", custom_peers.len());
        bootstrap_peers.extend(custom_peers);
    }

    tracing::info!("Total {} bootstrap peers", bootstrap_peers.len());

    NodeConfig::new("/swarmdrop/1.0.0", agent_version)
        .with_mdns(true)
        .with_relay_client(true)
        .with_dcutr(true)
        .with_autonat(true)
        .with_req_resp_timeout(Duration::from_secs(180))
        .with_bootstrap_peers(bootstrap_peers)
}
```

**Step 2: 更新 `commands/mod.rs` 的 `start()` 函数**

`create_node_config` 现在直接返回 `NodeConfig`，不再有 `result.bootstrap_peer_ids`：

```rust
#[tauri::command]
pub async fn start(
    app: AppHandle,
    keypair: State<'_, Keypair>,
    paired_devices: Vec<PairedDeviceInfo>,
    custom_bootstrap_nodes: Option<Vec<String>>,
) -> crate::AppResult<()> {
    let agent_version = crate::device::OsInfo::default().to_agent_version();
    let config = crate::network::config::create_node_config(
        agent_version,
        &custom_bootstrap_nodes.unwrap_or_default(),
    );

    let (client, receiver) =
        swarm_p2p_core::start::<AppRequest, AppResponse>((*keypair).clone(), config)
            .map_err(|e| AppError::Network(e.to_string()))?;

    let peer_id = PeerId::from_public_key(&keypair.public());
    let net_manager = NetManager::new(
        client.clone(),
        peer_id,
        paired_devices,
    );
    // ... 后续不变
```

**Step 3: 运行编译验证（此时会有 manager.rs 编译错误，Task 4 修复）**

暂跳过编译验证，与 Task 4 一起验证。

**Step 4: Commit（与 Task 4 合并提交）**

---

### Task 4: 重构 NetManager — 移除 `bootstrap_peer_ids`，升级 `relay_peers`

**Files:**
- Modify: `src-tauri/src/network/manager.rs`

**Step 1: 修改 `NetManager` struct 和 `new()`**

移除 `bootstrap_peer_ids` 字段，将 `relay_ready: Arc<RwLock<bool>>` 替换为 `relay_peers: Arc<RwLock<HashSet<PeerId>>>`：

```rust
pub struct NetManager {
    client: AppNetClient,
    peer_id: PeerId,
    pairing: Arc<PairingManager>,
    devices: Arc<DeviceManager>,
    transfer: Arc<TransferManager>,
    cancel_token: CancellationToken,
    listen_addrs: Arc<RwLock<Vec<Multiaddr>>>,
    nat_status: Arc<RwLock<NatStatus>>,
    public_addr: Arc<RwLock<Option<Multiaddr>>>,
    /// 当前已连接的中继节点 PeerId 集合
    relay_peers: Arc<RwLock<HashSet<PeerId>>>,
    /// 是否至少有一个引导/基础设施节点已连接（基于 agent_version 判断）
    bootstrap_connected: Arc<RwLock<bool>>,
}
```

`new()` 签名移除 `bootstrap_peer_ids` 参数：

```rust
pub fn new(
    client: AppNetClient,
    peer_id: PeerId,
    paired_devices: Vec<PairedDeviceInfo>,
) -> Self {
    // ... 内部创建逻辑不变，只是移除 bootstrap_peer_ids
    Self {
        // ...
        relay_peers: Arc::new(RwLock::new(HashSet::new())),
        bootstrap_connected: Arc::new(RwLock::new(false)),
    }
}
```

**Step 2: 更新 `SharedNetRefs` struct**

```rust
pub(crate) struct SharedNetRefs {
    pub peer_id: PeerId,
    pub client: AppNetClient,
    pub devices: Arc<DeviceManager>,
    pub pairing: Arc<PairingManager>,
    pub transfer: Arc<TransferManager>,
    pub listen_addrs: Arc<RwLock<Vec<Multiaddr>>>,
    pub nat_status: Arc<RwLock<NatStatus>>,
    pub public_addr: Arc<RwLock<Option<Multiaddr>>>,
    pub relay_peers: Arc<RwLock<HashSet<PeerId>>>,
    pub bootstrap_connected: Arc<RwLock<bool>>,
}
```

**Step 3: 更新 `shared_refs()` 方法**

```rust
pub(crate) fn shared_refs(&self) -> SharedNetRefs {
    SharedNetRefs {
        peer_id: self.peer_id,
        client: self.client.clone(),
        devices: self.devices.clone(),
        pairing: self.pairing.clone(),
        transfer: self.transfer.clone(),
        listen_addrs: self.listen_addrs.clone(),
        nat_status: self.nat_status.clone(),
        public_addr: self.public_addr.clone(),
        relay_peers: self.relay_peers.clone(),
        bootstrap_connected: self.bootstrap_connected.clone(),
    }
}
```

**Step 4: 更新 `build_network_status()`**

```rust
pub fn build_network_status(&self) -> NetworkStatus {
    let relay_peers_list: Vec<PeerId> = self
        .relay_peers
        .read()
        .map(|g| g.iter().copied().collect())
        .unwrap_or_default();

    NetworkStatus {
        status: NodeStatus::Running,
        peer_id: Some(self.peer_id),
        listen_addrs: read_or(&self.listen_addrs, Vec::new()),
        nat_status: read_or(&self.nat_status, NatStatus::Unknown),
        public_addr: self.public_addr.read().ok().and_then(|g| g.clone()),
        connected_peers: self.devices.connected_count(),
        discovered_peers: self.devices.discovered_count(),
        relay_ready: !relay_peers_list.is_empty(),
        relay_peers: relay_peers_list,
        bootstrap_connected: read_or(&self.bootstrap_connected, false),
    }
}
```

**Step 5: 运行编译验证（event_loop.rs 会有错误，Task 5 修复）**

暂跳过，与 Task 5 一起验证。

---

### Task 5: 重构 event_loop — 基于 identify 判断 bootstrap，追踪 relay_peers

**Files:**
- Modify: `src-tauri/src/network/event_loop.rs:224-263`

**Step 1: 修改 `RelayReservationAccepted` 处理**

```rust
NodeEvent::RelayReservationAccepted { relay_peer_id, .. } => {
    if let Ok(mut rp) = shared.relay_peers.write() {
        rp.insert(relay_peer_id);
    }
    let net_status = shared.build_network_status();
    let _ = app.emit(events::NETWORK_STATUS_CHANGED, &net_status);
}
```

**Step 2: 修改 `PeerConnected` 处理 — 不再用 `bootstrap_peer_ids`**

```rust
NodeEvent::PeerConnected { .. } => {
    emit_device_and_status();
}
```

bootstrap_connected 改为在 `IdentifyReceived` 中判断。

**Step 3: 修改 `PeerDisconnected` 处理 — 清理 relay_peers + 重算 bootstrap_connected**

```rust
NodeEvent::PeerDisconnected { ref peer_id } => {
    // 清理中继节点
    if let Ok(mut rp) = shared.relay_peers.write() {
        rp.remove(peer_id);
    }
    // 重算 bootstrap_connected：是否还有非 SwarmDrop 的已连接 peer
    // （在 IdentifyReceived 中设置，断开时重新检查）
    let any_infra_connected = shared.devices.has_connected_infra_peer();
    if let Ok(mut bc) = shared.bootstrap_connected.write() {
        *bc = any_infra_connected;
    }
    emit_device_and_status();
}
```

**Step 4: 修改 `IdentifyReceived` 分支 — 判断 bootstrap_connected**

将 `IdentifyReceived` 从合并分支中拆出来单独处理：

```rust
NodeEvent::IdentifyReceived { ref peer_id, .. } => {
    // 检查是否为非 SwarmDrop 节点（即基础设施节点）
    if !shared.devices.is_swarmdrop_peer(peer_id) {
        if let Ok(mut bc) = shared.bootstrap_connected.write() {
            *bc = true;
        }
    }
    emit_device_and_status();
}
NodeEvent::PeersDiscovered { .. }
| NodeEvent::PingSuccess { .. }
| NodeEvent::HolePunchSucceeded { .. } => {
    emit_device_and_status();
}
```

**Step 5: 在 DeviceManager 中添加 `has_connected_infra_peer()` 辅助方法**

回到 `src-tauri/src/device/manager.rs`，添加：

```rust
/// 是否有已连接的基础设施节点（非 SwarmDrop 客户端）
pub fn has_connected_infra_peer(&self) -> bool {
    self.peers.iter().any(|e| {
        let p = e.value();
        p.is_connected
            && !p
                .agent_version
                .as_deref()
                .is_some_and(OsInfo::is_swarmdrop_agent)
    })
}
```

**Step 6: 运行编译验证**

Run: `cd d:/workspace/swarmdrop/src-tauri && cargo check 2>&1 | head -20`
Expected: 编译通过

**Step 7: Commit（合并 Task 3/4/5）**

```bash
git add src-tauri/src/network/ src-tauri/src/device/manager.rs src-tauri/src/commands/mod.rs
git commit -m "refactor: 用 identify agent_version 替代硬编码 PeerId 识别引导节点，升级 relay_peers 追踪"
```

---

### Task 6: 更新 NetworkStatus 类型 — 新增 relay_peers 字段

**Files:**
- Modify: `src-tauri/src/network/mod.rs:30-44`

**Step 1: 更新 `NetworkStatus` struct**

```rust
/// 网络状态快照
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkStatus {
    pub status: NodeStatus,
    pub peer_id: Option<PeerId>,
    pub listen_addrs: Vec<Multiaddr>,
    pub nat_status: NatStatus,
    pub public_addr: Option<Multiaddr>,
    pub connected_peers: usize,
    pub discovered_peers: usize,
    /// Relay 中继是否就绪（至少有一个中继节点已连接）
    pub relay_ready: bool,
    /// 当前已连接的中继节点 PeerId 列表
    pub relay_peers: Vec<PeerId>,
    /// 是否至少有一个引导节点已连接
    pub bootstrap_connected: bool,
}
```

**Step 2: 运行完整编译验证**

Run: `cd d:/workspace/swarmdrop/src-tauri && cargo check 2>&1 | head -10`
Expected: 编译通过

**Step 3: Commit**

```bash
git add src-tauri/src/network/mod.rs
git commit -m "feat: NetworkStatus 新增 relay_peers 字段"
```

---

### Task 7: 前端类型同步

**Files:**
- Modify: `src/commands/network.ts:47-59`

**Step 1: 更新 `NetworkStatus` TypeScript 类型**

```typescript
export interface NetworkStatus {
  status: NodeStatus;
  peerId: string | null;
  listenAddrs: string[];
  natStatus: NatStatus;
  publicAddr: string | null;
  connectedPeers: number;
  discoveredPeers: number;
  /** Relay 中继是否就绪（至少有一个中继节点已连接） */
  relayReady: boolean;
  /** 当前已连接的中继节点 PeerId 列表 */
  relayPeers: string[];
  /** 是否至少有一个引导节点已连接 */
  bootstrapConnected: boolean;
}
```

**Step 2: 运行前端类型检查**

Run: `cd d:/workspace/swarmdrop && pnpm tsc --noEmit 2>&1 | head -10`
Expected: 无类型错误

**Step 3: Commit**

```bash
git add src/commands/network.ts
git commit -m "feat: 前端 NetworkStatus 类型新增 relayPeers 字段"
```

---

### Task 8: 运行 Rust 测试验证无回归

**Step 1: 运行所有 Rust 测试**

Run: `cd d:/workspace/swarmdrop/src-tauri && cargo test 2>&1 | tail -20`
Expected: 所有测试通过

**Step 2: 运行 clippy**

Run: `cd d:/workspace/swarmdrop/src-tauri && cargo clippy 2>&1 | tail -20`
Expected: 无 error

**Step 3: 运行前端构建检查**

Run: `cd d:/workspace/swarmdrop && pnpm build 2>&1 | tail -10`
Expected: 构建通过

---

## 注意事项

1. **IdentifyReceived 延迟问题**：`PeerConnected` 事件早于 `IdentifyReceived`，所以 `bootstrap_connected` 会有短暂延迟才变为 true。这是可接受的行为，因为 identify 握手通常在毫秒级完成。

2. **`has_connected_infra_peer()` 的边界情况**：如果一个 peer 连接了但还没收到 identify（`agent_version` 为 None），它不会被计为基础设施节点也不会被计为 SwarmDrop 节点。这是正确的——在 identify 完成前我们不知道它是什么。

3. **relay_peers 清理**：中继 reservation 过期不会产生专门事件，但中继节点断开会触发 `PeerDisconnected`，此时从 `relay_peers` 中移除。如果 reservation 过期但连接还在（极端情况），`relay_ready` 可能为 true 但实际中继不可用。这与现有行为一致，暂不处理。
