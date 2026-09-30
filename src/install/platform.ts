export interface InstallEnv {
  userAgent: string
  maxTouchPoints: number
  standalone: boolean
}

export function isIos(env: InstallEnv): boolean {
  // iPadOS w trybie „witryna na komputer” przedstawia się jako Macintosh, ale ma ekran dotykowy.
  return /iPad|iPhone|iPod/.test(env.userAgent) || (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1)
}

export function shouldShowIosInstallHint(env: InstallEnv, dismissed: boolean): boolean {
  return isIos(env) && !env.standalone && !dismissed
}

export function readInstallEnv(): InstallEnv {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone: window.matchMedia?.('(display-mode: standalone)')?.matches === true || iosStandalone,
  }
}
