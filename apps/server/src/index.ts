import { startApp } from "./app";

/**
 * ヘッドレス起動エントリ（Webviewを開かずサーバのみ）。
 * Discord への接続は UI（ブラウザ or デスクトップ版）からの操作で行う。
 */
const main = () => {
	const url = startApp();
	console.log(`Discord 議事録Bot サーバを起動しました: ${url}`);
	console.log("ブラウザでアクセスするか、デスクトップ版を起動してください。");
};

main();
