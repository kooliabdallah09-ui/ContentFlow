import { showSuccess, showError } from './notifications'

export interface BatchJob {
  id: string
  type: 'images' | 'voices' | 'videos'
  items: Array<{
    id: string
    settings: any
    status: 'pending' | 'processing' | 'completed' | 'failed'
    error?: string
  }>
  startedAt: number
  completedAt?: number
  totalCredits: number
}

class BatchGenerator {
  private jobs: Map<string, BatchJob> = new Map()

  createBatch(type: 'images' | 'voices' | 'videos', items: any[]): string {
    const jobId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const job: BatchJob = {
      id: jobId,
      type,
      items: items.map((settings, idx) => ({
        id: `item-${idx}`,
        settings,
        status: 'pending',
      })),
      startedAt: Date.now(),
      totalCredits: 0,
    }

    this.jobs.set(jobId, job)
    return jobId
  }

  getJob(jobId: string): BatchJob | undefined {
    return this.jobs.get(jobId)
  }

  async processBatch(
    jobId: string,
    endpoint: string,
    token: string
  ): Promise<{ success: boolean; results: any[] }> {
    const job = this.jobs.get(jobId)
    if (!job) {
      throw new Error('Batch job not found')
    }

    const results: any[] = []
    let completedCount = 0
    let failedCount = 0

    for (const item of job.items) {
      try {
        item.status = 'processing'

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(item.settings),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Generation failed')
        }

        const data = await response.json()
        item.status = 'completed'
        job.totalCredits += data.creditsCost || 0
        completedCount++
        results.push(data)
      } catch (err) {
        item.status = 'failed'
        item.error = err instanceof Error ? err.message : 'Unknown error'
        failedCount++
        results.push(null)
      }
    }

    job.completedAt = Date.now()

    if (failedCount === 0) {
      showSuccess(`Batch complete`, `All ${completedCount} items generated successfully`)
    } else {
      showError(
        `Batch completed with errors`,
        `${completedCount} succeeded, ${failedCount} failed`
      )
    }

    return { success: failedCount === 0, results }
  }

  clearJob(jobId: string): void {
    this.jobs.delete(jobId)
  }

  getProgress(jobId: string): { completed: number; total: number; percentage: number } {
    const job = this.jobs.get(jobId)
    if (!job) {
      return { completed: 0, total: 0, percentage: 0 }
    }

    const completed = job.items.filter((item) => item.status !== 'pending').length
    const total = job.items.length

    return {
      completed,
      total,
      percentage: Math.round((completed / total) * 100),
    }
  }
}

export const batchGenerator = new BatchGenerator()
