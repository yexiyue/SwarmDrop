# SeaORM 2.0 Entity First 工作流

## 目录

- [概念](#概念)
- [启用方式](#启用方式)
- [Schema Sync 功能](#schema-sync-功能)
- [apply vs sync](#apply-vs-sync)
- [Migration 中使用](#migration-中使用)
- [时间胶囊模式](#时间胶囊模式)
- [推荐迁移策略](#推荐迁移策略)
- [生产环境注意事项](#生产环境注意事项)

## 概念

Entity First 颠覆传统 schema-first 方式：先写 Entity 代码，让 SeaORM 自动创建/同步数据库表结构。

传统流程：设计数据库表 → 写 migration → 生成 Entity
Entity First：编写 Entity → 自动生成表/列/外键/索引

## 启用方式

需要两个 feature flag：

```toml
[dependencies]
sea-orm = { version = "2.0", features = ["schema-sync", "entity-registry"] }
```

在 `main.rs` 初始化数据库后调用：

```rust
let db = &Database::connect(db_url).await?;
db.get_schema_registry("my_crate::entity::*").sync(db).await?;
```

### 手动注册（不使用 entity-registry）

```rust
db.get_schema_builder()
    .register(user::Entity)
    .register(profile::Entity)
    .register(post::Entity)
    .register(comment::Entity)
    .sync(db).await?;
```

### 依赖解析

SeaORM 自动构建外键依赖图，按拓扑排序建表。如 comment 引用 post，post 会先于 comment 创建。

## Schema Sync 功能

`sync()` 对比内存中的 Entity 定义与实际数据库 schema，幂等地执行差异操作。

### 新增表

添加新 Entity 模块 → 下次运行自动 `CREATE TABLE`：

```rust
// entity/mod.rs
pub mod post;
pub mod upvote;  // ← 新模块
```

### 新增列

在 Model 中添加字段 → `ALTER TABLE ADD COLUMN`：

```rust
pub struct Model {
    ..
    pub date_of_birth: Option<DateTimeUtc>,  // ← 新增
}
```

非空列需指定默认值：

```rust
#[sea_orm(default_value = 0)]
pub post_count: i32,

#[sea_orm(default_expr = "Expr::current_timestamp()")]  // SQLite 不支持
pub updated_at: DateTimeUtc,
```

### 重命名列

代码层面重命名（不改数据库）：

```rust
#[sea_orm(column_name = "date_of_birth")]
pub dob: Option<DateTimeUtc>,
```

真正重命名数据库列：

```rust
#[sea_orm(renamed_from = "date_of_birth")]
pub dob: Option<DateTimeUtc>,
// SQL: ALTER TABLE profile RENAME COLUMN "date_of_birth" TO "dob"
```

### 新增/删除唯一约束

```rust
#[sea_orm(unique)]  // 添加 → CREATE UNIQUE INDEX
pub name: String,

// 移除 unique 注解 → DROP INDEX
```

### 新增外键

随表创建时自动包含外键。SQLite 不支持后加外键（关系查询仍可用，客户端处理）。

## apply vs sync

两种方法用途不同：

| 方法 | 行为 | 适用场景 |
|------|------|---------|
| `apply(db)` | 直接执行 CREATE TABLE，**不检查表是否存在** | Migration 初始化建表 |
| `sync(db)` | 对比现有 schema，幂等执行差异操作 | 开发阶段实时同步 |

关键区别：
- **apply** 是"一次性"操作，适合在 migration 中使用。migration 系统（`seaql_migrations` 表）保证每个 migration 只执行一次，因此 apply 在 migration 中是安全的
- **sync** 每次调用都做全量 schema 比对，适合开发阶段启动时自动同步
- 生产环境不建议用 sync（启动开销），用 migration + apply 更可控

## Migration 中使用

`SchemaBuilder` 可在 migration 中配合 `apply` 使用：

```rust
#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        db.get_schema_builder()
            .register(user::Entity)
            .register(profile::Entity)
            .apply(db)  // 用 apply，不用 sync
            .await
    }
}
```

> **注意：** 直接引用主 entity 模块存在"实体漂移"风险——Entity 随开发不断演进，但 migration 应该是固定的历史快照。解决方案见下方"时间胶囊模式"。

## 时间胶囊模式

### 问题

如果 migration 中直接引用 `entity::user::Entity`，当 Entity 后续新增字段时，旧 migration 的行为会发生变化（apply 会用最新 Entity 建表），导致 migration 不再是确定性的历史记录。

### 解决方案

在 migration crate 中为每个 migration 保存一份 Entity 快照（"时间胶囊"）：

```
migration/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── m20260101_000001_init/
│   │   ├── mod.rs          # MigrationTrait 实现
│   │   └── entity/         # ← 冻结的 Entity 快照
│   │       ├── mod.rs
│   │       ├── user.rs
│   │       └── profile.rs
│   └── m20260201_000001_add_avatar/
│       └── mod.rs          # 增量变更，用 SeaQuery
```

### 初始化 migration（时间胶囊）

```rust
// migration/src/m20260101_000001_init/mod.rs
mod entity;  // 引用本地冻结的 entity 快照

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        db.get_schema_builder()
            .register(entity::user::Entity)
            .register(entity::profile::Entity)
            .apply(db)
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(entity::profile::Entity).to_owned()).await?;
        manager.drop_table(Table::drop().table(entity::user::Entity).to_owned()).await
    }
}
```

### 增量变更 migration（SeaQuery）

后续变更使用 SeaQuery 手写 ALTER 语句，不依赖 Entity 定义：

```rust
// migration/src/m20260201_000001_add_avatar/mod.rs
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.alter_table(
            Table::alter()
                .table(Alias::new("user"))
                .add_column(ColumnDef::new(Alias::new("avatar_url")).string_null())
                .to_owned()
        ).await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.alter_table(
            Table::alter()
                .table(Alias::new("user"))
                .drop_column(Alias::new("avatar_url"))
                .to_owned()
        ).await
    }
}
```

### SQLite 破坏性变更（重建表）

SQLite 不支持 DROP COLUMN 或修改列类型，需要重建表：

```rust
async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    let db = manager.get_connection();
    // 1. 创建新表
    db.execute_unprepared(
        "CREATE TABLE user_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            age INTEGER NOT NULL  -- 原来是 TEXT，改为 INTEGER
        )"
    ).await?;
    // 2. 迁移数据（类型转换）
    db.execute_unprepared(
        "INSERT INTO user_new (id, name, age) SELECT id, name, CAST(age AS INTEGER) FROM user"
    ).await?;
    // 3. 删旧表
    db.execute_unprepared("DROP TABLE user").await?;
    // 4. 重命名
    db.execute_unprepared("ALTER TABLE user_new RENAME TO user").await?;
    Ok(())
}
```

## 推荐迁移策略

| 场景 | 方法 | 说明 |
|------|------|------|
| 项目初始化建表 | 时间胶囊 + `apply` | 复制 Entity 快照到 migration 子目录，用 SchemaBuilder.apply() |
| 新增列 | SeaQuery `Table::alter().add_column()` | 简单安全 |
| 重命名列 | SeaQuery `Table::alter().rename_column()` | SQLite 3.25.0+ 支持 |
| 删除列 | raw SQL 重建表（SQLite）/ SeaQuery（PG） | SQLite 不支持 ALTER DROP COLUMN |
| 修改列类型 | raw SQL 重建表 | 所有数据库都建议重建以保证数据安全 |
| 新增索引/约束 | SeaQuery `Index::create()` | — |

### 应用启动时执行迁移

```rust
// main.rs 或 Tauri setup 中
use sea_orm_migration::MigratorTrait;

let db = Database::connect(db_url).await?;
migration::Migrator::up(&db, None).await?;  // 自动执行所有未运行的 migration
```

`Migrator::up()` 查询 `seaql_migrations` 表，只执行尚未运行的 migration，安全幂等。

## 生产环境注意事项

- `schema-sync` 是 feature flag，**生产构建可关闭**避免启动时 schema discovery
- sync 不执行破坏性操作：**不会 DROP 表、列、外键**（DROP INDEX 除外）
- 每次启动都做全量 schema 比对，生产环境可能不适用
- **推荐：** 初始化用时间胶囊 + apply，后续变更用 SeaQuery/raw SQL migration，生产启动时执行 `Migrator::up()`
