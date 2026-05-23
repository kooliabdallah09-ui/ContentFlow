import { ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  message: string
  description?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
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
  duration = 5000
) {
  const id = `${Date.now()}-${Math.random()}`
  const toast: Toast = {
    id,
    type,
    message,
    description,
    duration,
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

export function showSuccess(message: string, description?: string) {
  return showToast('success', message, description)
}

export function showError(message: string, description?: string) {
  return showToast('error', message, description)
}

export function showInfo(message: string, description?: string) {
  return showToast('info', message, description)
}

export function showWarning(message: string, description?: string) {
  return showToast('warning', message, description)
}
