/**
 * Product Categories and Models
 * 
 * This is a hardcoded list of product categories and models.
 * No need to store in database as these are relatively static.
 */

export interface ProductCategory {
  name: string
  models: string[]
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    name: 'MDVR',
    models: [
      'MA80-08V1',
      'MA80-08V2',
      'MA80-08V3',
      'ME31-08V5',
      'ME32-04N',
      'ME32-04N2',
      'ME41-04N',
      'ME41-04N2',
      'ME30-04N',
      'ME30-04N2',
      'ME40-04N',
      'ME40-04N2',
    ],
  },
  {
    name: 'Dashcam',
    models: [
      'MC30-01N2',
      'MC30-01H',
      'ME40-02V3',
      'ME40-02V8',
    ],
  },
  {
    name: 'MDT',
    models: [
      'MDTV2',
      'MDTV5',
    ],
  },
  {
    name: 'VSS',
    models: [
      'VSS2.5',
      'VSS2.6',
    ],
  },
]

/**
 * Get all product categories
 */
export function getProductCategories(): ProductCategory[] {
  return PRODUCT_CATEGORIES
}

/**
 * Get models for a specific category
 */
export function getProductModels(categoryName: string): string[] {
  const category = PRODUCT_CATEGORIES.find(c => c.name === categoryName)
  return category?.models || []
}

/**
 * Get all category names
 */
export function getCategoryNames(): string[] {
  return PRODUCT_CATEGORIES.map(c => c.name)
}

/**
 * Validate if a category and model combination is valid
 */
export function isValidProduct(categoryName: string, modelName: string): boolean {
  const models = getProductModels(categoryName)
  return models.includes(modelName)
}

