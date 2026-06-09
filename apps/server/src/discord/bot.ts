import type {
	BotStatus,
	GuildVoiceChannels,
	Participant,
	RecordingState,
	VoiceChannelOption,
} from "@dis-ml/contract";
import {
	type VoiceConnection,
	entersState,
	joinVoiceChannel,
	VoiceConnectionStatus,
} from "@discordjs/voice";
import { ORPCError } from "@orpc/server";
import type { SonioxNodeClient } from "@soniox/node";
import {
	Client,
	Events,
	GatewayIntentBits,
	type GuildMember,
	type VoiceBasedChannel,
	type VoiceState,
} from "discord.js";
import { randomUUID } from "node:crypto";
import { appState } from "../core/state";
import {
	addSessionParticipant,
	createSession,
	endSession,
	insertRecording,
	insertTranscript,
} from "../db/repo";
import { bus } from "../events/bus";
import { getStoredSettings } from "../settings/store";
import { createSonioxClient } from "../stt/soniox";
import { VoiceSession } from "./voice";

/** 例外を表示用メッセージへ変換する */
const describeError = (error: unknown): string => {
	return error instanceof Error ? error.message : String(error);
};

/** GuildMember から参加者情報を構築する（発話状態は引き継ぎ） */
const participantFromMember = (
	member: GuildMember,
	wasSpeaking: boolean,
): Participant => {
	return {
		userId: member.id,
		username: member.user.username,
		displayName: member.displayName,
		avatarUrl: member.user.displayAvatarURL(),
		isBot: member.user.bot,
		isSpeaking: wasSpeaking,
		isSelfMuted: member.voice.selfMute ?? false,
		isSelfDeafened: member.voice.selfDeaf ?? false,
		joinedAt: Date.now(),
	};
};

/**
 * Discord Bot の統括。接続・VC追従・参加者追跡・録音制御・永続化を行う。
 * ソフトウェア的に動作し、オーナーのVC入退室へ追従する。
 */
class BotManager {
	private client: Client | null = null;
	private connection: VoiceConnection | null = null;
	private voiceSession: VoiceSession | null = null;
	private sonioxClient: SonioxNodeClient | null = null;
	/** 参加者の表示名キャッシュ（userId → 表示名） */
	private readonly memberNames = new Map<string, string>();

