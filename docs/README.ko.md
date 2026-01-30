# ArkFolio

> 하이브리드 암호화폐 자산 통합 관리 - CEX, DEX, 온체인 자산을 하나로 관리하는 데스크톱 애플리케이션

[English](../README.md)

## 개요

ArkFolio는 모든 암호화폐 자산을 한 곳에서 관리할 수 있는 프라이버시 중심의 데스크톱 애플리케이션입니다. 클라우드 기반 포트폴리오 트래커와 달리, ArkFolio는 암호화된 로컬 저장소를 사용하여 모든 데이터를 저장하므로 금융 데이터에 대한 완전한 통제권을 가질 수 있습니다.

## 주요 기능

### 구현 완료
- **CEX 연동** - API를 통한 바이낸스, 업비트, OKX 계정 연결
  - 현물 잔고 추적
  - 선물/무기한 포지션 모니터링
  - 실시간 WebSocket 업데이트 (준비됨)
- **보안 저장소** - Electron safeStorage를 통한 OS 수준 API 키 암호화
- **로컬 데이터베이스** - OPFS를 활용한 SQLite WASM으로 영구적이고 안전한 저장
- **모던 UI** - 반응형 레이아웃의 다크 테마 대시보드

### 개발 예정
- **DEX 연동** - Hyperliquid, dYdX 무기한 포지션 추적
- **온체인 추적** - 멀티체인 지갑 모니터링 (EVM + Solana)
- **DeFi 분석** - LP 포지션, 렌딩 프로토콜, 이자 농사
- **한국 세금 신고 지원** - 이동평균법 원가 계산, 홈택스 호환 리포트
- **리스크 관리** - 포트폴리오 건전성 모니터링, 청산가 알림
- **Google Drive 백업** - 암호화된 클라우드 백업 옵션

## 스크린샷

*준비 중*

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Electron + Vite + React 18 |
| 언어 | TypeScript |
| 데이터베이스 | SQLite WASM (sql.js) + OPFS |
| ORM | Drizzle ORM |
| 스타일링 | Tailwind CSS |
| 상태관리 | Zustand |
| 차트 | Lightweight Charts (TradingView) |
| 거래소 API | CCXT + 커스텀 어댑터 |

## 설치 방법

### 사전 요구사항
- Node.js 18+
- npm 또는 yarn

### 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/0xarkstar/arkfolio.git
cd arkfolio

# 의존성 설치
npm install

# 개발 서버 시작
npm run dev
```

### 프로덕션 빌드

```bash
# 애플리케이션 빌드
npm run build

# 빌드된 애플리케이션은 dist/ 디렉토리에 생성됩니다
```

## 프로젝트 구조

```
arkfolio/
├── electron/
│   ├── main.ts              # Electron 메인 프로세스
│   ├── preload.ts           # IPC 브릿지
│   └── services/
│       └── safeStorage.ts   # API 키 암호화
├── src/
│   ├── components/          # 공유 UI 컴포넌트
│   │   └── layout/          # 레이아웃 컴포넌트
│   ├── features/
│   │   ├── cex/             # CEX 연동
│   │   ├── dex/             # DEX 연동 (예정)
│   │   ├── onchain/         # 지갑 추적 (예정)
│   │   ├── defi/            # DeFi 분석 (예정)
│   │   ├── tax/             # 세금 신고 (예정)
│   │   └── settings/        # 앱 설정
│   ├── database/
│   │   ├── schema.ts        # Drizzle 스키마 (11개 테이블)
│   │   └── init.ts          # SQLite WASM 초기화
│   ├── services/
│   │   └── exchanges/       # 거래소 API 어댑터
│   └── stores/              # Zustand 상태 관리
└── public/
    └── sql-wasm.wasm        # SQLite WASM 바이너리
