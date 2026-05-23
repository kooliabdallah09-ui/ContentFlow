import { useEffect, useRef } from 'react'

interface UseAutoSaveOptions {
  key: string
  delay?: number
  onRestore?: (data: any) => void
}

export function useAutoSave<T extends Record<string, any>>(
  data: T,
  options: UseAutoSaveOptions
) {
  const { key, delay = 1000, onRestore } = options
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Restore data on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        const restoredData = JSON.parse(saved)
        onRestore?.(restoredData)
      } catch (err) {
        console.error('Failed to restore auto-saved data:', err)
      }
    }
  }, [key, onRestore])

  // Auto-save data
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout for auto-save
    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(data))
      } catch (err) {
        console.error('Failed to auto-save data:', err)
      }
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [data, key, delay])

  const clearSaved = () => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(key)
  }

  return { clearSaved }
}
