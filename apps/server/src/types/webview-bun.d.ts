// webview-bun は型未提供かつ生TSソースを公開しており、そのまま型チェックすると
// 当プロジェクトの厳格設定に抵触する。型チェック時はこのスタブに差し替える
// （tsconfig.typecheck.json の paths）。実行時の Bun は実体パッケージを解決する。
// 本プロジェクトで使用する最小APIのみ宣言する。

/** ネイティブ Webview ウィンドウ */
export declare class Webview {
	/** @param debug 開発者ツールを有効化するか */
	constructor(debug?: boolean);
	/** ウィンドウタイトル */
	set title(value: string);
	/** 指定URLへ遷移する */
	navigate(url: string): void;
	/** イベントループを開始する（ウィンドウを閉じるまでブロック） */
	run(): void;
	/** ウィンドウを破棄する */
	destroy(): void;
}
