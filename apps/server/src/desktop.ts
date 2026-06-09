import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { HOST, PORT } from "./config";

/**
 * デスクトップ起動エントリ。
 *
 * `webview.run()` は GUI イベントループでメインスレッドをブロックするため、
 * 同一スレッドの HTTP サーバが応答できなくなる。これを避けるため、
 * 「サーバは子プロセス（DIS_ML_ROLE=server）で起動」「親は Webview を開く」構成にする。
 * GUI が使えない環境では、子サーバを稼働させたままブラウザ利用を案内する。
 */

/** ローカルサーバのURL */
const url = `http://${HOST}:${String(PORT)}/`;

/** 現在のプラットフォームに対応する webview ネイティブライブラリのファイル名 */
const webviewLibFileName = (): string => {
	if (process.platform === "win32") {
		return "libwebview.dll";
	}
	if (process.platform === "darwin") {
		return "libwebview.dylib";
	}
	return `libwebview-${process.arch}.so`;
};

/** Bun ランタイム上（bun run）か、コンパイル済みバイナリかを判定する */
const isCompiledBinary = (): boolean => {
	const exe = basename(process.execPath).toLowerCase().replace(/\.exe$/, "");
	return exe !== "bun" && exe !== "bun-debug";
};

/** 子プロセス: ヘッドレスでサーバを稼働させ続ける */
const runServerRole = async (): Promise<void> => {
	const { startApp } = await import("./app");
	startApp();
	console.log(`サーバを起動しました: ${url}`);
};

/** サーバが応答可能になるまで待つ */
const waitForServer = async (timeoutMs: number): Promise<boolean> => {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
			if (res.status >= 200 && res.status < 500) {
				return true;
			}
		} catch {
			// 理由: まだ起動前。少し待って再試行する
		}
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 150);
		});
	}
	return false;
};

/** 親プロセス: サーバを子プロセスで起動し、ネイティブ Webview を開く */
const runDesktopRole = async (): Promise<void> => {
	// 自身（バイナリ or `bun <script>`）を server ロールで再起動する
	const command = isCompiledBinary()
		? [process.execPath]
		: [process.execPath, import.meta.path];
	const child = Bun.spawn(command, {
		env: { ...process.env, DIS_ML_ROLE: "server" },
		stdio: ["inherit", "inherit", "inherit"],
	});
	const stopChild = () => {
		child.kill();
	};
	process.on("SIGINT", () => {
		stopChild();
		process.exit(0);
	});
	process.on("SIGTERM", () => {
		stopChild();
		process.exit(0);
	});

	if (!(await waitForServer(15_000))) {
		console.error("サーバの起動に失敗しました。");
		stopChild();
		process.exit(1);
	}

	// スタンドアロンバイナリ配布時は同梱の libwebview を使う（WEBVIEW_PATH）
	const besideExe = join(
		dirname(process.execPath),
		"native",
		webviewLibFileName(),
	);
	if ((process.env["WEBVIEW_PATH"] ?? "") === "" && existsSync(besideExe)) {
		process.env["WEBVIEW_PATH"] = besideExe;
	}

	try {
		// WEBVIEW_PATH 設定後に動的 import する（ロード時に libwebview を dlopen するため）
		const { Webview } = await import("webview-bun");
		const webview = new Webview();
		webview.title = "コンソールダッシュボード";
		webview.navigate(url);
		console.log(`Webview を起動しました: ${url}`);
		webview.run(); // ウィンドウを閉じるまでブロックする
		stopChild();
		process.exit(0);
	} catch (error) {
		// 理由: GUI 不可環境では子サーバを稼働させたままブラウザ利用を案内する
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Webview を起動できません（ブラウザで ${url} を開いてください）: ${message}`);
		await new Promise<never>(() => {
			// 親は待機（Ctrl+C で終了し、子サーバも停止する）
		});
	}
};

if (process.env["DIS_ML_ROLE"] === "server") {
	await runServerRole();
} else {
	await runDesktopRole();
}
