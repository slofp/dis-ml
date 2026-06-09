import type {
	BotConnectionState,
	LiveEvent,
	Participant,
	RecordingState,
	TranscriptEntry,
	VoiceChannelInfo,
} from "@dis-ml/contract";
import { client } from "$lib/api/client";

/** 画面に表示するログ1行 */
export type LogLine = {
	/** レベル */
	level: "info" | "warn" | "error";
	/** 本文 */
	message: string;
	/** 時刻（epoch ミリ秒） */
	at: number;
};

/** タイムラインの最大保持件数 */
const MAX_TIMELINE = 500;
/** ログの最大保持件数 */
const MAX_LOGS = 200;
/** 再接続までの待機（ミリ秒） */
const RECONNECT_DELAY = 1500;

/** アプリ全体のリアクティブ状態の型 */
type AppState = {
	/** バックエンド（SSE）に接続できているか */
	serverOnline: boolean;
	/** Discord 接続状態 */
	connection: BotConnectionState;
	/** 参加中VC */
	voice: VoiceChannelInfo | null;
	/** 参加者一覧 */
	participants: Participant[];
	/** 録音状態 */
	recording: RecordingState;
	/** 進行中セッションID */
	currentSessionId: string | null;
	/** 設定が揃っているか */
	settingsConfigured: boolean;
	/** STT タイムライン */
	timeline: TranscriptEntry[];
	/** ログ */
	logs: LogLine[];
};

/** アプリ全体のリアクティブ状態 */
export const app: AppState = $state({
	serverOnline: false,
	connection: "disconnected",
	voice: null,
	participants: [],
	recording: { active: false, startedAt: null, sessionId: null },
	currentSessionId: null,
	settingsConfigured: false,
	timeline: [],
	logs: [],
});

/** タイムラインへエントリを反映する（暫定は置換、確定は暫定を消して追加） */
const upsertTimeline = (entry: TranscriptEntry): void => {
	if (entry.isFinal) {
		const interimId = `live-${entry.userId}`;
		app.timeline = [
			...app.timeline.filter((item) => item.id !== interimId),
			entry,
		];
	} else {
		const index = app.timeline.findIndex((item) => item.id === entry.id);
		if (index === -1) {
			app.timeline = [...app.timeline, entry];
		} else {
			app.timeline = app.timeline.map((item) =>
				item.id === entry.id ? entry : item,
			);
		}
	}
	if (app.timeline.length > MAX_TIMELINE) {
		app.timeline = app.timeline.slice(app.timeline.length - MAX_TIMELINE);
	}
};

/** ライブイベントを状態へ適用する */
const applyEvent = (event: LiveEvent): void => {
	switch (event.type) {
		case "status": {
			app.connection = event.connection;
			app.voice = event.voice;
			app.currentSessionId = event.sessionId;
			break;
		}
		case "participants": {
			app.participants = event.participants;
			break;
		}
		case "transcript": {
			upsertTimeline(event.entry);
			break;
		}
		case "recording": {
			app.recording = event.state;
			break;
		}
		case "log": {
			app.logs = [
				...app.logs.slice(Math.max(0, app.logs.length - MAX_LOGS + 1)),
				{ level: event.level, message: event.message, at: event.at },
			];
			break;
		}
	}
};

/** 指定ミリ秒待機する */
const delay = (ms: number): Promise<void> => {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
};

/** ライブ購読が動作中か */
let streaming = false;

/** 初期状態を取得し、ライブイベント購読を開始する */
export const initApp = async (): Promise<void> => {
	if (streaming) {
		return;
	}
	streaming = true;
	await refreshSnapshot();
	// 購読ループは内部で例外を握りつぶし継続するため、ここでは待たない
	runStream().catch(() => undefined);
};

/** 現在状態とタイムラインをサーバから取得する */
export const refreshSnapshot = async (): Promise<void> => {
	try {
		const status = await client.bot.getStatus();
		app.connection = status.connection;
		app.voice = status.voice;
		app.participants = status.participants;
		app.recording = status.recording;
		app.currentSessionId = status.currentSessionId;
		app.settingsConfigured = status.settingsConfigured;
		app.timeline = await client.transcript.getCurrent();
		app.serverOnline = true;
	} catch {
		// 理由: サーバ未起動などは serverOnline=false として扱い、購読側で再試行する
		app.serverOnline = false;
	}
};

/** ライブイベントを購読し続ける（切断時は再接続） */
const runStream = async (): Promise<void> => {
	while (streaming) {
		try {
			const iterator = await client.live.events(undefined, {});
			app.serverOnline = true;
			for await (const event of iterator) {
				applyEvent(event);
			}
		} catch {
			// 理由: 接続断は想定内。少し待って再接続する
			app.serverOnline = false;
		}
		await delay(RECONNECT_DELAY);
	}
};

