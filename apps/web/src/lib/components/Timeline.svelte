<script lang="ts">
	import { app } from "$lib/state/app.svelte";
	import StatusDot from "./StatusDot.svelte";
	import TimelineEntry from "./TimelineEntry.svelte";
	import Activity from "@lucide/svelte/icons/activity";

	const entries = $derived(app.timeline);

	/** スクロール領域。新しい発話で自動的に最下部へ追従する */
	let scroller: HTMLDivElement | null = $state(null);

	$effect(() => {
		// entries.length を依存に取り、新規発話で最下部へ追従する
		if (entries.length >= 0 && scroller !== null) {
			scroller.scrollTop = scroller.scrollHeight;
		}
	});
</script>

<section class="flex min-h-0 flex-1 flex-col rounded-md border border-border bg-card">
	<header class="flex items-center justify-between border-b border-border px-4 py-3">
		<h2 class="flex items-center gap-2 text-sm font-bold">
			<Activity class="size-4 text-primary" />
			リアルタイム文字起こし
		</h2>
		<div class="flex items-center gap-1.5">
			<StatusDot
				variant={app.connection === "connected" ? "online" : "offline"}
				pulse={app.connection === "connected"}
			/>
			<span class="text-xs text-muted-foreground">
				{app.connection === "connected" ? "LIVE" : "待機中"}
			</span>
		</div>
	</header>

	<div bind:this={scroller} class="min-h-0 flex-1 divide-y divide-border/40 overflow-y-auto px-3 py-2">
		{#each entries as entry (entry.id)}
			<TimelineEntry {entry} />
		{:else}
			<div class="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
				<Activity class="size-9 text-muted-foreground/30" />
				<p class="text-sm text-muted-foreground">まだ文字起こしがありません</p>
				<p class="text-xs text-muted-foreground/70">
					VCに参加し、発話が始まるとここに表示されます
				</p>
			</div>
		{/each}
	</div>
</section>
