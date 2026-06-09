<script lang="ts">
	import Button from "$lib/components/ui/button/Button.svelte";
	import {
		app,
		connectBot,
		describeError,
		disconnectBot,
		pushLog,
		startRecording,
		stopRecording,
	} from "$lib/state/app.svelte";
	import LoaderCircle from "@lucide/svelte/icons/loader-circle";
	import Power from "@lucide/svelte/icons/power";
	import PlugZap from "@lucide/svelte/icons/plug-zap";
	import Radio from "@lucide/svelte/icons/radio";
	import Settings from "@lucide/svelte/icons/settings";
	import Square from "@lucide/svelte/icons/square";
	import StatusDot from "./StatusDot.svelte";

	type Props = {
		/** 設定ダイアログを開く */
		onOpenSettings: () => void;
	};

	let { onOpenSettings }: Props = $props();

	let recordBusy = $state(false);

	const connecting = $derived(app.connection === "connecting");
	const connected = $derived(app.connection === "connected");
	const inVoice = $derived(app.voice !== null);

	/** 接続トグル（接続/切断） */
	const toggleConnection = async (): Promise<void> => {
		try {
			if (connected) {
				await disconnectBot();
			} else {
				await connectBot();
			}
		} catch (error) {
			pushLog("error", describeError(error));
		}
	};

	/** 録音トグル（開始/停止） */
	const toggleRecording = async (): Promise<void> => {
		recordBusy = true;
		try {
			if (app.recording.active) {
				await stopRecording();
			} else {
				await startRecording();
			}
		} catch (error) {
			pushLog("error", describeError(error));
		} finally {
			recordBusy = false;
		}
	};
</script>

<header
	class="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4"
>
	<div class="flex items-center gap-3">
		<div class="leading-tight">
			<h1 class="text-sm font-extrabold tracking-wide">コンソールダッシュボード</h1>
			<p class="text-[0.625rem] tracking-widest text-muted-foreground uppercase">
				Discord Meeting Logger
			</p>
		</div>

		{#if inVoice && app.voice !== null}
			<div class="ml-2 flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1">
				<StatusDot variant="online" pulse />
				<span class="max-w-40 truncate text-xs font-bold">{app.voice.channelName}</span>
			</div>
		{/if}
	</div>

	<div class="flex items-center gap-2">
		<Button
			variant={app.recording.active ? "destructive" : "outline"}
			size="sm"
			disabled={!inVoice || recordBusy}
			onclick={toggleRecording}
		>
			{#if recordBusy}
				<LoaderCircle class="size-4 animate-spin" />
			{:else if app.recording.active}
				<Square class="size-4 fill-current" />
			{:else}
				<Radio class="size-4" />
			{/if}
			{app.recording.active ? "録音停止" : "録音"}
		</Button>

		<Button
			variant={connected ? "outline" : "default"}
			size="sm"
			disabled={connecting || (!connected && !app.settingsConfigured)}
			onclick={toggleConnection}
		>
			{#if connecting}
				<LoaderCircle class="size-4 animate-spin" />
			{:else if connected}
				<Power class="size-4" />
			{:else}
				<PlugZap class="size-4" />
			{/if}
			{connected ? "切断" : "接続"}
		</Button>

		<Button variant="ghost" size="icon" aria-label="設定" onclick={onOpenSettings}>
			<Settings class="size-4.5" />
		</Button>
	</div>
</header>
