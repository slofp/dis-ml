import { AUDIO_CHANNELS, AUDIO_SAMPLE_RATE, OPUS_FRAME_SIZE } from "../config";
import { WavWriter } from "./wav";

/** 1フレーム(20ms)のバイト数（960サンプル × 2ch × 2byte） */
const FRAME_BYTES = OPUS_FRAME_SIZE * AUDIO_CHANNELS * 2;
/** ミックスのティック間隔（ミリ秒） */
const TICK_MS = 20;
/** int16 の範囲 */
const INT16_MAX = 32_767;
const INT16_MIN = -32_768;

/**
 * 複数ユーザーの PCM を実時間で時間整合ミックスし、単一WAVへ書き出す。
 * 20ms ごとに各ユーザーの最新フレームを合算する（無音区間はゼロ）。
 */
export class Mixer {
	/** ミックス出力のWAVライター */
	private readonly writer: WavWriter;
	/** ユーザーID → 未処理PCMバッファ */
	private readonly buffers = new Map<string, Buffer>();
	/** ティック用タイマー */
	private timer: ReturnType<typeof setInterval> | null = null;

	/** @param path ミックスWAVの出力先 */
	constructor(path: string) {
		this.writer = new WavWriter(path, AUDIO_SAMPLE_RATE, AUDIO_CHANNELS);
	}

	/** ミックスを開始する */
	start(): void {
		if (this.timer !== null) {
			return;
		}
		this.timer = setInterval(() => {
			this.tick();
		}, TICK_MS);
	}

	/** ユーザーのPCMを投入する */
	push(userId: string, pcm: Buffer): void {
		const existing = this.buffers.get(userId);
		this.buffers.set(
			userId,
			existing === undefined ? Buffer.from(pcm) : Buffer.concat([existing, pcm]),
		);
	}

	/** 20msぶんのミックスフレームを書き出す */
	private tick(): void {
		const sampleCount = FRAME_BYTES / 2;
		const accumulator = new Int32Array(sampleCount);

		for (const [userId, buffer] of this.buffers) {
			if (buffer.length < FRAME_BYTES) {
				continue;
			}
			const frame = buffer.subarray(0, FRAME_BYTES);
			// 残りを新しいバッファへコピーして元の確保を解放する
			this.buffers.set(userId, Buffer.from(buffer.subarray(FRAME_BYTES)));
			for (let i = 0; i < sampleCount; i += 1) {
				const sample = accumulator[i] ?? 0;
				accumulator[i] = sample + frame.readInt16LE(i * 2);
			}
		}

		const mixed = Buffer.alloc(FRAME_BYTES);
		for (let i = 0; i < sampleCount; i += 1) {
			const value = accumulator[i] ?? 0;
			const clamped = value > INT16_MAX ? INT16_MAX : value < INT16_MIN ? INT16_MIN : value;
			mixed.writeInt16LE(clamped, i * 2);
		}
		this.writer.write(mixed);
	}

	/**
	 * ミックスを停止し、ファイルを確定する。
	 * @returns 書き込んだサイズ（バイト）と録音長（ミリ秒）
	 */
	stop(): { sizeBytes: number; durationMs: number } {
		if (this.timer !== null) {
			clearInterval(this.timer);
			this.timer = null;
		}
		this.buffers.clear();
		return this.writer.close();
	}
}
