import { z } from "zod";

/**
 * ドメインモデル定義（zod スキーマ + 推論型）。
 * サーバ実装とフロントの両方から参照される単一の真実源。
 */

/** Bot の Discord 接続状態 */
export const BotConnectionStateSchema = z.enum([
	"disconnected",
	"connecting",
	"connected",
	"error",
]);
/** Bot の Discord 接続状態 */
export type BotConnectionState = z.infer<typeof BotConnectionStateSchema>;

/** 参加中のボイスチャンネル情報 */
export const VoiceChannelInfoSchema = z.object({
	/** ギルド(サーバ)ID */
	guildId: z.string(),
	/** ギルド(サーバ)名 */
	guildName: z.string(),
	/** ボイスチャンネルID */
	channelId: z.string(),
	/** ボイスチャンネル名 */
	channelName: z.string(),
	/** 参加した時刻（epoch ミリ秒） */
	joinedAt: z.number().int(),
});
/** 参加中のボイスチャンネル情報 */
export type VoiceChannelInfo = z.infer<typeof VoiceChannelInfoSchema>;

/** VC 参加者 */
export const ParticipantSchema = z.object({
	/** DiscordユーザーID */
	userId: z.string(),
	/** ユーザー名（@ハンドル） */
	username: z.string(),
	/** サーバ内表示名 */
	displayName: z.string(),
	/** アバター画像URL（無い場合 null） */
	avatarUrl: z.string().nullable(),
	/** Bot アカウントか */
	isBot: z.boolean(),
	/** 現在発話中か */
	isSpeaking: z.boolean(),
	/** 自分でミュートしているか */
	isSelfMuted: z.boolean(),
	/** 自分でスピーカーをオフにしているか */
	isSelfDeafened: z.boolean(),
	/** VCに参加した時刻（epoch ミリ秒） */
	joinedAt: z.number().int(),
});
/** VC 参加者 */
export type Participant = z.infer<typeof ParticipantSchema>;

/** STT タイムラインのエントリ（いつ・誰が・何を話したか） */
export const TranscriptEntrySchema = z.object({
	/** エントリの一意ID */
	id: z.string(),
	/** 所属する議事録セッションID */
	sessionId: z.string(),
	/** 発話者のDiscordユーザーID */
	userId: z.string(),
	/** 発話者の表示名 */
	displayName: z.string(),
	/** 文字起こしテキスト */
	text: z.string(),
	/** 発話開始（音声先頭からの相対ミリ秒、不明なら null） */
	startMs: z.number().int().nullable(),
	/** 発話終了（音声先頭からの相対ミリ秒、不明なら null） */
	endMs: z.number().int().nullable(),
	/** 確定済みか（false は暫定結果） */
	isFinal: z.boolean(),
	/** 検出言語コード（不明なら null） */
	language: z.string().nullable(),
	/** 生成時刻（epoch ミリ秒） */
	createdAt: z.number().int(),
});
/** STT タイムラインのエントリ */
export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>;

/** 録音状態 */
export const RecordingStateSchema = z.object({
	/** 録音中か */
	active: z.boolean(),
	/** 録音開始時刻（epoch ミリ秒、未録音なら null） */
	startedAt: z.number().int().nullable(),
	/** 録音対象の議事録セッションID（未録音なら null） */
	sessionId: z.string().nullable(),
});
/** 録音状態 */
export type RecordingState = z.infer<typeof RecordingStateSchema>;

/** 録音ファイルの種別（ユーザー別 / 全体ミックス） */
export const RecordingKindSchema = z.enum(["user", "mix"]);
/** 録音ファイルの種別 */
export type RecordingKind = z.infer<typeof RecordingKindSchema>;

/** 録音ファイル */
export const RecordingFileSchema = z.object({
	/** ファイルの一意ID */
	id: z.string(),
	/** 所属セッションID */
	sessionId: z.string(),
	/** 種別（user=ユーザー別 / mix=全体ミックス） */
	kind: RecordingKindSchema,
	/** 対象ユーザーID（mix の場合 null） */
	userId: z.string().nullable(),
	/** 対象ユーザー表示名（mix の場合 null） */
	displayName: z.string().nullable(),
	/** 保存ファイル名 */
	fileName: z.string(),
	/** ファイルサイズ（バイト） */
	sizeBytes: z.number().int(),
	/** 録音長（ミリ秒、不明なら null） */
	durationMs: z.number().int().nullable(),
	/** 生成時刻（epoch ミリ秒） */
	createdAt: z.number().int(),
});
/** 録音ファイル */
export type RecordingFile = z.infer<typeof RecordingFileSchema>;

