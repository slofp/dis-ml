import type {
	RecordingFile,
	RecordingKind,
	SessionDetail,
	SessionSummary,
	TranscriptEntry,
} from "@dis-ml/contract";
import { count, desc, eq } from "drizzle-orm";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { RECORDINGS_DIR } from "../config";
import { db } from "./index";
import { recordings, sessionParticipants, sessions, transcripts } from "./schema";

/** 新規セッション作成の入力 */
export type CreateSessionInput = {
	/** セッションID */
	id: string;
	/** ギルドID */
	guildId: string;
	/** ギルド名 */
	guildName: string;
	/** ボイスチャンネルID */
	channelId: string;
	/** ボイスチャンネル名 */
	channelName: string;
	/** 開始時刻（epoch ミリ秒） */
	startedAt: number;
};

/** 文字列を録音種別へ正規化する */
const toRecordingKind = (value: string): RecordingKind => {
	return value === "mix" ? "mix" : "user";
};

/** セッションを作成する */
export const createSession = (input: CreateSessionInput): void => {
	db.insert(sessions)
		.values({ ...input, endedAt: null })
		.run();
};

/** セッションを終了する（終了時刻を記録） */
export const endSession = (id: string, endedAt: number): void => {
	db.update(sessions).set({ endedAt }).where(eq(sessions.id, id)).run();
};

/** セッション参加者を記録する（既存なら無視） */
export const addSessionParticipant = (input: {
	sessionId: string;
	userId: string;
	username: string;
	displayName: string;
	firstSeenAt: number;
}): void => {
	db.insert(sessionParticipants).values(input).onConflictDoNothing().run();
};

/** 確定した文字起こしエントリを保存する */
export const insertTranscript = (entry: TranscriptEntry): void => {
	db.insert(transcripts)
		.values({
			id: entry.id,
			sessionId: entry.sessionId,
			userId: entry.userId,
			displayName: entry.displayName,
			text: entry.text,
			startMs: entry.startMs,
			endMs: entry.endMs,
			isFinal: entry.isFinal,
			language: entry.language,
			createdAt: entry.createdAt,
		})
		.run();
};

/** 録音ファイルのメタデータを保存する */
export const insertRecording = (file: RecordingFile): void => {
	db.insert(recordings)
		.values({
			id: file.id,
			sessionId: file.sessionId,
			kind: file.kind,
			userId: file.userId,
			displayName: file.displayName,
			fileName: file.fileName,
			sizeBytes: file.sizeBytes,
			durationMs: file.durationMs,
			createdAt: file.createdAt,
		})
		.run();
};

/** セッションごとの集計件数 */
type CountMaps = {
	/** 参加者数 */
	participants: Map<string, number>;
	/** 文字起こし件数 */
	transcripts: Map<string, number>;
	/** 録音ありのセッション集合 */
	recordings: Set<string>;
};

/** 集計件数をまとめて取得する */
const loadCountMaps = (): CountMaps => {
	const participantRows = db
		.select({ sessionId: sessionParticipants.sessionId, value: count() })
		.from(sessionParticipants)
		.groupBy(sessionParticipants.sessionId)
		.all();
	const transcriptRows = db
		.select({ sessionId: transcripts.sessionId, value: count() })
		.from(transcripts)
		.groupBy(transcripts.sessionId)
		.all();
	const recordingRows = db
		.selectDistinct({ sessionId: recordings.sessionId })
		.from(recordings)
		.all();

	return {
		participants: new Map(participantRows.map((row) => [row.sessionId, row.value])),
		transcripts: new Map(transcriptRows.map((row) => [row.sessionId, row.value])),
		recordings: new Set(recordingRows.map((row) => row.sessionId)),
	};
};

/** セッション行を概要へ変換する */
const toSummary = (
	row: typeof sessions.$inferSelect,
	counts: CountMaps,
): SessionSummary => {
	return {
		id: row.id,
		guildId: row.guildId,
		guildName: row.guildName,
		channelId: row.channelId,
		channelName: row.channelName,
		startedAt: row.startedAt,
		endedAt: row.endedAt,
		participantCount: counts.participants.get(row.id) ?? 0,
		transcriptCount: counts.transcripts.get(row.id) ?? 0,
		hasRecording: counts.recordings.has(row.id),
	};
};

/** セッション一覧（新しい順）を取得する */
export const listSessions = (): SessionSummary[] => {
	const rows = db.select().from(sessions).orderBy(desc(sessions.startedAt)).all();
	const counts = loadCountMaps();
	return rows.map((row) => toSummary(row, counts));
};

/** 文字起こし行を契約型へ変換する */
const toTranscriptEntry = (
	row: typeof transcripts.$inferSelect,
): TranscriptEntry => {
	return {
		id: row.id,
		sessionId: row.sessionId,
		userId: row.userId,
		displayName: row.displayName,
		text: row.text,
		startMs: row.startMs,
		endMs: row.endMs,
		isFinal: row.isFinal,
		language: row.language,
		createdAt: row.createdAt,
	};
};

/** 録音行を契約型へ変換する */
const toRecordingFile = (
	row: typeof recordings.$inferSelect,
): RecordingFile => {
	return {
		id: row.id,
		sessionId: row.sessionId,
		kind: toRecordingKind(row.kind),
		userId: row.userId,
		displayName: row.displayName,
		fileName: row.fileName,
		sizeBytes: row.sizeBytes,
		durationMs: row.durationMs,
		createdAt: row.createdAt,
	};
};

/** セッション詳細を取得する（存在しなければ null） */
export const getSessionDetail = (id: string): SessionDetail | null => {
	const row = db.select().from(sessions).where(eq(sessions.id, id)).get();
	if (row === undefined) {
		return null;
	}
	const counts = loadCountMaps();
	const entries = db
		.select()
		.from(transcripts)
		.where(eq(transcripts.sessionId, id))
		.orderBy(transcripts.createdAt)
		.all()
		.map(toTranscriptEntry);
	const files = db
		.select()
		.from(recordings)
		.where(eq(recordings.sessionId, id))
		.all()
		.map(toRecordingFile);

	return { session: toSummary(row, counts), entries, recordings: files };
};

/** 現在進行中のセッションの文字起こしエントリを取得する */
export const getTranscriptsBySession = (id: string): TranscriptEntry[] => {
	return db
		.select()
		.from(transcripts)
		.where(eq(transcripts.sessionId, id))
		.orderBy(transcripts.createdAt)
		.all()
		.map(toTranscriptEntry);
};

/** セッションを削除する（録音ファイルも削除） */
export const deleteSession = (id: string): boolean => {
	const row = db.select().from(sessions).where(eq(sessions.id, id)).get();
	if (row === undefined) {
		return false;
	}
	// 録音ファイルのディレクトリごと削除（存在しなくてもエラーにしない）
	rmSync(join(RECORDINGS_DIR, id), { recursive: true, force: true });

	db.delete(transcripts).where(eq(transcripts.sessionId, id)).run();
	db.delete(recordings).where(eq(recordings.sessionId, id)).run();
	db.delete(sessionParticipants).where(eq(sessionParticipants.sessionId, id)).run();
	db.delete(sessions).where(eq(sessions.id, id)).run();
	return true;
};
