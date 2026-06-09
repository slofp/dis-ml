import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { db } from "./index";
import { appSettings } from "./schema";

/**
 * drizzle-kit が生成したマイグレーション(SQL)フォルダを解決する。
 * 1) 環境変数 DIS_ML_MIGRATIONS_DIR
 * 2) 実行ファイル隣の drizzle/（スタンドアロンバイナリ配布時）
 * 3) ソースからの相対パス（bun run / bun start 時）
 */
const resolveMigrationsFolder = (): string => {
	const fromEnv = process.env["DIS_ML_MIGRATIONS_DIR"];
	if (fromEnv !== undefined && fromEnv !== "") {
		return resolve(fromEnv);
	}
	const besideExe = join(dirname(process.execPath), "drizzle");
	if (existsSync(besideExe)) {
		return besideExe;
	}
	return resolve(join(import.meta.dir, "../../drizzle"));
};

/** 既にスキーマ（app_settings テーブル）が存在するかを drizzle で確認する */
const schemaAlreadyExists = (): boolean => {
	try {
		db.select({ id: appSettings.id }).from(appSettings).limit(1).all();
		return true;
	} catch {
		// 理由: テーブルが無い場合は「no such table」で失敗するため false
		return false;
	}
};

/**
 * スキーマを最新化する（drizzle-kit 生成のマイグレーションを適用）。
 * 冪等で、起動時に毎回呼んでよい。SQL はコードに直書きせず生成物を用いる。
 *
 * マイグレーション記録を持たない旧バージョン由来のDB（テーブルは存在するが
 * __drizzle_migrations が無い／タグが変わった等）では `CREATE TABLE` が衝突する。
 * その場合は、既存スキーマが揃っていれば適用済みとみなして継続する（データを失わない）。
 */
export const ensureSchema = (): void => {
	try {
		migrate(db, { migrationsFolder: resolveMigrationsFolder() });
	} catch (error) {
		if (schemaAlreadyExists()) {
			console.warn(
				"既存のスキーマを検出しました。マイグレーションをスキップして継続します。",
			);
			return;
		}
		throw error;
	}
};

// スクリプトとして直接実行された場合はマイグレーションを適用する
if (import.meta.main) {
	ensureSchema();
	console.log("マイグレーションを適用しました。");
}
