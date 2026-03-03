# 断点续传代码审查报告

**日期**: 2026-03-03
**审查范围**: `src-tauri/src/transfer/receiver.rs`, `progress.rs`, `offer.rs`, `network/event_loop.rs`
**严重程度**: 🔴 高(2个) | 🟡 中(4个) | 🟢 低(1个)

---

## 1. 🔴 严重: `bytes_from_bitmap` 计算错误

**位置**: `src/transfer/receiver.rs:636-651`

```rust
fn bytes_from_bitmap(bitmap: &[u8], file_size: u64, total_chunks: u32) -> u64 {
    // ...
    let full_chunk_count = count_completed_in_bitmap(bitmap, total_chunks.saturating_sub(1));
    // ...
}
```

**问题**: `count_completed_in_bitmap` 的第二个参数应该是 `total_chunks`，但代码中传入的是 `total_chunks - 1`。这会导致最后一个 chunk 的字节计算错误。

**影响**: 断点续传时恢复的字节数统计不准确，可能表现为：
- 进度显示错误（比如显示 99% 而不是 100%）
- ETA 计算偏差
- 传输完成后字节统计不正确

**修复建议**:
```rust
let full_chunk_count = count_completed_in_bitmap(bitmap, total_chunks);
```

---

## 2. 🔴 严重: 暂停时的最终刷写不完整

**位置**: `src/transfer/receiver.rs:439-456`

```rust
if self.cancel_token.is_cancelled() {
    if let Some(db) = self.app.try_state::<DatabaseConnection>() {
        let bm = bitmap.lock().await.clone();
        let bytes = file_transferred.load(Ordering::Relaxed);
        // ... update_file_checkpoint
    }
}
```

**问题**:
1. 刷写只在 `cancel_token.is_cancelled()` 为 true 时执行
2. 用户"暂停"操作时可能只是标记状态，不一定会触发 cancel token
3. 刷写是异步的，如果在刷写完成前进程被终止，进度会丢失

**影响**: 用户暂停传输后，部分进度（最多 10 个 chunk）可能丢失。

**修复建议**:
1. 添加明确的 `pause()` 方法
2. 确保刷写完成后再返回
3. 考虑使用同步刷写或增加确认机制

```rust
pub async fn pause_and_flush(&self) -> AppResult<()> {
    self.cancel_token.cancel();

    // 等待所有进行中的 chunk 完成
    // 强制刷写 bitmap 到 DB
    // 返回前确认写入成功
}
```

---

## 3. 🟡 中等: 并发 chunk 处理中的 Race Condition

**位置**: `src/transfer/receiver.rs:339-345, 391-418`

**问题**:
- Bitmap 的更新和 checkpoint 刷写是异步的
- 每 10 个 chunk 才刷写一次到 DB
- 如果系统在刷写 DB 前崩溃，DB 中的 bitmap 会比实际接收的数据落后最多 10 个 chunk

**影响**: 极端情况下（崩溃/断电），恢复时可能需要重新下载最多 10 个已接收的 chunk（约 2.5MB）。

**修复建议**:
1. 考虑基于时间（如每 1 秒）而非 chunk 数量刷写
2. 或者在关键节点（如文件切换、暂停时）强制刷写

---

## 4. 🟡 中等: `Ordering::Relaxed` 可能导致统计不准确

**位置**: `src/transfer/receiver.rs:334-335, 396, 443`

```rust
let completed_count = Arc::new(AtomicU32::new(initial_completed));
let file_transferred = Arc::new(AtomicU64::new(initial_bytes));
// ...
file_transferred.fetch_add(chunk_size as u64, Ordering::Relaxed);
```

**问题**: `Relaxed` 内存序在极端并发情况下可能导致：
- 进度显示顺序不一致
- 最终的 checkpoint 数据不准确

**说明**: 在 x86 架构上这个问题几乎不会出现，但在 ARM 架构上可能有问题。

**修复建议**:
```rust
// 使用 SeqCst 确保全局顺序一致性
file_transferred.fetch_add(chunk_size as u64, Ordering::SeqCst);
completed_count.fetch_add(1, Ordering::SeqCst);
```

或者至少使用 `Release/Acquire` 配对：
```rust
// 写入时使用 Release
completed_count.fetch_add(1, Ordering::Release);

// 读取时使用 Acquire
let count = completed_count.load(Ordering::Acquire);
```

---

## 5. 🟡 中等: `mark_chunk_completed` 边界检查不完整

**位置**: `src/transfer/receiver.rs:605-611`

```rust
fn mark_chunk_completed(bitmap: &mut [u8], chunk_index: u32) {
    let byte_idx = (chunk_index / 8) as usize;
    let bit_idx = chunk_index % 8;
    if byte_idx < bitmap.len() {  // 只在 byte_idx 越界时检查
        bitmap[byte_idx] |= 1 << bit_idx;
    }
}
```

**问题**:
1. 如果 `chunk_index` 超出范围（由于 bug 或其他原因），函数静默忽略
2. 没有日志记录这种情况
3. 可能导致数据丢失或进度统计错误而不被发现

