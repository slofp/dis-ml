<script lang="ts">
	import type { BotSettingsUpdate } from "@dis-ml/contract";
	import Button from "$lib/components/ui/button/Button.svelte";
	import Dialog from "$lib/components/ui/dialog/Dialog.svelte";
	import DialogContent from "$lib/components/ui/dialog/DialogContent.svelte";
	import DialogDescription from "$lib/components/ui/dialog/DialogDescription.svelte";
	import DialogFooter from "$lib/components/ui/dialog/DialogFooter.svelte";
	import DialogHeader from "$lib/components/ui/dialog/DialogHeader.svelte";
	import DialogTitle from "$lib/components/ui/dialog/DialogTitle.svelte";
	import Input from "$lib/components/ui/input/Input.svelte";
	import Label from "$lib/components/ui/label/Label.svelte";
	import Switch from "$lib/components/ui/switch/Switch.svelte";
	import { client } from "$lib/api/client";
	import { app, describeError, pushLog, refreshSnapshot } from "$lib/state/app.svelte";
	import KeyRound from "@lucide/svelte/icons/key-round";
	import Languages from "@lucide/svelte/icons/languages";
	import LoaderCircle from "@lucide/svelte/icons/loader-circle";
	import Radio from "@lucide/svelte/icons/radio";
	import { cn } from "$lib/utils";

	type Props = {
		/** 開閉状態（双方向） */
		open: boolean;
	};

	let { open = $bindable() }: Props = $props();

	/** 設定カテゴリ */
	type Category = "auth" | "stt" | "follow";

	/** サイドバーのカテゴリ定義 */
	const categories: { id: Category; label: string; icon: typeof KeyRound }[] = [
		{ id: "auth", label: "認証情報", icon: KeyRound },
		{ id: "stt", label: "文字起こし", icon: Languages },
		{ id: "follow", label: "追従・録音", icon: Radio },
	];

	/** 現在選択中のカテゴリ */
	let activeCategory = $state<Category>("auth");

	/** フォーム状態 */
	let form = $state({
		discordToken: "",
		sonioxApiKey: "",
		sttModel: "stt-rt-preview",
		languageHints: "ja",
		ownerUserId: "",
		autoFollowOwner: true,
		autoRecord: false,
	});
	let discordTokenSet = $state(false);
	let sonioxApiKeySet = $state(false);
	let loading = $state(false);
	let saving = $state(false);

	/** ダイアログが開いたら現在設定を読み込む */
	$effect(() => {
		if (open) {
			load();
		}
	});

	/** 現在の設定を取得してフォームへ反映する */
	const load = async (): Promise<void> => {
		loading = true;
		try {
			const view = await client.settings.get();
			form = {
				discordToken: "",
				sonioxApiKey: "",
				sttModel: view.sttModel,
				languageHints: view.languageHints.join(", "),
				ownerUserId: view.ownerUserId ?? "",
				autoFollowOwner: view.autoFollowOwner,
				autoRecord: view.autoRecord,
			};
			discordTokenSet = view.discordTokenSet;
			sonioxApiKeySet = view.sonioxApiKeySet;
		} catch (error) {
			pushLog("error", `設定の取得に失敗: ${describeError(error)}`);
		} finally {
			loading = false;
		}
	};

	/** カンマ区切りの言語ヒントを配列へ変換する */
	const parseHints = (raw: string): string[] => {
		return raw
			.split(",")
			.map((item) => item.trim())
			.filter((item) => item !== "");
	};

	/** 設定を保存する */
	const save = async (): Promise<void> => {
		saving = true;
		try {
			const update: BotSettingsUpdate = {
				sttModel: form.sttModel,
				languageHints: parseHints(form.languageHints),
				autoFollowOwner: form.autoFollowOwner,
				autoRecord: form.autoRecord,
				ownerUserId: form.ownerUserId === "" ? null : form.ownerUserId,
			};
			if (form.discordToken !== "") {
				update.discordToken = form.discordToken;
			}
			if (form.sonioxApiKey !== "") {
				update.sonioxApiKey = form.sonioxApiKey;
			}
			const view = await client.settings.update(update);
			app.settingsConfigured = view.discordTokenSet && view.sonioxApiKeySet;
			await refreshSnapshot();
			pushLog("info", "設定を保存しました。");
			open = false;
		} catch (error) {
			pushLog("error", `設定の保存に失敗: ${describeError(error)}`);
		} finally {
			saving = false;
		}
	};
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-2xl">
		<DialogHeader>
			<DialogTitle>Bot 設定</DialogTitle>
			<DialogDescription>Bot の動作設定を行います。</DialogDescription>
		</DialogHeader>

		<div class="flex min-h-72 gap-5 py-1">
			<!-- 左: カテゴリサイドバー -->
			<nav class="flex w-36 shrink-0 flex-col gap-1 border-r border-border pr-3">
				{#each categories as cat (cat.id)}
					{@const Icon = cat.icon}
					<button
						type="button"
						class={cn(
							"flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-bold transition-colors",
							activeCategory === cat.id
								? "bg-secondary text-foreground"
								: "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
						)}
						onclick={() => (activeCategory = cat.id)}
					>
						<Icon class="size-4 shrink-0" />
						{cat.label}
					</button>
				{/each}
			</nav>

			<!-- 右: 選択カテゴリの設定項目 -->
			<div class="min-w-0 flex-1">
				{#if activeCategory === "auth"}
					<div class="flex flex-col gap-4">
						<div class="flex flex-col gap-1.5">
							<Label for="discord-token">Discord Bot トークン</Label>
							<Input
								id="discord-token"
								type="password"
								autocomplete="off"
								bind:value={form.discordToken}
								placeholder={discordTokenSet ? "設定済み（変更する場合のみ入力）" : "未設定"}
							/>
						</div>
						<div class="flex flex-col gap-1.5">
							<Label for="soniox-key">Soniox API キー</Label>
							<Input
								id="soniox-key"
								type="password"
								autocomplete="off"
								bind:value={form.sonioxApiKey}
								placeholder={sonioxApiKeySet ? "設定済み（変更する場合のみ入力）" : "未設定"}
							/>
						</div>
						<p class="text-xs text-muted-foreground">
							トークン・キーは画面からのみ設定し、保存後は再表示しません。
						</p>
					</div>
				{:else if activeCategory === "stt"}
					<div class="flex flex-col gap-4">
						<div class="flex flex-col gap-1.5">
							<Label for="stt-model">STT モデル</Label>
							<Input id="stt-model" bind:value={form.sttModel} />
						</div>
						<div class="flex flex-col gap-1.5">
							<Label for="lang-hints">言語ヒント（カンマ区切り）</Label>
							<Input id="lang-hints" bind:value={form.languageHints} placeholder="ja" />
							<p class="text-xs text-muted-foreground">例: ja, en（ISO 言語コード）</p>
						</div>
					</div>
				{:else}
					<div class="flex flex-col gap-4">
						<div class="flex flex-col gap-1.5">
							<Label for="owner-id">オーナーのユーザーID</Label>
							<Input id="owner-id" bind:value={form.ownerUserId} placeholder="例: 123456789012345678" />
						</div>
						<div class="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
							<div class="min-w-0">
								<p class="text-sm font-bold">オーナーに自動追従</p>
								<p class="text-xs text-muted-foreground">オーナーのVC入退室に合わせて参加/退出</p>
							</div>
							<Switch bind:checked={form.autoFollowOwner} />
						</div>
						<div class="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
							<div class="min-w-0">
								<p class="text-sm font-bold">参加時に自動録音</p>
								<p class="text-xs text-muted-foreground">VC参加と同時に録音を開始</p>
							</div>
							<Switch bind:checked={form.autoRecord} />
						</div>
					</div>
				{/if}
			</div>
		</div>

		<DialogFooter>
			<Button variant="outline" onclick={() => (open = false)} disabled={saving}>
				キャンセル
			</Button>
			<Button onclick={save} disabled={saving || loading}>
				{#if saving}
					<LoaderCircle class="size-4 animate-spin" />
				{/if}
				保存
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
