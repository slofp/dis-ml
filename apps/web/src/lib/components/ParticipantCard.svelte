<script lang="ts">
	import type { Participant } from "@dis-ml/contract";
	import Avatar from "$lib/components/ui/avatar/Avatar.svelte";
	import AvatarFallback from "$lib/components/ui/avatar/AvatarFallback.svelte";
	import AvatarImage from "$lib/components/ui/avatar/AvatarImage.svelte";
	import { cn } from "$lib/utils";
	import Bot from "@lucide/svelte/icons/bot";
	import MicOff from "@lucide/svelte/icons/mic-off";
	import VolumeOff from "@lucide/svelte/icons/volume-off";
	import SpeakingMeter from "./SpeakingMeter.svelte";

	type Props = {
		/** 参加者 */
		participant: Participant;
	};

	let { participant }: Props = $props();

	/** イニシャル（アバター代替） */
	const initial = $derived(participant.displayName.slice(0, 1).toUpperCase());
</script>

<article
	class={cn(
		"flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 transition-colors",
		participant.isSpeaking ? "border-primary/60 bg-primary/5" : "",
	)}
>
	<Avatar class="size-9 rounded-md">
		{#if participant.avatarUrl !== null}
			<AvatarImage src={participant.avatarUrl} alt={participant.displayName} />
		{/if}
		<AvatarFallback class="rounded-md bg-secondary text-xs font-bold">
			{initial}
		</AvatarFallback>
	</Avatar>

	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-1.5">
			<p class="truncate text-sm font-bold text-foreground">
				{participant.displayName}
			</p>
			{#if participant.isBot}
				<span
					class="inline-flex items-center gap-1 rounded-sm bg-secondary px-1 py-0.5 text-[0.625rem] font-bold text-muted-foreground"
				>
					<Bot class="size-2.5" />BOT
				</span>
			{/if}
		</div>
		<p class="truncate text-xs text-muted-foreground">@{participant.username}</p>
	</div>

	<div class="flex items-center gap-2">
		{#if participant.isSelfDeafened}
			<VolumeOff class="size-4 text-rec" />
		{:else if participant.isSelfMuted}
			<MicOff class="size-4 text-warn" />
		{/if}
		<SpeakingMeter active={participant.isSpeaking} />
	</div>
</article>
