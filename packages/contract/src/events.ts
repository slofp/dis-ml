import { z } from "zod";
import {
	BotConnectionStateSchema,
	ParticipantSchema,
	RecordingStateSchema,
	TranscriptEntrySchema,
	VoiceChannelInfoSchema,
} from "./models";

/**
 * サーバ→クライアントへ流すリアルタイムイベント。
 * oRPC の Event Iterator(SSE) で `live.events` から配信される。
 * UI はこのストリームを購読して状態を反応的に更新する。
 */

/** ログレベル */
export const LogLevelSchema = z.enum(["info", "warn", "error"]);
/** ログレベル */
export type LogLevel = z.infer<typeof LogLevelSchema>;

/** リアルタイムイベント（type による判別 union） */
export const LiveEventSchema = z.discriminatedUnion("type", [
	z.object({
		/** イベント種別: 接続状態の変化 */
		type: z.literal("status"),
		/** 現在の接続状態 */
		connection: BotConnectionStateSchema,
		/** 参加中のVC（未参加なら null） */
		voice: VoiceChannelInfoSchema.nullable(),
		/** 進行中の議事録セッションID（無ければ null） */
		sessionId: z.string().nullable(),
	}),
	z.object({
		/** イベント種別: 参加者一覧の更新 */
		type: z.literal("participants"),
		/** 最新の参加者一覧 */
		participants: z.array(ParticipantSchema),
	}),
	z.object({
		/** イベント種別: 文字起こしエントリの追加/更新 */
		type: z.literal("transcript"),
		/** 追加または更新されたエントリ */
		entry: TranscriptEntrySchema,
	}),
	z.object({
		/** イベント種別: 録音状態の変化 */
		type: z.literal("recording"),
		/** 現在の録音状態 */
		state: RecordingStateSchema,
	}),
	z.object({
		/** イベント種別: ログ通知 */
		type: z.literal("log"),
		/** ログレベル */
		level: LogLevelSchema,
		/** ログ本文 */
		message: z.string(),
		/** 発生時刻（epoch ミリ秒） */
		at: z.number().int(),
	}),
]);
/** リアルタイムイベント */
export type LiveEvent = z.infer<typeof LiveEventSchema>;
