# dis-ml

Discord のボイスチャンネルに「ソフトウェア的に」参加し、参加者ごとの音声をリアルタイムに
文字起こし（Soniox STT）しつつ、任意タイミングで録音（ユーザー別 + 全体ミックス）するツール。
Web UI はソフトウェア風のコントロールパネル。

> 本ファイルはプロジェクト固有の構成・コマンド・設計をまとめる。
> コーディング規約（TypeScript/CSS 等）は ESLint / tsconfig による厳格設定で機械的に強制している。

## 技術スタック

- ランタイム/言語: **Bun** / **TypeScript**（最大限の strict。isolatedDeclarations のみ除外）
- Bot: **discord.js** + **@discordjs/voice**（音声受信）
- STT: **@soniox/node**（リアルタイム WebSocket）
- API: **oRPC**（契約ファースト・`@orpc/contract` + **zod**、SSE は Event Iterator）
- DB: **bun:sqlite** + **Drizzle ORM**
- フロント: **SvelteKit(SPA)** + **Vite** + **Tailwind CSS v4** + **shadcn-svelte**（nova/neutral）
- アイコン: **@lucide/svelte** / フォント: **LINE Seed JP**（Google Fonts、これのみ使用）
- Lint: **ESLint**（typescript-eslint strict-type-checked + 規約強制ルール）

## モノレポ構成（Bun workspaces）

```
packages/contract  … oRPC契約・ドメイン型（zod）。サーバ/フロント共有の真実源
apps/server        … Bot本体 + oRPCサーバ + STT + 録音（バックエンド／バイナリ対象）
apps/web           … SvelteKit SPA（コントロールパネル）。バックエンドAPIは持たない
```

### アーキテクチャ

```mermaid
flowchart LR
  subgraph server[apps/server (Bun)]
    bot[discord.js + @discordjs/voice] -->|Opus→PCM| voice[VoiceSession]
    voice -->|mono PCM| stt[Soniox STT]
    voice -->|stereo PCM| rec[録音 WAV/ミックス]
    stt --> bus[EventBus]
    bot --> state[AppState]
    rpc[oRPC RPCHandler] --> db[(bun:sqlite + Drizzle)]
    rpc --- bus
    rpc -->|静的配信| spa
  end
  spa[apps/web SPA] -->|oRPC over HTTP /rpc| rpc
  spa -->|SSE live.events| bus
```

- フロントは **同一オリジン**で `/rpc`（oRPC）と `/media`（録音配信）を叩く。dev は Vite が
  `127.0.0.1:8787` へプロキシ。本番/バイナリはサーバが SPA も配信する。
- Discord はユーザーごとに音声ストリームが分かれるため、**話者は既知**（STT の diarization 不要）。
  1ユーザー = 1 Soniox セッションで紐付ける。

## 主要コマンド

| 目的 | コマンド |
|------|----------|
| 依存インストール | `bun install` |
| 開発（両方同時） | `bun run dev`（server: 8787 / web: 5173） |
| 開発（個別） | `bun run dev:server` / `bun run dev:web` |
| 型チェック（全体） | `bun run typecheck` |
| Lint | `bun run lint` / 自動修正 `bun run lint:fix` |
| 本番ビルド | `bun run build`（web→`apps/web/build`、server→`apps/server/dist`） |
| スタンドアロンバイナリ | `bun run build:binary`（`bin/dis-ml` + `bin/web` を生成） |

## 実行とデータ

- サーバ待受: **127.0.0.1:8787**（ローカル専用・認証なし）。
- データ保存先: 既定 `~/.dis-ml`（`DIS_ML_DATA_DIR` で変更可）。
  - `dis-ml.sqlite`（設定/セッション/文字起こし/録音メタ）
  - `recordings/<sessionId>/`（`mix.wav` と `user-<userId>.wav`）
- シークレット（Discord Bot トークン / Soniox API キー）は**設定画面からのみ**入力し SQLite に保存。
  `.env`・環境変数は使用しない。
- SPA 配置の解決順: `DIS_ML_WEB_DIST` → 実行ファイル隣の `web/` → ソース相対 `apps/web/build`。

## 設計上のポイント / 規約

- 音声: Opus→PCM(48kHz/ステレオ) は `prism.opus.Decoder`(opusscript)。STT へはモノラル化して送信、
  録音はステレオのまま。ミックスは 20ms tick で全ユーザーを時間整合合算（`audio/mixer.ts`）。
- DB スキーマは `db/schema.ts`（Drizzle）と `db/migrate.ts`（冪等DDL）を**一致させる**こと。
  実行時は `ensureSchema()` でテーブル作成（外部マイグレーション不要＝バイナリ配布向け）。
- リアルタイム反映は `events/bus.ts`（EventBus）→ oRPC `live.events`(SSE) → フロント
  `lib/state/app.svelte.ts`（runes）。文字起こしは暫定(`live-<userId>`)→確定(uuid)で置換。
- フロントは shadcn-svelte 採用のため CSS は Tailwind + CSS変数を使用。
  ただし**紫(H240-340)・グラデーションは不使用**。配色はターコイズ(H≈174)アクセントのダーク基調。
- ESLint: `.svelte` は型情報ルールを無効化（runes 誤検知回避）。ロジックは `.svelte.ts`（型チェック対象）へ。

## テスト方針

Discord 依存のため**ユニットテストは作らない**。全実装後に**人間が実機で動作確認**する。
確認手順は `README.md` を参照。型チェック・Lint・oRPC スモーク・UI レンダリングは自動で検証済み。

## 注意（要・人間確認）

- 実 Discord 接続・音声受信・STT・録音の通し動作はトークン/キーが必要なため未検証。
- スタンドアロンバイナリでの DAVE(`@snazzah/davey` ネイティブ) の動作は実機確認が必要。
