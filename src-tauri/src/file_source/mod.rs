//! 文件来源抽象模块
//!
//! 统一处理标准路径和 Android content:// URI 两种文件来源。
//! 通过条件编译隔离平台代码，桌面端不编译 Android 相关逻辑。

pub mod path_ops;

#[cfg(target_os = "android")]
pub mod android_ops;

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[cfg(target_os = "android")]
use tauri_plugin_android_fs::FileUri;

use crate::AppResult;

/// 分块大小：256 KB
pub const CHUNK_SIZE: usize = 256 * 1024;

/// 文件来源：标准路径 或 Android content:// URI
///
/// 桌面端仅编译 `Path` 分支；Android 端同时支持 `Path` 和 `AndroidUri`。
/// 前端通过 Tauri IPC 传入时，`AndroidUri` 分支的字段与
/// `tauri-plugin-android-fs-api` 的 `AndroidFsUri` 类型序列化格式一致。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum FileSource {
    /// 标准文件系统路径（桌面 + Android 私有目录）
    Path { path: PathBuf },

    /// Android SAF/MediaStore URI
    /// 直接复用 `tauri-plugin-android-fs` 的 `FileUri` 类型
    #[cfg(target_os = "android")]
    AndroidUri(FileUri),
}

/// 文件元数据
#[derive(Debug, Clone)]
pub struct FileSourceMetadata {
    /// 文件或目录名
    pub name: String,
    /// 文件大小（字节），目录为 0
    pub size: u64,
    /// 是否为目录
    pub is_dir: bool,
}

/// 目录遍历后的扁平化文件条目
#[derive(Debug, Clone)]
pub struct EnumeratedFile {
    /// 文件名
    pub name: String,
    /// 相对路径（Unix 风格 `/` 分隔符）
    pub relative_path: String,
    /// 文件来源
    pub source: FileSource,
    /// 文件大小
    pub size: u64,
}

impl FileSource {
    /// 读取文件的指定分块
    ///
    /// `file_size` 用于验证 chunk_index 范围和计算最后一块的读取量。
    pub async fn read_chunk(
        &self,
        file_size: u64,
        chunk_index: u32,
        #[allow(unused_variables)] app: &tauri::AppHandle,
    ) -> AppResult<Vec<u8>> {
        match self {
            Self::Path { path } => path_ops::read_chunk(path, file_size, chunk_index).await,
            #[cfg(target_os = "android")]
            Self::AndroidUri(file_uri) => {
                android_ops::read_chunk(file_uri, file_size, chunk_index, app).await
            }
        }
    }

    /// 流式计算 BLAKE3 hash（不将整个文件加载到内存）
    pub async fn compute_hash(
        &self,
        #[allow(unused_variables)] app: &tauri::AppHandle,
    ) -> AppResult<String> {
        match self {
            Self::Path { path } => path_ops::compute_hash(path).await,
            #[cfg(target_os = "android")]
            Self::AndroidUri(file_uri) => android_ops::compute_hash(file_uri, app).await,
        }
    }

    /// 获取文件或目录的元数据
    pub async fn metadata(
        &self,
        #[allow(unused_variables)] app: &tauri::AppHandle,
    ) -> AppResult<FileSourceMetadata> {
        match self {
            Self::Path { path } => path_ops::metadata(path).await,
            #[cfg(target_os = "android")]
            Self::AndroidUri(file_uri) => android_ops::metadata(file_uri, app).await,
        }
    }

    /// 递归遍历目录，返回所有文件的扁平化列表
    ///
    /// `parent_relative_path` 是当前目录在传输中的相对路径前缀。
    pub async fn enumerate_dir(
        &self,
        parent_relative_path: &str,
        #[allow(unused_variables)] app: &tauri::AppHandle,
    ) -> AppResult<Vec<EnumeratedFile>> {
        match self {
            Self::Path { path } => path_ops::enumerate_dir(path, parent_relative_path).await,
            #[cfg(target_os = "android")]
            Self::AndroidUri(file_uri) => {
                android_ops::enumerate_dir(file_uri, parent_relative_path, app).await
            }
        }
    }
}

/// 计算文件的总分块数
pub fn calc_total_chunks(file_size: u64) -> u32 {
    if file_size == 0 {
        return 1; // 空文件也算一个块
    }
    file_size.div_ceil(CHUNK_SIZE as u64) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calc_total_chunks() {
        assert_eq!(calc_total_chunks(0), 1);
        assert_eq!(calc_total_chunks(1), 1);
        assert_eq!(calc_total_chunks(CHUNK_SIZE as u64), 1);
        assert_eq!(calc_total_chunks(CHUNK_SIZE as u64 + 1), 2);
        assert_eq!(calc_total_chunks(CHUNK_SIZE as u64 * 10), 10);
    }
}
