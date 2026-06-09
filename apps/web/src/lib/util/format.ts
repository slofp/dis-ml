/**
 * 表示用フォーマッタ群。
 */

/** 2桁ゼロ埋めする */
const pad2 = (value: number): string => {
	return value < 10 ? `0${String(value)}` : String(value);
};

/**
 * epoch ミリ秒を時刻（HH:MM:SS）へ整形する。
 * @param epochMs epoch ミリ秒
 * @returns "HH:MM:SS"
 */
export const formatClock = (epochMs: number): string => {
	const date = new Date(epochMs);
	return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
};

/**
 * epoch ミリ秒を日時（YYYY/MM/DD HH:MM）へ整形する。
 * @param epochMs epoch ミリ秒
 * @returns "YYYY/MM/DD HH:MM"
 */
export const formatDateTime = (epochMs: number): string => {
	const date = new Date(epochMs);
	const y = String(date.getFullYear());
	return `${y}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

/**
 * 経過ミリ秒を H:MM:SS / M:SS へ整形する。
 * @param ms ミリ秒
 * @returns 経過時間表記
 */
export const formatDuration = (ms: number): string => {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) {
		return `${String(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
	}
	return `${String(minutes)}:${pad2(seconds)}`;
};

/**
 * バイト数を人間可読な単位へ整形する。
 * @param bytes バイト数
 * @returns "1.2 MB" 等
 */
export const formatBytes = (bytes: number): string => {
	if (bytes < 1024) {
		return `${String(bytes)} B`;
	}
	const units = ["KB", "MB", "GB"];
	let value = bytes / 1024;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value = value / 1024;
		unitIndex += 1;
	}
	return `${value.toFixed(1)} ${units[unitIndex] ?? "KB"}`;
};
