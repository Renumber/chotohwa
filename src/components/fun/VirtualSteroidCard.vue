<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Modal from '@/components/common/Modal.vue'
import { formatDateKey } from '@/utils/helpers'

type InjectionPhase = 'idle' | 'charging' | 'complete'

const STORAGE_DATE_KEY = 'chotohwa.virtualSteroid.lastDate'
const STORAGE_COUNT_KEY = 'chotohwa.virtualSteroid.totalCount'
const HOLD_DURATION_MS = 1600

const open = ref(false)
const phase = ref<InjectionPhase>('idle')
const progress = ref(0)
const completedToday = ref(false)
const totalCount = ref(0)

let animationFrame = 0
let holdStartedAt = 0

const cardStatus = computed(() => (
  completedToday.value
    ? '오늘 부스터 완료 · 의지 +100'
    : '휴대폰을 팔에 대고 길게 눌러보세요'
))

const buttonLabel = computed(() => {
  if (phase.value === 'complete') return '부스터 장착 완료!'
  if (phase.value === 'charging') return '그대로 누르고 있기...'
  return completedToday.value ? '한 번 더 연출하기' : '길게 눌러 주입하기'
})

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // 진동을 지원하지 않거나 차단한 브라우저에서는 시각 효과만 사용한다.
  }
}

function loadStats() {
  try {
    completedToday.value = localStorage.getItem(STORAGE_DATE_KEY) === formatDateKey(new Date())
    totalCount.value = Number(localStorage.getItem(STORAGE_COUNT_KEY)) || 0
  } catch {
    completedToday.value = false
    totalCount.value = 0
  }
}

function saveCompletion() {
  completedToday.value = true
  totalCount.value += 1
  try {
    localStorage.setItem(STORAGE_DATE_KEY, formatDateKey(new Date()))
    localStorage.setItem(STORAGE_COUNT_KEY, String(totalCount.value))
  } catch {
    // 저장소가 차단되어도 현재 화면의 연출은 유지한다.
  }
}

function finishInjection() {
  cancelAnimationFrame(animationFrame)
  animationFrame = 0
  progress.value = 100
  phase.value = 'complete'
  saveCompletion()
  vibrate([80, 50, 140])
}

function updateProgress(now: number) {
  const elapsed = now - holdStartedAt
  progress.value = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100)
  if (progress.value >= 100) {
    finishInjection()
    return
  }
  animationFrame = requestAnimationFrame(updateProgress)
}

function startHold(event?: PointerEvent | KeyboardEvent) {
  if (phase.value === 'charging') return
  if (event instanceof PointerEvent) {
    ;(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
  }
  phase.value = 'charging'
  progress.value = 0
  holdStartedAt = performance.now()
  vibrate(25)
  animationFrame = requestAnimationFrame(updateProgress)
}

function cancelHold() {
  if (phase.value !== 'charging') return
  cancelAnimationFrame(animationFrame)
  animationFrame = 0
  phase.value = 'idle'
  progress.value = 0
}

function showInjection() {
  phase.value = 'idle'
  progress.value = 0
  open.value = true
}

function closeInjection() {
  cancelHold()
  open.value = false
}

onMounted(loadStats)

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <section class="overflow-hidden rounded-2xl bg-gradient-to-br from-gray-950 via-emerald-950 to-gray-900 text-white shadow-lg">
    <button
      type="button"
      class="flex w-full items-center gap-3 p-4 text-left active:scale-[0.99]"
      @click="showInjection"
    >
      <span class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-2xl ring-1 ring-white/15">
        💉
      </span>
      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-2">
          <span class="font-bold">가상 스테로이드</span>
          <span class="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            100% 가상
          </span>
        </span>
        <span class="mt-0.5 block text-xs text-gray-300">{{ cardStatus }}</span>
      </span>
      <span class="text-lg text-emerald-300" aria-hidden="true">›</span>
    </button>
  </section>

  <Modal :open="open" title="가상 스테로이드" @close="closeInjection">
    <div class="relative overflow-hidden rounded-2xl bg-gray-950 p-5 text-center text-white">
      <div
        v-if="phase === 'complete'"
        class="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <i v-for="n in 14" :key="n" class="booster-confetti" :style="{ '--i': n }" />
      </div>

      <p class="text-xs font-bold tracking-[0.24em] text-emerald-400">VIRTUAL BOOSTER</p>

      <div
        class="relative mx-auto mt-5 grid h-32 w-32 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10"
        :class="{ 'booster-pulse': phase === 'charging', 'booster-complete': phase === 'complete' }"
      >
        <div
          class="absolute inset-2 rounded-full"
          :style="{ background: `conic-gradient(#34d399 ${progress * 3.6}deg, rgb(255 255 255 / 0.08) 0deg)` }"
        />
        <div class="relative grid h-24 w-24 place-items-center rounded-full bg-gray-950 text-5xl">
          {{ phase === 'complete' ? '⚡' : '💉' }}
        </div>
      </div>

      <template v-if="phase === 'complete'">
        <h3 class="mt-5 text-2xl font-black text-emerald-300">의지 +100</h3>
        <p class="mt-1 text-sm text-gray-300">가상 부스터 장착 완료. 이제 진짜 운동하러 가세요!</p>
      </template>
      <template v-else>
        <h3 class="mt-5 text-lg font-bold">휴대폰을 팔에 대세요</h3>
        <p class="mt-1 text-sm text-gray-400">아래 버튼을 끝까지 길게 누르면 진동과 함께 주입됩니다.</p>
      </template>

      <button
        type="button"
        class="mt-5 w-full touch-none select-none rounded-xl bg-emerald-500 px-4 py-3.5 font-bold text-gray-950 transition-transform active:scale-[0.98]"
        :class="{ 'bg-emerald-300': phase === 'complete' }"
        @pointerdown.prevent="startHold"
        @pointerup.prevent="cancelHold"
        @pointercancel="cancelHold"
        @contextmenu.prevent
        @keydown.space.prevent="startHold"
        @keyup.space.prevent="cancelHold"
      >
        {{ buttonLabel }}
      </button>

      <p class="mt-3 text-[11px] leading-relaxed text-gray-500">
        총 {{ totalCount }}회 체험 · 재미를 위한 시각·진동 연출이며 신체 변화나 의학적 효과가 없습니다.
        실제 아나볼릭 스테로이드 사용을 권장하지 않습니다.
      </p>
    </div>
  </Modal>
</template>

<style scoped>
.booster-pulse {
  animation: booster-pulse 0.55s ease-in-out infinite alternate;
}

.booster-complete {
  box-shadow: 0 0 45px rgb(52 211 153 / 0.45);
}

.booster-confetti {
  --angle: calc(var(--i) * 25.7deg);
  position: absolute;
  left: 50%;
  top: 46%;
  width: 6px;
  height: 12px;
  border-radius: 999px;
  background: hsl(calc(var(--i) * 43deg) 85% 62%);
  animation: booster-confetti 900ms ease-out both;
  transform: rotate(var(--angle)) translateY(-20px);
}

@keyframes booster-pulse {
  from { transform: scale(0.98); }
  to { transform: scale(1.03); }
}

@keyframes booster-confetti {
  from {
    opacity: 1;
    transform: rotate(var(--angle)) translateY(-20px) scale(1);
  }
  to {
    opacity: 0;
    transform: rotate(var(--angle)) translateY(-150px) scale(0.7);
  }
}

@media (prefers-reduced-motion: reduce) {
  .booster-pulse,
  .booster-confetti {
    animation: none;
  }
}
</style>
