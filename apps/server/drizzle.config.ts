import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit 設定（開発時の SQL 生成・スキーマ確認用）。
 * 実行時のテーブル作成は src/db/migrate.ts の冪等DDLで行うため、
 * 本番動作には必須ではない。
 */
export default defineConfig({
	dialect: "sqlite",
	schema: "./src/db/schema.ts",
	out: "./drizzle",
});
