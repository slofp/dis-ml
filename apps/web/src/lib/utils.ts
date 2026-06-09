import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind のクラス文字列をマージするユーティリティ（shadcn-svelte 標準）。
 * 競合するユーティリティは後勝ちで解決される。
 * @param inputs - 結合する class 値
 * @returns マージ済みの class 文字列
 */
export const cn = (...inputs: ClassValue[]) => {
	return twMerge(clsx(inputs));
};

/** `child` スニペットを除いた型 */
export type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, "child"> : T;
/** `children` スニペットを除いた型 */
export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, "children"> : T;
/** `child` / `children` の両方を除いた型 */
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
/** `ref`（バインド用の要素参照）を付与した型 */
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
	/** バインドされる DOM 要素参照 */
	ref?: U | null;
};