/** クライアント側のメッセージをログへ追加する */
export const pushLog = (level: LogLine["level"], message: string): void => {
	app.logs = [
		...app.logs.slice(Math.max(0, app.logs.length - MAX_LOGS + 1)),
		{ level, message, at: Date.now() },
	];
};

/** 例外を表示用メッセージへ変換する */
export const describeError = (error: unknown): string => {
	return error instanceof Error ? error.message : String(error);
};

/** Discord へ接続する */
export const connectBot = async (): Promise<void> => {
	const status = await client.bot.connect();
	app.connection = status.connection;
};

/** Discord から切断する */
export const disconnectBot = async (): Promise<void> => {
	await client.bot.disconnect();
};

/** 参加可能なボイスチャンネル一覧を取得する */
export const listVoiceChannels = async () => {
	return client.voice.listChannels();
};

/** 指定したVCへ手動で参加する */
export const joinVoiceChannel = async (channelId: string): Promise<void> => {
	await client.voice.join({ channelId });
};

/** 現在のVCから退出する */
export const leaveVoice = async (): Promise<void> => {
	await client.voice.leave();
};

/** 録音を開始する */
export const startRecording = async (): Promise<void> => {
	app.recording = await client.recording.start();
};

/** 録音を停止する */
export const stopRecording = async (): Promise<void> => {
	app.recording = await client.recording.stop();
};

/**
 * 開発時のデザイン確認用にサンプルデータを投入する。
 * `import.meta.env.DEV` かつ URL に `?demo` がある場合のみ呼ばれる想定。
 */
export const seedDemo = (): void => {
	const base = 1_780_000_000_000;
	app.serverOnline = true;
	app.connection = "connected";
	app.settingsConfigured = true;
	app.voice = {
		guildId: "g1",
		guildName: "開発合宿サーバー",
		channelId: "c1",
		channelName: "general-voice",
		joinedAt: Date.now() - 1000 * 60 * 23,
	};
	app.recording = {
		active: true,
		startedAt: Date.now() - 1000 * 60 * 12,
		sessionId: "s1",
	};
	app.participants = [
		{
			userId: "u1",
			username: "haru",
			displayName: "はる",
			avatarUrl: null,
			isBot: false,
			isSpeaking: true,
			isSelfMuted: false,
			isSelfDeafened: false,
			joinedAt: base,
		},
		{
			userId: "u2",
			username: "minato_dev",
			displayName: "みなと",
			avatarUrl: null,
			isBot: false,
			isSpeaking: false,
			isSelfMuted: true,
			isSelfDeafened: false,
			joinedAt: base,
		},
		{
			userId: "u3",
			username: "sora",
			displayName: "そら",
			avatarUrl: null,
			isBot: false,
			isSpeaking: false,
			isSelfMuted: false,
			isSelfDeafened: true,
			joinedAt: base,
		},
		{
			userId: "bot",
			username: "minutes_bot",
			displayName: "議事録Bot",
			avatarUrl: null,
			isBot: true,
			isSpeaking: false,
			isSelfMuted: true,
			isSelfDeafened: false,
			joinedAt: base,
		},
	];
	app.timeline = [
		{
			id: "t1",
			sessionId: "s1",
			userId: "u1",
			displayName: "はる",
			text: "では定例を始めます。今日のアジェンダは三つです。",
			startMs: 0,
			endMs: 3200,
			isFinal: true,
			language: "ja",
			createdAt: Date.now() - 1000 * 90,
		},
		{
			id: "t2",
			sessionId: "s1",
			userId: "u2",
			displayName: "みなと",
			text: "了解です。まず先週のリリースの振り返りからお願いします。",
			startMs: 3300,
			endMs: 7100,
			isFinal: true,
			language: "ja",
			createdAt: Date.now() - 1000 * 70,
		},
		{
			id: "t3",
			sessionId: "s1",
			userId: "u3",
			displayName: "そら",
			text: "デプロイは問題なかったのですが、STTのレイテンシが少し気になりました。",
			startMs: 7200,
			endMs: 12000,
			isFinal: true,
			language: "ja",
			createdAt: Date.now() - 1000 * 45,
		},
		{
			id: "live-u1",
			sessionId: "s1",
			userId: "u1",
			displayName: "はる",
			text: "なるほど、ではその点を次のスプリントで",
			startMs: 12100,
			endMs: null,
			isFinal: false,
			language: "ja",
			createdAt: Date.now(),
		},
	];
	app.logs = [
		{ level: "info", message: "VC「general-voice」に参加しました。", at: Date.now() - 1000 * 60 },
		{ level: "info", message: "録音を開始しました。", at: Date.now() - 1000 * 60 * 12 },
	];
};
