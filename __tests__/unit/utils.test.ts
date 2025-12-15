/**
 * 通用工具函数测试
 */

import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('Utils', () => {
  describe('cn (className merge)', () => {
    it('应该合并多个类名', () => {
      const result = cn('class1', 'class2')
      expect(result).toContain('class1')
      expect(result).toContain('class2')
    })

    it('应该处理条件类名', () => {
      const isActive = true
      const result = cn('base', isActive && 'active')
      expect(result).toContain('active')
    })

    it('应该忽略 falsy 值', () => {
      const result = cn('base', false, null, undefined, '')
      expect(result).toBe('base')
    })

    it('应该处理 Tailwind 类名冲突', () => {
      // tailwind-merge 会处理冲突
      const result = cn('p-4', 'p-8')
      expect(result).toContain('p-8')
    })

    it('应该处理空输入', () => {
      const result = cn()
      expect(result).toBe('')
    })
  })
})

describe('String Utilities', () => {
  describe('截断文本', () => {
    const truncate = (str: string, maxLength: number) => {
      if (str.length <= maxLength) return str
      return str.slice(0, maxLength - 3) + '...'
    }

    it('短文本不应该被截断', () => {
      expect(truncate('Hello', 10)).toBe('Hello')
    })

    it('长文本应该被截断并添加省略号', () => {
      expect(truncate('Hello World', 8)).toBe('Hello...')
    })

    it('边界长度应该正确处理', () => {
      expect(truncate('Hello', 5)).toBe('Hello')
      expect(truncate('Hello!', 5)).toBe('He...')
    })
  })

  describe('格式化文件大小', () => {
    const formatFileSize = (bytes: number): string => {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    it('应该格式化字节', () => {
      expect(formatFileSize(0)).toBe('0 B')
      expect(formatFileSize(500)).toBe('500 B')
    })

    it('应该格式化 KB', () => {
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(2048)).toBe('2 KB')
    })

    it('应该格式化 MB', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB')
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB')
    })
  })

  describe('Slug 生成', () => {
    const slugify = (text: string): string => {
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
    }

    it('应该转换为小写', () => {
      expect(slugify('Hello World')).toBe('hello-world')
    })

    it('应该替换空格为连字符', () => {
      expect(slugify('hello world')).toBe('hello-world')
    })

    it('应该移除特殊字符', () => {
      expect(slugify('Hello! World?')).toBe('hello-world')
    })

    it('应该处理多个空格', () => {
      expect(slugify('hello   world')).toBe('hello-world')
    })
  })
})

describe('Date Utilities', () => {
  describe('相对时间', () => {
    const getRelativeTime = (date: Date): string => {
      const now = new Date()
      const diff = now.getTime() - date.getTime()
      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)

      if (seconds < 60) return '刚刚'
      if (minutes < 60) return `${minutes}分钟前`
      if (hours < 24) return `${hours}小时前`
      if (days < 7) return `${days}天前`
      return date.toLocaleDateString('zh-CN')
    }

    it('应该显示"刚刚"', () => {
      const now = new Date()
      expect(getRelativeTime(now)).toBe('刚刚')
    })

    it('应该显示分钟前', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      expect(getRelativeTime(fiveMinutesAgo)).toBe('5分钟前')
    })

    it('应该显示小时前', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
      expect(getRelativeTime(twoHoursAgo)).toBe('2小时前')
    })

    it('应该显示天前', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      expect(getRelativeTime(threeDaysAgo)).toBe('3天前')
    })
  })

  describe('日期格式化', () => {
    const formatDate = (date: Date, locale: string = 'zh-CN'): string => {
      return date.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }

    it('应该格式化中文日期', () => {
      const date = new Date('2024-01-15')
      const formatted = formatDate(date, 'zh-CN')
      expect(formatted).toContain('2024')
      expect(formatted).toContain('1')
      expect(formatted).toContain('15')
    })

    it('应该格式化英文日期', () => {
      const date = new Date('2024-01-15')
      const formatted = formatDate(date, 'en-US')
      expect(formatted).toContain('2024')
      expect(formatted).toContain('January')
    })
  })
})

