import { contract } from "@dis-ml/contract";
import type { ContractRouterClient } from "@orpc/contract";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

/** バックエンド oRPC サーバへのリンク（同一オリジン /rpc。dev は Vite がプロキシ） */
const link = new RPCLink({
	url: `${globalThis.location.origin}/rpc`,
});

/** 型付き oRPC クライアント（契約から型推論） */
export const client: ContractRouterClient<typeof contract> =
	createORPCClient(link);
