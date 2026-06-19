<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center"
      @click.self="emit('close')"
    >
      <div
        class="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-bold">{{ title }}</h2>
          <button
            type="button"
            class="rounded-lg px-3 py-1 text-sm text-gray-500 hover:bg-gray-100"
            @click="emit('close')"
          >
            닫기
          </button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
