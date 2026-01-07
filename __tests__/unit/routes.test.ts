/**
 * 路由常量和辅助函数测试
 */

import { describe, it, expect } from 'vitest'
import {
  PUBLIC_ROUTES,
  STATIC_ROUTES,
  ROLE_ROUTES,
  isRouteMatch,
  getDefaultDashboard,
} from '@/lib/constants/routes'

describe('Routes Constants', () => {
  describe('PUBLIC_ROUTES', () => {
    it('应该包含认证相关路由', () => {
      expect(PUBLIC_ROUTES).toContain('/auth/login')
      expect(PUBLIC_ROUTES).toContain('/auth/register')
      expect(PUBLIC_ROUTES).toContain('/auth/forgot-password')
      expect(PUBLIC_ROUTES).toContain('/auth/error')
    })

    it('应该包含公开 API 路由', () => {
      expect(PUBLIC_ROUTES).toContain('/api/auth')
      expect(PUBLIC_ROUTES).toContain('/api/health')
      expect(PUBLIC_ROUTES).toContain('/api/webhooks')
      expect(PUBLIC_ROUTES).toContain('/api/faq')
    })

    it('应该包含公开页面', () => {
      expect(PUBLIC_ROUTES).toContain('/faq')
      expect(PUBLIC_ROUTES).toContain('/unauthorized')
    })

    it('不应该包含受保护的路由', () => {
      expect(PUBLIC_ROUTES).not.toContain('/admin')
      expect(PUBLIC_ROUTES).not.toContain('/staff')
      expect(PUBLIC_ROUTES).not.toContain('/customer')
      expect(PUBLIC_ROUTES).not.toContain('/api/conversations')
    })
  })

  describe('STATIC_ROUTES', () => {
    it('应该包含 Next.js 静态资源路由', () => {
      expect(STATIC_ROUTES).toContain('/_next')
    })

    it('应该包含 favicon', () => {
      expect(STATIC_ROUTES).toContain('/favicon.ico')
    })
  })

  describe('ROLE_ROUTES', () => {
    it('admin 路由只允许 admin 角色', () => {
      expect(ROLE_ROUTES.admin.prefix).toBe('/admin')
      expect(ROLE_ROUTES.admin.allowedRoles).toContain('admin')
      expect(ROLE_ROUTES.admin.allowedRoles).not.toContain('staff')
      expect(ROLE_ROUTES.admin.allowedRoles).not.toContain('customer')
    })

    it('staff 路由允许 staff 和 admin', () => {
      expect(ROLE_ROUTES.staff.prefix).toBe('/staff')
      expect(ROLE_ROUTES.staff.allowedRoles).toContain('staff')
      expect(ROLE_ROUTES.staff.allowedRoles).toContain('admin')
      expect(ROLE_ROUTES.staff.allowedRoles).not.toContain('customer')
    })

    it('customer 路由允许所有角色', () => {
      expect(ROLE_ROUTES.customer.prefix).toBe('/customer')
      expect(ROLE_ROUTES.customer.allowedRoles).toContain('customer')
      expect(ROLE_ROUTES.customer.allowedRoles).toContain('staff')
      expect(ROLE_ROUTES.customer.allowedRoles).toContain('admin')
    })
  })
})

