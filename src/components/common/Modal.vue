<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'

const props = defineProps<{
  open: boolean
  title: string
}>()

const emit = defineEmits<{
  close: []
}>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      document.addEventListener('keydown', onKeydown)
      document.body.style.overflow = 'hidden'
    } else {
      document.removeEventListener('keydown', onKeydown)
      document.body.style.overflow = ''
    }
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center"
        role="dialog"
        aria-modal="true"
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
    </Transition>
  </Teleport>
</template>
