/**
 * 区域常量和映射测试
 */

import { describe, it, expect } from 'vitest'
import {
  REGIONS,
  REGION_GROUP_MAPPING,
  GROUP_REGION_MAPPING,
  getGroupIdByRegion,
  getRegionByGroupId,
  getRegionLabel,
  isValidRegion,
} from '@/lib/constants/regions'

describe('Regions Constants', () => {
  describe('REGIONS 数组', () => {
    it('应该包含 8 个区域', () => {
      expect(REGIONS).toHaveLength(8)
    })

    it('每个区域应该有 value, label, labelEn', () => {
      REGIONS.forEach(region => {
        expect(region).toHaveProperty('value')
        expect(region).toHaveProperty('label')
        expect(region).toHaveProperty('labelEn')
        expect(typeof region.value).toBe('string')
        expect(typeof region.label).toBe('string')
        expect(typeof region.labelEn).toBe('string')
      })
    })

    it('应该包含所有预期的区域', () => {
      const regionValues = REGIONS.map(r => r.value)
      expect(regionValues).toContain('asia-pacific')
      expect(regionValues).toContain('middle-east')
      expect(regionValues).toContain('africa')
      expect(regionValues).toContain('north-america')
      expect(regionValues).toContain('latin-america')
      expect(regionValues).toContain('europe-zone-1')
      expect(regionValues).toContain('europe-zone-2')
      expect(regionValues).toContain('cis')
    })

    it('区域值应该唯一', () => {
      const values = REGIONS.map(r => r.value)
      const uniqueValues = [...new Set(values)]
      expect(values.length).toBe(uniqueValues.length)
    })
  })

  describe('REGION_GROUP_MAPPING', () => {
    it('应该为每个区域映射一个 Group ID', () => {
      REGIONS.forEach(region => {
        expect(REGION_GROUP_MAPPING[region.value]).toBeDefined()
        expect(typeof REGION_GROUP_MAPPING[region.value]).toBe('number')
      })
    })

    it('已配置的区域应该有正确的 Group ID', () => {
      expect(REGION_GROUP_MAPPING['asia-pacific']).toBe(4) // 亚太
      expect(REGION_GROUP_MAPPING['middle-east']).toBe(3) // 中东
      expect(REGION_GROUP_MAPPING['africa']).toBe(1) // 非洲 Users
      expect(REGION_GROUP_MAPPING['north-america']).toBe(6) // 北美
      expect(REGION_GROUP_MAPPING['latin-america']).toBe(7) // 拉美
      expect(REGION_GROUP_MAPPING['europe-zone-1']).toBe(2) // 欧洲
      expect(REGION_GROUP_MAPPING['europe-zone-2']).toBe(8) // 欧洲二区
      expect(REGION_GROUP_MAPPING['cis']).toBe(5) // 独联体
    })

    it('所有8个区域都已配置，不再有回退组', () => {
      REGIONS.forEach(region => {
        const groupId = REGION_GROUP_MAPPING[region.value]
        expect(groupId).toBeGreaterThan(0)
        expect(groupId).toBeLessThanOrEqual(8)
      })
    })
  })

  describe('GROUP_REGION_MAPPING', () => {
    it('应该是 REGION_GROUP_MAPPING 的反向映射', () => {
      expect(GROUP_REGION_MAPPING[1]).toBe('africa') // 非洲 Users
      expect(GROUP_REGION_MAPPING[2]).toBe('europe-zone-1') // 欧洲
      expect(GROUP_REGION_MAPPING[3]).toBe('middle-east') // 中东
      expect(GROUP_REGION_MAPPING[4]).toBe('asia-pacific') // 亚太
      expect(GROUP_REGION_MAPPING[5]).toBe('cis') // 独联体
      expect(GROUP_REGION_MAPPING[6]).toBe('north-america') // 北美
      expect(GROUP_REGION_MAPPING[7]).toBe('latin-america') // 拉美
      expect(GROUP_REGION_MAPPING[8]).toBe('europe-zone-2') // 欧洲二区
    })

    it('所有8个Group ID都应该有对应的区域', () => {
      for (let groupId = 1; groupId <= 8; groupId++) {
        expect(GROUP_REGION_MAPPING[groupId]).toBeDefined()
        expect(typeof GROUP_REGION_MAPPING[groupId]).toBe('string')
      }
    })
  })

  describe('getGroupIdByRegion', () => {
    it('应该返回正确的 Group ID', () => {
      expect(getGroupIdByRegion('asia-pacific')).toBe(4) // 亚太
      expect(getGroupIdByRegion('middle-east')).toBe(3) // 中东
      expect(getGroupIdByRegion('africa')).toBe(1) // 非洲 Users
      expect(getGroupIdByRegion('north-america')).toBe(6) // 北美
      expect(getGroupIdByRegion('latin-america')).toBe(7) // 拉美
      expect(getGroupIdByRegion('europe-zone-1')).toBe(2) // 欧洲
      expect(getGroupIdByRegion('europe-zone-2')).toBe(8) // 欧洲二区
      expect(getGroupIdByRegion('cis')).toBe(5) // 独联体
    })
  })

  describe('getRegionByGroupId', () => {
    it('应该返回正确的区域', () => {
      expect(getRegionByGroupId(1)).toBe('africa') // 非洲 Users
      expect(getRegionByGroupId(2)).toBe('europe-zone-1') // 欧洲
      expect(getRegionByGroupId(3)).toBe('middle-east') // 中东
      expect(getRegionByGroupId(4)).toBe('asia-pacific') // 亚太
      expect(getRegionByGroupId(5)).toBe('cis') // 独联体
      expect(getRegionByGroupId(6)).toBe('north-america') // 北美
      expect(getRegionByGroupId(7)).toBe('latin-america') // 拉美
      expect(getRegionByGroupId(8)).toBe('europe-zone-2') // 欧洲二区
    })

    it('不存在的 Group ID 应该返回 undefined', () => {
      expect(getRegionByGroupId(999)).toBeUndefined()
    })
  })

  describe('getRegionLabel', () => {
    it('应该返回中文标签（默认）', () => {
      const label = getRegionLabel('asia-pacific')
      expect(label).toContain('亚太区')
    })

    it('应该返回英文标签', () => {
      const label = getRegionLabel('asia-pacific', 'en')
      expect(label).toBe('Asia-Pacific')
    })

    it('无效区域应该返回原值', () => {
      const label = getRegionLabel('invalid-region' as any)
      expect(label).toBe('invalid-region')
    })
  })

  describe('isValidRegion', () => {
    it('有效区域应该返回 true', () => {
      expect(isValidRegion('asia-pacific')).toBe(true)
      expect(isValidRegion('middle-east')).toBe(true)
      expect(isValidRegion('africa')).toBe(true)
      expect(isValidRegion('cis')).toBe(true)
    })

    it('无效区域应该返回 false', () => {
      expect(isValidRegion('invalid')).toBe(false)
      expect(isValidRegion('')).toBe(false)
      expect(isValidRegion('ASIA-PACIFIC')).toBe(false) // 大小写敏感
    })
  })
})

