import type {
	BotConnectionState,
	BotStatus,
	Participant,
	RecordingState,
	VoiceChannelInfo,
} from "@dis-ml/contract";
import { bus } from "../events/bus";

/**
 * Bot のメモリ上の現在状態。
 * 変更時にイベントバスへ通知し、フロントへリアルタイム反映する。
 */
class AppState {
	/** Discord 接続状態 */
	private connection: BotConnectionState = "disconnected";
	/** 参加中VC（未参加なら null） */
	private voice: VoiceChannelInfo | null = null;
	/** 参加者（userId → Participant） */
	private readonly participants = new Map<string, Participant>();
	/** 録音状態 */
	private recording: RecordingState = {
		active: false,
		startedAt: null,
		sessionId: null,
	};
	/** 進行中の議事録セッションID */
	private currentSessionId: string | null = null;
	/** Discordトークンと Soniox キーが揃っているか */
	private settingsConfigured = false;

	/** 現在の接続状態 */
	getConnection(): BotConnectionState {
		return this.connection;
	}

	/** 接続状態を設定し通知する */
	setConnection(connection: BotConnectionState): void {
		this.connection = connection;
		this.emitStatus();
	}

	/** 参加中VC */
	getVoice(): VoiceChannelInfo | null {
		return this.voice;
	}

	/** 参加中VCを設定し通知する */
	setVoice(voice: VoiceChannelInfo | null): void {
		this.voice = voice;
		this.emitStatus();
	}

	/** 進行中セッションID */
	getCurrentSessionId(): string | null {
		return this.currentSessionId;
	}

	/** 進行中セッションIDを設定する（通知は呼び出し側に委ねる） */
	setCurrentSessionId(sessionId: string | null): void {
		this.currentSessionId = sessionId;
	}

	/** 設定が揃っているか */
	isSettingsConfigured(): boolean {
		return this.settingsConfigured;
	}

	/** 設定の充足状態を更新し通知する */
	setSettingsConfigured(configured: boolean): void {
		this.settingsConfigured = configured;
		this.emitStatus();
	}

	/** 参加者一覧（配列） */
	getParticipants(): Participant[] {
		return [...this.participants.values()];
	}

	/** 参加者をまとめて置き換え通知する */
	setParticipants(participants: Participant[]): void {
		this.participants.clear();
		for (const participant of participants) {
			this.participants.set(participant.userId, participant);
		}
		bus.publishParticipants(this.getParticipants());
	}

	/** 参加者を追加/更新し通知する */
	upsertParticipant(participant: Participant): void {
		this.participants.set(participant.userId, participant);
		bus.publishParticipants(this.getParticipants());
	}

	/** 参加者を削除し通知する */
	removeParticipant(userId: string): void {
		if (this.participants.delete(userId)) {
			bus.publishParticipants(this.getParticipants());
		}
	}

	/** 指定ユーザーの発話状態を更新し通知する */
	setSpeaking(userId: string, isSpeaking: boolean): void {
		const participant = this.participants.get(userId);
		if (participant === undefined || participant.isSpeaking === isSpeaking) {
			return;
		}
		this.participants.set(userId, { ...participant, isSpeaking });
		bus.publishParticipants(this.getParticipants());
	}

	/** 録音状態 */
	getRecording(): RecordingState {
		return this.recording;
	}

	/** 録音状態を設定し通知する */
	setRecording(recording: RecordingState): void {
		this.recording = recording;
		bus.publishRecording(recording);
	}

	/** 現在状態のスナップショットを返す */
	snapshot(): BotStatus {
		return {
			connection: this.connection,
			voice: this.voice,
			participants: this.getParticipants(),
			recording: this.recording,
			settingsConfigured: this.settingsConfigured,
			currentSessionId: this.currentSessionId,
		};
	}

	/** 接続/VC/セッションの状態イベントを配信する */
	emitStatus(): void {
		bus.publishStatus(this.connection, this.voice, this.currentSessionId);
	}
}

/** アプリ全体で共有する状態 */
export const appState = new AppState();
