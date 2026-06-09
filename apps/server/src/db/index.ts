import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { DATA_DIR, DB_PATH } from "../config";
import * as schema from "./schema";

// データディレクトリを用意（存在すれば何もしない）
mkdirSync(DATA_DIR, { recursive: true });

/** bun:sqlite の生インスタンス */
const sqlite = new Database(DB_PATH, { create: true });
// 書き込み耐性・並行性のため WAL モードを有効化
sqlite.run("PRAGMA journal_mode = WAL;");
sqlite.run("PRAGMA foreign_keys = ON;");

/** Drizzle データベースインスタンス（全クエリのエントリ） */
export const db = drizzle(sqlite, { schema });

/** スキーマ（テーブル定義）への参照 */
export { schema };