describe('Region Business Logic', () => {
  describe('区域权限场景', () => {
    it('Staff 只能访问自己区域的工单', () => {
      const staffRegion = 'asia-pacific'
      const staffGroupId = getGroupIdByRegion(staffRegion)

      const ticketGroupId = 4 // Asia-Pacific (updated from 5)
      const ticketRegion = getRegionByGroupId(ticketGroupId)

      expect(ticketRegion).toBe(staffRegion)
      expect(staffGroupId).toBe(ticketGroupId)
    })

    it('不同区域的工单应该被过滤', () => {
      const staffRegion = 'asia-pacific'
      const staffGroupId = getGroupIdByRegion(staffRegion)
      const ticketGroupId = 3 // Middle-East (updated from 2)
      const ticketRegion = getRegionByGroupId(ticketGroupId)

      expect(ticketRegion).toBe('middle-east')
      expect(ticketRegion).not.toBe(staffRegion)
      expect(ticketGroupId).not.toBe(staffGroupId)
    })

    it('非洲区(Group ID=1)也已配置，不再是回退组', () => {
      const ticketGroupId = 1 // 非洲 Users
      const ticketRegion = getRegionByGroupId(ticketGroupId)

      expect(ticketRegion).toBe('africa')
      expect(ticketRegion).toBeDefined()
    })
  })

  describe('多语言区域显示', () => {
    it('应该支持中英文切换', () => {
      const region = 'europe-zone-1'
      const zhLabel = getRegionLabel(region, 'zh')
      const enLabel = getRegionLabel(region, 'en')
      
      expect(zhLabel).toContain('欧洲一区')
      expect(enLabel).toBe('Europe Zone 1')
    })
  })
})
