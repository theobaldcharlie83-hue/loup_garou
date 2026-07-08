import { useEffect, useRef } from 'react'

/**
 * Piège le focus clavier à l'intérieur d'un conteneur de modale et gère la touche
 * Échap. Accessibilité : empêche de tabuler « derrière » la modale et restaure le
 * focus précédent à la fermeture.
 *
 * @param {React.RefObject<HTMLElement>} ref  conteneur de la modale
 * @param {boolean} active                    le piège est-il actif (modale montée/visible)
 * @param {() => void} [onEscape]             rappel sur la touche Échap
 */
export function useFocusTrap(ref, active = true, onEscape) {
  // onEscape via ref pour ne pas relancer l'effet (et re-focuser) à chaque rendu.
  const onEscapeRef = useRef(onEscape)
  useEffect(() => {
    onEscapeRef.current = onEscape
  }, [onEscape])

  useEffect(() => {
    if (!active || !ref.current) return
    const node = ref.current
    const previouslyFocused = document.activeElement

    const SELECTOR =
      'a[href],button:not([disabled]),textarea,input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
    const focusable = () =>
      Array.from(node.querySelectorAll(SELECTOR)).filter((el) => el.offsetParent !== null)

    focusable()[0]?.focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && onEscapeRef.current) {
        e.stopPropagation()
        onEscapeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const els = focusable()
      if (els.length === 0) return
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
      }
    }
  }, [ref, active])
}
