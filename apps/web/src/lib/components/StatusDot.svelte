<script lang="ts">
	import { cn } from "$lib/utils";

	/** 表示バリアント */
	type Variant = "online" | "offline" | "rec" | "warn" | "active";

	type Props = {
		/** 状態バリアント */
		variant?: Variant;
		/** 点滅させるか */
		pulse?: boolean;
		/** 追加クラス */
		class?: string;
	};

	let { variant = "offline", pulse = false, class: className }: Props = $props();

	/** バリアントごとの色クラス */
	const colorByVariant: Record<Variant, string> = {
		online: "bg-live",
		offline: "bg-muted-foreground",
		rec: "bg-rec",
		warn: "bg-warn",
		active: "bg-primary",
	};
</script>

<span class={cn("relative inline-flex size-2.5 shrink-0", className)}>
	{#if pulse}
		<span
			class={cn(
				"absolute inline-flex size-full animate-ping rounded-full opacity-60",
				colorByVariant[variant],
			)}
		></span>
	{/if}
	<span
		class={cn(
			"relative inline-flex size-2.5 rounded-full",
			colorByVariant[variant],
		)}
	></span>
</span>
