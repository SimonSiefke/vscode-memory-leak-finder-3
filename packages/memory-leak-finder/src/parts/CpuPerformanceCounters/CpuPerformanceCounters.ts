export interface CpuPerformanceCounter {
  readonly available: boolean
  readonly event: string
  readonly name: string
  readonly unit: string
  readonly value: number | null
}

export interface CpuPerformanceCountersSample {
  readonly command: readonly string[]
  readonly counters?: readonly CpuPerformanceCounter[]
  readonly cycles: number | null
  readonly instructions: number | null
  readonly perfPid?: number
  readonly pid: number
  readonly rawOutput: string
}

const counterSpecs = [
  {
    event: 'instructions:u',
    name: 'instructions',
    unit: 'count',
  },
  {
    event: 'cycles:u',
    name: 'cycles',
    unit: 'count',
  },
] as const

const counterUnits: Record<string, string> = {
  'context-switches': 'count',
  'cpu-migrations': 'count',
  cycles: 'count',
  instructions: 'count',
  'page-faults': 'count',
  'task-clock': 'usec',
}

const parseCounterValue = (value: string): number | null => {
  const normalized = value.trim()
  if (!normalized || normalized.startsWith('<')) {
    return null
  }
  const parsed = Number(normalized.replaceAll(',', ''))
  if (!Number.isFinite(parsed)) {
    return null
  }
  return parsed
}

const normalizeEventName = (eventName: string): string => {
  return eventName.trim().split(':')[0]
}

const getConfiguredEvents = (command: readonly string[]): readonly string[] => {
  const eventsIndex = command.indexOf('-e')
  if (eventsIndex === -1) {
    return []
  }
  const events = command[eventsIndex + 1]
  if (!events) {
    return []
  }
  return events.split(',').map((event) => event.trim()).filter(Boolean)
}

const toCounterRow = (event: string, value: number | null): CpuPerformanceCounter => {
  const name = normalizeEventName(event)
  return {
    available: typeof value === 'number',
    event,
    name,
    unit: counterUnits[name] || 'count',
    value,
  }
}

export const parsePerfStatOutput = (rawOutput: string): Pick<CpuPerformanceCountersSample, 'counters' | 'cycles' | 'instructions'> => {
  const counters: Record<string, number | null> = Object.create(null)
  const events: Record<string, string> = Object.create(null)
  const lines = rawOutput.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const csvParts = trimmed.split(',')
    if (csvParts.length >= 3 && csvParts[1] === '' && csvParts[2]) {
      const event = csvParts[2].trim()
      const name = normalizeEventName(event)
      events[name] = event
      counters[name] = parseCounterValue(csvParts[0])
      continue
    }
    const textMatch = /^\s*([0-9,.]+|<[^>]+>)\s+([A-Za-z][\w:.-]*)/.exec(line)
    if (textMatch) {
      const event = textMatch[2]
      const name = normalizeEventName(event)
      events[name] = event
      counters[name] = parseCounterValue(textMatch[1])
    }
  }
  const rows = Object.keys(counters).toSorted().map((name) => toCounterRow(events[name] || name, counters[name]))
  return {
    counters: rows,
    cycles: counters.cycles ?? null,
    instructions: counters.instructions ?? null,
  }
}

export const toCpuPerformanceCounterRows = (sample: CpuPerformanceCountersSample): readonly CpuPerformanceCounter[] => {
  if (sample.counters?.length) {
    return sample.counters
  }
  const configuredEvents = Object.fromEntries(getConfiguredEvents(sample.command).map((event) => [normalizeEventName(event), event]))
  return counterSpecs.map((spec) => {
    const value = sample[spec.name]
    return {
      available: typeof value === 'number',
      event: configuredEvents[spec.name] || spec.event,
      name: spec.name,
      unit: spec.unit,
      value,
    }
  })
}

export const formatCpuPerformanceCountersSummary = (metrics: readonly CpuPerformanceCounter[]): string => {
  const availableMetrics = metrics.filter((metric) => metric.available)
  if (availableMetrics.length === 0) {
    return 'No CPU performance counters were available'
  }
  const lines = ['CPU performance counters:', 'metric | value | unit']
  for (const metric of availableMetrics) {
    lines.push(`${metric.name} | ${metric.value} | ${metric.unit}`)
  }
  return lines.join('\n')
}
