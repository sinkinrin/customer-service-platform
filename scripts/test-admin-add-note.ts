/**
 * Test Admin ADD NOTE functionality
 *
 * This script tests whether Admin users can successfully add notes to tickets
 */

import { zammadClient } from '../src/lib/zammad/client'

async function testAdminAddNote() {
  console.log('='.repeat(60))
  console.log('Testing Admin ADD NOTE Functionality')
  console.log('='.repeat(60))

  try {
    // Test 1: Check if admin user exists in Zammad
    console.log('\n[Test 1] Checking if admin@test.com exists in Zammad...')

    try {
      const adminUser = await zammadClient.getUserByEmail('admin@test.com')
      console.log('✓ Admin user found:', {
        id: adminUser.id,
        email: adminUser.email,
        login: adminUser.login,
        active: adminUser.active,
      })
    } catch (error) {
      console.error('✗ Admin user NOT found in Zammad!')
      console.error('  This will cause ADD NOTE to fail when using X-On-Behalf-Of')
      console.error('  Error:', error instanceof Error ? error.message : error)
    }

    // Test 2: Get a test ticket to add note to
    console.log('\n[Test 2] Finding a test ticket...')

    const searchResult = await zammadClient.searchTickets('state:*', 1)
    if (!searchResult.tickets || searchResult.tickets.length === 0) {
      console.error('✗ No tickets found to test with')
      return
    }

    const testTicket = searchResult.tickets[0]
    console.log('✓ Found test ticket:', {
      id: testTicket.id,
      number: testTicket.number,
      title: testTicket.title,
      state: testTicket.state,
    })

    // Test 3: Try to create an article as admin
    console.log('\n[Test 3] Creating article as admin@test.com...')

    try {
      const article = await zammadClient.createArticle(
        {
          ticket_id: testTicket.id,
          subject: 'Test Note - Admin ADD NOTE Verification',
          body: 'This is a test note to verify Admin ADD NOTE functionality.',
          content_type: 'text/html',
          type: 'note',
          internal: true, // Internal note
        },
        'admin@test.com' // X-On-Behalf-Of
      )

      console.log('✓ Article created successfully:', {
        id: article.id,
        ticket_id: article.ticket_id,
        created_by: article.created_by,
        sender: article.sender,
        internal: article.internal,
      })

      // Test 4: Verify the article was created with correct sender
      console.log('\n[Test 4] Verifying article sender...')

      if (article.sender === 'Agent') {
        console.log('✓ Article sender is "Agent" (correct for staff/admin)')
      } else {
        console.warn('⚠ Unexpected sender:', article.sender)
      }

      if (article.created_by && article.created_by.includes('admin')) {
        console.log('✓ Article created_by includes "admin"')
      } else {
        console.warn('⚠ Unexpected created_by:', article.created_by)
      }

    } catch (error) {
      console.error('✗ Failed to create article!')
      console.error('  Error:', error instanceof Error ? error.message : error)

      if (error instanceof Error && error.message.includes('User not found')) {
        console.error('\n  ROOT CAUSE: admin@test.com does not exist in Zammad')
        console.error('  SOLUTION: Create admin user in Zammad or update user mapping')
      }
    }

    // Test 5: Test with attachments
    console.log('\n[Test 5] Testing note with attachment...')

    // Create a simple text file as base64
    const testFileContent = Buffer.from('Test attachment content').toString('base64')

    try {
      const articleWithAttachment = await zammadClient.createArticle(
        {
          ticket_id: testTicket.id,
          subject: 'Test Note with Attachment',
          body: 'Testing attachment upload functionality.',
          content_type: 'text/html',
          type: 'note',
          internal: true,
          attachments: [
            {
              filename: 'test.txt',
              data: testFileContent,
              'mime-type': 'text/plain',
            },
          ],
        },
        'admin@test.com'
      )

      console.log('✓ Article with attachment created:', {
        id: articleWithAttachment.id,
        attachments_count: articleWithAttachment.attachments?.length || 0,
      })

      if (articleWithAttachment.attachments && articleWithAttachment.attachments.length > 0) {
        console.log('✓ Attachment uploaded successfully:', {
          filename: articleWithAttachment.attachments[0].filename,
          size: articleWithAttachment.attachments[0].size,
        })
      }

    } catch (error) {
      console.error('✗ Failed to create article with attachment!')
      console.error('  Error:', error instanceof Error ? error.message : error)
    }

    console.log('\n' + '='.repeat(60))
    console.log('Test Summary')
    console.log('='.repeat(60))
    console.log('If all tests passed, Admin ADD NOTE is working correctly.')
    console.log('If any test failed, check the error messages above for details.')
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\nFatal error during testing:', error)
    throw error
  }
}

// Run the test
testAdminAddNote()
  .then(() => {
    console.log('\n✓ Test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n✗ Test failed:', error)
    process.exit(1)
  })
