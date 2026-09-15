import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import FocusStatsCharts from '~/components/dashboard/FocusStatsCharts.client.vue'
import type { PomodoroDailyStat } from '~/types/pomodoro.types'

const makeStat = (
  overrides: Partial<PomodoroDailyStat> = {},
): PomodoroDailyStat => ({
  date: '2026-09-14',
  completedTotal: 2,
  secondsTotal: 3000,
  completedForTask: 1,
  secondsForTask: 1500,
  ...overrides,
})

const chartStub = (name: string) => ({
  name,
  props: ['data', 'categories', 'yAxis', 'loading', 'tooltipTitleFormatter'],
  template: `<div :data-chart="'${name}'" />`,
})

const mountCharts = (props: {
  stats: PomodoroDailyStat[]
  focusedTaskTitle?: string | null
  loading?: boolean
  error?: string | null
}) =>
  mountSuspended(FocusStatsCharts, {
    props,
    global: {
      stubs: {
        AreaChart: chartStub('AreaChart'),
        BarChart: chartStub('BarChart'),
      },
    },
  })

describe('focus stats charts', () => {
  it('maps daily totals and focused-task values into both charts', async () => {
    const stats = [
      makeStat({ date: '2026-09-13', completedTotal: 1, secondsTotal: 600 }),
      makeStat(),
    ]
    const wrapper = await mountCharts({
      stats,
      focusedTaskTitle: 'Write tests',
    })
    const areaChart = wrapper.findComponent({ name: 'AreaChart' })
    const barChart = wrapper.findComponent({ name: 'BarChart' })

    expect(areaChart.props('data')).toEqual([
      expect.objectContaining({
        date: '2026-09-13',
        totalMinutes: 10,
        focusedMinutes: 25,
      }),
      expect.objectContaining({
        date: '2026-09-14',
        totalMinutes: 50,
        focusedMinutes: 25,
      }),
    ])
    expect(areaChart.props('categories')).toEqual({
      totalMinutes: { name: 'All focus time' },
      focusedMinutes: { name: 'Focused task' },
    })
    expect(barChart.props('yAxis')).toEqual([
      'totalPomodoros',
      'focusedPomodoros',
    ])
    expect(wrapper.text()).toContain('1h')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('Write tests')
    wrapper.unmount()
  })

  it('omits focused-task series when no task is selected', async () => {
    const wrapper = await mountCharts({ stats: [makeStat()] })

    expect(
      wrapper.findComponent({ name: 'AreaChart' }).props('categories'),
    ).toEqual({
      totalMinutes: { name: 'All focus time' },
    })
    expect(wrapper.findComponent({ name: 'BarChart' }).props('yAxis')).toEqual([
      'totalPomodoros',
    ])
    wrapper.unmount()
  })

  it('shows loading charts before data arrives', async () => {
    const wrapper = await mountCharts({ stats: [], loading: true })

    expect(wrapper.findAll('[data-chart]')).toHaveLength(2)
    expect(wrapper.findComponent({ name: 'AreaChart' }).props('loading')).toBe(
      true,
    )
    wrapper.unmount()
  })

  it('shows explicit empty and error states', async () => {
    const emptyWrapper = await mountCharts({ stats: [] })
    expect(emptyWrapper.text()).toContain('No completed focus sessions yet')
    expect(emptyWrapper.find('[data-chart]').exists()).toBe(false)
    emptyWrapper.unmount()

    const errorWrapper = await mountCharts({ stats: [], error: 'Denied' })
    expect(errorWrapper.get('[role="alert"]').text()).toContain(
      'Couldn’t load focus analytics.',
    )
    expect(errorWrapper.find('[data-chart]').exists()).toBe(false)
    errorWrapper.unmount()
  })
})
