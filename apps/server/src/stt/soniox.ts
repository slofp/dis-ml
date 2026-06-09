import type { TranscriptEntry } from "@dis-ml/contract";
import {
	type RealtimeResult,
	type RealtimeToken,
	SonioxNodeClient,
} from "@soniox/node";
import { randomUUID } from "node:crypto";
import { AUDIO_SAMPLE_RATE, OPUS_FRAME_SIZE } from "../config";

/** Soniox クライアントを生成する */
export const createSonioxClient = (apiKey: string): SonioxNodeClient => {
	return new SonioxNodeClient({ api_key: apiKey });
};

/** 音声ポンプのティック間隔（ミリ秒） */
const TICK_MS = 20;
/** 1ティック分の無音フレーム（モノラル16bit / 20ms） */
const SILENCE_FRAME = Buffer.alloc(OPUS_FRAME_SIZE * 2);
/**
 * 発話停止後に送り続ける無音の長さ（ミリ秒）。
 * Discord は無音時に音声を送らないため、末尾に無音を補って
 * Soniox の endpoint 検出（発話区切り）を確実に発火させ、文章を確定させる。
 */
const SILENCE_TAIL_MS = 2500;
/** 接続待ち中に保持する音声キューの上限（フレーム数 ≒ 5秒） */
const MAX_QUEUE_FRAMES = 250;
/** pause 中の keepalive 間隔（無音タイムアウト回避） */
const KEEPALIVE_MS = 3000;
/** endpoint 検出の最大遅延（ミリ秒） */
const MAX_ENDPOINT_DELAY_MS = 1500;

/** UserTranscriber の依存・コールバック */
export type TranscriberDeps = {
	/** 共有 Soniox クライアント */
	client: SonioxNodeClient;
	/** STT モデル名 */
	model: string;
	/** 言語ヒント */
	languageHints: string[];
	/** 発話者ユーザーID */
	userId: string;
	/** 発話者表示名 */
	displayName: string;
	/** 所属セッションID */
	sessionId: string;
	/** 文字起こしエントリ（暫定/確定）が更新されたとき */
	onEntry: (entry: TranscriptEntry) => void;
	/** エラー発生時 */
	onError: (message: string) => void;
};

/** 特殊トークン（<end> 等）を除外する */
const isSpeechToken = (token: RealtimeToken): boolean => {
	const text = token.text;
	return text !== "" && !(text.startsWith("<") && text.endsWith(">"));
};

/**
 * 1ユーザーぶんの Soniox リアルタイムSTTセッション。
 * Discord はユーザーごとに音声が分かれるため、話者は既知（diarization不要）。
 *
 * 音声は 20ms ティックの「連続ポンプ」で送出する:
 * - 受信音声が無い間も、発話停止から SILENCE_TAIL_MS の間は無音を送り続けて
 *   endpoint 検出を発火させ、暫定のままになるのを防ぐ。
 * - それ以降の長い無音は pause() して keepalive のみとし、無音タイムアウトを防ぐ。
 */
export class UserTranscriber {
	private readonly deps: TranscriberDeps;
	/** Soniox セッション（接続後に設定） */
	private session: ReturnType<SonioxNodeClient["realtime"]["stt"]> | null = null;
	/** 送信待ちの音声フレーム（接続前はここに溜める） */
	private queue: Buffer[] = [];
	/** 最後に実音声を受け取った時刻（epoch ミリ秒） */
	private lastRealAudioAt = 0;
	/** 送出ポンプのタイマー */
	private ticker: ReturnType<typeof setInterval> | null = null;
	/** 現在の発話で確定済みのトークン */
	private finalizedTokens: RealtimeToken[] = [];
	/** 現在の発話の暫定トークン */
	private interimTokens: RealtimeToken[] = [];
	/** 暫定表示用の安定ID（ユーザー単位） */
	private readonly interimId: string;
	/** クローズ済みか */
	private closed = false;

	/** @param deps 依存とコールバック */
	constructor(deps: TranscriberDeps) {
		this.deps = deps;
		this.interimId = `live-${deps.userId}`;
	}

	/** Soniox へ接続する */
	async connect(): Promise<void> {
		const session = this.deps.client.realtime.stt(
			{
				model: this.deps.model,
				audio_format: "pcm_s16le",
				sample_rate: AUDIO_SAMPLE_RATE,
				num_channels: 1,
				language_hints: this.deps.languageHints,
				enable_endpoint_detection: true,
				max_endpoint_delay_ms: MAX_ENDPOINT_DELAY_MS,
			},
			{ keepalive_interval_ms: KEEPALIVE_MS },
		);
		this.session = session;

		session.on("result", (result: RealtimeResult) => {
			this.handleResult(result);
		});
		session.on("endpoint", () => {
			this.flushUtterance();
		});
		session.on("error", (error: Error) => {
			this.deps.onError(`STT(${this.deps.displayName}): ${error.message}`);
		});

		await session.connect();
	}

