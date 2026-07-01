import { expect, test } from '@jest/globals'
import {
  formatCpuPerformanceCountersSummary,
  parsePerfStatOutput,
  toCpuPerformanceCounterRows,
} from '../src/parts/CpuPerformanceCounters/CpuPerformanceCounters.ts'
import * as PerfStat from '../src/parts/PerfStat/PerfStat.ts'

test('parsePerfStatOutput parses perf csv output', () => {
  const result = parsePerfStatOutput(`123456,,instructions:u,100.00,,
789012,,cycles:u,100.00,,
`)

  expect(result).toEqual({
    counters: [
      {
        available: true,
        event: 'cycles:u',
        name: 'cycles',
        unit: 'count',
        value: 789012,
      },
      {
        available: true,
        event: 'instructions:u',
        name: 'instructions',
        unit: 'count',
        value: 123456,
      },
    ],
    cycles: 789012,
    instructions: 123456,
  })
})

test('parsePerfStatOutput treats unsupported perf counters as unavailable', () => {
  const result = parsePerfStatOutput(`<not supported>,,instructions:u,0,100.00,,
<not supported>,,cycles:u,0,100.00,,
`)

  expect(result).toEqual({
    counters: [
      {
        available: false,
        event: 'cycles:u',
        name: 'cycles',
        unit: 'count',
        value: null,
      },
      {
        available: false,
        event: 'instructions:u',
        name: 'instructions',
        unit: 'count',
        value: null,
      },
    ],
    cycles: null,
    instructions: null,
  })
})

test('parsePerfStatOutput parses human perf output', () => {
  const result = parsePerfStatOutput(`          107,379,466      instructions:u
          134,745,265      cycles:u
`)

  expect(result).toEqual({
    counters: [
      {
        available: true,
        event: 'cycles:u',
        name: 'cycles',
        unit: 'count',
        value: 134745265,
      },
      {
        available: true,
        event: 'instructions:u',
        name: 'instructions',
        unit: 'count',
        value: 107379466,
      },
    ],
    cycles: 134745265,
    instructions: 107379466,
  })
})

test('parsePerfStatOutput parses software perf events', () => {
  const result = parsePerfStatOutput(`          672524      task-clock
               2      context-switches
               1      cpu-migrations
              80      page-faults
`)

  expect(result).toEqual({
    counters: [
      {
        available: true,
        event: 'context-switches',
        name: 'context-switches',
        unit: 'count',
        value: 2,
      },
      {
        available: true,
        event: 'cpu-migrations',
        name: 'cpu-migrations',
        unit: 'count',
        value: 1,
      },
      {
        available: true,
        event: 'page-faults',
        name: 'page-faults',
        unit: 'count',
        value: 80,
      },
      {
        available: true,
        event: 'task-clock',
        name: 'task-clock',
        unit: 'usec',
        value: 672524,
      },
    ],
    cycles: null,
    instructions: null,
  })
})

test('toCpuPerformanceCounterRows marks unavailable counters', () => {
  const rows = toCpuPerformanceCounterRows({
    command: ['perf', 'stat'],
    cycles: null,
    instructions: 10,
    pid: 123,
    rawOutput: '',
  })

  expect(rows).toEqual([
    {
      available: true,
      event: 'instructions:u',
      name: 'instructions',
      unit: 'count',
      value: 10,
    },
    {
      available: false,
      event: 'cycles:u',
      name: 'cycles',
      unit: 'count',
      value: null,
    },
  ])
})

test('toCpuPerformanceCounterRows preserves configured perf event names', () => {
  const rows = toCpuPerformanceCounterRows({
    command: ['perf', 'stat', '--no-big-num', '-x', ',', '-e', 'instructions,cycles', '-p', '123'],
    cycles: 20,
    instructions: 10,
    pid: 123,
    rawOutput: '',
  })

  expect(rows).toEqual([
    {
      available: true,
      event: 'instructions',
      name: 'instructions',
      unit: 'count',
      value: 10,
    },
    {
      available: true,
      event: 'cycles',
      name: 'cycles',
      unit: 'count',
      value: 20,
    },
  ])
})

test('formatCpuPerformanceCountersSummary returns compact text for available counters', () => {
  const summary = formatCpuPerformanceCountersSummary([
    {
      available: true,
      event: 'instructions:u',
      name: 'instructions',
      unit: 'count',
      value: 10,
    },
    {
      available: false,
      event: 'cycles:u',
      name: 'cycles',
      unit: 'count',
      value: null,
    },
  ])

  expect(summary).toBe('CPU performance counters:\nmetric | value | unit\ninstructions | 10 | count')
})

test('getPerfStatArgs uses default hardware events', () => {
  const originalEvents = process.env.VSCODE_MEMORY_LEAK_FINDER_PERF_EVENTS
  delete process.env.VSCODE_MEMORY_LEAK_FINDER_PERF_EVENTS
  try {
    expect(PerfStat.getPerfStatArgs(123)).toEqual(['stat', '--no-big-num', '-x', ',', '-e', 'instructions:u,cycles:u', '-p', '123'])
  } finally {
    if (originalEvents === undefined) {
      delete process.env.VSCODE_MEMORY_LEAK_FINDER_PERF_EVENTS
    } else {
      process.env.VSCODE_MEMORY_LEAK_FINDER_PERF_EVENTS = originalEvents
    }
  }
})

test('getPerfStatArgs uses configured hardware events', () => {
  const originalEvents = process.env.VSCODE_MEMORY_LEAK_FINDER_PERF_EVENTS
  process.env.VSCODE_MEMORY_LEAK_FINDER_PERF_EVENTS = 'instructions,cycles'
  try {
    expect(PerfStat.getPerfStatArgs(123)).toEqual(['stat', '--no-big-num', '-x', ',', '-e', 'instructions,cycles', '-p', '123'])
  } finally {
    if (originalEvents === undefined) {
      delete process.env.VSCODE_MEMORY_LEAK_FINDER_PERF_EVENTS
    } else {
      process.env.VSCODE_MEMORY_LEAK_FINDER_PERF_EVENTS = originalEvents
    }
  }
})
