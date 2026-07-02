<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })

defineProps<{
  title: string
  badge?: string
}>()
</script>

<template>
  <section class="card overflow-hidden">
    <button
      type="button"
      class="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-100/60"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="flex items-center gap-2 font-medium">
        {{ title }}
        <span v-if="badge" class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
          {{ badge }}
        </span>
      </span>
      <svg
        class="h-4 w-4 text-gray-400 transition-transform duration-200"
        :class="{ 'rotate-180': open }"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
    <div v-show="open" class="space-y-3 px-4 pb-4">
      <slot />
    </div>
  </section>
</template>