```

## 개발 현황

| 기능 | 상태 | 진행률 |
|------|------|--------|
| 프로젝트 설정 (Electron + Vite + React) | 완료 | 100% |
| SQLite WASM + OPFS 저장소 | 완료 | 100% |
| 데이터베이스 스키마 (Drizzle ORM) | 완료 | 100% |
| Electron safeStorage | 완료 | 100% |
| CEX 어댑터 (바이낸스, 업비트, OKX) | 완료 | 100% |
| UI 레이아웃 및 네비게이션 | 완료 | 100% |
| 포트폴리오 페이지 | 진행 중 | 30% |
| 설정 페이지 | 진행 중 | 50% |
| 지갑 페이지 | 목업 | 5% |
| DeFi 페이지 | 목업 | 5% |
| 세금 페이지 | 목업 | 5% |
| DEX 연동 | 미시작 | 0% |
| 온체인 인덱싱 | 미시작 | 0% |
| 가격 오라클 | 미시작 | 0% |

## 로드맵

### Phase 1: 기초 (현재)
- [x] Electron + Vite + React 설정
- [x] OPFS 기반 SQLite WASM
- [x] Drizzle ORM 스키마
- [x] CEX 어댑터 (바이낸스, 업비트, OKX)
- [x] 기본 UI 레이아웃

### Phase 2: CEX 완성
- [ ] WebSocket 실시간 잔고 동기화
- [ ] 거래 내역 가져오기
- [ ] 포트폴리오 집계 로직
- [ ] 가격 피드 연동

### Phase 3: DEX & 온체인
- [ ] Hyperliquid 연동
- [ ] dYdX v4 연동
- [ ] EVM 지갑 추적
- [ ] Solana 지갑 추적

### Phase 4: DeFi & 분석
- [ ] LP 포지션 추적
- [ ] 렌딩 프로토콜 연동
- [ ] Pendle PT/YT 지원
- [ ] 포인트/에어드랍 추적

### Phase 5: 세금 & 컴플라이언스
- [ ] 한국 세금 계산 엔진
- [ ] 거래 분류
- [ ] 홈택스 내보내기 형식
- [ ] 감사 추적 지원

### Phase 6: 리스크 & 백업
- [ ] 순자산 계산
- [ ] 청산가 알림
- [ ] Google Drive 백업
- [ ] 멀티 디바이스 동기화

## 데이터베이스 스키마

ArkFolio는 11개의 테이블을 사용하여 암호화폐 포트폴리오를 추적합니다:

- `exchanges` - 연결된 거래소 계정
- `balances` - 자산 잔고 (현물, 선물, 마진, 적립)
- `positions` - 선물/무기한 포지션
- `transactions` - 거래 및 이체 내역
- `wallets` - 온체인 지갑 주소
- `onchain_assets` - 지갑별 토큰 잔고
- `defi_positions` - DeFi 프로토콜 포지션
- `points` - 프로토콜 포인트 및 에어드랍
- `price_history` - 과거 가격 데이터
- `tax_reports` - 생성된 세금 리포트
- `settings` - 애플리케이션 설정

## 보안

- **클라우드 저장 없음** - 모든 데이터는 로컬 기기에만 저장
- **API 키 암호화** - OS 수준 암호화 사용 (macOS Keychain, Windows Credential Manager)
- **읽기 전용 API 키** - 거래소 API는 읽기 권한만 필요
- **트래킹 없음** - 원격 측정 또는 분석 기능 없음

## 기여하기

기여는 언제나 환영합니다! Pull Request를 자유롭게 제출해 주세요.

1. 저장소 포크
2. 기능 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'Add some amazing feature'`)
4. 브랜치에 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 열기

## 라이선스

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다 - 자세한 내용은 [LICENSE](../LICENSE) 파일을 참조하세요.

## 감사의 말

- [CCXT](https://github.com/ccxt/ccxt) - 암호화폐 거래소 트레이딩 라이브러리
- [sql.js](https://github.com/sql-js/sql.js) - WebAssembly로 컴파일된 SQLite
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [Lightweight Charts](https://github.com/nicholasdavies/lightweight-charts) - TradingView 차트 라이브러리

---

[ArkStar](https://github.com/0xarkstar)가 정성껏 만들었습니다
