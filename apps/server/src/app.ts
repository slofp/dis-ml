import { HOST, PORT } from "./config";
import { ensureSchema } from "./db/migrate";
import { startServer } from "./rpc/server";
import { initSettings } from "./settings/store";

/**
 * アプリ（バックエンド）を起動する。
 * DBスキーマを用意し、設定を読み込み、oRPCサーバ(HTTP+SSE)を起動する。
 * @returns ローカルサーバのURL
 */
export const startApp = (): string => {
	ensureSchema();
	initSettings();
	startServer();
	return `http://${HOST}:${String(PORT)}/`;
};
