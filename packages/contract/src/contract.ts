import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";
import { LiveEventSchema } from "./events";
import {
	BotSettingsUpdateSchema,
	BotSettingsViewSchema,
	BotStatusSchema,
	GuildVoiceChannelsSchema,
	ParticipantSchema,
	RecordingStateSchema,
	SessionDetailSchema,
	SessionSummarySchema,
	TranscriptEntrySchema,
} from "./models";

/** セッションIDを受け取る共通入力 */
const SessionIdInputSchema = z.object({
	/** 対象セッションID */
	id: z.string().min(1),
});

/**
 * oRPC 契約（contract-first）。
 * サーバはこの契約を `implement` し、フロントは型として参照する。
 */
export const contract = {
	/** Bot 本体の状態・接続制御 */
	bot: {
		/** 現在の全体状態スナップショットを取得 */
		getStatus: oc.output(BotStatusSchema),
		/** Discord へ接続する */
		connect: oc.output(BotStatusSchema),
		/** Discord から切断する */
		disconnect: oc.output(BotStatusSchema),
	},

	/** ボイスチャンネル関連 */
	voice: {
		/** 参加中VCの参加者一覧を取得 */
		getParticipants: oc.output(z.array(ParticipantSchema)),
		/** 参加可能なボイスチャンネル一覧を取得（ギルドごと） */
		listChannels: oc.output(z.array(GuildVoiceChannelsSchema)),
		/** 指定したボイスチャンネルへ手動で参加する */
		join: oc
			.input(z.object({
				/** 参加先ボイスチャンネルID */
				channelId: z.string().min(1),
			}))
			.output(BotStatusSchema),
		/** 現在のVCから退出する */
		leave: oc.output(BotStatusSchema),
	},

	/** 録音制御 */
	recording: {
		/** 録音状態を取得 */
		getState: oc.output(RecordingStateSchema),
		/** 録音を開始する */
		start: oc.output(RecordingStateSchema),
		/** 録音を停止する */
		stop: oc.output(RecordingStateSchema),
	},

	/** 文字起こし（進行中セッション） */
	transcript: {
		/** 進行中セッションの文字起こしエントリを取得（時系列昇順） */
		getCurrent: oc.output(z.array(TranscriptEntrySchema)),
	},

	/** Bot 設定 */
	settings: {
		/** 設定を取得（シークレットはマスク） */
		get: oc.output(BotSettingsViewSchema),
		/** 設定を更新（指定項目のみ） */
		update: oc.input(BotSettingsUpdateSchema).output(BotSettingsViewSchema),
	},

	/** アーカイブ（過去セッション） */
	archive: {
		/** セッション一覧を取得（新しい順） */
		list: oc.output(z.array(SessionSummarySchema)),
		/** セッション詳細を取得 */
		get: oc.input(SessionIdInputSchema).output(SessionDetailSchema),
		/** セッションを削除（録音ファイルも含む） */
		delete: oc.input(SessionIdInputSchema).output(z.object({
			/** 削除に成功したか */
			deleted: z.boolean(),
		})),
	},

	/** リアルタイムイベント配信 */
	live: {
		/** 状態・参加者・文字起こし・録音・ログのイベントを購読 */
		events: oc.output(eventIterator(LiveEventSchema)),
	},
};

/** アプリ全体の oRPC 契約型 */
export type AppContract = typeof contract;
