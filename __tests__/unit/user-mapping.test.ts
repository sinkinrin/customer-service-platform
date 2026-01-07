/**
 * Zammad 用户映射测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mappingStore } = vi.hoisted(() => ({
  mappingStore: new Map<
    string,
    {
      userId: string
      zammadUserId: number
      zammadUserEmail: string
      createdAt: Date
      updatedAt: Date
    }
  >(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userZammadMapping: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = mappingStore.get(where.userId)
        if (existing) {
          const next = {
            ...existing,
            ...update,
            userId: existing.userId,
            createdAt: existing.createdAt,
          }
          mappingStore.set(where.userId, next)
          return next
        }

        const now = new Date()
        const record = {
          ...create,
          createdAt: now,
          updatedAt: now,
        }
        mappingStore.set(where.userId, record)
        return record
      }),

      findUnique: vi.fn(async ({ where, select }: any) => {
        const record = mappingStore.get(where.userId) || null
        if (!record) return null
        if (!select) return record

        const selected: any = {}
        for (const key of Object.keys(select)) {
          if (select[key]) selected[key] = (record as any)[key]
        }
        return selected
      }),

      count: vi.fn(async ({ where }: any) => (mappingStore.has(where.userId) ? 1 : 0)),

      delete: vi.fn(async ({ where }: any) => {
        if (!mappingStore.has(where.userId)) throw new Error('NotFound')
        mappingStore.delete(where.userId)
      }),

      findMany: vi.fn(async () => Array.from(mappingStore.values())),

      deleteMany: vi.fn(async () => {
        mappingStore.clear()
      }),
    },
  },
}))

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
  beforeEach(async () => {
    await clearAllUserZammadMappings()
  })

  describe('setUserZammadMapping', () => {
    it('应该创建新的映射', async () => {
      await setUserZammadMapping('user-1', 100, 'user1@test.com')

      expect(await getUserZammadId('user-1')).toBe(100)
      expect(await getUserZammadEmail('user-1')).toBe('user1@test.com')
    })

    it('应该更新已存在的映射', async () => {
      await setUserZammadMapping('user-1', 100, 'old@test.com')
      await setUserZammadMapping('user-1', 200, 'new@test.com')

      expect(await getUserZammadId('user-1')).toBe(200)
      expect(await getUserZammadEmail('user-1')).toBe('new@test.com')
    })

    it('更新时应该保留 createdAt', async () => {
      await setUserZammadMapping('user-1', 100, 'user1@test.com')
      const firstMapping = await getUserZammadMapping('user-1')
      const originalCreatedAt = firstMapping?.createdAt

      await setUserZammadMapping('user-1', 200, 'updated@test.com')
      const updatedMapping = await getUserZammadMapping('user-1')

      expect(updatedMapping?.createdAt.getTime()).toBe(originalCreatedAt?.getTime())
    })

    it('更新时应该更新 updatedAt', async () => {
      await setUserZammadMapping('user-1', 100, 'user1@test.com')
      const firstMapping = await getUserZammadMapping('user-1')

      await setUserZammadMapping('user-1', 200, 'updated@test.com')
      const updatedMapping = await getUserZammadMapping('user-1')

      expect(updatedMapping?.updatedAt).toBeInstanceOf(Date)
      expect(updatedMapping!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        firstMapping!.createdAt.getTime()
      )
    })
  })

  describe('getUserZammadId', () => {
    it('存在的用户应该返回 Zammad ID', async () => {
      await setUserZammadMapping('user-1', 100, 'user1@test.com')
      
      expect(await getUserZammadId('user-1')).toBe(100)
    })

    it('不存在的用户应该返回 undefined', async () => {
      expect(await getUserZammadId('nonexistent')).toBeUndefined()
    })
  })

  describe('getUserZammadEmail', () => {
    it('存在的用户应该返回 Zammad Email', async () => {
      await setUserZammadMapping('user-1', 100, 'user1@test.com')
      
      expect(await getUserZammadEmail('user-1')).toBe('user1@test.com')
    })

    it('不存在的用户应该返回 undefined', async () => {
      expect(await getUserZammadEmail('nonexistent')).toBeUndefined()
    })
  })

  describe('getUserZammadMapping', () => {
    it('应该返回完整的映射对象', async () => {
      await setUserZammadMapping('user-1', 100, 'user1@test.com')
      
      const mapping = await getUserZammadMapping('user-1')
      
      expect(mapping).toBeDefined()
      expect(mapping?.userId).toBe('user-1')
      expect(mapping?.zammadUserId).toBe(100)
      expect(mapping?.zammadUserEmail).toBe('user1@test.com')
      expect(mapping?.createdAt).toBeInstanceOf(Date)
      expect(mapping?.updatedAt).toBeInstanceOf(Date)
    })

    it('不存在的用户应该返回 null', async () => {
      expect(await getUserZammadMapping('nonexistent')).toBeNull()
    })
  })

  describe('hasUserZammadMapping', () => {
    it('存在映射应该返回 true', async () => {
      await setUserZammadMapping('user-1', 100, 'user1@test.com')
      
      expect(await hasUserZammadMapping('user-1')).toBe(true)
    })

    it('不存在映射应该返回 false', async () => {
      expect(await hasUserZammadMapping('nonexistent')).toBe(false)
    })
  })

  describe('deleteUserZammadMapping', () => {
    it('删除存在的映射应该返回 true', async () => {
      await setUserZammadMapping('user-1', 100, 'user1@test.com')
      
      expect(await deleteUserZammadMapping('user-1')).toBe(true)
      expect(await hasUserZammadMapping('user-1')).toBe(false)
    })

    it('删除不存在的映射应该返回 false', async () => {
      expect(await deleteUserZammadMapping('nonexistent')).toBe(false)
    })
  })

  describe('getAllUserZammadMappings', () => {
    it('应该返回所有映射', async () => {
      await setUserZammadMapping('user-1', 100, 'user1@test.com')
      await setUserZammadMapping('user-2', 200, 'user2@test.com')
      await setUserZammadMapping('user-3', 300, 'user3@test.com')
      
      const allMappings = await getAllUserZammadMappings()
      
      expect(allMappings).toHaveLength(3)
    })

    it('空存储应该返回空数组', async () => {
      const allMappings = await getAllUserZammadMappings()
      
      expect(allMappings).toEqual([])
    })
  })

  describe('clearAllUserZammadMappings', () => {
    it('应该清除所有映射', async () => {
      await setUserZammadMapping('user-1', 100, 'user1@test.com')
      await setUserZammadMapping('user-2', 200, 'user2@test.com')
      
      await clearAllUserZammadMappings()
      
      expect(await getAllUserZammadMappings()).toHaveLength(0)
      expect(await hasUserZammadMapping('user-1')).toBe(false)
      expect(await hasUserZammadMapping('user-2')).toBe(false)
    })
  })
})

describe('User Mapping Business Scenarios', () => {
  beforeEach(async () => {
    await clearAllUserZammadMappings()
  })

  describe('用户首次登录场景', () => {
    it('新用户应该没有 Zammad 映射', async () => {
      const newUserId = 'new-user-id'
      
      expect(await hasUserZammadMapping(newUserId)).toBe(false)
    })

    it('创建 Zammad 用户后应该保存映射', async () => {
      const userId = 'new-user-id'
      const zammadUserId = 12345
      const zammadEmail = 'newuser@example.com'
      
      // 模拟创建 Zammad 用户后保存映射
      await setUserZammadMapping(userId, zammadUserId, zammadEmail)
      
      expect(await hasUserZammadMapping(userId)).toBe(true)
      expect(await getUserZammadId(userId)).toBe(zammadUserId)
    })
  })

  describe('用户邮箱变更场景', () => {
    it('邮箱变更后应该更新映射', async () => {
      const userId = 'user-id'
      
      await setUserZammadMapping(userId, 100, 'old@example.com')
      await setUserZammadMapping(userId, 100, 'new@example.com')
      
      expect(await getUserZammadEmail(userId)).toBe('new@example.com')
      expect(await getUserZammadId(userId)).toBe(100) // ID 不变
    })
  })

  describe('用户删除场景', () => {
    it('删除用户时应该清除映射', async () => {
      const userId = 'user-to-delete'
      
      await setUserZammadMapping(userId, 100, 'user@example.com')
      expect(await hasUserZammadMapping(userId)).toBe(true)
      
      await deleteUserZammadMapping(userId)
      expect(await hasUserZammadMapping(userId)).toBe(false)
    })
  })

  describe('批量操作场景', () => {
    it('应该支持批量添加用户映射', async () => {
      const users = [
        { id: 'user-1', zammadId: 101, email: 'user1@test.com' },
        { id: 'user-2', zammadId: 102, email: 'user2@test.com' },
        { id: 'user-3', zammadId: 103, email: 'user3@test.com' },
      ]
      
      for (const user of users) {
        await setUserZammadMapping(user.id, user.zammadId, user.email)
      }
      
      expect(await getAllUserZammadMappings()).toHaveLength(3)
      for (const user of users) {
        expect(await getUserZammadId(user.id)).toBe(user.zammadId)
      }
    })
  })
})
