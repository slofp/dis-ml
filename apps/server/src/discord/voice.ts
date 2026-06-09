import type { RecordingKind, TranscriptEntry } from "@dis-ml/contract";
import {
	type VoiceConnection,
	EndBehaviorType,
} from "@discordjs/voice";
import type { SonioxNodeClient } from "@soniox/node";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUDIO_CHANNELS, AUDIO_SAMPLE_RATE, RECORDINGS_DIR } from "../config";
import { Mixer } from "../audio/mixer";
import { createOpusDecoder } from "../audio/opusDecoder";
import { WavWriter } from "../audio/wav";
import { UserTranscriber } from "../stt/soniox";

/** 録音停止時に返す1ファイル分のメタデータ */
export type RecordingResult = {
	/** 種別 */
	kind: RecordingKind;
	/** 対象ユーザーID（mixは null） */
	userId: string | null;
	/** 対象ユーザー表示名（mixは null） */
	displayName: string | null;
	/** 保存ファイル名 */
	fileName: string;
	/** サイズ（バイト） */
	sizeBytes: number;
	/** 録音長（ミリ秒） */
	durationMs: number;
};

/** VoiceSession の依存・コールバック */
export type VoiceSessionContext = {
	/** 確立済みのボイス接続 */
	connection: VoiceConnection;
	/** Soniox クライアント（キー未設定なら null＝STT無効） */
	sonioxClient: SonioxNodeClient | null;
	/** STT モデル名 */
	sttModel: string;
	/** 言語ヒント */
	languageHints: string[];
	/** 議事録セッションID */
	sessionId: string;
	/** userId から表示名を解決する */
	resolveDisplayName: (userId: string) => string;
	/** 文字起こしエントリ（暫定/確定）の通知 */
	onEntry: (entry: TranscriptEntry) => void;
	/** 発話状態の変化 */
	onSpeaking: (userId: string, speaking: boolean) => void;
	/** エラー通知 */
	onError: (message: string) => void;
};

/** ステレオPCM(s16le) をモノラルへダウンミックスする */
const downmixToMono = (stereo: Buffer): Buffer => {
	const frameCount = Math.floor(stereo.length / 4);
	const mono = Buffer.alloc(frameCount * 2);
	for (let i = 0; i < frameCount; i += 1) {
		const left = stereo.readInt16LE(i * 4);
		const right = stereo.readInt16LE(i * 4 + 2);
		mono.writeInt16LE((left + right) >> 1, i * 2);
	}
	return mono;
};

/**
 * 1つのボイスチャンネルに対する音声処理セッション。
 * ・接続中は常時STT（ユーザーごとにSonioxセッションでリアルタイムSTT）。
 * ・録音は任意タイミングで開始/停止し、ユーザー別WAV + 全体ミックスWAVを保存する。
 */
export class VoiceSession {
	private readonly ctx: VoiceSessionContext;
	/** ユーザーごとのSTTセッション */
	private readonly transcribers = new Map<string, UserTranscriber>();
	/** 現在オープン中の受信ストリームのユーザー集合 */
	private readonly activeStreams = new Set<string>();
	/** 録音中のユーザー別WAVライター */
	private readonly recordingWriters = new Map<string, WavWriter>();
	/** 録音中のミキサー */
	private mixer: Mixer | null = null;
	/** 録音中か */
	private recording = false;
	/** 破棄済みか */
	private destroyed = false;

	/** @param ctx 依存とコールバック */
	constructor(ctx: VoiceSessionContext) {
		this.ctx = ctx;
	}

	/** 受信を開始する（発話開始イベントを購読） */
	start(): void {
		const receiver = this.ctx.connection.receiver;
		receiver.speaking.on("start", (userId: string) => {
			this.ctx.onSpeaking(userId, true);
			this.subscribeUser(userId);
		});
		receiver.speaking.on("end", (userId: string) => {
			this.ctx.onSpeaking(userId, false);
		});
	}

	/** 録音中か */
	isRecording(): boolean {
		return this.recording;
	}

	/** 録音を開始する */
	startRecording(): void {
		if (this.recording || this.destroyed) {
			return;
		}
		mkdirSync(this.sessionDir(), { recursive: true });
		this.mixer = new Mixer(join(this.sessionDir(), "mix.wav"));
		this.mixer.start();
		this.recording = true;
	}

