<script lang="ts">
	import { app } from "$lib/state/app.svelte";
	import { formatClock } from "$lib/util/format";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import ChevronUp from "@lucide/svelte/icons/chevron-up";
	import Terminal from "@lucide/svelte/icons/terminal";

	let expanded = $state(false);

	const latest = $derived(app.logs.at(-1) ?? null);

	/** レベルごとの文字色クラス */
	const levelColor: Record<"info" | "warn" | "error", string> = {
		info: "text-muted-foreground",
		warn: "text-warn",
		error: "text-rec",
	};
</script>

<footer class="shrink-0 border-t border-border bg-card">
	<button
		type="button"
		class="flex w-full items-center gap-2 px-4 py-1.5 text-left"
		onclick={() => (expanded = !expanded)}
	>
		<Terminal class="size-3.5 shrink-0 text-muted-foreground" />
		{#if latest !== null}
			<span class="shrink-0 text-xs tabular-nums text-muted-foreground/70">
				{formatClock(latest.at)}
			</span>
			<span class="truncate text-xs {levelColor[latest.level]}">{latest.message}</span>
		{:else}
			<span class="text-xs text-muted-foreground/70">ログはまだありません</span>
		{/if}
		<span class="ml-auto shrink-0 text-muted-foreground">
			{#if expanded}
				<ChevronDown class="size-3.5" />
			{:else}
				<ChevronUp class="size-3.5" />
			{/if}
		</span>
	</button>

	{#if expanded}
		<ul class="flex max-h-44 flex-col gap-0.5 overflow-y-auto border-t border-border px-4 py-2">
			{#each [...app.logs].reverse() as log (`${log.at}-${log.message}`)}
				<li class="flex gap-2 text-xs">
					<span class="shrink-0 tabular-nums text-muted-foreground/70">{formatClock(log.at)}</span>
					<span class={levelColor[log.level]}>{log.message}</span>
				</li>
			{:else}
				<li class="py-2 text-center text-xs text-muted-foreground/70">ログはまだありません</li>
			{/each}
		</ul>
	{/if}
</footer>
