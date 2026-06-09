import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { BotSettings } from "@dis-ml/contract";

/**
 * サーバ全体の定数・既定値。
 * シークレット（Discordトークン / Soniox APIキー）は設定画面からのみ入力し、
 * 環境変数や .env は使用しない（DBに保存）。
 */

/** oRPC サーバの待受ホスト（ローカル専用） */
export const HOST = "127.0.0.1";
/** oRPC サーバの待受ポート（Vite dev のプロキシ先と一致） */
export const PORT = 8787;
/** oRPC ハンドラのパスプレフィックス */
export const RPC_PREFIX = "/rpc";

/** データ保存ディレクトリ（SQLite・録音）。環境変数で上書き可能（秘密情報ではない） */
export const DATA_DIR = resolve(
	process.env["DIS_ML_DATA_DIR"] ?? join(homedir(), ".dis-ml"),
);
/** SQLite データベースファイルのパス */
export const DB_PATH = join(DATA_DIR, "dis-ml.sqlite");
/** 録音ファイルの保存ディレクトリ */
export const RECORDINGS_DIR = join(DATA_DIR, "recordings");

/** Discord 音声のサンプリングレート（Opusデコード後は固定で48kHz） */
export const AUDIO_SAMPLE_RATE = 48_000;
/** Discord 音声のチャンネル数（ステレオ） */
export const AUDIO_CHANNELS = 2;
/** Opus フレームサイズ（48kHzで20ms） */
export const OPUS_FRAME_SIZE = 960;

/** Bot 一般設定の既定値 */
export const DEFAULT_BOT_SETTINGS: BotSettings = {
	sttModel: "stt-rt-preview",
	languageHints: ["ja"],
	autoFollowOwner: true,
	ownerUserId: null,
	autoRecord: false,
};
