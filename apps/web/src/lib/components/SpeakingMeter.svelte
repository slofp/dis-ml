<script lang="ts">
	type Props = {
		/** 発話中か */
		active?: boolean;
	};

	let { active = false }: Props = $props();

	/** バーの本数 */
	const bars = [0, 1, 2, 3];
</script>

<!-- 発話中はイコライザ風に上下する。停止中は低い一定バー。 -->
<div class="meter" class:meter--active={active} aria-hidden="true">
	{#each bars as index (index)}
		<span class="meter__bar" style={`--i: ${String(index)}`}></span>
	{/each}
</div>

<style>
	.meter {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 16px;
	}

	.meter__bar {
		width: 3px;
		height: 4px;
		border-radius: 9999px;
		background-color: var(--muted-foreground);
		transition: height 250ms ease;
	}

	.meter--active .meter__bar {
		background-color: var(--primary);
		animation: meter-bounce 700ms ease-in-out infinite;
		animation-delay: calc(var(--i) * 120ms);
	}

	@keyframes meter-bounce {
		0%,
		100% {
			height: 4px;
		}
		50% {
			height: 16px;
		}
	}
</style>
