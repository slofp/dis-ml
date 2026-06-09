<script lang="ts">
	import type { BotConnectionState } from "@dis-ml/contract";
	import Button from "$lib/components/ui/button/Button.svelte";
	import { app, describeError, leaveVoice, pushLog } from "$lib/state/app.svelte";
	import { formatDuration } from "$lib/util/format";
	import LogIn from "@lucide/svelte/icons/log-in";
	import LogOut from "@lucide/svelte/icons/log-out";
	import Radio from "@lucide/svelte/icons/radio";
	import JoinChannelDialog from "./JoinChannelDialog.svelte";
	import StatusDot from "./StatusDot.svelte";

	let joinOpen = $state(false);
	let leaving = $state(false);

	/** 現在のVCから退出する */
	const leave = async (): Promise<void> => {
		leaving = true;
		try {
			await leaveVoice();
		} catch (error) {
			pushLog("error", describeError(error));
		} finally {
			leaving = false;
		}
	};

	/** 1秒ごとに更新する現在時刻（経過表示用） */
	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => {
			clearInterval(id);
		};
	});

	/** 接続状態の表示定義 */
	const connectionView: Record<
		BotConnectionState,
		{ label: string; variant: "online" | "offline" | "warn" | "rec"; pulse: boolean }
	> = {
		disconnected: { label: "未接続", variant: "offline", pulse: false },
		connecting: { label: "接続中…", variant: "warn", pulse: true },
		connected: { label: "接続済み", variant: "online", pulse: false },
		error: { label: "エラー", variant: "rec", pulse: true },
	};

	const connection = $derived(connectionView[app.connection]);
	const sessionElapsed = $derived(
		app.voice === null ? null : formatDuration(now - app.voice.joinedAt),
	);
	const recElapsed = $derived(
		app.recording.startedAt === null
			? null
			: formatDuration(now - app.recording.startedAt),
	);
</script>

<section class="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
	<header class="flex items-center justify-between">
		<h2 class="text-xs font-bold tracking-widest text-muted-foreground uppercase">
			ステータス
		</h2>
		<div class="flex items-center gap-1.5">
			<StatusDot variant={app.serverOnline ? "online" : "offline"} />
			<span class="text-[0.625rem] text-muted-foreground">
				{app.serverOnline ? "サーバ接続" : "サーバ停止"}
			</span>
		</div>
	</header>

	<dl class="flex flex-col gap-2.5 text-sm">
		<div class="flex items-center justify-between">
			<dt class="text-muted-foreground">Discord</dt>
			<dd class="flex items-center gap-2 font-bold">
				<StatusDot variant={connection.variant} pulse={connection.pulse} />
				{connection.label}
			</dd>
		</div>

		<div class="flex items-center justify-between gap-3">
			<dt class="text-muted-foreground">VC</dt>
			<dd class="min-w-0 truncate text-right font-bold">
				{#if app.voice !== null}
					{app.voice.channelName}
				{:else}
					<span class="text-muted-foreground">—</span>
				{/if}
			</dd>
		</div>

		{#if app.voice !== null}
			<div class="flex items-center justify-between gap-3">
				<dt class="text-muted-foreground">サーバ</dt>
				<dd class="min-w-0 truncate text-right text-xs text-muted-foreground">
					{app.voice.guildName}
				</dd>
			</div>
			<div class="flex items-center justify-between">
				<dt class="text-muted-foreground">経過</dt>
				<dd class="font-bold tabular-nums">{sessionElapsed}</dd>
			</div>
		{/if}

		<div class="flex items-center justify-between border-t border-border pt-2.5">
			<dt class="flex items-center gap-1.5 text-muted-foreground">
				<Radio class="size-3.5" />録音
			</dt>
			<dd class="flex items-center gap-2 font-bold">
				{#if app.recording.active}
					<StatusDot variant="rec" pulse />
					<span class="tabular-nums text-rec">REC {recElapsed}</span>
				{:else}
					<span class="text-muted-foreground">停止中</span>
				{/if}
			</dd>
		</div>
	</dl>

	{#if app.connection === "connected"}
		<div class="border-t border-border pt-3">
			{#if app.voice === null}
				<Button variant="outline" size="sm" class="w-full" onclick={() => (joinOpen = true)}>
					<LogIn class="size-4" />VCに参加
				</Button>
			{:else}
				<Button variant="outline" size="sm" class="w-full" disabled={leaving} onclick={leave}>
					<LogOut class="size-4" />VCから退出
				</Button>
			{/if}
		</div>
	{/if}
</section>

<JoinChannelDialog bind:open={joinOpen} />
