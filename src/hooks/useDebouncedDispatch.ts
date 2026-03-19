"use client"

import { useCallback, useRef, Dispatch } from "react"

/**
 * Wraps a dispatch function to batch rapid-fire actions (e.g. slider drags)
 * using requestAnimationFrame. Only the LAST action in a frame is dispatched.
 */
export function useDebouncedDispatch<A>(dispatch: Dispatch<A>): Dispatch<A> {
  const pending = useRef<A | null>(null)
  const raf = useRef<number | null>(null)

  return useCallback(
    (action: A) => {
      pending.current = action
      if (raf.current === null) {
        raf.current = requestAnimationFrame(() => {
          if (pending.current !== null) {
            dispatch(pending.current)
          }
          pending.current = null
          raf.current = null
        })
      }
    },
    [dispatch]
  )
}