	/** Discord へ接続する */
	async connect(): Promise<BotStatus> {
		if (this.client !== null) {
			return appState.snapshot();
		}
		const settings = getStoredSettings();
		if (settings.discordToken === null) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Discord Bot トークンが未設定です。設定画面で入力してください。",
			});
		}

		this.sonioxClient =
			settings.sonioxApiKey === null
				? null
				: createSonioxClient(settings.sonioxApiKey);

		const client = new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildVoiceStates,
			],
		});
		this.client = client;
		this.registerHandlers(client);

		appState.setConnection("connecting");
		try {
			await client.login(settings.discordToken);
		} catch (error) {
			this.client = null;
			appState.setConnection("error");
			throw new ORPCError("BAD_REQUEST", {
				message: `Discord 接続に失敗しました: ${describeError(error)}`,
				cause: error,
			});
		}
		return appState.snapshot();
	}

	/** Discord から切断する */
	async disconnect(): Promise<BotStatus> {
		await this.leaveVoice();
		if (this.client !== null) {
			await this.client.destroy();
			this.client = null;
		}
		this.sonioxClient = null;
		appState.setConnection("disconnected");
		return appState.snapshot();
	}

	/** 現在のVCから退出する（接続自体は維持） */
	async leaveVoice(): Promise<BotStatus> {
		if (this.voiceSession !== null) {
			if (this.voiceSession.isRecording()) {
				this.persistRecordings();
			}
			await this.voiceSession.destroy();
			this.voiceSession = null;
		}
		const sessionId = appState.getCurrentSessionId();
		if (sessionId !== null) {
			endSession(sessionId, Date.now());
		}
		if (this.connection !== null) {
			this.connection.destroy();
			this.connection = null;
		}
		appState.setCurrentSessionId(null);
		appState.setVoice(null);
		appState.setParticipants([]);
		appState.setRecording({ active: false, startedAt: null, sessionId: null });
		this.memberNames.clear();
		return appState.snapshot();
	}

	/** 参加可能なボイスチャンネルを一覧する（ギルドごと） */
	listJoinableChannels(): GuildVoiceChannels[] {
		if (this.client === null) {
			return [];
		}
		const result: GuildVoiceChannels[] = [];
		for (const guild of this.client.guilds.cache.values()) {
			const channels: VoiceChannelOption[] = [];
			for (const channel of guild.channels.cache.values()) {
				if (channel.isVoiceBased()) {
					channels.push({
						channelId: channel.id,
						channelName: channel.name,
						memberCount: channel.members.size,
					});
				}
			}
			if (channels.length > 0) {
				result.push({
					guildId: guild.id,
					guildName: guild.name,
					channels,
				});
			}
		}
		return result;
	}

	/** 指定したボイスチャンネルへ手動で参加する */
	async joinChannelById(channelId: string): Promise<BotStatus> {
		if (this.client === null) {
			throw new ORPCError("BAD_REQUEST", {
				message: "先に Discord へ接続してください。",
			});
		}
		for (const guild of this.client.guilds.cache.values()) {
			const channel = guild.channels.cache.get(channelId);
			if (channel?.isVoiceBased() === true) {
				await this.joinChannel(channel);
				return appState.snapshot();
			}
		}
		throw new ORPCError("NOT_FOUND", {
			message: "指定されたボイスチャンネルが見つかりません。",
		});
	}

	/** 録音を開始する */
	startRecording(): RecordingState {
		if (this.voiceSession === null) {
			throw new ORPCError("BAD_REQUEST", {
				message: "VCに参加していないため録音できません。",
			});
		}
		const sessionId = appState.getCurrentSessionId();
		this.voiceSession.startRecording();
		const state: RecordingState = {
			active: true,
			startedAt: Date.now(),
			sessionId,
		};
		appState.setRecording(state);
		bus.log("info", "録音を開始しました。");
		return state;
	}

	/** 録音を停止する */
	stopRecording(): RecordingState {
		if (this.voiceSession?.isRecording() === true) {
			this.persistRecordings();
		}
		const state: RecordingState = {
			active: false,
			startedAt: null,
			sessionId: null,
		};
		appState.setRecording(state);
		bus.log("info", "録音を停止しました。");
		return state;
	}

	/** 録音を停止しメタデータを永続化する */
	private persistRecordings(): void {
		if (this.voiceSession === null) {
			return;
		}
		const sessionId = appState.getCurrentSessionId();
		const results = this.voiceSession.stopRecording();
		if (sessionId === null) {
			return;
		}
		for (const result of results) {
			insertRecording({
				id: randomUUID(),
				sessionId,
				kind: result.kind,
				userId: result.userId,
				displayName: result.displayName,
				fileName: result.fileName,
				sizeBytes: result.sizeBytes,
				durationMs: result.durationMs,
				createdAt: Date.now(),
			});
		}
	}

	/** Discord クライアントのイベントを登録する */
	private registerHandlers(client: Client): void {
		client.once(Events.ClientReady, (ready) => {
			appState.setConnection("connected");
			bus.log("info", `Discord に接続しました（${ready.user.tag}）。`);
			this.followOwnerInitial().catch((error: unknown) => {
				bus.log("error", `オーナー追従に失敗しました: ${describeError(error)}`);
			});
		});
		client.on(Events.VoiceStateUpdate, (oldState, newState) => {
			this.onVoiceStateUpdate(oldState, newState).catch((error: unknown) => {
				bus.log("error", `VC状態更新の処理に失敗しました: ${describeError(error)}`);
			});
		});
		client.on(Events.Error, (error) => {
			bus.log("error", `Discord クライアントエラー: ${error.message}`);
		});
	}

	/** 接続直後、オーナーが既にVCに居れば追従する */
	private async followOwnerInitial(): Promise<void> {
		const settings = getStoredSettings();
		if (!settings.autoFollowOwner || settings.ownerUserId === null) {
			return;
		}
		const ownerId = settings.ownerUserId;
		if (this.client === null) {
			return;
		}
		for (const guild of this.client.guilds.cache.values()) {
			try {
				const member = await guild.members.fetch(ownerId);
				const channel = member.voice.channel;
				if (channel !== null) {
					await this.joinChannel(channel);
					return;
				}
			} catch {
				// 理由: 対象ギルドにオーナーが居ない場合は無視して次を探す
			}
		}
	}

	/** VC状態変化のハンドラ（追従 + 参加者更新） */
	private async onVoiceStateUpdate(
		oldState: VoiceState,
		newState: VoiceState,
	): Promise<void> {
		await this.handleOwnerFollow(newState);
		this.refreshParticipantsIfRelevant(oldState, newState);
	}

	/** オーナー追従の処理 */
	private async handleOwnerFollow(newState: VoiceState): Promise<void> {
		const settings = getStoredSettings();
		if (!settings.autoFollowOwner || settings.ownerUserId === null) {
			return;
		}
		if (newState.id !== settings.ownerUserId) {
			return;
		}
		const targetChannel = newState.channel;
		if (targetChannel === null) {
			// オーナーが退出 → Bot も退出
			await this.leaveVoice();
			return;
		}
		if (targetChannel.id !== appState.getVoice()?.channelId) {
			await this.joinChannel(targetChannel);
		}
	}

	/** 現在のVCに関係する変化なら参加者一覧を更新する */
	private refreshParticipantsIfRelevant(
		oldState: VoiceState,
		newState: VoiceState,
	): void {
		const currentChannelId = appState.getVoice()?.channelId;
		if (currentChannelId === undefined) {
			return;
		}
		if (
			oldState.channelId !== currentChannelId &&
			newState.channelId !== currentChannelId
		) {
			return;
		}
		const channel = newState.guild.channels.cache.get(currentChannelId);
		if (channel?.isVoiceBased() === true) {
			this.updateParticipants(channel);
		}
	}

	/** 指定VCへ参加し、議事録セッションを開始する */
	private async joinChannel(channel: VoiceBasedChannel): Promise<void> {
		if (appState.getVoice()?.channelId === channel.id) {
			return;
		}
		await this.leaveVoice();

		const connection = joinVoiceChannel({
			channelId: channel.id,
			guildId: channel.guild.id,
			adapterCreator: channel.guild.voiceAdapterCreator,
			// 受信のため自分はスピーカーオフにしない。送信はしないためミュート。
			selfDeaf: false,
			selfMute: true,
		});
		this.connection = connection;

		try {
			await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
		} catch (error) {
			connection.destroy();
			this.connection = null;
			const message = error instanceof Error ? error.message : String(error);
			bus.log("error", `VC接続に失敗しました: ${message}`);
			return;
		}

		const sessionId = randomUUID();
		const startedAt = Date.now();
		createSession({
			id: sessionId,
			guildId: channel.guild.id,
			guildName: channel.guild.name,
			channelId: channel.id,
			channelName: channel.name,
			startedAt,
		});
		appState.setCurrentSessionId(sessionId);
		appState.setVoice({
			guildId: channel.guild.id,
			guildName: channel.guild.name,
			channelId: channel.id,
			channelName: channel.name,
			joinedAt: startedAt,
		});

		this.voiceSession = new VoiceSession({
			connection,
			sonioxClient: this.sonioxClient,
			sttModel: getStoredSettings().sttModel,
			languageHints: getStoredSettings().languageHints,
			sessionId,
			resolveDisplayName: (userId) => this.memberNames.get(userId) ?? userId,
			onEntry: (entry) => {
				bus.publishTranscript(entry);
				if (entry.isFinal) {
					insertTranscript(entry);
				}
			},
			onSpeaking: (userId, speaking) => {
				appState.setSpeaking(userId, speaking);
			},
			onError: (message) => {
				bus.log("error", message);
			},
		});
		this.voiceSession.start();

		this.updateParticipants(channel);
		bus.log("info", `VC「${channel.name}」に参加しました。`);

		// 設定で自動録音が有効なら参加と同時に録音を開始する
		if (getStoredSettings().autoRecord) {
			this.startRecording();
		}
	}

	/** チャンネルメンバーから参加者一覧を再構築する */
	private updateParticipants(channel: VoiceBasedChannel): void {
		const previous = new Map(
			appState.getParticipants().map((p) => [p.userId, p.isSpeaking]),
		);
		const participants: Participant[] = [];
		const sessionId = appState.getCurrentSessionId();
		for (const member of channel.members.values()) {
			const wasSpeaking = previous.get(member.id) ?? false;
			const participant = participantFromMember(member, wasSpeaking);
			participants.push(participant);
			this.memberNames.set(member.id, participant.displayName);
			if (sessionId !== null && !member.user.bot) {
				addSessionParticipant({
					sessionId,
					userId: member.id,
					username: participant.username,
					displayName: participant.displayName,
					firstSeenAt: Date.now(),
				});
			}
		}
		appState.setParticipants(participants);
	}
}

/** アプリ全体で共有する Bot マネージャ */
export const botManager = new BotManager();
