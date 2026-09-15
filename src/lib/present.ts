import type { MassSession } from '../types/mass'

/** 곧 시작할 미사, 없으면 가장 최근 일정 */
export function pickDefaultMass(masses: MassSession[]): MassSession | undefined {
  if (!masses.length) return undefined
  const now = Date.now()
  const sorted = [...masses].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  )
  // 3시간 전까지는 "진행 중"으로 보고 고름
  const graceMs = 3 * 60 * 60 * 1000
  const upcoming = sorted.find((m) => new Date(m.scheduledAt).getTime() >= now - graceMs)
  return upcoming ?? sorted[sorted.length - 1]
}

type KeyboardNavigator = Navigator & {
  keyboard?: {
    lock: (keyCodes?: string[]) => Promise<void>
    unlock: () => void
  }
}

function supportsKeyboardLock(): boolean {
  if (typeof navigator === 'undefined') return false
  const kb = (navigator as KeyboardNavigator).keyboard
  return Boolean(kb && typeof kb.lock === 'function')
}

async function lockEscapeKey(): Promise<void> {
  if (!supportsKeyboardLock()) return
  try {
    await (navigator as KeyboardNavigator).keyboard!.lock(['Escape'])
  } catch {
    /* 권한·미지원 — Esc는 브라우저 기본(전체화면 해제)으로 동작 */
  }
}

function unlockKeyboard(): void {
  if (!supportsKeyboardLock()) return
  try {
    ;(navigator as KeyboardNavigator).keyboard!.unlock()
  } catch {
    /* ignore */
  }
}

let fullscreenLockHooked = false

function ensureFullscreenKeyboardHook(): void {
  if (typeof document === 'undefined' || fullscreenLockHooked) return
  fullscreenLockHooked = true
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      void lockEscapeKey()
    } else {
      unlockKeyboard()
    }
  })
}

/** 사용자 클릭 제스처 안에서 호출해야 브라우저가 허용함 */
export async function enterSlideshowFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return
  ensureFullscreenKeyboardHook()
  if (document.fullscreenElement) {
    await lockEscapeKey()
    return
  }
  const root = document.documentElement
  if (!root.requestFullscreen) return
  try {
    // 최신 스펙: keyboardLock 옵션 (미지원 브라우저는 무시되거나 실패 시 폴백)
    const req = root.requestFullscreen as (
      options?: FullscreenOptions & { keyboardLock?: string },
    ) => Promise<void>
    try {
      await req.call(root, { keyboardLock: 'browser' })
    } catch {
      await root.requestFullscreen()
    }
    await lockEscapeKey()
  } catch {
    /* 권한·정책으로 거부될 수 있음 — 슬라이드쇼는 계속 */
  }
}
