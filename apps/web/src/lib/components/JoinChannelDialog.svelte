<script lang="ts">
	import type { GuildVoiceChannels } from "@dis-ml/contract";
	import Dialog from "$lib/components/ui/dialog/Dialog.svelte";
	import DialogContent from "$lib/components/ui/dialog/DialogContent.svelte";
	import DialogDescription from "$lib/components/ui/dialog/DialogDescription.svelte";
	import DialogHeader from "$lib/components/ui/dialog/DialogHeader.svelte";
	import DialogTitle from "$lib/components/ui/dialog/DialogTitle.svelte";
	import {
		describeError,
		joinVoiceChannel,
		listVoiceChannels,
		pushLog,
	} from "$lib/state/app.svelte";
	import LoaderCircle from "@lucide/svelte/icons/loader-circle";
	import Volume2 from "@lucide/svelte/icons/volume-2";

	type Props = {
		/** 開閉状態（双方向） */
		open: boolean;
	};

	let { open = $bindable() }: Props = $props();

	let guilds = $state<GuildVoiceChannels[]>([]);
	let loading = $state(false);
	let joiningId = $state<string | null>(null);

	$effect(() => {
		if (open) {
			load();
		}
	});

	/** 参加可能なVC一覧を取得する */
	const load = async (): Promise<void> => {
		loading = true;
		try {
			guilds = await listVoiceChannels();
		} catch (error) {
			pushLog("error", `VC一覧の取得に失敗: ${describeError(error)}`);
		} finally {
			loading = false;
		}
	};

	/** 指定VCへ参加する */
	const join = async (channelId: string): Promise<void> => {
		joiningId = channelId;
		try {
			await joinVoiceChannel(channelId);
			open = false;
		} catch (error) {
			pushLog("error", `VC参加に失敗: ${describeError(error)}`);
		} finally {
			joiningId = null;
		}
	};
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>VCに参加</DialogTitle>
			<DialogDescription>参加するボイスチャンネルを選択してください。</DialogDescription>
		</DialogHeader>

		<div class="flex max-h-96 min-h-32 flex-col gap-4 overflow-y-auto py-1">
			{#if loading}
				<div class="flex flex-1 items-center justify-center py-10 text-muted-foreground">
					<LoaderCircle class="size-5 animate-spin" />
				</div>
			{:else}
				{#each guilds as guild (guild.guildId)}
					<section class="flex flex-col gap-1.5">
						<h3 class="px-1 text-xs font-bold tracking-widest text-muted-foreground uppercase">
							{guild.guildName}
						</h3>
						{#each guild.channels as channel (channel.channelId)}
							<button
								type="button"
								class="flex items-center gap-2.5 rounded-md border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 disabled:opacity-50"
								disabled={joiningId !== null}
								onclick={() => join(channel.channelId)}
							>
								<Volume2 class="size-4 shrink-0 text-muted-foreground" />
								<span class="min-w-0 flex-1 truncate text-sm font-bold">{channel.channelName}</span>
								{#if joiningId === channel.channelId}
									<LoaderCircle class="size-4 shrink-0 animate-spin text-primary" />
								{:else}
									<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
										{channel.memberCount}人
									</span>
								{/if}
							</button>
						{/each}
					</section>
				{:else}
					<p class="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">
						参加可能なボイスチャンネルがありません
					</p>
				{/each}
			{/if}
		</div>
	</DialogContent>
</Dialog>
