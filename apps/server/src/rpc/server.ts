import { RPCHandler } from "@orpc/server/fetch";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { HOST, PORT, RECORDINGS_DIR, RPC_PREFIX } from "../config";
import { router } from "./router";

/**
 * ビルド済み SPA の配置ディレクトリを解決する。
 * 1) 環境変数 DIS_ML_WEB_DIST
 * 2) 実行ファイル隣の web/（スタンドアロンバイナリ配布時）
 * 3) ソースからの相対パス（bun run / bun start 時）
 */
const resolveWebDist = (): string => {
	const fromEnv = process.env["DIS_ML_WEB_DIST"];
	if (fromEnv !== undefined && fromEnv !== "") {
		return resolve(fromEnv);
	}
	const besideExe = join(dirname(process.execPath), "web");
	if (existsSync(besideExe)) {
		return besideExe;
	}
	return resolve(join(import.meta.dir, "../../../web/build"));
};

/** ビルド済み SPA の配置ディレクトリ */
const WEB_DIST = resolveWebDist();

/** oRPC の fetch ハンドラ */
const rpcHandler = new RPCHandler(router);

/** パストラバーサルを防ぎつつベース配下のファイルを返す */
const serveFromDir = async (
	baseDir: string,
	relativePath: string,
	fallback: string | null,
): Promise<Response> => {
	const target = resolve(join(baseDir, relativePath));
	if (!target.startsWith(baseDir)) {
		return new Response("Forbidden", { status: 403 });
	}
	const file = Bun.file(target);
	if (await file.exists()) {
		return new Response(file);
	}
	if (fallback !== null) {
		const fallbackFile = Bun.file(join(baseDir, fallback));
		if (await fallbackFile.exists()) {
			return new Response(fallbackFile);
		}
	}
	return new Response("Not Found", { status: 404 });
};

/** SPA を配信する（未ヒットは index.html へフォールバック） */
const serveSpa = async (pathname: string): Promise<Response> => {
	const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
	const response = await serveFromDir(WEB_DIST, relative, "index.html");
	if (response.status === 404) {
		return new Response(
			"Web UI のビルドが見つかりません。`bun run build` を実行してください。",
			{ status: 404 },
		);
	}
	return response;
};

/** 録音ファイルを配信する（/media/recordings/<sessionId>/<file>） */
const serveRecording = async (pathname: string): Promise<Response> => {
	const relative = pathname.slice("/media/recordings/".length);
	return serveFromDir(RECORDINGS_DIR, relative, null);
};

/** oRPC サーバ（HTTP + SSE）を起動する */
export const startServer = () => {
	const server = Bun.serve({
		hostname: HOST,
		port: PORT,
		// SSE(Event Iterator)の長時間接続を維持するためアイドルタイムアウトを無効化
		idleTimeout: 0,
		fetch: async (request) => {
			const url = new URL(request.url);
			const { pathname } = url;

			if (pathname === RPC_PREFIX || pathname.startsWith(`${RPC_PREFIX}/`)) {
				const result = await rpcHandler.handle(request, {
					prefix: RPC_PREFIX,
					context: {},
				});
				return result.response ?? new Response("Not Found", { status: 404 });
			}

			if (pathname.startsWith("/media/recordings/")) {
				return serveRecording(pathname);
			}

			return serveSpa(pathname);
		},
	});
	return server;
};
