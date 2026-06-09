import { contract, type LiveEvent } from "@dis-ml/contract";
import { implement, ORPCError } from "@orpc/server";
import { appState } from "../core/state";
import {
	deleteSession,
	getSessionDetail,
	getTranscriptsBySession,
	listSessions,
} from "../db/repo";
import { botManager } from "../discord/bot";
import { bus } from "../events/bus";
import { getSettingsView, updateSettings } from "../settings/store";

/** 契約の実装ビルダー */
const os = implement(contract);

/** oRPC ルーター（契約の実装） */
export const router = os.router({
	bot: {
		getStatus: os.bot.getStatus.handler(() => appState.snapshot()),
		connect: os.bot.connect.handler(async () => botManager.connect()),
		disconnect: os.bot.disconnect.handler(async () => botManager.disconnect()),
	},

	voice: {
		getParticipants: os.voice.getParticipants.handler(() =>
			appState.getParticipants(),
		),
		listChannels: os.voice.listChannels.handler(() =>
			botManager.listJoinableChannels(),
		),
		join: os.voice.join.handler(async ({ input }) =>
			botManager.joinChannelById(input.channelId),
		),
		leave: os.voice.leave.handler(async () => botManager.leaveVoice()),
	},

	recording: {
		getState: os.recording.getState.handler(() => appState.getRecording()),
		start: os.recording.start.handler(() => botManager.startRecording()),
		stop: os.recording.stop.handler(() => botManager.stopRecording()),
	},

	transcript: {
		getCurrent: os.transcript.getCurrent.handler(() => {
			const sessionId = appState.getCurrentSessionId();
			return sessionId === null ? [] : getTranscriptsBySession(sessionId);
		}),
	},

	settings: {
		get: os.settings.get.handler(() => getSettingsView()),
		update: os.settings.update.handler(({ input }) => updateSettings(input)),
	},

	archive: {
		list: os.archive.list.handler(() => listSessions()),
		get: os.archive.get.handler(({ input }) => {
			const detail = getSessionDetail(input.id);
			if (detail === null) {
				throw new ORPCError("NOT_FOUND", {
					message: "指定されたセッションが見つかりません。",
				});
			}
			return detail;
		}),
		delete: os.archive.delete.handler(({ input }) => ({
			deleted: deleteSession(input.id),
		})),
	},

	live: {
		events: os.live.events.handler(async function* ({ signal }) {
			// 接続直後に現在状態のスナップショットを送る
			const snapshot = appState.snapshot();
			const initial: LiveEvent[] = [
				{
					type: "status",
					connection: snapshot.connection,
					voice: snapshot.voice,
					sessionId: snapshot.currentSessionId,
				},
				{ type: "participants", participants: snapshot.participants },
				{ type: "recording", state: snapshot.recording },
			];
			for (const event of initial) {
				yield event;
			}
			// 以降はイベントバスを購読して配信する
			for await (const event of bus.subscribe(signal)) {
				yield event;
			}
		}),
	},
});

/** ルーター型（クライアント側の型推論に使用可能） */
export type AppRouter = typeof router;
