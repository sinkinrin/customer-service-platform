import { describe, expect, it } from 'vitest'
import { getActiveStateIds, mapStateIdToString, ZAMMAD_STATE_IDS } from '@/lib/constants/zammad-states'

describe('zammad state mapping', () => {
  it('maps both pending-close state ids to pending close', () => {
    expect(mapStateIdToString(6)).toBe('pending close')
    expect(mapStateIdToString(7)).toBe('pending close')
  })

  it('counts the alternate pending-close state as active', () => {
    expect(getActiveStateIds()).toContain(ZAMMAD_STATE_IDS.PENDING_CLOSE_ALT)
  })
})
