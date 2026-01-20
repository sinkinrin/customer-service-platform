/**
 * Migration Script: Add region field to existing conversations
 *
 * This script reads all conversations from local storage and adds the region field
 * based on the customer's email (looking up from mock-auth or defaulting to 'asia-pacific')
 *
 * Usage: npx ts-node scripts/migrate-conversation-regions.ts
 */

import fs from 'fs/promises'
import path from 'path'

// Define RegionValue type locally to avoid import issues
type RegionValue = 'asia-pacific' | 'middle-east' | 'africa' | 'north-america' | 'latin-america' | 'europe-zone-1' | 'europe-zone-2' | 'cis'

// Mock users mapping (simplified for migration)
const mockUserRegions: Record<string, RegionValue> = {
  'customer@test.com': 'asia-pacific',
  'staff@test.com': 'asia-pacific',
  'admin@test.com': 'asia-pacific', // Admin default
  'jasper.deng@howentech.com': 'asia-pacific',
  'playwright-test-user@example.com': 'asia-pacific',
}

const STORAGE_DIR = path.join(process.cwd(), 'data', 'conversations')
const CONVERSATIONS_FILE = path.join(STORAGE_DIR, 'conversations.json')
const BACKUP_FILE = path.join(STORAGE_DIR, 'conversations.backup.json')

interface LocalConversation {
  id: string
  customer_id: string
  customer_email: string
  customer_name?: string
  region?: RegionValue
  mode: 'ai' | 'human'
  status: 'active' | 'waiting' | 'closed'
  zammad_ticket_id?: number
  transferred_at?: string
  transfer_reason?: string
  staff_id?: string
  staff_name?: string
  assigned_at?: string
  customer_unread_count?: number
  staff_unread_count?: number
  customer_last_read_at?: string
  staff_last_read_at?: string
  created_at: string
  updated_at: string
  last_message_at: string
}

interface MigrationStats {
  total: number
  alreadyHasRegion: number
  migratedFromUser: number
  migratedWithDefault: number
  failed: number
}

async function findUserRegion(email: string): Promise<RegionValue | null> {
  const normalizedEmail = email.toLowerCase().trim()
  const region = mockUserRegions[normalizedEmail]
  if (region) {
    return region
  }
  return null
}

async function migrate() {
  console.log('='.repeat(60))
  console.log('Conversation Region Migration Script')
  console.log('='.repeat(60))
  console.log('')

  const stats: MigrationStats = {
    total: 0,
    alreadyHasRegion: 0,
    migratedFromUser: 0,
    migratedWithDefault: 0,
    failed: 0,
  }

  try {
    // Check if conversations file exists
    try {
      await fs.access(CONVERSATIONS_FILE)
    } catch {
      console.log('No conversations file found. Nothing to migrate.')
      return
    }

    // Read existing conversations
    const data = await fs.readFile(CONVERSATIONS_FILE, 'utf-8')
    const conversations: LocalConversation[] = JSON.parse(data)
    stats.total = conversations.length

    console.log(`Found ${stats.total} conversations to process.`)
    console.log('')

    if (stats.total === 0) {
      console.log('No conversations to migrate.')
      return
    }

    // Create backup
    console.log('Creating backup...')
    await fs.writeFile(BACKUP_FILE, data)
    console.log(`Backup saved to: ${BACKUP_FILE}`)
    console.log('')

    // Process each conversation
    console.log('Processing conversations...')
    console.log('-'.repeat(60))

    for (const conv of conversations) {
      try {
        if (conv.region) {
          stats.alreadyHasRegion++
          console.log(`[SKIP] ${conv.id} - Already has region: ${conv.region}`)
          continue
        }

        // Try to find user's region
        const userRegion = await findUserRegion(conv.customer_email)

        if (userRegion) {
          conv.region = userRegion
          stats.migratedFromUser++
          console.log(`[USER] ${conv.id} - Set region from user: ${userRegion} (${conv.customer_email})`)
        } else {
          // Use default region
          conv.region = 'asia-pacific'
          stats.migratedWithDefault++
          console.log(`[DEFAULT] ${conv.id} - Set default region: asia-pacific (${conv.customer_email})`)
        }
      } catch (error) {
        stats.failed++
        console.error(`[ERROR] ${conv.id} - Failed to migrate:`, error)
      }
    }

    // Save updated conversations
    console.log('')
    console.log('Saving updated conversations...')
    await fs.writeFile(CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2))
    console.log('Done!')

    // Print summary
    console.log('')
    console.log('='.repeat(60))
    console.log('Migration Summary')
    console.log('='.repeat(60))
    console.log(`Total conversations:     ${stats.total}`)
    console.log(`Already had region:      ${stats.alreadyHasRegion}`)
    console.log(`Migrated from user:      ${stats.migratedFromUser}`)
    console.log(`Migrated with default:   ${stats.migratedWithDefault}`)
    console.log(`Failed:                  ${stats.failed}`)
    console.log('')

    if (stats.failed > 0) {
      console.log('⚠️  Some conversations failed to migrate. Check the logs above.')
    } else {
      console.log('✅ Migration completed successfully!')
    }

    console.log('')
    console.log(`Backup file: ${BACKUP_FILE}`)
    console.log('To rollback, copy the backup file back to conversations.json')

  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

// Run migration
migrate().catch(console.error)
