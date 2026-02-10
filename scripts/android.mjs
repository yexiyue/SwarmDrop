import { resolve } from "node:path";
import { execSync } from "node:child_process";

const libDir = resolve("src-tauri/vendor/prebuilt/android-aarch64");
const command = process.argv.slice(2).join(" ") || "dev";

process.env.SODIUM_LIB_DIR = libDir;
execSync(`tauri android ${command}`, { stdio: "inherit", env: process.env });