/** 議事録セッションの概要（アーカイブ一覧用） */
export const SessionSummarySchema = z.object({
	/** セッションの一意ID */
	id: z.string(),
	/** ギルド(サーバ)ID */
	guildId: z.string(),
	/** ギルド(サーバ)名 */
	guildName: z.string(),
	/** ボイスチャンネルID */
	channelId: z.string(),
	/** ボイスチャンネル名 */
	channelName: z.string(),
	/** セッション開始時刻（epoch ミリ秒） */
	startedAt: z.number().int(),
	/** セッション終了時刻（進行中なら null） */
	endedAt: z.number().int().nullable(),
	/** 参加した人数（延べ） */
	participantCount: z.number().int(),
	/** 文字起こしエントリ数 */
	transcriptCount: z.number().int(),
	/** 録音ファイルを持つか */
	hasRecording: z.boolean(),
});
/** 議事録セッションの概要 */
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

/** 議事録セッションの詳細（アーカイブ閲覧用） */
export const SessionDetailSchema = z.object({
	/** セッション概要 */
	session: SessionSummarySchema,
	/** 文字起こしエントリ（時系列昇順） */
	entries: z.array(TranscriptEntrySchema),
	/** 録音ファイル一覧 */
	recordings: z.array(RecordingFileSchema),
});
/** 議事録セッションの詳細 */
export type SessionDetail = z.infer<typeof SessionDetailSchema>;

/** Bot 設定（シークレットを除く一般設定） */
export const BotSettingsSchema = z.object({
	/** 使用する Soniox STT モデル名 */
	sttModel: z.string(),
	/** STT の言語ヒント（ISO言語コード） */
	languageHints: z.array(z.string()),
	/** オーナーのVC入退室に自動追従するか */
	autoFollowOwner: z.boolean(),
	/** 追従対象オーナーのDiscordユーザーID（未設定なら null） */
	ownerUserId: z.string().nullable(),
	/** VC参加時に自動で録音を開始するか */
	autoRecord: z.boolean(),
});
/** Bot 設定（一般設定） */
export type BotSettings = z.infer<typeof BotSettingsSchema>;

/** Bot 設定の閲覧用ビュー（シークレットは設定有無のみ公開） */
export const BotSettingsViewSchema = BotSettingsSchema.extend({
	/** Discord Bot トークンが設定済みか */
	discordTokenSet: z.boolean(),
	/** Soniox API キーが設定済みか */
	sonioxApiKeySet: z.boolean(),
});
/** Bot 設定の閲覧用ビュー */
export type BotSettingsView = z.infer<typeof BotSettingsViewSchema>;

/** Bot 設定の更新入力（指定された項目のみ更新。シークレットは平文で受け取る） */
export const BotSettingsUpdateSchema = z.object({
	/** 使用する Soniox STT モデル名 */
	sttModel: z.string().optional(),
	/** STT の言語ヒント */
	languageHints: z.array(z.string()).optional(),
	/** オーナー自動追従の有効/無効 */
	autoFollowOwner: z.boolean().optional(),
	/** 追従対象オーナーのDiscordユーザーID（null でクリア） */
	ownerUserId: z.string().nullable().optional(),
	/** VC参加時の自動録音の有効/無効 */
	autoRecord: z.boolean().optional(),
	/** Discord Bot トークン（平文。空文字でクリア） */
	discordToken: z.string().optional(),
	/** Soniox API キー（平文。空文字でクリア） */
	sonioxApiKey: z.string().optional(),
});
/** Bot 設定の更新入力 */
export type BotSettingsUpdate = z.infer<typeof BotSettingsUpdateSchema>;

/** 参加可能なボイスチャンネルの選択肢 */
export const VoiceChannelOptionSchema = z.object({
	/** ボイスチャンネルID */
	channelId: z.string(),
	/** ボイスチャンネル名 */
	channelName: z.string(),
	/** 現在の参加人数 */
	memberCount: z.number().int(),
});
/** 参加可能なボイスチャンネルの選択肢 */
export type VoiceChannelOption = z.infer<typeof VoiceChannelOptionSchema>;

/** ギルドと、その配下の参加可能ボイスチャンネル */
export const GuildVoiceChannelsSchema = z.object({
	/** ギルド(サーバ)ID */
	guildId: z.string(),
	/** ギルド(サーバ)名 */
	guildName: z.string(),
	/** 参加可能なボイスチャンネル一覧 */
	channels: z.array(VoiceChannelOptionSchema),
});
/** ギルドと、その配下の参加可能ボイスチャンネル */
export type GuildVoiceChannels = z.infer<typeof GuildVoiceChannelsSchema>;

/** Bot 全体の現在状態（初期表示用のスナップショット） */
export const BotStatusSchema = z.object({
	/** Discord 接続状態 */
	connection: BotConnectionStateSchema,
	/** 参加中のVC（未参加なら null） */
	voice: VoiceChannelInfoSchema.nullable(),
	/** VC 参加者一覧 */
	participants: z.array(ParticipantSchema),
	/** 録音状態 */
	recording: RecordingStateSchema,
	/** Discordトークンと Soniox キーが両方設定済みか */
	settingsConfigured: z.boolean(),
	/** 進行中の議事録セッションID（無ければ null） */
	currentSessionId: z.string().nullable(),
});
/** Bot 全体の現在状態 */
export type BotStatus = z.infer<typeof BotStatusSchema>;
