import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import OpusScript from "opusscript";
import { AUDIO_CHANNELS, AUDIO_SAMPLE_RATE } from "../config";
import { bus } from "../events/bus";

/** 1パケットを PCM へデコードできる最小デコーダ */
export type OpusDecoder = {
	/** Opus パケットをデコードして PCM(s16le) を返す */
	decode: (packet: Buffer) => Buffer;
};

/** ネイティブ binding（@discordjs/opus）の形 */
type NativeOpusBinding = {
	/** エンコーダ兼デコーダ */
	OpusEncoder: new (rate: number, channels: number) => OpusDecoder;
};

const nativeRequire = createRequire(import.meta.url);

/**
 * ネイティブ Opus(@discordjs/opus) を読み込む。
 * - スタンドアロンバイナリ: 実行ファイル隣の `native/opus.node`（同梱）を直接 require
 * - 開発時(bun run): パッケージから通常解決（node-pre-gyp が prebuild を解決）
 * 読み込めなければ null（呼び出し側で opusscript にフォールバック）。
 */
const loadNativeBinding = (): NativeOpusBinding | null => {
	const candidates: string[] = [];
	const envPath = process.env["DIS_ML_OPUS_NODE"];
	if (envPath !== undefined && envPath !== "") {
		candidates.push(envPath);
	}
	const besideExe = join(dirname(process.execPath), "native", "opus.node");
	if (existsSync(besideExe)) {
		candidates.push(besideExe);
	}

	for (const candidate of candidates) {
		try {
			// 理由: require は外部由来の any を返すため as で型付けする
			return nativeRequire(candidate) as NativeOpusBinding;
		} catch {
			// 理由: 候補が読み込めなければ次の候補/フォールバックへ
		}
	}

	try {
		return nativeRequire("@discordjs/opus") as NativeOpusBinding;
	} catch {
		// 理由: ネイティブが無ければ opusscript を使う
		return null;
	}
};

/** ネイティブ binding（読み込めなければ null＝opusscriptを使用） */
const nativeBinding = loadNativeBinding();

bus.log(
	"info",
	`Opus デコーダ: ${nativeBinding !== null ? "ネイティブ(@discordjs/opus)" : "opusscript(純JS)"}`,
);

/**
 * Opus デコーダを生成する（ネイティブ優先、無ければ opusscript）。
 * @returns 1パケット単位でデコードできるデコーダ
 */
export const createOpusDecoder = (): OpusDecoder => {
	if (nativeBinding !== null) {
		return new nativeBinding.OpusEncoder(AUDIO_SAMPLE_RATE, AUDIO_CHANNELS);
	}
	return new OpusScript(AUDIO_SAMPLE_RATE, AUDIO_CHANNELS);
};
