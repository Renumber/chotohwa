<script setup lang="ts">
defineProps<{
  saving: boolean
}>()
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-150"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-300"
    leave-to-class="opacity-0"
  >
    <p
      v-if="saving"
      class="sticky top-0 z-30 bg-primary-600 px-4 py-1 text-center text-xs text-white"
    >
      저장 중...
    </p>
  </Transition>
</template>