**修复建议**:
```rust
fn mark_chunk_completed(bitmap: &mut [u8], chunk_index: u32) {
    let byte_idx = (chunk_index / 8) as usize;
    let bit_idx = chunk_index % 8;
    if byte_idx >= bitmap.len() {
        tracing::error!(
            "chunk_index {} exceeds bitmap size {} (byte_idx={})",
            chunk_index, bitmap.len(), byte_idx
        );
        debug_assert!(false, "chunk_index out of bounds");
        return;
    }
    bitmap[byte_idx] |= 1 << bit_idx;
}
```

---

## 6. 🟡 中等: `is_fully_complete` 判断的边界情况

**位置**: `src/transfer/receiver.rs:193-195`

```rust
let is_fully_complete = initial_bitmap
    .map(|bm| count_completed_in_bitmap(bm, total_chunks) >= total_chunks)
    .unwrap_or(false);
```

**问题**: 如果 `total_chunks` 为 0（空文件），`count_completed_in_bitmap` 返回 0，`is_fully_complete` 会是 true。这在逻辑上是正确的，但需要确认：

1. 空文件的传输流程是否正确
2. `calc_total_chunks(0)` 是否返回 1（根据代码确实返回 1）

**验证**: 当前实现 `calc_total_chunks` 对空文件返回 1，所以空文件会有一个 chunk，这不是问题。

**建议**: 添加针对空文件的单元测试确保行为正确。

---

## 7. 🟢 低: DB Checkpoint 更新频率可能过高

**位置**: `src/transfer/receiver.rs:39`

```rust
const CHECKPOINT_INTERVAL: u32 = 10;
```

**问题**:
- 每 10 个 chunk 刷写一次 DB
- 对于大文件（10GB，约 40000 个 chunks），会有约 4000 次 DB 写操作
- 频繁写 SQLite 可能影响性能和磁盘寿命

**修复建议**:
考虑双重阈值策略：
```rust
const CHECKPOINT_INTERVAL_CHUNKS: u32 = 10;
const CHECKPOINT_INTERVAL_MILLIS: u64 = 1000; // 最多 1 秒一次

// 在代码中同时检查两个条件
let should_checkpoint = count.is_multiple_of(CHECKPOINT_INTERVAL_CHUNKS)
    || last_checkpoint_time.elapsed().as_millis() >= CHECKPOINT_INTERVAL_MILLIS;
```

---

## 8. 🟡 中等: 发送方断点续传时的源文件验证

**位置**: `src/network/event_loop.rs:129-137`

```rust
// 验证源文件仍存在且大小匹配
let path = PathBuf::from(&source_path);
match std::fs::metadata(&path) {
    Ok(meta) if meta.len() == db_file.size as u64 => {}
    _ => {
        warn!("源文件不存在或大小不匹配: {}", source_path);
        return reject_resume(session_id, ResumeRejectReason::FileModified);
    }
}
```

**问题**: 只检查了文件大小，没有校验文件内容是否被修改（比如部分修改但大小不变）。

**说明**: 这是设计上的权衡。完整的校验需要重新计算 BLAKE3 hash，对于大文件会阻塞传输。

**建议**: 考虑添加可选的严格模式，或者在怀疑文件损坏时提供重新计算 hash 的选项。

---

## 修复优先级清单

| 优先级 | 问题 | 文件 | 预计工作量 |
|--------|------|------|-----------|
| P0 | `bytes_from_bitmap` 参数错误 | `receiver.rs:646` | 5 分钟 |
| P0 | 暂停时的最终刷写不完整 | `receiver.rs:439-456` | 2 小时 |
| P1 | `Ordering::Relaxed` | `receiver.rs:334-396` | 30 分钟 |
| P1 | `mark_chunk_completed` 边界检查 | `receiver.rs:605-611` | 30 分钟 |
| P2 | Checkpoint 时间/数量双重策略 | `receiver.rs:39, 399-418` | 1 小时 |
| P2 | 添加空文件单元测试 | `receiver.rs` / `path_ops.rs` | 1 小时 |
| P3 | 源文件严格校验模式 | `event_loop.rs:129-137` | 4 小时 |

---

## 附录: 相关代码片段

### A1. `count_completed_in_bitmap` 实现
```rust
fn count_completed_in_bitmap(bitmap: &[u8], total_chunks: u32) -> u32 {
    let full_bytes = (total_chunks / 8) as usize;
    let remainder_bits = total_chunks % 8;

    let mut count: u32 = bitmap
        .iter()
        .take(full_bytes)
        .map(|b| b.count_ones())
        .sum();

    if remainder_bits > 0 {
        if let Some(&last_byte) = bitmap.get(full_bytes) {
            let mask = (1u8 << remainder_bits) - 1;
            count += (last_byte & mask).count_ones();
        }
    }
    count
}
```

### A2. `calc_total_chunks` 实现
```rust
pub fn calc_total_chunks(file_size: u64) -> u32 {
    if file_size == 0 {
        1  // 空文件也至少有一个 chunk
    } else {
        file_size.div_ceil(CHUNK_SIZE as u64) as u32
    }
}
```

---

*报告生成时间: 2026-03-03*
*审查工具: Claude Code*
*版本: 基于 commit 4b18ac0*
