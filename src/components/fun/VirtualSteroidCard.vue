<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

watch(open, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
})

onMounted(loadStats)

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  document.body.style.overflow = ''
})
</script>

<template>
  <section class="card overflow-hidden">
    <button
      type="button"
      class="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
      @click="showInjection"
    >
      <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-100 text-xl">
        💉
      </span>
      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-2">
          <span class="font-medium text-gray-800">가상 스테로이드</span>
          <span class="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-600">
            재미 기능
          </span>
        </span>
        <span class="mt-0.5 block text-xs text-gray-500">{{ cardStatus }}</span>
      </span>
      <span class="text-lg text-gray-300" aria-hidden="true">›</span>
    </button>
  </section>

  <Teleport to="body">
    <Transition name="injector-screen">
      <div
        v-if="open"
        class="injector-screen fixed inset-0 z-[100] overflow-hidden text-gray-900"
        role="dialog"
        aria-modal="true"
        aria-label="가상 스테로이드 체험"
      >
        <div
          v-if="phase === 'complete'"
          class="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          <i v-for="n in 18" :key="n" class="booster-confetti" :style="{ '--i': n }" />
        </div>

        <button
          type="button"
          class="absolute right-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/70 text-xl text-gray-500 shadow-sm"
          :style="{ top: 'calc(1rem + env(safe-area-inset-top))' }"
          aria-label="닫기"
          @click="closeInjection"
        >
          ×
        </button>

        <main
          class="mx-auto flex h-dvh w-full max-w-lg flex-col items-center px-6 text-center"
          :style="{
            paddingTop: 'calc(4.5rem + env(safe-area-inset-top))',
            paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))',
          }"
        >
          <div class="shrink-0">
            <p class="text-[11px] font-bold tracking-[0.24em] text-violet-500">VIRTUAL BOOSTER</p>
            <h2 class="mt-3 text-xl font-black">
              {{ phase === 'complete' ? '가상 부스터 주입 완료!' : '휴대폰을 팔에 꾹 눌러주세요' }}
            </h2>
            <p class="mt-1.5 text-sm text-gray-500">
              {{ phase === 'complete'
                ? '의지 +100 장착. 이제 진짜 운동하러 갈 시간!'
                : '휴대폰 아래쪽을 팔에 대고 보라색 버튼을 길게 누르세요' }}
            </p>
          </div>

          <button
            type="button"
            class="injector-touch-zone relative my-4 flex min-h-0 flex-1 touch-none select-none items-center justify-center"
            :class="{ 'is-charging': phase === 'charging', 'is-complete': phase === 'complete' }"
            :style="{ '--progress': progress / 100 }"
            :aria-label="buttonLabel"
            @pointerdown.prevent="startHold"
            @pointerup.prevent="cancelHold"
            @pointercancel="cancelHold"
            @contextmenu.prevent
            @keydown.space.prevent="startHold"
            @keyup.space.prevent="cancelHold"
          >
            <span class="injector">
              <span class="injector-plunger">
                <span class="injector-plunger-shine" />
                <span class="injector-press-dot" />
              </span>
              <span class="injector-neck" />
              <span class="injector-body">
                <span class="injector-label">STEROID</span>
                <span class="injector-window">
                  <span class="injector-liquid" />
                  <span class="injector-bubbles">•<br />•</span>
                </span>
              </span>
              <span class="injector-tip" />
              <span class="injector-needle" />
            </span>

            <span v-if="phase === 'charging'" class="absolute bottom-3 text-sm font-bold text-violet-600">
              {{ Math.round(progress) }}% · 그대로 누르세요
            </span>
            <span v-else-if="phase === 'complete'" class="absolute bottom-3 text-lg font-black text-violet-600">
              ⚡ 의지 +100
            </span>
            <span v-else class="absolute bottom-3 text-sm font-semibold text-gray-500">
              주사 펜을 길게 누르기
            </span>
          </button>

          <div class="w-full shrink-0">
            <div class="h-1.5 overflow-hidden rounded-full bg-violet-100">
              <div
                class="h-full rounded-full bg-violet-500 transition-[width] duration-75"
                :style="{ width: `${progress}%` }"
              />
            </div>
            <p class="mt-3 text-[10px] leading-relaxed text-gray-400">
              총 {{ totalCount }}회 체험 · 화면과 진동만 사용하는 장난 기능이며 신체 변화나 의학적 효과가 없습니다.
              실제 약물 사용을 권장하지 않습니다.
            </p>
          </div>
        </main>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.injector-screen {
  color-scheme: light;
  background:
    radial-gradient(circle at 50% 54%, rgb(196 181 253 / 0.48), transparent 36%),
    linear-gradient(180deg, #fcfaff 0%, #f4edff 100%);
  forced-color-adjust: none;
  isolation: isolate;
}

.injector-screen-enter-active,
.injector-screen-leave-active {
  transition: opacity 180ms ease, transform 220ms ease;
}

.injector-screen-enter-from,
.injector-screen-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.injector-touch-zone {
  width: min(100%, 280px);
  outline: none;
}

.injector {
  position: relative;
  display: flex;
  width: 124px;
  height: min(52dvh, 430px);
  min-height: 330px;
  flex-direction: column;
  align-items: center;
  filter:
    drop-shadow(0 0 2px rgb(76 29 149 / 0.75))
    drop-shadow(0 22px 22px rgb(76 29 149 / 0.28));
  transform: translateY(calc(var(--progress) * 10px));
  transition: transform 120ms ease;
}

.injector-plunger {
  position: relative;
  z-index: 2;
  display: grid;
  width: 86px;
  height: 70px;
  flex: 0 0 70px;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgb(91 33 182 / 0.28);
  border-radius: 24px 24px 17px 17px;
  background: linear-gradient(145deg, #9b5cff 0%, #6d28d9 52%, #4c1d95 100%);
  box-shadow: inset -10px -10px 20px rgb(46 16 101 / 0.22), 0 8px 14px rgb(76 29 149 / 0.22);
  transform: translateY(calc(var(--progress) * 7px));
  transition: transform 100ms linear;
}

.injector-plunger-shine {
  position: absolute;
  inset: 8px auto 8px 12px;
  width: 10px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.28);
}

.injector-press-dot {
  width: 30px;
  height: 30px;
  border: 3px solid rgb(255 255 255 / 0.25);
  border-radius: 999px;
  background: rgb(49 18 106 / 0.22);
  box-shadow: inset 0 2px 8px rgb(26 5 62 / 0.35);
}

.injector-neck {
  width: 52px;
  height: 20px;
  flex: 0 0 20px;
  border-inline: 2px solid #8b5cf6;
  background: linear-gradient(90deg, #c4b5fd, #fff 35%, #ddd6fe);
}

.injector-body {
  position: relative;
  width: 94px;
  min-height: 210px;
  flex: 1;
  border: 2px solid #8b5cf6;
  border-radius: 18px 18px 25px 25px;
  background: linear-gradient(90deg, #ddd6fe 0%, #fff 32%, #faf5ff 70%, #c4b5fd 100%);
  box-shadow:
    0 0 0 4px rgb(255 255 255 / 0.72),
    0 12px 32px rgb(76 29 149 / 0.26),
    inset 8px 0 12px rgb(255 255 255 / 0.9),
    inset -8px 0 12px rgb(109 40 217 / 0.14);
}

.injector-label {
  position: absolute;
  left: 50%;
  top: 26px;
  padding: 5px 7px;
  border-radius: 8px;
  background: #6d28d9;
  color: white;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.08em;
  transform: translateX(-50%);
}

.injector-window {
  position: absolute;
  inset: 80px 16px 23px;
  overflow: hidden;
  border: 3px solid #7c3aed;
  border-radius: 12px;
  background: #ddd6fe;
  box-shadow:
    0 0 0 2px rgb(255 255 255 / 0.8),
    0 0 18px rgb(124 58 237 / 0.34),
    inset 0 3px 10px rgb(76 29 149 / 0.2);
}

.injector-liquid {
  position: absolute;
  inset: 0;
  transform-origin: bottom;
  transform: scaleY(calc(1 - var(--progress)));
  background:
    linear-gradient(90deg, rgb(255 255 255 / 0.5), transparent 38%),
    linear-gradient(180deg, #a78bfa, #7c3aed);
  transition: transform 80ms linear;
}

.injector-bubbles {
  position: absolute;
  right: 8px;
  bottom: 14px;
  color: rgb(255 255 255 / 0.55);
  font-size: 12px;
  line-height: 36px;
}

.injector-tip {
  width: 40px;
  height: 22px;
  flex: 0 0 22px;
  border: 2px solid #8b5cf6;
  border-radius: 0 0 18px 18px;
  background: linear-gradient(90deg, #c4b5fd, white 45%, #ddd6fe);
}

.injector-needle {
  width: 3px;
  height: 18px;
  flex: 0 0 18px;
  background: linear-gradient(90deg, #4c1d95, #c4b5fd);
  box-shadow: 0 0 5px rgb(76 29 149 / 0.75);
}

.is-charging .injector {
  animation: injector-hum 90ms linear infinite alternate;
}

.is-charging .injector-plunger {
  box-shadow: 0 0 28px rgb(124 58 237 / 0.55);
}

.is-complete .injector {
  filter: drop-shadow(0 0 28px rgb(139 92 246 / 0.5));
}

.booster-confetti {
  --angle: calc(var(--i) * 20deg);
  position: absolute;
  z-index: 5;
  left: 50%;
  top: 52%;
  width: 7px;
  height: 14px;
  border-radius: 999px;
  background: hsl(calc(var(--i) * 37deg) 85% 62%);
  animation: booster-confetti 900ms ease-out both;
}

@keyframes injector-hum {
  from { margin-left: -1px; }
  to { margin-left: 1px; }
}

@keyframes booster-confetti {
  from {
    opacity: 1;
    transform: rotate(var(--angle)) translateY(-25px) scale(1);
  }
  to {
    opacity: 0;
    transform: rotate(var(--angle)) translateY(-220px) scale(0.7);
  }
}

@media (max-height: 690px) {
  .injector {
    height: 330px;
    min-height: 300px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .injector-screen-enter-active,
  .injector-screen-leave-active,
  .is-charging .injector,
  .booster-confetti {
    animation: none;
    transition: none;
  }
}
</style>
