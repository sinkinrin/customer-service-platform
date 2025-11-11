import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

async function checkKnowledgeBase() {
  console.log('=== Checking Zammad Knowledge Base Configuration ===\n')
  console.log('ZAMMAD_URL:', process.env.ZAMMAD_URL)
  console.log('ZAMMAD_API_TOKEN:', process.env.ZAMMAD_API_TOKEN ? '***' + process.env.ZAMMAD_API_TOKEN.slice(-10) : 'NOT SET')
  console.log()

  try {
    // Try to get Knowledge Base init data
    console.log('1. Checking Knowledge Base init endpoint...')
    const response = await fetch(`${process.env.ZAMMAD_URL}/api/v1/knowledge_bases/init`, {
      headers: {
        'Authorization': `Token ${process.env.ZAMMAD_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('Response status:', response.status)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))

    if (response.ok) {
      const data = await response.json()
      console.log('\n✅ Knowledge Base is configured!')
      console.log('Knowledge Base data:', JSON.stringify(data, null, 2))
    } else {
      const errorText = await response.text()
      console.log('\n❌ Knowledge Base API error:')
      console.log('Status:', response.status)
      console.log('Error:', errorText)
    }

    // Try to get Knowledge Base categories
    console.log('\n2. Checking Knowledge Base categories endpoint...')
    const categoriesResponse = await fetch(`${process.env.ZAMMAD_URL}/api/v1/knowledge_base/categories`, {
      headers: {
        'Authorization': `Token ${process.env.ZAMMAD_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('Categories response status:', categoriesResponse.status)

    if (categoriesResponse.ok) {
      const categories = await categoriesResponse.json()
      console.log('✅ Categories found:', categories.length)
      console.log('Categories:', JSON.stringify(categories, null, 2))
    } else {
      const errorText = await categoriesResponse.text()
      console.log('❌ Categories error:', errorText)
    }

    // Try to get Knowledge Base answers
    console.log('\n3. Checking Knowledge Base answers endpoint...')
    const answersResponse = await fetch(`${process.env.ZAMMAD_URL}/api/v1/knowledge_base/answers`, {
      headers: {
        'Authorization': `Token ${process.env.ZAMMAD_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('Answers response status:', answersResponse.status)

    if (answersResponse.ok) {
      const answers = await answersResponse.json()
      console.log('✅ Answers found:', answers.length)
      console.log('Answers:', JSON.stringify(answers, null, 2))
    } else {
      const errorText = await answersResponse.text()
      console.log('❌ Answers error:', errorText)
    }

  } catch (error) {
    console.error('Error checking Knowledge Base:', error)
  }
}

checkKnowledgeBase()

