//! 文件传输模块
//!
//! 实现端到端加密的文件传输功能，包括文件分块、加密/解密、进度追踪等。

pub mod crypto;
pub mod fs;
pub mod offer;
pub mod progress;
pub mod receiver;
pub mod sender;
