<script lang="ts">
	import type { SessionDetail, SessionSummary } from "@dis-ml/contract";
	import Button from "$lib/components/ui/button/Button.svelte";
	import { client } from "$lib/api/client";
	import { describeError, pushLog } from "$lib/state/app.svelte";
	import { formatBytes, formatDateTime, formatDuration } from "$lib/util/format";
	import ArchiveIcon from "@lucide/svelte/icons/archive";
	import ArrowLeft from "@lucide/svelte/icons/arrow-left";
	import Disc3 from "@lucide/svelte/icons/disc-3";
	import RefreshCw from "@lucide/svelte/icons/refresh-cw";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import TimelineEntry from "./TimelineEntry.svelte";

	let sessions = $state<SessionSummary[]>([]);
	let detail = $state<SessionDetail | null>(null);
	let loading = $state(false);
	let confirmingId = $state<string | null>(null);

	/** セッション一覧を取得する */
	const loadList = async (): Promise<void> => {
		loading = true;
		try {
			sessions = await client.archive.list();
		} catch (error) {
			pushLog("error", `アーカイブ取得に失敗: ${describeError(error)}`);
		} finally {
			loading = false;
		}
	};

	/** セッション詳細を開く */
	const openDetail = async (id: string): Promise<void> => {
		try {
			detail = await client.archive.get({ id });
		} catch (error) {
			pushLog("error", `詳細取得に失敗: ${describeError(error)}`);
		}
	};

	/** セッションを削除する */
	const removeSession = async (id: string): Promise<void> => {
		try {
			await client.archive.delete({ id });
			confirmingId = null;
			await loadList();
		} catch (error) {
			pushLog("error", `削除に失敗: ${describeError(error)}`);
		}
	};

	/** 録音ファイルの配信URL */
	const recordingUrl = (sessionId: string, fileName: string): string => {
		return `/media/recordings/${sessionId}/${fileName}`;
	};

	$effect(() => {
		loadList();
	});
</script>

<section class="flex min-h-0 flex-1 flex-col rounded-md border border-border bg-card">
	{#if detail === null}
		<header class="flex items-center justify-between border-b border-border px-4 py-3">
			<h2 class="flex items-center gap-2 text-sm font-bold">
				<ArchiveIcon class="size-4 text-primary" />アーカイブ
			</h2>
			<Button variant="ghost" size="icon-sm" aria-label="更新" onclick={loadList}>
				<RefreshCw class="size-4 {loading ? 'animate-spin' : ''}" />
			</Button>
		</header>

		<div class="min-h-0 flex-1 overflow-y-auto p-3">
			<ul class="flex flex-col gap-2">
				{#each sessions as session (session.id)}
					<li>
						<div
							class="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5"
						>
							<button
								type="button"
								class="min-w-0 flex-1 text-left"
								onclick={() => openDetail(session.id)}
							>
								<div class="flex items-center gap-2">
									<span class="truncate text-sm font-bold">{session.channelName}</span>
									{#if session.hasRecording}
										<Disc3 class="size-3.5 shrink-0 text-primary" />
									{/if}
								</div>
								<p class="truncate text-xs text-muted-foreground">
									{session.guildName} ・ {formatDateTime(session.startedAt)}
								</p>
							</button>
							<div class="flex shrink-0 items-center gap-3 text-xs text-muted-foreground tabular-nums">
								<span>{session.participantCount}人</span>
								<span>{session.transcriptCount}発話</span>
							</div>
							{#if confirmingId === session.id}
								<Button variant="destructive" size="xs" onclick={() => removeSession(session.id)}>
									削除する
								</Button>
								<Button variant="ghost" size="xs" onclick={() => (confirmingId = null)}>
									取消
								</Button>
							{:else}
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="削除"
									onclick={() => (confirmingId = session.id)}
								>
									<Trash2 class="size-4" />
								</Button>
							{/if}
						</div>
					</li>
				{:else}
					<li class="flex flex-col items-center justify-center gap-2 py-16 text-center">
						<ArchiveIcon class="size-9 text-muted-foreground/30" />
						<p class="text-sm text-muted-foreground">アーカイブはまだありません</p>
					</li>
				{/each}
			</ul>
		</div>
	{:else}
		<header class="flex items-center gap-2 border-b border-border px-3 py-3">
			<Button variant="ghost" size="icon-sm" aria-label="戻る" onclick={() => (detail = null)}>
				<ArrowLeft class="size-4" />
			</Button>
			<div class="min-w-0 flex-1">
				<h2 class="truncate text-sm font-bold">{detail.session.channelName}</h2>
				<p class="truncate text-xs text-muted-foreground">
					{detail.session.guildName} ・ {formatDateTime(detail.session.startedAt)}
				</p>
			</div>
		</header>

		<div class="min-h-0 flex-1 overflow-y-auto p-4">
			{#if detail.recordings.length > 0}
				<section class="mb-5 flex flex-col gap-2">
					<h3 class="text-xs font-bold tracking-widest text-muted-foreground uppercase">録音</h3>
					{#each detail.recordings as rec (rec.id)}
						<div class="flex flex-col gap-2 rounded-md border border-border bg-background p-3">
							<div class="flex items-center justify-between gap-2 text-xs">
								<span class="font-bold">
									{rec.kind === "mix" ? "全体ミックス" : (rec.displayName ?? rec.fileName)}
								</span>
								<span class="text-muted-foreground tabular-nums">
									{rec.durationMs === null ? "" : formatDuration(rec.durationMs)} ・ {formatBytes(rec.sizeBytes)}
								</span>
							</div>
							<audio
								class="w-full"
								controls
								preload="none"
								src={recordingUrl(detail.session.id, rec.fileName)}
							></audio>
						</div>
					{/each}
				</section>
			{/if}

			<section class="flex flex-col gap-1">
				<h3 class="mb-1 text-xs font-bold tracking-widest text-muted-foreground uppercase">
					文字起こし
				</h3>
				{#each detail.entries as entry (entry.id)}
					<TimelineEntry {entry} />
				{:else}
					<p class="py-8 text-center text-sm text-muted-foreground">文字起こしはありません</p>
				{/each}
			</section>
		</div>
	{/if}
</section>
