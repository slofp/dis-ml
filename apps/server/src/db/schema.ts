import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

/**
 * Drizzle スキーマ（bun:sqlite）。
 * タイムスタンプは epoch ミリ秒の整数で保持する（契約の型に一致）。
 * 実テーブルの作成は `db/migrate.ts` の冪等DDLで行う（スタンドアロン配布のため）。
 */

/** アプリ設定（常に id=1 の単一行で運用） */
export const appSettings = sqliteTable("app_settings", {
	/** 固定主キー（常に 1） */
	id: integer("id").primaryKey(),
	/** Soniox STT モデル名 */
	sttModel: text("stt_model").notNull(),
	/** 言語ヒント（JSON文字列の配列） */
	languageHints: text("language_hints").notNull(),
	/** オーナーのVC入退室に自動追従するか */
	autoFollowOwner: integer("auto_follow_owner", { mode: "boolean" }).notNull(),
	/** 追従対象オーナーのDiscordユーザーID */
	ownerUserId: text("owner_user_id"),
	/** VC参加時に自動録音するか */
	autoRecord: integer("auto_record", { mode: "boolean" }).notNull(),
	/** Discord Bot トークン（平文／nullで未設定） */
	discordToken: text("discord_token"),
	/** Soniox API キー（平文／nullで未設定） */
	sonioxApiKey: text("soniox_api_key"),
	/** 更新時刻（epoch ミリ秒） */
	updatedAt: integer("updated_at").notNull(),
});

/** 議事録セッション（1回の接続〜切断、または録音単位） */
export const sessions = sqliteTable("sessions", {
	/** セッションID */
	id: text("id").primaryKey(),
	/** ギルドID */
	guildId: text("guild_id").notNull(),
	/** ギルド名 */
	guildName: text("guild_name").notNull(),
	/** ボイスチャンネルID */
	channelId: text("channel_id").notNull(),
	/** ボイスチャンネル名 */
	channelName: text("channel_name").notNull(),
	/** 開始時刻（epoch ミリ秒） */
	startedAt: integer("started_at").notNull(),
	/** 終了時刻（進行中は null） */
	endedAt: integer("ended_at"),
});

/** セッション参加者（延べ人数の集計用） */
export const sessionParticipants = sqliteTable(
	"session_participants",
	{
		/** セッションID */
		sessionId: text("session_id").notNull(),
		/** ユーザーID */
		userId: text("user_id").notNull(),
		/** ユーザー名 */
		username: text("username").notNull(),
		/** 表示名 */
		displayName: text("display_name").notNull(),
		/** 初回参加時刻（epoch ミリ秒） */
		firstSeenAt: integer("first_seen_at").notNull(),
	},
	(table) => [primaryKey({ columns: [table.sessionId, table.userId] })],
);

/** 文字起こしエントリ（確定分を永続化） */
export const transcripts = sqliteTable("transcripts", {
	/** エントリID */
	id: text("id").primaryKey(),
	/** セッションID */
	sessionId: text("session_id").notNull(),
	/** 発話者ユーザーID */
	userId: text("user_id").notNull(),
	/** 発話者表示名 */
	displayName: text("display_name").notNull(),
	/** 文字起こしテキスト */
	text: text("text").notNull(),
	/** 発話開始（相対ミリ秒／null可） */
	startMs: integer("start_ms"),
	/** 発話終了（相対ミリ秒／null可） */
	endMs: integer("end_ms"),
	/** 確定済みか */
	isFinal: integer("is_final", { mode: "boolean" }).notNull(),
	/** 検出言語コード（null可） */
	language: text("language"),
		/** 生成時刻（epoch ミリ秒） */
		createdAt: integer("created_at").notNull(),
	},
	(table) => [
		index("idx_transcripts_session").on(table.sessionId, table.createdAt),
	],
);

/** 録音ファイル */
export const recordings = sqliteTable(
	"recordings",
	{
	/** ファイルID */
	id: text("id").primaryKey(),
	/** セッションID */
	sessionId: text("session_id").notNull(),
	/** 種別（user / mix） */
	kind: text("kind").notNull(),
	/** 対象ユーザーID（mixは null） */
	userId: text("user_id"),
	/** 対象ユーザー表示名（mixは null） */
	displayName: text("display_name"),
	/** 保存ファイル名 */
	fileName: text("file_name").notNull(),
	/** サイズ（バイト） */
	sizeBytes: integer("size_bytes").notNull(),
	/** 録音長（ミリ秒／null可） */
	durationMs: integer("duration_ms"),
	/** 生成時刻（epoch ミリ秒） */
	createdAt: integer("created_at").notNull(),
	},
	(table) => [index("idx_recordings_session").on(table.sessionId)],
);
