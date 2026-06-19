<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const tabs = [
  { path: '/', label: '오늘', icon: '📋' },
  { path: '/history', label: '기록', icon: '📅' },
  { path: '/coach', label: '코치', icon: '🤖' },
  { path: '/settings', label: '설정', icon: '⚙️' },
]
</script>

<template>
  <nav
    class="fixed bottom-0 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]"
  >
    <div class="flex">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors"
        :class="
          route.path === tab.path
            ? 'text-primary-600 font-medium'
            : 'text-gray-500'
        "
      >
        <span class="text-lg">{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>