describe('Validation Utilities', () => {
  describe('Email 验证', () => {
    const isValidEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(email)
    }

    it('应该验证有效邮箱', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
    })

    it('应该拒绝无效邮箱', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('test@')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('test @example.com')).toBe(false)
    })
  })

  describe('URL 验证', () => {
    const isValidUrl = (url: string): boolean => {
      try {
        new URL(url)
        return true
      } catch {
        return false
      }
    }

    it('应该验证有效 URL', () => {
      expect(isValidUrl('https://example.com')).toBe(true)
      expect(isValidUrl('http://localhost:3000')).toBe(true)
      expect(isValidUrl('https://sub.domain.com/path?query=1')).toBe(true)
    })

    it('应该拒绝无效 URL', () => {
      expect(isValidUrl('not a url')).toBe(false)
      expect(isValidUrl('example.com')).toBe(false)
    })
  })

  describe('UUID 验证', () => {
    const isValidUUID = (uuid: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      return uuidRegex.test(uuid)
    }

    it('应该验证有效 UUID', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true)
    })

    it('应该拒绝无效 UUID', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false)
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false)
      expect(isValidUUID('')).toBe(false)
    })
  })
})

describe('Array Utilities', () => {
  describe('数组去重', () => {
    const unique = <T>(arr: T[]): T[] => [...new Set(arr)]

    it('应该去除重复元素', () => {
      expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3])
    })

    it('应该处理字符串数组', () => {
      expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c'])
    })

    it('应该处理空数组', () => {
      expect(unique([])).toEqual([])
    })
  })

  describe('数组分组', () => {
    const groupBy = <T, K extends string | number>(
      arr: T[],
      keyFn: (item: T) => K
    ): Record<K, T[]> => {
      return arr.reduce((acc, item) => {
        const key = keyFn(item)
        if (!acc[key]) acc[key] = []
        acc[key].push(item)
        return acc
      }, {} as Record<K, T[]>)
    }

    it('应该按属性分组', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ]

      const grouped = groupBy(items, item => item.type)

      expect(grouped['a']).toHaveLength(2)
      expect(grouped['b']).toHaveLength(1)
    })
  })

  describe('数组分块', () => {
    const chunk = <T>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = []
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size))
      }
      return chunks
    }

    it('应该将数组分成指定大小的块', () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    })

    it('应该处理空数组', () => {
      expect(chunk([], 2)).toEqual([])
    })

    it('应该处理大于数组长度的块大小', () => {
      expect(chunk([1, 2], 5)).toEqual([[1, 2]])
    })
  })
})

describe('Object Utilities', () => {
  describe('深拷贝', () => {
    const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj))

    it('应该创建独立的副本', () => {
      const original = { a: 1, b: { c: 2 } }
      const cloned = deepClone(original)

      cloned.b.c = 3

      expect(original.b.c).toBe(2)
      expect(cloned.b.c).toBe(3)
    })

    it('应该处理数组', () => {
      const original = [1, [2, 3]]
      const cloned = deepClone(original)

      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
    })
  })

  describe('对象合并', () => {
    const merge = <T extends object>(target: T, ...sources: Partial<T>[]): T => {
      return Object.assign({}, target, ...sources)
    }

    it('应该合并多个对象', () => {
      const result = merge({ a: 1 }, { b: 2 }, { c: 3 })
      expect(result).toEqual({ a: 1, b: 2, c: 3 })
    })

    it('后面的值应该覆盖前面的', () => {
      const result = merge({ a: 1 }, { a: 2 })
      expect(result.a).toBe(2)
    })
  })

  describe('Pick 和 Omit', () => {
    const pick = <T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
      const result = {} as Pick<T, K>
      keys.forEach(key => {
        if (key in obj) result[key] = obj[key]
      })
      return result
    }

    const omit = <T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
      const result = { ...obj }
      keys.forEach(key => delete result[key])
      return result as Omit<T, K>
    }

    it('pick 应该只保留指定的键', () => {
      const obj = { a: 1, b: 2, c: 3 }
      expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 })
    })

    it('omit 应该排除指定的键', () => {
      const obj = { a: 1, b: 2, c: 3 }
      expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 })
    })
  })
})