	/**
	 * 録音を停止し、保存したファイルのメタデータを返す。
	 * @returns 保存された録音ファイル一覧
	 */
	stopRecording(): RecordingResult[] {
		if (!this.recording) {
			return [];
		}
		this.recording = false;
		const results: RecordingResult[] = [];

		for (const [userId, writer] of this.recordingWriters) {
			const { sizeBytes, durationMs } = writer.close();
			results.push({
				kind: "user",
				userId,
				displayName: this.ctx.resolveDisplayName(userId),
				fileName: `user-${userId}.wav`,
				sizeBytes,
				durationMs,
			});
		}
		this.recordingWriters.clear();

		if (this.mixer !== null) {
			const { sizeBytes, durationMs } = this.mixer.stop();
			this.mixer = null;
			results.push({
				kind: "mix",
				userId: null,
				displayName: null,
				fileName: "mix.wav",
				sizeBytes,
				durationMs,
			});
		}

		return results;
	}

	/** 指定ユーザーの音声受信を購読する（既に購読中なら何もしない） */
	private subscribeUser(userId: string): void {
		if (this.destroyed || this.activeStreams.has(userId)) {
			return;
		}
		this.activeStreams.add(userId);

		const opusStream = this.ctx.connection.receiver.subscribe(userId, {
			end: { behavior: EndBehaviorType.AfterSilence, duration: 200 },
		});
		// Opus パケットを1つずつデコード（ネイティブ優先／opusscriptフォールバック）
		const decoder = createOpusDecoder();

		opusStream.on("data", (packet: Buffer) => {
			try {
				this.handlePcm(userId, decoder.decode(packet));
			} catch {
				// 理由: 破損フレームのデコード失敗は無視して継続する
			}
		});
		const cleanup = () => {
			this.activeStreams.delete(userId);
		};
		opusStream.on("end", cleanup);
		opusStream.on("error", (error: Error) => {
			this.ctx.onError(`音声受信エラー(${userId}): ${error.message}`);
			cleanup();
		});
	}

	/** デコード済みステレオPCMを STT と録音へ振り分ける */
	private handlePcm(userId: string, stereoPcm: Buffer): void {
		// STT（モノラルへ変換して送信）
		const transcriber = this.ensureTranscriber(userId);
		if (transcriber !== null) {
			transcriber.sendAudio(downmixToMono(stereoPcm));
		}

		// 録音（ユーザー別WAV + ミックス）
		if (this.recording) {
			this.ensureWriter(userId).write(stereoPcm);
			if (this.mixer !== null) {
				this.mixer.push(userId, stereoPcm);
			}
		}
	}

	/** ユーザーのSTTセッションを取得（必要なら生成・接続） */
	private ensureTranscriber(userId: string): UserTranscriber | null {
		if (this.ctx.sonioxClient === null) {
			return null;
		}
		const existing = this.transcribers.get(userId);
		if (existing !== undefined) {
			return existing;
		}
		const transcriber = new UserTranscriber({
			client: this.ctx.sonioxClient,
			model: this.ctx.sttModel,
			languageHints: this.ctx.languageHints,
			userId,
			displayName: this.ctx.resolveDisplayName(userId),
			sessionId: this.ctx.sessionId,
			onEntry: this.ctx.onEntry,
			onError: this.ctx.onError,
		});
		this.transcribers.set(userId, transcriber);
		transcriber.connect().catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			this.ctx.onError(`STT接続失敗(${userId}): ${message}`);
		});
		return transcriber;
	}

	/** ユーザー別WAVライターを取得（必要なら生成） */
	private ensureWriter(userId: string): WavWriter {
		const existing = this.recordingWriters.get(userId);
		if (existing !== undefined) {
			return existing;
		}
		const writer = new WavWriter(
			join(this.sessionDir(), `user-${userId}.wav`),
			AUDIO_SAMPLE_RATE,
			AUDIO_CHANNELS,
		);
		this.recordingWriters.set(userId, writer);
		return writer;
	}

	/** このセッションの録音保存ディレクトリ */
	private sessionDir(): string {
		return join(RECORDINGS_DIR, this.ctx.sessionId);
	}

	/** セッションを破棄し、STTと録音を終了する */
	async destroy(): Promise<void> {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;
		if (this.recording) {
			this.stopRecording();
		}
		const closing = [...this.transcribers.values()].map((transcriber) =>
			transcriber.close(),
		);
		this.transcribers.clear();
		this.activeStreams.clear();
		await Promise.allSettled(closing);
	}
}
