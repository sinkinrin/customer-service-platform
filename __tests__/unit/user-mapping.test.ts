/**
 * Zammad 用户映射测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  setUserZammadMapping,
  getUserZammadId,
  getUserZammadEmail,
  getUserZammadMapping,
  hasUserZammadMapping,
  deleteUserZammadMapping,
  getAllUserZammadMappings,
  clearAllUserZammadMappings,
} from '@/lib/zammad/user-mapping'

describe('User Zammad Mapping', () => {
  beforeEach(() => {
    clearAllUserZammadMappings()
  })

  describe('setUserZammadMapping', () => {
    it('应该创建新的映射', () => {
      setUserZammadMapping('user-1', 100, 'user1@test.com')
      
      expect(getUserZammadId('user-1')).toBe(100)
      expect(getUserZammadEmail('user-1')).toBe('user1@test.com')
    })

    it('应该更新已存在的映射', () => {
      setUserZammadMapping('user-1', 100, 'old@test.com')
      setUserZammadMapping('user-1', 200, 'new@test.com')
      
      expect(getUserZammadId('user-1')).toBe(200)
      expect(getUserZammadEmail('user-1')).toBe('new@test.com')
    })

    it('更新时应该保留 createdAt', () => {
      setUserZammadMapping('user-1', 100, 'user1@test.com')
      const firstMapping = getUserZammadMapping('user-1')
      const originalCreatedAt = firstMapping?.createdAt
      
      // 等待一小段时间确保时间戳不同
      setUserZammadMapping('user-1', 200, 'updated@test.com')
      const updatedMapping = getUserZammadMapping('user-1')
      
      expect(updatedMapping?.createdAt).toBe(originalCreatedAt)
    })

    it('更新时应该更新 updatedAt', () => {
      setUserZammadMapping('user-1', 100, 'user1@test.com')
      const firstMapping = getUserZammadMapping('user-1')
      
      setUserZammadMapping('user-1', 200, 'updated@test.com')
      const updatedMapping = getUserZammadMapping('user-1')
      
      // updatedAt 应该是有效的 ISO 日期字符串
      expect(updatedMapping?.updatedAt).toBeDefined()
      expect(new Date(updatedMapping!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(firstMapping!.createdAt).getTime()
      )
    })
  })

  describe('getUserZammadId', () => {
    it('存在的用户应该返回 Zammad ID', () => {
      setUserZammadMapping('user-1', 100, 'user1@test.com')
      
      expect(getUserZammadId('user-1')).toBe(100)
    })

    it('不存在的用户应该返回 undefined', () => {
      expect(getUserZammadId('nonexistent')).toBeUndefined()
    })
  })

  describe('getUserZammadEmail', () => {
    it('存在的用户应该返回 Zammad Email', () => {
      setUserZammadMapping('user-1', 100, 'user1@test.com')
      
      expect(getUserZammadEmail('user-1')).toBe('user1@test.com')
    })

    it('不存在的用户应该返回 undefined', () => {
      expect(getUserZammadEmail('nonexistent')).toBeUndefined()
    })
  })

  describe('getUserZammadMapping', () => {
    it('应该返回完整的映射对象', () => {
      setUserZammadMapping('user-1', 100, 'user1@test.com')
      
      const mapping = getUserZammadMapping('user-1')
      
      expect(mapping).toBeDefined()
      expect(mapping?.userId).toBe('user-1')
      expect(mapping?.zammadUserId).toBe(100)
      expect(mapping?.zammadUserEmail).toBe('user1@test.com')
      expect(mapping?.createdAt).toBeDefined()
      expect(mapping?.updatedAt).toBeDefined()
    })

    it('不存在的用户应该返回 undefined', () => {
      expect(getUserZammadMapping('nonexistent')).toBeUndefined()
    })
  })

  describe('hasUserZammadMapping', () => {
    it('存在映射应该返回 true', () => {
      setUserZammadMapping('user-1', 100, 'user1@test.com')
      
      expect(hasUserZammadMapping('user-1')).toBe(true)
    })

    it('不存在映射应该返回 false', () => {
      expect(hasUserZammadMapping('nonexistent')).toBe(false)
    })
  })

  describe('deleteUserZammadMapping', () => {
    it('删除存在的映射应该返回 true', () => {
      setUserZammadMapping('user-1', 100, 'user1@test.com')
      
      expect(deleteUserZammadMapping('user-1')).toBe(true)
      expect(hasUserZammadMapping('user-1')).toBe(false)
    })

    it('删除不存在的映射应该返回 false', () => {
      expect(deleteUserZammadMapping('nonexistent')).toBe(false)
    })
  })

  describe('getAllUserZammadMappings', () => {
    it('应该返回所有映射', () => {
      setUserZammadMapping('user-1', 100, 'user1@test.com')
      setUserZammadMapping('user-2', 200, 'user2@test.com')
      setUserZammadMapping('user-3', 300, 'user3@test.com')
      
      const allMappings = getAllUserZammadMappings()
      
      expect(allMappings).toHaveLength(3)
    })

    it('空存储应该返回空数组', () => {
      const allMappings = getAllUserZammadMappings()
      
      expect(allMappings).toEqual([])
    })
  })

  describe('clearAllUserZammadMappings', () => {
    it('应该清除所有映射', () => {
      setUserZammadMapping('user-1', 100, 'user1@test.com')
      setUserZammadMapping('user-2', 200, 'user2@test.com')
      
      clearAllUserZammadMappings()
      
      expect(getAllUserZammadMappings()).toHaveLength(0)
      expect(hasUserZammadMapping('user-1')).toBe(false)
      expect(hasUserZammadMapping('user-2')).toBe(false)
    })
  })
})

describe('User Mapping Business Scenarios', () => {
  beforeEach(() => {
    clearAllUserZammadMappings()
  })

  describe('用户首次登录场景', () => {
    it('新用户应该没有 Zammad 映射', () => {
      const newUserId = 'new-user-id'
      
      expect(hasUserZammadMapping(newUserId)).toBe(false)
    })

    it('创建 Zammad 用户后应该保存映射', () => {
      const userId = 'new-user-id'
      const zammadUserId = 12345
      const zammadEmail = 'newuser@example.com'
      
      // 模拟创建 Zammad 用户后保存映射
      setUserZammadMapping(userId, zammadUserId, zammadEmail)
      
      expect(hasUserZammadMapping(userId)).toBe(true)
      expect(getUserZammadId(userId)).toBe(zammadUserId)
    })
  })

  describe('用户邮箱变更场景', () => {
    it('邮箱变更后应该更新映射', () => {
      const userId = 'user-id'
      
      setUserZammadMapping(userId, 100, 'old@example.com')
      setUserZammadMapping(userId, 100, 'new@example.com')
      
      expect(getUserZammadEmail(userId)).toBe('new@example.com')
      expect(getUserZammadId(userId)).toBe(100) // ID 不变
    })
  })

  describe('用户删除场景', () => {
    it('删除用户时应该清除映射', () => {
      const userId = 'user-to-delete'
      
      setUserZammadMapping(userId, 100, 'user@example.com')
      expect(hasUserZammadMapping(userId)).toBe(true)
      
      deleteUserZammadMapping(userId)
      expect(hasUserZammadMapping(userId)).toBe(false)
    })
  })

  describe('批量操作场景', () => {
    it('应该支持批量添加用户映射', () => {
      const users = [
        { id: 'user-1', zammadId: 101, email: 'user1@test.com' },
        { id: 'user-2', zammadId: 102, email: 'user2@test.com' },
        { id: 'user-3', zammadId: 103, email: 'user3@test.com' },
      ]
      
      users.forEach(user => {
        setUserZammadMapping(user.id, user.zammadId, user.email)
      })
      
      expect(getAllUserZammadMappings()).toHaveLength(3)
      users.forEach(user => {
        expect(getUserZammadId(user.id)).toBe(user.zammadId)
      })
    })
  })
})
