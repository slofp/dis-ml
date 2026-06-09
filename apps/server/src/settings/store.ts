import type { BotSettingsUpdate, BotSettingsView } from "@dis-ml/contract";
import { eq } from "drizzle-orm";
import { DEFAULT_BOT_SETTINGS } from "../config";
import { appState } from "../core/state";
import { db } from "../db/index";
import { appSettings } from "../db/schema";

/** 単一設定行の固定主キー */
const SETTINGS_ID = 1;

/** シークレットを含む内部用の設定（サーバ内部のみで使用） */
export type StoredSettings = {
	/** Soniox STT モデル名 */
	sttModel: string;
	/** 言語ヒント */
	languageHints: string[];
	/** オーナー自動追従 */
	autoFollowOwner: boolean;
	/** 追従対象オーナーID */
	ownerUserId: string | null;
	/** 自動録音 */
	autoRecord: boolean;
	/** Discord Bot トークン（平文／未設定は null） */
	discordToken: string | null;
	/** Soniox API キー（平文／未設定は null） */
	sonioxApiKey: string | null;
};

/** 文字列を「設定済みか」で判定する（null/空文字は未設定） */
const isFilled = (value: string | null): boolean => {
	return value !== null && value !== "";
};

/** 設定行を読み込む（無ければ既定値で作成する） */
const loadOrCreate = (): StoredSettings => {
	const row = db
		.select()
		.from(appSettings)
		.where(eq(appSettings.id, SETTINGS_ID))
		.get();

	if (row === undefined) {
		const now = Date.now();
		db.insert(appSettings)
			.values({
				id: SETTINGS_ID,
				sttModel: DEFAULT_BOT_SETTINGS.sttModel,
				languageHints: JSON.stringify(DEFAULT_BOT_SETTINGS.languageHints),
				autoFollowOwner: DEFAULT_BOT_SETTINGS.autoFollowOwner,
				ownerUserId: DEFAULT_BOT_SETTINGS.ownerUserId,
				autoRecord: DEFAULT_BOT_SETTINGS.autoRecord,
				discordToken: null,
				sonioxApiKey: null,
				updatedAt: now,
			})
			.run();
		return {
			...DEFAULT_BOT_SETTINGS,
			discordToken: null,
			sonioxApiKey: null,
		};
	}

	return {
		sttModel: row.sttModel,
		languageHints: parseLanguageHints(row.languageHints),
		autoFollowOwner: row.autoFollowOwner,
		ownerUserId: row.ownerUserId,
		autoRecord: row.autoRecord,
		discordToken: row.discordToken,
		sonioxApiKey: row.sonioxApiKey,
	};
};

/** 言語ヒントのJSON文字列を配列へ復元する（壊れていれば既定値） */
const parseLanguageHints = (raw: string): string[] => {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [...DEFAULT_BOT_SETTINGS.languageHints];
		}
		return parsed.filter((item): item is string => typeof item === "string");
	} catch {
		// 理由: 破損したJSONでも起動を妨げないよう既定値へフォールバック
		return [...DEFAULT_BOT_SETTINGS.languageHints];
	}
};

/** appState の設定充足フラグを最新化する */
const syncConfiguredFlag = (settings: StoredSettings): void => {
	const configured =
		isFilled(settings.discordToken) && isFilled(settings.sonioxApiKey);
	appState.setSettingsConfigured(configured);
};

/** シークレットを含む内部設定を取得する（Bot接続/STTで使用） */
export const getStoredSettings = (): StoredSettings => {
	return loadOrCreate();
};

/** 閲覧用の設定ビューを取得する（シークレットは設定有無のみ） */
export const getSettingsView = (): BotSettingsView => {
	const settings = loadOrCreate();
	return {
		sttModel: settings.sttModel,
		languageHints: settings.languageHints,
		autoFollowOwner: settings.autoFollowOwner,
		ownerUserId: settings.ownerUserId,
		autoRecord: settings.autoRecord,
		discordTokenSet: isFilled(settings.discordToken),
		sonioxApiKeySet: isFilled(settings.sonioxApiKey),
	};
};

/** 平文の秘密入力を保存値（null可）へ正規化する（空文字はクリア） */
const normalizeSecret = (
	input: string | undefined,
	current: string | null,
): string | null => {
	if (input === undefined) {
		return current;
	}
	return input === "" ? null : input;
};

/** 設定を更新し、最新の閲覧用ビューを返す */
export const updateSettings = (input: BotSettingsUpdate): BotSettingsView => {
	const current = loadOrCreate();

	const next: StoredSettings = {
		sttModel: input.sttModel ?? current.sttModel,
		languageHints: input.languageHints ?? current.languageHints,
		autoFollowOwner: input.autoFollowOwner ?? current.autoFollowOwner,
		ownerUserId:
			input.ownerUserId === undefined ? current.ownerUserId : input.ownerUserId,
		autoRecord: input.autoRecord ?? current.autoRecord,
		discordToken: normalizeSecret(input.discordToken, current.discordToken),
		sonioxApiKey: normalizeSecret(input.sonioxApiKey, current.sonioxApiKey),
	};

	db.update(appSettings)
		.set({
			sttModel: next.sttModel,
			languageHints: JSON.stringify(next.languageHints),
			autoFollowOwner: next.autoFollowOwner,
			ownerUserId: next.ownerUserId,
			autoRecord: next.autoRecord,
			discordToken: next.discordToken,
			sonioxApiKey: next.sonioxApiKey,
			updatedAt: Date.now(),
		})
		.where(eq(appSettings.id, SETTINGS_ID))
		.run();

	syncConfiguredFlag(next);

	return {
		sttModel: next.sttModel,
		languageHints: next.languageHints,
		autoFollowOwner: next.autoFollowOwner,
		ownerUserId: next.ownerUserId,
		autoRecord: next.autoRecord,
		discordTokenSet: isFilled(next.discordToken),
		sonioxApiKeySet: isFilled(next.sonioxApiKey),
	};
};

/** 起動時に設定充足フラグを初期化する */
export const initSettings = (): void => {
	syncConfiguredFlag(loadOrCreate());
};
