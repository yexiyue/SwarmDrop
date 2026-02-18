//! 文件系统工具
//!
//! 提供文件列举、元信息读取等 I/O 操作，在 `tokio::task::spawn_blocking` 中执行
//! 以避免阻塞异步运行时。

use std::path::PathBuf;

use serde::Serialize;
use walkdir::WalkDir;

use crate::AppResult;

/// 文件条目
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    /// 绝对路径
    pub path: String,
    /// 文件名
    pub name: String,
    /// 文件大小（字节）
    pub size: u64,
}

/// `list_files` 的返回结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListFilesResult {
    /// 输入路径是否为目录
    pub is_directory: bool,
    /// 所有文件条目（仅文件，不含目录）
    pub entries: Vec<FileEntry>,
    /// 文件总数
    pub total_count: usize,
    /// 文件总大小（字节）
    pub total_size: u64,
}

/// 递归列举路径下的所有文件
///
/// - 如果 `path` 是文件，`is_directory = false`，`entries` 只含该文件
/// - 如果 `path` 是目录，`is_directory = true`，递归列举所有文件
/// - 跟随符号链接，自动跳过无权访问的条目
pub async fn list_files(path: String) -> AppResult<ListFilesResult> {
    tokio::task::spawn_blocking(move || list_files_sync(&path)).await?
}

/// 批量获取文件元信息
///
/// 对每个路径调用 `fs::metadata`，返回基本信息。
/// 跳过无法访问的路径（不报错）。
pub async fn get_file_meta(paths: Vec<String>) -> AppResult<Vec<FileEntry>> {
    tokio::task::spawn_blocking(move || {
        let mut entries = Vec::with_capacity(paths.len());
        for p in &paths {
            let path = PathBuf::from(p);
            let Ok(meta) = std::fs::metadata(&path) else {
                continue;
            };
            if meta.is_dir() {
                continue;
            }
            entries.push(FileEntry {
                path: p.clone(),
                name: path
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_default(),
                size: meta.len(),
            });
        }
        Ok(entries)
    })
    .await?
}

// ============ 内部同步实现 ============

fn list_files_sync(path: &str) -> AppResult<ListFilesResult> {
    let root = PathBuf::from(path);
    let meta = std::fs::metadata(&root)?;

    // 单个文件
    if meta.is_file() {
        let size = meta.len();
        return Ok(ListFilesResult {
            is_directory: false,
            entries: vec![FileEntry {
                path: path.to_owned(),
                name: root
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_default(),
                size,
            }],
            total_count: 1,
            total_size: size,
        });
    }

    // 目录：递归遍历，只返回文件
    let mut entries = Vec::new();
    let mut total_size: u64 = 0;

    for entry in WalkDir::new(&root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_dir() {
            continue;
        }

        let entry_path = entry.path();
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        total_size += size;

        entries.push(FileEntry {
            path: entry_path.to_string_lossy().into_owned(),
            name: entry_path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default(),
            size,
        });
    }

    let total_count = entries.len();

    Ok(ListFilesResult {
        is_directory: true,
        entries,
        total_count,
        total_size,
    })
}
