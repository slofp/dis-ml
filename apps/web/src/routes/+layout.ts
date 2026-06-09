// SPA として動作させる（SSR/プリレンダリングを無効化）。
// バックエンドは別プロセスの oRPC サーバであり、SvelteKit はAPIを提供しない。
export const ssr = false;
export const prerender = false;
