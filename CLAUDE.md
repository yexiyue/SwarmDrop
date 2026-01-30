<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SwarmDrop is a **decentralized, cross-network, end-to-end encrypted file transfer tool** built with Tauri v2. It aims to be a "cross-network version of LocalSend" - no accounts, no servers, supporting both LAN and cross-network peer-to-peer file transfers.

**Tech Stack:**
- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Rust + Tauri 2
- **P2P Network:** libp2p (Request-Response + mDNS + Kademlia DHT + Relay + DCUtR)
- **Encryption:** XChaCha20-Poly1305 (planned)
- **Storage:** SQLite via rusqlite (planned for history)
- **UI:** shadcn/ui + Tailwind CSS (planned)

## Project Structure

```
swarmdrop/
├── src/                    # React frontend source
│   ├── App.tsx            # Main React component
│   ├── main.tsx           # React entry point
│   └── assets/            # Frontend assets
├── src-tauri/             # Rust backend source
│   ├── src/
│   │   ├── lib.rs         # Main Tauri library with commands
│   │   └── main.rs        # Application entry point
│   ├── Cargo.toml         # Rust dependencies
│   ├── tauri.conf.json    # Tauri configuration
│   └── capabilities/      # Tauri security capabilities
├── docs/                  # Astro + Starlight documentation site
│   ├── src/content/docs/  # Documentation markdown files
│   └── package.json       # Docs dependencies
└── dev-notes/             # Development notes and PRD
    └── product-requirements.md  # Full product requirements (Chinese)
```

## Build and Development Commands

### Frontend + Backend Development
```bash
# Development mode (starts both Vite and Tauri)
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Frontend Only
```bash
# Start Vite dev server on http://localhost:1420
pnpm dev  # (without Tauri)
```

### Backend (Tauri) Commands
```bash
# Run Tauri CLI commands directly
pnpm tauri dev      # Development mode
pnpm tauri build    # Production build
pnpm tauri info     # Environment info
```

### Rust Development
```bash
# Inside src-tauri/
cargo build         # Build Rust code
cargo test          # Run tests
cargo clippy        # Lint with Clippy
cargo fmt           # Format code
```

### Documentation Site
```bash
# Inside docs/
pnpm dev            # Start Astro dev server
pnpm build          # Build static site
pnpm preview        # Preview built site
```

## Architecture Overview

### Tauri Frontend ↔ Backend Communication

**Frontend calls Rust commands:**
```typescript
// In React components
import { invoke } from "@tauri-apps/api/core";
const result = await invoke("greet", { name: "World" });
```

**Rust command handlers:**
```rust
// In src-tauri/src/lib.rs
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

// Register in run() function
.invoke_handler(tauri::generate_handler![greet])
```

### Adding New Tauri Commands

When you need to add a new Tauri command, use the `edgemind-tauri-command` skill:
```bash
/edgemind-tauri-command
```

This skill provides guidance on:
1. Creating new Tauri commands in `src-tauri/src/lib.rs`
2. Registering commands in the `invoke_handler`
3. Calling commands from TypeScript with proper types
4. Following project conventions

### P2P Network Architecture (Planned)

The application will use libp2p for peer-to-peer networking:

- **Transport:** TCP + Noise encryption + Yamux multiplexing
- **Discovery:**
  - mDNS for LAN device discovery
  - Kademlia DHT for cross-network peer discovery
- **NAT Traversal:**
  - DCUtR (Direct Connection Upgrade through Relay) for hole punching
  - Relay protocol as fallback for failed hole punching
- **File Transfer:** Custom Request-Response protocol
- **Share Code System:** 6-character codes (A-Z0-9) that encode peer ID, session ID, and encryption key

### Security Model (Planned)

- Each transfer generates temporary key pairs
- File content encrypted with XChaCha20-Poly1305
- Share codes contain encryption keys
- Relay nodes cannot decrypt file content
- No telemetry or data collection

## Configuration Files

### Tauri Configuration (`src-tauri/tauri.conf.json`)
- **Development server:** http://localhost:1420
- **Frontend build output:** `../dist`
- **App identifier:** `com.gy.swarmdrop`
- **Window size:** 800x600

### Vite Configuration (`vite.config.ts`)
- **Dev server port:** 1420 (fixed, required by Tauri)
- **HMR port:** 1421
- Ignores `src-tauri` directory from watch

### TypeScript Configuration (`tsconfig.json`)
- **Target:** ES2020
- **JSX:** react-jsx
- **Strict mode:** enabled
- Linting: noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch

## Key Product Requirements

Refer to `dev-notes/product-requirements.md` for comprehensive product vision. Key points:

**MVP Features (P0):**
1. Send/receive files with 6-digit share codes
2. LAN device discovery via mDNS
3. Cross-network transfer via DHT + NAT traversal
4. End-to-end encryption
5. Transfer progress tracking
6. Device identity management

**Important Features (P1):**
- Transfer history
- Favorite devices
- Resume interrupted transfers
- MCP server for AI integration (localhost:19527)

**Future Iterations (P2):**
- Mobile apps (Android/iOS via Tauri 2)
- Clipboard sync
- Transfer speed limiting

## Monorepo Context

This project is intended to be part of a larger `swarm-apps` monorepo:

```
swarm-apps/
├── crates/
│   └── swarm-p2p/          # Shared P2P library (to be extracted)
│       ├── transport.rs
│       ├── discovery.rs
│       ├── relay.rs
│       └── protocol.rs
├── apps/
│   ├── swarmdrop/          # This project
│   └── swarmnote/          # Future note-taking app
└── bootstrap/              # DHT bootstrap node program
```

The P2P networking layer (libp2p integration) will eventually be extracted into a shared crate for reuse across multiple applications.

## Development Phases

**Current Status:** Phase 1 (Project Setup)

1. **Phase 1 - Local Testing (2 weeks):** Tauri scaffolding, basic UI, file selection, loopback testing
2. **Phase 2 - LAN Transfer (2 weeks):** libp2p setup, mDNS discovery, Request-Response protocol
3. **Phase 3 - Cross-Network (2 weeks):** DHT, NAT traversal, bootstrap nodes, share codes
4. **Phase 4 - Security & UX (1 week):** E2E encryption, history, error handling
5. **Phase 5 - Release (1 week):** Packaging, documentation, GitHub release

## Documentation

The project includes an Astro + Starlight documentation site in `docs/`. When editing documentation:

- Use the `swarmbook-tutorial` skill for tutorial-style content
- Content lives in `docs/src/content/docs/`
- Follow Starlight's markdown conventions
- Documentation is in Chinese (target audience)

## Additional Notes

- **Package manager:** pnpm (not npm or yarn)
- **Library naming:** The Rust library is named `swarmdrop_lib` (note the `_lib` suffix) to avoid Windows-specific naming conflicts with the binary
- **Tauri plugins:** Currently using `tauri-plugin-opener` for opening links
- **Target platforms (MVP):** Windows 10/11, macOS 12+, Linux (Ubuntu 22.04+, Fedora 38+)
