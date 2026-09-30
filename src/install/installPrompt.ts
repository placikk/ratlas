import { useSyncExternalStore } from 'react'

// Chrome na Androidzie zgłasza „beforeinstallprompt”, gdy aplikację można zainstalować.
// Zdarzenie przychodzi raz, często zanim wyrenderuje się przycisk — dlatego łapiemy je globalnie przy starcie.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function listenForInstallPrompt(target: Window = window): void {
  target.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    notify()
  })
  target.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void> } {
  const canInstall = useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  )

  async function install() {
    const event = deferred
    if (!event) return
    // Zdarzenia można użyć tylko raz.
    deferred = null
    notify()
    await event.prompt()
  }

  return { canInstall, install }
}
