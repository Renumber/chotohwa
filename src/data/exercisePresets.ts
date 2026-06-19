import type { ExercisePreset } from '@/types/log'

export const EXERCISE_PRESETS: ExercisePreset[] = [
  { id: 'bench-press', name: '벤치프레스', category: 'chest' },
  { id: 'incline-bench', name: '인클라인 벤치프레스', category: 'chest' },
  { id: 'dumbbell-fly', name: '덤벨 플라이', category: 'chest' },
  { id: 'lat-pulldown', name: '랫풀다운', category: 'back' },
  { id: 'barbell-row', name: '바벨로우', category: 'back' },
  { id: 'deadlift', name: '데드리프트', category: 'back' },
  { id: 'pull-up', name: '풀업', category: 'back' },
  { id: 'squat', name: '스쿼트', category: 'legs' },
  { id: 'leg-press', name: '레그프레스', category: 'legs' },
  { id: 'leg-curl', name: '레그컬', category: 'legs' },
  { id: 'shoulder-press', name: '숄더프레스', category: 'shoulders' },
  { id: 'lateral-raise', name: '사이드 레터럴 레이즈', category: 'shoulders' },
  { id: 'barbell-curl', name: '바벨컬', category: 'arms' },
  { id: 'tricep-pushdown', name: '트라이셉스 푸시다운', category: 'arms' },
  { id: 'plank', name: '플랭크', category: 'core' },
  { id: 'crunch', name: '크런치', category: 'core' },
  { id: 'hip-thrust', name: '힙쓰러스트', category: 'legs' },
  { id: 'calf-raise', name: '카프레이즈', category: 'legs' },
]
