'use client'

// Shared drag-and-drop hook for every image upload zone in the app. Spread the
// returned handlers on any container (button, div, dashed slot) to make it
// accept dropped image files. `isDragging` reflects an in-progress drag over
// the container so you can add a highlight border.
//
// Behaviour:
// - Accepts image/* files only (silently drops non-image entries).
// - Respects `multiple: false` — drops after the first if the caller asked for one.
// - Ignores drags that don't carry files (prevents drag-selecting text from
//   turning the whole page into a highlighted target).

import { useCallback, useRef, useState, type DragEvent } from 'react'

interface UseImageDropOptions {
  onFiles: (files: File[]) => void
  multiple?: boolean
  disabled?: boolean
}

export function useImageDrop({ onFiles, multiple = true, disabled = false }: UseImageDropOptions) {
  const [isDragging, setIsDragging] = useState(false)
  // Chrome fires dragenter/dragleave on every child element as the cursor
  // moves over them — a simple boolean flickers. Counter tracks nested
  // enters/leaves so we only flip when the drag really enters or leaves.
  const depth = useRef(0)

  const handleDragEnter = useCallback((e: DragEvent) => {
    if (disabled) return
    if (!e.dataTransfer?.types?.includes('Files')) return
    e.preventDefault()
    depth.current += 1
    setIsDragging(true)
  }, [disabled])

  const handleDragOver = useCallback((e: DragEvent) => {
    if (disabled) return
    if (!e.dataTransfer?.types?.includes('Files')) return
    e.preventDefault()
    // Signals to the OS that this is a valid drop target so the cursor shows
    // the copy indicator instead of the "not allowed" symbol.
    e.dataTransfer.dropEffect = 'copy'
  }, [disabled])

  const handleDragLeave = useCallback((e: DragEvent) => {
    if (disabled) return
    if (!e.dataTransfer?.types?.includes('Files')) return
    e.preventDefault()
    depth.current = Math.max(0, depth.current - 1)
    if (depth.current === 0) setIsDragging(false)
  }, [disabled])

  const handleDrop = useCallback((e: DragEvent) => {
    if (disabled) return
    e.preventDefault()
    depth.current = 0
    setIsDragging(false)
    const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'))
    if (!files.length) return
    onFiles(multiple ? files : files.slice(0, 1))
  }, [disabled, multiple, onFiles])

  return {
    isDragging,
    dropzoneProps: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  }
}
