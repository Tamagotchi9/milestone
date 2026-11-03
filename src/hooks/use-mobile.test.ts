import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useIsMobile } from './use-mobile'

const stubViewport = (matches: boolean) => {
  const listeners = new Set<() => void>()
  const mql = {
    matches,
    addEventListener: (_: string, listener: () => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_: string, listener: () => void) => {
      listeners.delete(listener)
    },
  }

  vi.stubGlobal('matchMedia', () => mql)

  const resize = (nextMatches: boolean) => {
    mql.matches = nextMatches
    listeners.forEach((listener) => listener())
  }

  return { resize, listeners }
}

it('reports a narrow viewport as mobile', () => {
  stubViewport(true)

  const { result } = renderHook(() => useIsMobile())

  expect(result.current).toBe(true)
})

it('updates when the viewport crosses the breakpoint', () => {
  const { resize } = stubViewport(false)
  const { result } = renderHook(() => useIsMobile())

  act(() => resize(true))

  expect(result.current).toBe(true)
})

it('stops listening after unmount', () => {
  const { listeners } = stubViewport(false)
  const { unmount } = renderHook(() => useIsMobile())

  unmount()

  expect(listeners.size).toBe(0)
})
