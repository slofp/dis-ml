import { spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	rmSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * スタンドアロンバイナリをクロスプラットフォームでビルドする。
 * 実行中の OS/アーキ向けに、Web・マイグレーション・ネイティブ依存
 * (Opus .node / webview ライブラリ) を bin/ へ同梱し、単一実行ファイルを生成する。
 *
 * ネイティブ依存は各プラットフォームのものが必要なため、配布対象の OS 上で実行する。
 */

/** リポジトリルート（scripts/ の1つ上） */
const ROOT = join(import.meta.dir, "..");
/** 出力ディレクトリ */
const BIN = join(ROOT, "bin");
/** サーバパッケージのディレクトリ */
const SERVER = join(ROOT, "apps", "server");
// ネイティブ依存はサーバパッケージの依存なので、サーバ基準で解決する
const serverRequire = createRequire(join(SERVER, "package.json"));

/** コマンドを実行し、失敗したら例外にする */
const run = (args: string[], cwd: string): void => {
	const result = spawnSync(args[0] ?? "", args.slice(1), {
		cwd,
		stdio: "inherit",
	});
	if (result.status !== 0) {
		throw new Error(`コマンド失敗 (${String(result.status)}): ${args.join(" ")}`);
	}
};

/** 指定ディレクトリ配下から該当ファイル名を再帰収集する */
const collectFiles = (dir: string, name: string, out: string[]): void => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			collectFiles(path, name, out);
		} else if (entry.name === name) {
			out.push(path);
		}
	}
};

/** 現在のプラットフォーム向け @discordjs/opus の .node を解決する */
const resolveOpusNode = (): string => {
	const pkgDir = dirname(serverRequire.resolve("@discordjs/opus/package.json"));
	const found: string[] = [];
	collectFiles(pkgDir, "opus.node", found);
	// 配布用 prebuild を優先（無ければ最初に見つかったもの）
	const chosen = found.find((path) => path.includes("prebuild")) ?? found[0];
	if (chosen === undefined) {
		throw new Error("@discordjs/opus の opus.node が見つかりません。");
	}
	return chosen;
};

/** 現在のプラットフォーム向け webview ネイティブライブラリのファイル名 */
const webviewLibFileName = (): string => {
	if (process.platform === "win32") {
		return "libwebview.dll";
	}
	if (process.platform === "darwin") {
		return "libwebview.dylib";
	}
	return `libwebview-${process.arch}.so`;
};

/** 現在のプラットフォーム向け webview ライブラリのパスを解決する */
const resolveWebviewLib = (): string => {
	const pkgDir = dirname(serverRequire.resolve("webview-bun/package.json"));
	const path = join(pkgDir, "build", webviewLibFileName());
	if (!existsSync(path)) {
		throw new Error(`webview ライブラリが見つかりません: ${path}`);
	}
	return path;
};

/** バイナリ化対象外（任意のネイティブ依存。未使用 or 純JS代替を使用） */
const EXTERNALS = [
	"ffmpeg-static",
	"node-opus",
	"sodium-native",
	"sodium",
	"libsodium-wrappers",
	"@stablelib/xchacha20poly1305",
];

// 1) Web(SPA) をビルド
run([process.execPath, "--filter", "@dis-ml/web", "build"], ROOT);

// 2) bin/ を作り直す
rmSync(BIN, { recursive: true, force: true });
mkdirSync(join(BIN, "native"), { recursive: true });

// 3) 配信物（SPA・マイグレーション）を同梱
cpSync(join(ROOT, "apps", "web", "build"), join(BIN, "web"), { recursive: true });
cpSync(join(SERVER, "drizzle"), join(BIN, "drizzle"), { recursive: true });

// 4) ネイティブ依存（Opus / webview）を同梱
cpSync(resolveOpusNode(), join(BIN, "native", "opus.node"));
cpSync(resolveWebviewLib(), join(BIN, "native", webviewLibFileName()));

// 5) 単一実行ファイルを生成（Windows は .exe）。Bun.build の JS API を使用する。
const outName = process.platform === "win32" ? "dis-ml.exe" : "dis-ml";
const result = await Bun.build({
	entrypoints: [join(SERVER, "src", "desktop.ts")],
	compile: { outfile: join(BIN, outName) },
	external: EXTERNALS,
});
if (!result.success) {
	for (const log of result.logs) {
		console.error(log);
	}
	throw new Error("バイナリのコンパイルに失敗しました。");
}

console.log(`ビルド完了: ${join(BIN, outName)}`);
console.log(`同梱: web / drizzle / native(${webviewLibFileName()}, opus.node)`);
