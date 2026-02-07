/**
 * Prisma Seed Script
 * 
 * Seeds FAQ data into the database
 */

import { PrismaClient } from '@prisma/client'
import { mockFAQCategories, mockFAQArticles } from '../src/lib/mock-faq-data'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Clear existing data
  console.log('Clearing existing data...')
  await prisma.faqRating.deleteMany()
  await prisma.faqArticleTranslation.deleteMany()
  await prisma.faqArticle.deleteMany()
  await prisma.faqCategory.deleteMany()

  // Seed categories
  console.log('Seeding categories...')
  for (const category of mockFAQCategories) {
    await prisma.faqCategory.create({
      data: {
        id: category.id,
        name: category.name,
        description: category.description,
        icon: category.icon,
        slug: category.name.toLowerCase().replace(/\s+/g, '-'),
        sortOrder: category.id,
        isActive: true,
      },
    })
  }
  console.log(`✅ Created ${mockFAQCategories.length} categories`)

  // Seed articles
  console.log('Seeding articles...')
  for (const article of mockFAQArticles) {
    // Create article
    const createdArticle = await prisma.faqArticle.create({
      data: {
        id: article.id,
        categoryId: article.categoryId,
        slug: `article-${article.id}`,
        views: article.views,
        isActive: true,
      },
    })

    // Create Chinese translation (default)
    await prisma.faqArticleTranslation.create({
      data: {
        articleId: createdArticle.id,
        locale: 'zh-CN',
        title: article.title,
        content: article.content,
        keywords: JSON.stringify(article.keywords),
      },
    })

    // Create English translation (simplified version)
    await prisma.faqArticleTranslation.create({
      data: {
        articleId: createdArticle.id,
        locale: 'en',
        title: article.title, // In production, this would be translated
        content: article.content, // In production, this would be translated
        keywords: JSON.stringify(article.keywords),
      },
    })
  }
  console.log(`✅ Created ${mockFAQArticles.length} articles with translations`)

  console.log('🎉 Database seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

