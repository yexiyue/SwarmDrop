# 配对流程示例

本文档提供 SwarmDrop 典型配对场景的分步操作指导。

## 场景 1：同事间传输文件（同一办公室 WiFi）

### 背景
用户 A 和用户 B 在同一办公室，连接同一个 WiFi，想要传输文件。

### 用户需求
"帮我连接到张三的电脑，我要发文件给他"

### 执行步骤

```
步骤 1: 检查网络状态
→ get_network_status()

返回示例：
{
  "status": "running",
  "peerId": "12D3KooWAbc...",
  "connectedPeers": 2
}

步骤 2: 列出局域网设备
→ list_devices(filter="all")

返回示例：
{
  "devices": [
    {
      "peerId": "12D3KooWDef...",
      "name": "张三的MacBook",
      "os": "macos",
      "deviceType": "laptop",
      "isConnected": true,
      "connectionType": "lan",
      "latencyMs": 2
    }
  ]
}

步骤 3: 发起配对请求（局域网直连）
→ request_pairing(
    peer_id="12D3KooWDef...",
    method="direct"
  )

步骤 4: 等待对方确认
张三在他的 SwarmDrop 应用中会收到通知：
"用户 A 的设备 想要与你配对"

张三点击"接受"后，返回：
{
  "status": "success"
}
```

### 预期结果
设备配对成功，可以开始文件传输。

---

## 场景 2：异地朋友传输（不同网络）

### 背景
用户 A 在北京，用户 B 在上海，两人不在同一局域网。

### 用户需求
"生成一个配对码给我朋友，他在另一个城市"

### 发送方操作（用户 A）

```
步骤 1: 检查网络状态
→ get_network_status()

步骤 2: 生成配对码
→ generate_pairing_code(expires_in_secs=600)

返回示例：
{
  "code": "482916",
  "createdAt": 1739180400,
  "expiresAt": 1739181000
}

步骤 3: 告知对方
AI 提示用户：
"配对码是 482916，有效期 10 分钟。请通过微信/电话等方式告诉你的朋友。"
```

### 接收方操作（用户 B）

用户 B 对他的 AI 助手说："我朋友给了我配对码 482916，帮我连接"

```
步骤 1: 检查网络状态
→ get_network_status()

步骤 2: 查询配对码对应的设备信息
→ get_device_info(code="482916")

返回示例：
{
  "peerId": "12D3KooWAbc...",
  "hostname": "用户A的笔记本",
  "os": "windows",
  "platform": "win32",
  "arch": "x86_64",
  "createdAt": 1739180400,
  "expiresAt": 1739181000
}

AI 向用户确认：
"找到设备：用户A的笔记本 (Windows)，是否发起配对？"

步骤 3: 发起配对请求
→ request_pairing(
    peer_id="12D3KooWAbc...",
    method="code",
    code="482916"
  )

步骤 4: 等待对方确认
用户 A 在应用中点击"接受"后，返回：
{
  "status": "success"
}
```

### 预期结果
跨网络配对成功，DHT 记录已建立，可以开始文件传输。

---

## 场景 3：查看当前连接

### 背景
用户想了解当前有哪些设备连接着自己的电脑。

### 用户需求
"有哪些设备连接着我？"

### 执行步骤

```
步骤 1: 获取网络总体状态
→ get_network_status()

返回示例：
{
  "status": "running",
  "peerId": "12D3KooWAbc...",
  "listenAddresses": ["/ip4/192.168.1.100/tcp/0"],
  "connectedPeers": 3,
  "discoveredPeers": 5
}

AI 回复：
"当前有 3 个设备连接着你，共发现 5 个设备。"

步骤 2: 列出已连接设备的详细信息
→ list_devices(filter="connected")

返回示例：
{
  "devices": [
    {
      "peerId": "12D3KooWDef...",
      "name": "MacBook-Pro",
      "os": "macos",
      "deviceType": "laptop",
      "isConnected": true,
      "connectionType": "lan",
      "latencyMs": 2
    },
    {
      "peerId": "12D3KooWGhi...",
      "name": "iPhone-12",
      "os": "ios",
      "deviceType": "mobile",
      "isConnected": true,
      "connectionType": "relay",
      "latencyMs": 45
    },
    {
      "peerId": "12D3KooWJkl...",
      "name": "Windows-Desktop",
      "os": "windows",
      "deviceType": "desktop",
      "isConnected": true,
      "connectionType": "lan",
      "latencyMs": 1
    }
  ],
  "total": 3
}

AI 回复：
"已连接的设备：
1. MacBook-Pro (macOS, 延迟 2ms, 局域网)
2. iPhone-12 (iOS, 延迟 45ms, 中继连接)
3. Windows-Desktop (Windows, 延迟 1ms, 局域网)"
```

