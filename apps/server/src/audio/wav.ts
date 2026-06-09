import { closeSync, openSync, statSync, writeSync } from "node:fs";

/** WAV(PCM s16le) を逐次書き込むライター。ヘッダのサイズはクローズ時に確定する。 */
export class WavWriter {
	/** 書き込み先ファイルディスクリプタ */
	private readonly fd: number;
	/** これまでに書き込んだ PCM データのバイト数 */
	private dataBytes = 0;
	/** クローズ済みか */
	private closed = false;
	/** ファイルパス */
	readonly path: string;
	/** サンプリングレート */
	readonly sampleRate: number;
	/** チャンネル数 */
	readonly channels: number;

	/**
	 * @param path 出力先パス
	 * @param sampleRate サンプリングレート（Hz）
	 * @param channels チャンネル数
	 */
	constructor(path: string, sampleRate: number, channels: number) {
		this.path = path;
		this.sampleRate = sampleRate;
		this.channels = channels;
		this.fd = openSync(path, "w");
		// 44バイトのヘッダ領域を仮の値で確保する（サイズはクローズ時に確定）
		writeSync(this.fd, this.buildHeader(0));
	}

	/** PCM(s16le) データを追記する */
	write(pcm: Buffer | Uint8Array): void {
		if (this.closed) {
			return;
		}
		const buffer = Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm);
		writeSync(this.fd, buffer);
		this.dataBytes += buffer.length;
	}

	/**
	 * ヘッダを確定してクローズする。
	 * @returns 書き込んだサイズ（バイト）と録音長（ミリ秒）
	 */
	close(): { sizeBytes: number; durationMs: number } {
		if (this.closed) {
			return this.metrics();
		}
		this.closed = true;
		// 先頭へ正しいヘッダを書き戻す
		writeSync(this.fd, this.buildHeader(this.dataBytes), 0, 44, 0);
		closeSync(this.fd);
		return this.metrics();
	}

	/** サイズと録音長を算出する */
	private metrics(): { sizeBytes: number; durationMs: number } {
		const bytesPerSecond = this.sampleRate * this.channels * 2;
		const durationMs =
			bytesPerSecond === 0
				? 0
				: Math.round((this.dataBytes / bytesPerSecond) * 1000);
		const sizeBytes = statSync(this.path).size;
		return { sizeBytes, durationMs };
	}

	/** 指定データ長の WAV ヘッダ(44バイト)を生成する */
	private buildHeader(dataLength: number): Buffer {
		const header = Buffer.alloc(44);
		const byteRate = this.sampleRate * this.channels * 2;
		const blockAlign = this.channels * 2;

		header.write("RIFF", 0, "ascii");
		header.writeUInt32LE(36 + dataLength, 4);
		header.write("WAVE", 8, "ascii");
		header.write("fmt ", 12, "ascii");
		header.writeUInt32LE(16, 16); // fmt チャンクサイズ
		header.writeUInt16LE(1, 20); // PCM
		header.writeUInt16LE(this.channels, 22);
		header.writeUInt32LE(this.sampleRate, 24);
		header.writeUInt32LE(byteRate, 28);
		header.writeUInt16LE(blockAlign, 32);
		header.writeUInt16LE(16, 34); // ビット深度
		header.write("data", 36, "ascii");
		header.writeUInt32LE(dataLength, 40);
		return header;
	}
}
