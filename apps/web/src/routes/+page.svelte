<script lang="ts">
	import { onMount } from "svelte";
	import Tabs from "$lib/components/ui/tabs/Tabs.svelte";
	import TabsContent from "$lib/components/ui/tabs/TabsContent.svelte";
	import TabsList from "$lib/components/ui/tabs/TabsList.svelte";
	import TabsTrigger from "$lib/components/ui/tabs/TabsTrigger.svelte";
	import ArchivePanel from "$lib/components/ArchivePanel.svelte";
	import LogConsole from "$lib/components/LogConsole.svelte";
	import ParticipantList from "$lib/components/ParticipantList.svelte";
	import SettingsDialog from "$lib/components/SettingsDialog.svelte";
	import StatusPanel from "$lib/components/StatusPanel.svelte";
	import Timeline from "$lib/components/Timeline.svelte";
	import TopBar from "$lib/components/TopBar.svelte";
	import { app, initApp, seedDemo } from "$lib/state/app.svelte";
	import ActivityIcon from "@lucide/svelte/icons/activity";
	import ArchiveIcon from "@lucide/svelte/icons/archive";

	let settingsOpen = $state(false);

	onMount(() => {
		// 開発時のデザイン確認用: ?demo でサンプルデータを表示（本番では除去される）
		if (import.meta.env.DEV && new URLSearchParams(globalThis.location.search).has("demo")) {
			const params = new URLSearchParams(globalThis.location.search);
			seedDemo();
			// ?demo=join: 接続済みだが未参加（VC参加ダイアログ確認用）
			if (params.get("demo") === "join") {
				app.voice = null;
				app.participants = [];
				app.timeline = [];
				app.recording = { active: false, startedAt: null, sessionId: null };
			}
			return;
		}
		initApp().then(() => {
			// 未設定なら設定ダイアログを促す
			if (!app.settingsConfigured) {
				settingsOpen = true;
			}
		});
	});
</script>

<div class="flex h-screen flex-col bg-background text-foreground">
	<TopBar onOpenSettings={() => (settingsOpen = true)} />

	<main class="grid min-h-0 flex-1 grid-cols-[20rem_1fr] gap-3 p-3">
		<aside class="flex min-h-0 flex-col gap-3">
			<StatusPanel />
			<ParticipantList />
		</aside>

		<Tabs value="live" class="flex min-h-0 flex-1 flex-col gap-3">
			<TabsList class="w-fit">
				<TabsTrigger value="live">
					<ActivityIcon class="size-4" />ライブ
				</TabsTrigger>
				<TabsTrigger value="archive">
					<ArchiveIcon class="size-4" />アーカイブ
				</TabsTrigger>
			</TabsList>
			<TabsContent value="live" class="flex min-h-0 flex-1 data-[state=inactive]:hidden">
				<Timeline />
			</TabsContent>
			<TabsContent value="archive" class="flex min-h-0 flex-1 data-[state=inactive]:hidden">
				<ArchivePanel />
			</TabsContent>
		</Tabs>
	</main>

	<LogConsole />
</div>

<SettingsDialog bind:open={settingsOpen} />
