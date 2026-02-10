# SwarmDrop MCP 使用指南

SwarmDrop 是一个去中心化的 P2P 文件传输工具。本指南帮助你通过 MCP Tool 完成设备配对和文件传输。

## 前置条件

1. SwarmDrop 应用已启动
2. P2P 网络已连接（用户在应用中点击"启动网络"）
3. MCP 服务已启用（用户在设置中开启）

**检查网络状态**：始终先调用 `get_network_status` 确认节点运行中。

## 配对流程

### 方式一：配对码配对（跨网络）

适用于设备不在同一局域网的情况。

**发送方操作**：
1. 调用 `generate_pairing_code` 生成 6 位数字码
2. 将配对码告知接收方（语音、短信等）

**接收方操作**：
1. 调用 `get_device_info(code)` 获取发送方设备信息
2. 确认无误后调用 `request_pairing(peer_id, method="code", code)`

**发送方确认**：
- 应用会弹出配对请求通知
- 用户确认后，接收方会收到成功响应

### 方式二：局域网直连（LAN）

适用于设备在同一 WiFi/以太网的情况。

**接收方操作**：
1. 调用 `list_devices(filter="all")` 查看局域网设备
2. 选择目标设备后调用 `request_pairing(peer_id, method="direct")`

**发送方确认**：
- 应用弹出配对请求，显示接收方设备信息
- 用户确认后配对完成

## Tool 使用顺序建议

```
1. get_network_status()           # 检查网络
2. list_devices(filter="all")     # 查看可用设备
   ├─ 如有目标设备 → 局域网直连流程
   └─ 无目标设备 → 配对码流程
3. generate_pairing_code()        # 或使用配对码
4. get_device_info(code)          # 接收方查询
5. request_pairing(...)           # 发起配对
```

## 错误处理

### 节点未启动
```json
{
  "isError": true,
  "content": "P2P 网络节点未启动，请先在 SwarmDrop 中启动网络连接"
}
```
**解决**：提示用户在 SwarmDrop 应用中点击"连接"按钮。

### 配对码过期
```json
{
  "isError": true,
  "content": "配对码已过期，请重新生成"
}
```
**解决**：重新调用 `generate_pairing_code`。默认有效期 5 分钟。

### 配对被拒绝
```json
{
  "status": "refused",
  "reason": "用户拒绝了配对请求"
}
```
**解决**：这是正常行为，说明对方不愿意配对。

## 最佳实践

1. **总是先检查状态**：调用任何网络相关 Tool 前，先用 `get_network_status` 确认
2. **配对码有效期**：默认 5 分钟，需要跨网络配对时可延长到 10 分钟（600 秒）
3. **设备筛选**：局域网场景用 `list_devices(filter="connected")` 只看已连接设备
4. **错误重试**：网络抖动可能导致偶发失败，可重试 1-2 次

## 功能限制

- MCP Tool 不能启动/停止 P2P 网络（需用户在应用中操作）
- MCP Tool 不能生成或管理密钥对（安全考虑）
- 配对请求的确认必须由用户在应用中完成（不能自动接受）
- 文件传输功能尚未实现（当前仅支持设备配对）

## 可用的 6 个 Tool

| Tool | 作用 | 前置条件 |
|------|------|---------|
| `get_network_status` | 获取 P2P 节点运行状态 | 无 |
| `list_devices` | 列出已发现/已连接的设备 | 节点运行中 |
| `generate_pairing_code` | 生成 6 位配对码并发布到 DHT | 节点运行中 |
| `get_device_info` | 通过配对码查询对端设备信息 | 节点运行中 |
| `request_pairing` | 向指定设备发起配对请求 | 节点运行中 |
| `respond_pairing_request` | 响应收到的配对请求 | 节点运行中 |

## 安全说明

- MCP Server 仅监听本地（127.0.0.1:19527），不接受外部连接
- 配对请求必须经过用户确认，AI 无法自动接受配对
- 敏感操作（密钥生成、网络启停）不暴露为 MCP Tool

## 常见问题

**Q: 调用 Tool 时返回"节点未启动"错误？**
A: 提示用户在 SwarmDrop 应用中点击顶部的"连接"按钮启动 P2P 网络。

**Q: 配对码多久过期？**
A: 默认 5 分钟（300 秒）。可在生成时指定 `expires_in_secs` 参数延长，最长建议 10 分钟。

**Q: 如何知道对方是否接受了配对？**
A: `request_pairing` 的返回值会包含 `status` 字段，`"success"` 表示接受，`"refused"` 表示拒绝。

**Q: 可以同时连接多少个设备？**
A: libp2p 网络层面无硬性限制，但建议单次配对操作只针对一个设备，避免混淆。

**Q: 局域网直连和配对码配对有什么区别？**
A: 局域网直连通过 mDNS 自动发现，速度快但限于同一网络；配对码配对通过 DHT 公网查询，支持跨网络但需手动传递配对码。
