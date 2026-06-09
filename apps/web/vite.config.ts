import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// oRPC サーバ（バックエンド）の開発時ポート。本番では同一オリジンで配信される。
const RPC_TARGET = 'http://127.0.0.1:8787';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		// モノレポ: ワークスペースパッケージ（packages/contract）のソース参照を許可
		fs: { allow: ['..', '../..'] },
		// 開発時は SPA からの /rpc・/media 呼び出しをバックエンドへプロキシ
		proxy: {
			'/rpc': { target: RPC_TARGET, changeOrigin: true },
			'/media': { target: RPC_TARGET, changeOrigin: true }
		}
	}
});
