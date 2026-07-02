<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps<{
  content: string
}>()

const html = computed(() =>
  DOMPurify.sanitize(marked.parse(props.content, { async: false, breaks: true })),
)
</script>

<template>
  <div class="markdown-body" v-html="html" />
</template>
