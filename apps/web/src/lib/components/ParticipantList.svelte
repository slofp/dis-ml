<script lang="ts">
	import { app } from "$lib/state/app.svelte";
	import Users from "@lucide/svelte/icons/users";
	import ParticipantCard from "./ParticipantCard.svelte";

	const participants = $derived(app.participants);
</script>

<section class="flex min-h-0 flex-1 flex-col gap-3 rounded-md border border-border bg-card p-4">
	<header class="flex items-center justify-between">
		<h2 class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase">
			<Users class="size-3.5" />参加者
		</h2>
		<span class="rounded-sm bg-secondary px-1.5 py-0.5 text-xs font-bold tabular-nums">
			{participants.length}
		</span>
	</header>

	<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
		{#each participants as participant (participant.userId)}
			<ParticipantCard {participant} />
		{:else}
			<div class="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
				<Users class="size-8 text-muted-foreground/40" />
				<p class="text-sm text-muted-foreground">VCに参加者がいません</p>
			</div>
		{/each}
	</div>
</section>
