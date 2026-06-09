import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import globals from "globals";
import svelte from "eslint-plugin-svelte";
import tseslint from "typescript-eslint";

/**
 * モノレポ共通の ESLint フラット設定。
 * プロジェクトの TypeScript 規約を可能な限り機械的に強制する。
 * 型情報を要するルールは projectService で解決する。
 */

// プロジェクトの「絶対禁止」事項を no-restricted-syntax で表現する
const restrictedSyntax = [
	{
		selector: "ExportDefaultDeclaration",
		message: "export default は禁止です。名前付きエクスポートを使用してください。",
	},
	{
		selector: "UnaryExpression[operator='delete']",
		message: "delete は禁止です。分割代入で新しいオブジェクトを作成してください。",
	},
	{
		selector: "CallExpression[callee.property.name='forEach']",
		message: "forEach は禁止です。for-of を使用してください。",
	},
	{
		selector: "TSEnumDeclaration",
		message: "enum は禁止です。union 型または as const を使用してください。",
	},
];

export default tseslint.config(
	{
		ignores: [
			"**/node_modules/**",
			"**/dist/**",
			"**/build/**",
			"**/.svelte-kit/**",
			"**/bin/**",
			// shadcn-svelte の生成コンポーネントはベンダー扱い（規約適用外）
			"apps/web/src/lib/components/ui/**",
		],
	},

	js.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	...tseslint.configs.stylisticTypeChecked,

	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: [".svelte"],
			},
		},
	},

	// 自前ソースに対するプロジェクト規約の強制
	{
		files: ["**/*.{ts,mts,cts,svelte}"],
		plugins: { "@stylistic": stylistic },
		rules: {
			"@typescript-eslint/consistent-type-definitions": ["error", "type"],
			"@typescript-eslint/no-non-null-assertion": "error",
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/switch-exhaustiveness-check": "error",
			eqeqeq: ["error", "always"],
			curly: ["error", "all"],
			"no-var": "error",
			"prefer-const": "error",
			"no-void": "error",
			"prefer-rest-params": "error",
			"no-restricted-syntax": ["error", ...restrictedSyntax],
			"@stylistic/semi": ["error", "always"],
		},
	},

	// Svelte ファイル
	...svelte.configs.recommended,
	{
		// .svelte は型情報ルールを無効化（runes/コンパイラ起因の誤検知を避ける）。
		// パーサ（svelte-eslint-parser）は recommended のものを維持し、rules だけ上書きする。
		// ロジックは .svelte.ts 側（型チェック対象）に寄せている。
		files: ["**/*.svelte"],
		languageOptions: {
			globals: { ...globals.browser },
			parserOptions: { parser: tseslint.parser },
		},
		rules: {
			...tseslint.configs.disableTypeChecked.rules,
			// Svelte 5 の `let { ... } = $props()` は const にできないため無効化
			"prefer-const": "off",
		},
	},

	// .svelte.ts（runes モジュール）は純粋な TS として型チェックする
	{
		files: ["**/*.svelte.ts"],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},

	// 設定ファイル等は型情報なし＆default export 許可
	{
		files: ["**/*.config.{js,ts}", "**/svelte.config.js", "**/drizzle.config.ts"],
		...tseslint.configs.disableTypeChecked,
		languageOptions: {
			globals: { ...globals.node },
		},
		rules: {
			"no-restricted-syntax": "off",
		},
	},

	// JS 設定ファイルは型チェック対象外
	{
		files: ["**/*.js", "**/*.mjs"],
		...tseslint.configs.disableTypeChecked,
	},

	// ビルド等のツールスクリプト（どのパッケージの tsconfig にも属さない）
	{
		files: ["scripts/**/*.ts"],
		languageOptions: {
			globals: { ...globals.node, Bun: "readonly" },
			parserOptions: { projectService: false, project: false },
		},
		rules: {
			...tseslint.configs.disableTypeChecked.rules,
		},
	},

	// 型宣言ファイル(.d.ts)はアンビエント宣言のため一部規約を緩和
	{
		files: ["**/*.d.ts"],
		rules: {
			"no-restricted-syntax": "off",
		},
	},
);
