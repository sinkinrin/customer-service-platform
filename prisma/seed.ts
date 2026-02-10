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
        slug: category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        sortOrder: category.id,
        isActive: true,
      },
    })
  }
  console.log(`✅ Created ${mockFAQCategories.length} categories`)

  // Seed articles with translations
  console.log('Seeding articles...')
  for (const article of mockFAQArticles) {
    const createdArticle = await prisma.faqArticle.create({
      data: {
        id: article.id,
        categoryId: article.categoryId,
        slug: `article-${article.id}`,
        views: article.views,
        isActive: true,
      },
    })

    // Create translations for each locale
    for (const translation of article.translations) {
      await prisma.faqArticleTranslation.create({
        data: {
          articleId: createdArticle.id,
          locale: translation.locale,
          title: translation.title,
          content: translation.content,
          keywords: JSON.stringify(translation.keywords),
        },
      })
    }
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
