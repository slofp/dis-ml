import type {
	BotConnectionState,
	LiveEvent,
	LogLevel,
	Participant,
	RecordingState,
	TranscriptEntry,
	VoiceChannelInfo,
} from "@dis-ml/contract";

/** バスへの購読者（内部キュー付き） */
type Subscriber = {
	/** バッファ済みイベント */
	queue: LiveEvent[];
	/** 次イベント到着を待つ resolver（待機していなければ null） */
	resolve: (() => void) | null;
	/** 購読が終了したか */
	closed: boolean;
};

/**
 * サーバ→クライアントのリアルタイムイベントを配信する単純なバス。
 * 複数購読者へファンアウトし、各購読者は AsyncGenerator で消費する。
 */
class EventBus {
	private readonly subscribers = new Set<Subscriber>();

	/** イベントを全購読者へ配信する */
	publish(event: LiveEvent): void {
		for (const subscriber of this.subscribers) {
			subscriber.queue.push(event);
			if (subscriber.resolve !== null) {
				const wake = subscriber.resolve;
				subscriber.resolve = null;
				wake();
			}
		}
	}

	/**
	 * イベントを購読する。`signal` の abort で購読を終了する。
	 * @param signal 購読を中断する AbortSignal
	 * @returns イベントを順次返す非同期ジェネレータ
	 */
	async *subscribe(signal?: AbortSignal): AsyncGenerator<LiveEvent> {
		const subscriber: Subscriber = { queue: [], resolve: null, closed: false };
		this.subscribers.add(subscriber);

		const onAbort = () => {
			subscriber.closed = true;
			if (subscriber.resolve !== null) {
				const wake = subscriber.resolve;
				subscriber.resolve = null;
				wake();
			}
		};
		if (signal !== undefined) {
			signal.addEventListener("abort", onAbort, { once: true });
		}

		try {
			while (!subscriber.closed) {
				if (subscriber.queue.length === 0) {
					await new Promise<void>((resolvePromise) => {
						subscriber.resolve = resolvePromise;
					});
					continue;
				}
				const next = subscriber.queue.shift();
				if (next !== undefined) {
					yield next;
				}
			}
		} finally {
			this.subscribers.delete(subscriber);
			if (signal !== undefined) {
				signal.removeEventListener("abort", onAbort);
			}
		}
	}

	/** 接続状態の変化を配信 */
	publishStatus(
		connection: BotConnectionState,
		voice: VoiceChannelInfo | null,
		sessionId: string | null,
	): void {
		this.publish({ type: "status", connection, voice, sessionId });
	}

	/** 参加者一覧の更新を配信 */
	publishParticipants(participants: Participant[]): void {
		this.publish({ type: "participants", participants });
	}

	/** 文字起こしエントリの追加/更新を配信 */
	publishTranscript(entry: TranscriptEntry): void {
		this.publish({ type: "transcript", entry });
	}

	/** 録音状態の変化を配信 */
	publishRecording(state: RecordingState): void {
		this.publish({ type: "recording", state });
	}

	/** ログ通知を配信し、サーバ標準出力にも記録する */
	log(level: LogLevel, message: string): void {
		const at = Date.now();
		const line = `[${level}] ${message}`;
		if (level === "error") {
			console.error(line);
		} else if (level === "warn") {
			console.warn(line);
		} else {
			console.log(line);
		}
		this.publish({ type: "log", level, message, at });
	}
}

/** アプリ全体で共有するイベントバス */
export const bus = new EventBus();
