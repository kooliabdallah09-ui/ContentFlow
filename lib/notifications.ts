import { ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  message: string
  description?: string
  duration?: number
  /**
   * Survive client-side navigation. Defaults to false: a toast belongs to the
   * page that raised it, so an error from one screen can't follow you onto an
   * unrelated one and look like it came from whatever you're now looking at.
   *
   * Opt in for hand-offs that deliberately report on the previous page's work
   * ("charged N credits", "now available in the UGC step").
   */
  persist?: boolean
  action?: {
    label: string
    onClick: () => void
  }
}

export interface ToastOptions {
  duration?: number
  persist?: boolean
}

let toastCallbacks: Set<(toast: Toast) => void> = new Set()

export function subscribeToToasts(callback: (toast: Toast) => void) {
  toastCallbacks.add(callback)
  return () => toastCallbacks.delete(callback)
}

export function showToast(
  type: ToastType,
  message: string,
  description?: string,
  options: ToastOptions = {}
) {
  const { duration = 5000, persist = false } = options
  const id = `${Date.now()}-${Math.random()}`
  const toast: Toast = {
    id,
    type,
    message,
    description,
    duration,
    persist,
  }

  toastCallbacks.forEach((cb) => cb(toast))

  if (duration > 0) {
    setTimeout(() => {
      removeToast(id)
    }, duration)
  }

  return id
}

export function removeToast(id: string) {
  toastCallbacks.forEach((cb) =>
    cb({ id, type: 'info', message: '', duration: 0 })
  )
}

export function showSuccess(message: string, description?: string, options?: ToastOptions) {
  return showToast('success', message, description, options)
}

export function showError(message: string, description?: string, options?: ToastOptions) {
  return showToast('error', message, description, options)
}

export function showInfo(message: string, description?: string, options?: ToastOptions) {
  return showToast('info', message, description, options)
}

export function showWarning(message: string, description?: string, options?: ToastOptions) {
  return showToast('warning', message, description, options)
}
