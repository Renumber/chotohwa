# 초토화 (chotohwa)

개인용 헬스·식단 기록 모바일 웹 앱. 모든 데이터는 브라우저 로컬(IndexedDB)에 저장되며, 서버 없이 동작합니다.

## 주요 기능

### 기록
- **운동** — 프리셋 선택 + 직접 추가, 세트(kg × 반복) 기록, 이전 기록 힌트
- **유산소** — 종류, 시간, 거리, 칼로리
- **식단** — 끼니별 음식 + 칼로리·탄수·단백·지방, 일일 합계

### 데이터 관리
- **자동 저장** — 입력 즉시 IndexedDB 반영
- **백업 / 복원** — JSON 파일로 전체 데이터보내기·가져오기 (병합 / 덮어쓰기)
- **AI 연동용보내기** — 마크다운, 포터블 JSON, 프롬프트 형식 (ChatGPT·Claude 등에 붙여넣기)

### 코치 (실험)
- 최근 7일 데이터 기반 피드백
- 기본: 규칙 기반 분석
- 선택: OpenAI / Claude API 연동 (API 키는 기기에만 저장)

### PWA
- 홈 화면 추가, 오프라인 UI 지원

### 데스크탑
- 중앙 모바일 폭(`max-w-lg`) 유지, 좌우 여백으로 동일한 UX

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Vue 3 + TypeScript + Vite |
| 스타일 | Tailwind CSS v4 |
| 로컬 DB | Dexie (IndexedDB) |
| 상태 | Pinia |
| PWA | vite-plugin-pwa |
| 배포 | AWS Amplify Hosting |

## 시작하기

### 요구 사항

- Node.js 20+

### 로컬 개발

```bash
npm install
npm run dev
```

### 빌드

```bash
npm run build
npm run preview   # 빌드 결과 미리보기
```

## 배포 (AWS Amplify)

저장소 루트의 [`amplify.yml`](amplify.yml)이 빌드를 자동 설정합니다.

1. [AWS Amplify Console](https://console.aws.amazon.com/amplify/) → **Host web app**
2. GitHub `chotohwa` 저장소 연결
3. 빌드 설정 자동 감지 후 배포

| 항목 | 값 |
|------|-----|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node | 20 (`.nvmrc` 참고) |

[`customHttp.yml`](customHttp.yml)에서 SPA 라우팅 rewrite와 PWA 캐시 헤더를 처리합니다.

## 프로젝트 구조

```
src/
├── views/          # 오늘, 기록, 코치, 설정
├── components/     # 운동·식단·레이아웃 UI
├── db/             # Dexie 스키마 및 CRUD
├── services/
│   ├── export/     # 백업, AI 연동용보내기
│   └── coach/      # 데이터 집계, AI Provider
├── composables/
├── stores/
└── types/
```

## 데이터 위치

| 저장소 | 내용 |
|--------|------|
| `dayLogs` | 일별 운동·유산소·식단 |
| `customExercises` | 사용자 추가 운동 |
| `settings` | 목표, AI 설정 |

데이터는 **이 기기의 브라우저에만** 존재합니다. 백업 파일을 잃어버리면 복구할 수 없으니 정기적으로보내기를 권장합니다.

## 라이선스

Private — 개인용 프로젝트