describe('isRouteMatch', () => {
  describe('精确匹配', () => {
    it('应该匹配精确路径', () => {
      expect(isRouteMatch('/auth/login', PUBLIC_ROUTES)).toBe(true)
      expect(isRouteMatch('/api/health', PUBLIC_ROUTES)).toBe(true)
      expect(isRouteMatch('/faq', PUBLIC_ROUTES)).toBe(true)
    })

    it('不应该匹配不存在的路径', () => {
      expect(isRouteMatch('/admin', PUBLIC_ROUTES)).toBe(false)
      expect(isRouteMatch('/api/tickets', PUBLIC_ROUTES)).toBe(false)
    })
  })

  describe('前缀匹配', () => {
    it('应该匹配以公开路由开头的子路径', () => {
      expect(isRouteMatch('/auth/login/callback', PUBLIC_ROUTES)).toBe(true)
      expect(isRouteMatch('/api/auth/session', PUBLIC_ROUTES)).toBe(true)
      expect(isRouteMatch('/api/faq/search', PUBLIC_ROUTES)).toBe(true)
    })

    it('不应该匹配部分字符串匹配', () => {
      // /faq 是公开的，但 /faq-admin 不应该匹配
      expect(isRouteMatch('/faq-admin', PUBLIC_ROUTES)).toBe(false)
    })
  })

  describe('静态路由匹配', () => {
    it('应该匹配 Next.js 静态资源', () => {
      expect(isRouteMatch('/_next/static/chunks/main.js', STATIC_ROUTES)).toBe(true)
      expect(isRouteMatch('/_next/image', STATIC_ROUTES)).toBe(true)
    })

    it('应该匹配 favicon', () => {
      expect(isRouteMatch('/favicon.ico', STATIC_ROUTES)).toBe(true)
    })
  })

  describe('边界情况', () => {
    it('空路径应该不匹配', () => {
      expect(isRouteMatch('', PUBLIC_ROUTES)).toBe(false)
    })

    it('根路径应该匹配公开路由', () => {
      expect(isRouteMatch('/', PUBLIC_ROUTES)).toBe(true)
    })
  })
})

describe('getDefaultDashboard', () => {
  it('admin 应该返回 admin dashboard', () => {
    expect(getDefaultDashboard('admin')).toBe('/admin/dashboard')
  })

  it('staff 应该返回 staff dashboard', () => {
    expect(getDefaultDashboard('staff')).toBe('/staff/dashboard')
  })

  it('customer 应该返回 customer dashboard', () => {
    expect(getDefaultDashboard('customer')).toBe('/customer/dashboard')
  })
})

describe('Route Access Control', () => {
  describe('角色权限验证场景', () => {
    const checkAccess = (pathname: string, role: 'customer' | 'staff' | 'admin'): boolean => {
      // 检查公开路由
      if (isRouteMatch(pathname, PUBLIC_ROUTES)) return true
      
      // 检查角色路由
      for (const [, config] of Object.entries(ROLE_ROUTES)) {
        if (pathname.startsWith(config.prefix)) {
          return (config.allowedRoles as readonly string[]).includes(role)
        }
      }
      
      return false
    }

    it('所有用户都可以访问公开路由', () => {
      expect(checkAccess('/auth/login', 'customer')).toBe(true)
      expect(checkAccess('/auth/login', 'staff')).toBe(true)
      expect(checkAccess('/auth/login', 'admin')).toBe(true)
    })

    it('只有 admin 可以访问 admin 路由', () => {
      expect(checkAccess('/admin/dashboard', 'admin')).toBe(true)
      expect(checkAccess('/admin/dashboard', 'staff')).toBe(false)
      expect(checkAccess('/admin/dashboard', 'customer')).toBe(false)
    })

    it('staff 和 admin 可以访问 staff 路由', () => {
      expect(checkAccess('/staff/tickets', 'admin')).toBe(true)
      expect(checkAccess('/staff/tickets', 'staff')).toBe(true)
      expect(checkAccess('/staff/tickets', 'customer')).toBe(false)
    })

    it('所有角色都可以访问 customer 路由', () => {
      expect(checkAccess('/customer/conversations', 'admin')).toBe(true)
      expect(checkAccess('/customer/conversations', 'staff')).toBe(true)
      expect(checkAccess('/customer/conversations', 'customer')).toBe(true)
    })
  })

  describe('登录后重定向场景', () => {
    it('不同角色应该重定向到不同的 dashboard', () => {
      const roles: Array<'customer' | 'staff' | 'admin'> = ['customer', 'staff', 'admin']
      
      roles.forEach(role => {
        const dashboard = getDefaultDashboard(role)
        expect(dashboard).toContain(role)
        expect(dashboard).toContain('dashboard')
      })
    })
  })
})
