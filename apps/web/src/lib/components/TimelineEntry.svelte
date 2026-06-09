<script lang="ts">
	import type { TranscriptEntry } from "@dis-ml/contract";
	import { formatClock } from "$lib/util/format";

	type Props = {
		/** 文字起こしエントリ */
		entry: TranscriptEntry;
	};

	let { entry }: Props = $props();
</script>

<article class="flex gap-3 px-1 py-1.5">
	<time
		class="mt-0.5 shrink-0 text-xs tabular-nums text-muted-foreground/70"
		datetime={new Date(entry.createdAt).toISOString()}
	>
		{formatClock(entry.createdAt)}
	</time>
	<div class="min-w-0 flex-1">
		<span class="mr-2 text-sm font-bold text-primary">{entry.displayName}</span>
		<span
			class="text-sm leading-relaxed break-words"
			class:text-foreground={entry.isFinal}
			class:text-muted-foreground={!entry.isFinal}
		>
			{entry.text}{#if !entry.isFinal}<span class="caret">▋</span>{/if}
		</span>
	</div>
</article>

<style>
	.caret {
		margin-left: 1px;
		color: var(--primary);
		animation: caret-blink 1s steps(2, start) infinite;
	}

	@keyframes caret-blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
	}
</style>