### 预期结果
用户清楚地了解当前的设备连接情况。

---

## 场景 4：响应配对请求（被动接收）

### 背景
其他设备向用户发起了配对请求，用户想通过 AI 助手处理。

### 用户需求
"刚才有个设备想配对，帮我看看是谁"

### 执行步骤

```
说明：
当前 MCP Tool 不提供主动获取待处理配对请求列表的功能。
配对请求的处理主要在 SwarmDrop 应用 UI 中完成。

应用会弹出通知：
"设备 '李四的iPad' 想要与你配对"
- [接受]
- [拒绝]

如果用户想通过 AI 助手响应，可以这样操作：

用户："帮我接受来自 peer ID 12D3KooWXyz... 的配对请求，pending_id 是 42，配对方式是 direct"

→ respond_pairing_request(
    pending_id=42,
    method="direct",
    accept=true
  )

返回：
{
  "status": "success"
}
```

### 注意事项
- `pending_id` 和 `method` 信息需要用户从应用通知中获取
- 当前设计中，MCP 无法主动列出待处理请求（出于安全考虑）
- 推荐在应用 UI 中直接操作，更直观

---

## 场景 5：配对失败的处理

### 背景
配对过程中遇到各种错误。

### 案例 5.1：配对码过期

```
用户："用这个配对码 123456 连接"

→ get_device_info(code="123456")

返回：
{
  "isError": true,
  "content": "配对码已过期，请重新生成"
}

AI 回复：
"这个配对码已经过期了。配对码默认有效期是 5 分钟。请让对方重新生成一个新的配对码。"
```

### 案例 5.2：节点未启动

```
用户："帮我连接到某个设备"

→ get_network_status()

返回：
{
  "status": "stopped"
}

AI 回复：
"你的 P2P 网络还没有启动。请在 SwarmDrop 应用中点击顶部的'连接'按钮启动网络后再试。"
```

### 案例 5.3：对方拒绝配对

```
→ request_pairing(...)

返回：
{
  "status": "refused",
  "reason": "用户拒绝了配对请求"
}

AI 回复：
"对方拒绝了配对请求。这可能是因为：
1. 对方不认识你的设备
2. 对方当前不方便接收文件
3. 配对信息显示有误

建议通过其他方式（电话、微信）与对方确认。"
```

---

## Tool 调用最佳实践总结

1. **总是从状态检查开始**
   ```
   get_network_status() → 确认节点运行
   ```

2. **局域网优先**
   ```
   list_devices(filter="all") → 先看能否直连
   ```

3. **配对码作为备选**
   ```
   没有局域网设备 → 生成配对码
   ```

4. **错误友好提示**
   ```
   遇到错误 → 给出清晰的解决方案，而不是直接返回错误信息
   ```

5. **等待用户确认**
   ```
   配对请求发送后 → 明确告知需要对方在应用中确认
   ```

## 不支持的操作

以下操作 **不能** 通过 MCP Tool 完成，需要用户在应用中操作：

- ❌ 启动/停止 P2P 网络
- ❌ 生成/导入密钥对
- ❌ 修改设备名称
- ❌ 自动接受配对请求（必须用户手动确认）
- ❌ 文件传输（当前阶段未实现）

## 调试建议

如果 AI 助手在使用 Tool 时遇到问题：

1. 检查 MCP Server 是否启动（127.0.0.1:19527）
2. 检查 P2P 网络是否运行（用 `get_network_status`）
3. 查看 SwarmDrop 应用日志（开发者控制台）
4. 确认配对码未过期（生成后 5-10 分钟内使用）
5. 验证 peer_id 格式正确（以 "12D3Koo" 开头）
