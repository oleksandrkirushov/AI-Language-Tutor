import { useEffect } from 'react'

interface SpaceKeyOptions {
  enabled: boolean
  onSpace: () => void
  onFocusLost: () => void
}

function isSpaceShortcut(event: KeyboardEvent): boolean {
  if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey) {
    return false
  }
  const { target } = event
  const isTyping =
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  return !isTyping
}

export function useSpaceKey({ enabled, onSpace, onFocusLost }: SpaceKeyOptions) {
  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isSpaceShortcut(event)) {
        return
      }
      event.preventDefault() // no page scroll, and no click on a focused button
      if (!event.repeat) {
        onSpace()
      }
    }

    // Some browsers click a focused button on keyup, even after keydown was handled
    const handleKeyUp = (event: KeyboardEvent) => {
      if (isSpaceShortcut(event)) {
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', onFocusLost)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', onFocusLost)
    }
  }, [enabled, onSpace, onFocusLost])
}