	/** モノラルPCM(s16le/48kHz) を受け取りキューへ積む（送出はポンプが行う） */
	sendAudio(monoPcm: Buffer): void {
		if (this.closed) {
			return;
		}
		this.queue.push(monoPcm);
		if (this.queue.length > MAX_QUEUE_FRAMES) {
			this.queue.shift();
		}
		this.lastRealAudioAt = Date.now();
		const session = this.session;
		if (session?.paused === true) {
			try {
				session.resume();
			} catch {
				// 理由: resume 失敗（状態遷移中など）は致命的ではない
			}
		}
		this.ensureTicker();
	}

	/** 送出ポンプを起動する（停止中なら） */
	private ensureTicker(): void {
		if (this.ticker !== null) {
			return;
		}
		this.ticker = setInterval(() => {
			this.tick();
		}, TICK_MS);
	}

	/** 送出ポンプを停止する */
	private stopTicker(): void {
		if (this.ticker !== null) {
			clearInterval(this.ticker);
			this.ticker = null;
		}
	}

	/** 20ms ごとに音声（または末尾無音）を送出する */
	private tick(): void {
		const session = this.session;
		if (session === null || this.closed) {
			this.stopTicker();
			return;
		}
		// 接続確立前は送らずキューに溜めて待つ。終了状態ならポンプを止める。
		if (session.state !== "connected") {
			if (
				session.state === "error" ||
				session.state === "closed" ||
				session.state === "canceled" ||
				session.state === "finished"
			) {
				this.stopTicker();
			}
			return;
		}

		// 実音声があればまとめて送る
		if (this.queue.length > 0) {
			const frames = this.queue;
			this.queue = [];
			for (const frame of frames) {
				this.safeSend(frame);
			}
			return;
		}

		// 実音声が無い: 末尾無音を送って endpoint を促す。長くなれば pause。
		const idleMs = Date.now() - this.lastRealAudioAt;
		if (idleMs <= SILENCE_TAIL_MS) {
			this.safeSend(SILENCE_FRAME);
			return;
		}
		// 長時間無音 → pause（keepaliveで接続維持）。未確定があれば確定させる。
		this.flushUtterance();
		if (!session.paused) {
			try {
				session.pause();
			} catch {
				// 理由: pause 失敗（状態遷移中など）は致命的ではない
			}
		}
		this.stopTicker();
	}

	/** 例外でBotを落とさずに音声を送る */
	private safeSend(frame: Buffer): void {
		const session = this.session;
		if (session?.state !== "connected") {
			return;
		}
		try {
			session.sendAudio(frame);
		} catch {
			// 理由: 送信直後の切断などで稀に発生し得るが、Bot全体を落とさない
		}
	}

	/** result イベントを処理し、暫定エントリを通知する */
	private handleResult(result: RealtimeResult): void {
		const finals = result.tokens.filter(
			(token) => token.is_final && isSpeechToken(token),
		);
		const interim = result.tokens.filter(
			(token) => !token.is_final && isSpeechToken(token),
		);
		this.finalizedTokens.push(...finals);
		this.interimTokens = interim;

		const text = this.currentText();
		if (text === "") {
			return;
		}
		this.deps.onEntry(this.buildEntry(this.interimId, text, false));
	}

	/** 発話を確定し、確定エントリを通知する */
	private flushUtterance(): void {
		const text = this.currentText();
		this.finalizedTokens = [];
		this.interimTokens = [];
		if (text === "") {
			return;
		}
		this.deps.onEntry(this.buildEntry(randomUUID(), text, true));
	}

	/** 現在の発話テキスト（確定+暫定）を組み立てる */
	private currentText(): string {
		const tokens = [...this.finalizedTokens, ...this.interimTokens];
		return tokens
			.map((token) => token.text)
			.join("")
			.trim();
	}

	/** TranscriptEntry を構築する */
	private buildEntry(id: string, text: string, isFinal: boolean): TranscriptEntry {
		const tokens = [...this.finalizedTokens, ...this.interimTokens];
		const first = tokens.at(0);
		const last = tokens.at(-1);
		const language = tokens.find((token) => token.language !== undefined)?.language;
		return {
			id,
			sessionId: this.deps.sessionId,
			userId: this.deps.userId,
			displayName: this.deps.displayName,
			text,
			startMs: first?.start_ms ?? null,
			endMs: last?.end_ms ?? null,
			isFinal,
			language: language ?? null,
			createdAt: Date.now(),
		};
	}

	/** セッションを終了し、未確定の発話を確定する */
	async close(): Promise<void> {
		if (this.closed) {
			return;
		}
		this.closed = true;
		this.stopTicker();
		this.flushUtterance();
		const session = this.session;
		this.session = null;
		if (session === null) {
			return;
		}
		try {
			await session.finish();
		} catch {
			// 理由: 終了処理の失敗は致命的ではないため無視する
		}
	}
}
