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
      expect(REGION_GROUP_MAPPING['asia-pacific']).toBe(5)
      expect(REGION_GROUP_MAPPING['middle-east']).toBe(2)
      expect(REGION_GROUP_MAPPING['north-america']).toBe(7)
      expect(REGION_GROUP_MAPPING['latin-america']).toBe(4)
      expect(REGION_GROUP_MAPPING['europe-zone-1']).toBe(3)
      expect(REGION_GROUP_MAPPING['cis']).toBe(6)
    })

    it('未配置的区域应该回退到 Users 组 (ID=1)', () => {
      expect(REGION_GROUP_MAPPING['africa']).toBe(1)
      expect(REGION_GROUP_MAPPING['europe-zone-2']).toBe(1)
    })
  })

  describe('GROUP_REGION_MAPPING', () => {
    it('应该是 REGION_GROUP_MAPPING 的反向映射（排除回退组）', () => {
      expect(GROUP_REGION_MAPPING[5]).toBe('asia-pacific')
      expect(GROUP_REGION_MAPPING[2]).toBe('middle-east')
      expect(GROUP_REGION_MAPPING[7]).toBe('north-america')
      expect(GROUP_REGION_MAPPING[4]).toBe('latin-america')
      expect(GROUP_REGION_MAPPING[3]).toBe('europe-zone-1')
      expect(GROUP_REGION_MAPPING[6]).toBe('cis')
    })

    it('Users 组 (ID=1) 不应该映射到任何区域', () => {
      expect(GROUP_REGION_MAPPING[1]).toBeUndefined()
    })
  })

  describe('getGroupIdByRegion', () => {
    it('应该返回正确的 Group ID', () => {
      expect(getGroupIdByRegion('asia-pacific')).toBe(5)
      expect(getGroupIdByRegion('middle-east')).toBe(2)
      expect(getGroupIdByRegion('cis')).toBe(6)
    })

    it('未配置的区域应该返回 1', () => {
      expect(getGroupIdByRegion('africa')).toBe(1)
      expect(getGroupIdByRegion('europe-zone-2')).toBe(1)
    })
  })

  describe('getRegionByGroupId', () => {
    it('应该返回正确的区域', () => {
      expect(getRegionByGroupId(5)).toBe('asia-pacific')
      expect(getRegionByGroupId(2)).toBe('middle-east')
      expect(getRegionByGroupId(6)).toBe('cis')
    })

    it('Users 组应该返回 undefined', () => {
      expect(getRegionByGroupId(1)).toBeUndefined()
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
      
      const ticketGroupId = 5 // Asia-Pacific
      const ticketRegion = getRegionByGroupId(ticketGroupId)
      
      expect(ticketRegion).toBe(staffRegion)
    })

    it('不同区域的工单应该被过滤', () => {
      const staffRegion = 'asia-pacific'
      const ticketGroupId = 2 // Middle-East
      const ticketRegion = getRegionByGroupId(ticketGroupId)
      
      expect(ticketRegion).not.toBe(staffRegion)
    })

    it('回退组的工单区域无法确定', () => {
      const ticketGroupId = 1 // Users (fallback)
      const ticketRegion = getRegionByGroupId(ticketGroupId)
      
      expect(ticketRegion).toBeUndefined()
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
