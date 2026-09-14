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

/** 사용자 클릭 제스처 안에서 호출해야 브라우저가 허용함 */
export async function enterSlideshowFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return
  if (document.fullscreenElement) return
  const root = document.documentElement
  if (!root.requestFullscreen) return
  try {
    await root.requestFullscreen()
  } catch {
    /* 권한·정책으로 거부될 수 있음 — 슬라이드쇼는 계속 */
  }
}
