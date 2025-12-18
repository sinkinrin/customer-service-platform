/**
 * Regional Constants and Mappings
 * 
 * Defines the 8 service regions and their mappings to Zammad Groups
 */

export const REGIONS = [
  { value: 'asia-pacific', label: '亚太区 (Asia-Pacific)', labelEn: 'Asia-Pacific' },
  { value: 'middle-east', label: '中东区 (Middle East)', labelEn: 'Middle East' },
  { value: 'africa', label: '非洲区 (Africa)', labelEn: 'Africa' },
  { value: 'north-america', label: '北美区 (North America)', labelEn: 'North America' },
  { value: 'latin-america', label: '拉美区 (Latin America)', labelEn: 'Latin America' },
  { value: 'europe-zone-1', label: '欧洲一区 (Europe Zone 1)', labelEn: 'Europe Zone 1' },
  { value: 'europe-zone-2', label: '欧洲二区 (Europe Zone 2)', labelEn: 'Europe Zone 2' },
  { value: 'cis', label: '独联体 (CIS)', labelEn: 'CIS' },
] as const

export type RegionValue = typeof REGIONS[number]['value']

/**
 * Region to Zammad Group ID Mapping
 *
 * NOTE: These Group IDs match the actual Zammad Groups in the system
 * Retrieved from Zammad API on 2025-12-17
 *
 * Zammad Groups:
 * - ID 1: 非洲 Users (default group)
 * - ID 2: 欧洲
 * - ID 3: 中东
 * - ID 4: 亚太
 * - ID 5: 独联体
 *
 * NOTE: North America, Latin America, Europe Zone 2 groups don't exist in Zammad yet (ID = 1 as fallback to Users group)
 */
export const REGION_GROUP_MAPPING: Record<RegionValue, number> = {
  'asia-pacific': 4,      // Zammad Group: 亚太
  'middle-east': 3,       // Zammad Group: 中东
  'africa': 1,            // Zammad Group: 非洲 Users (default)
  'north-america': 1,     // TODO: Create North America group in Zammad (using Users as fallback)
  'latin-america': 1,     // TODO: Create Latin America group in Zammad (using Users as fallback)
  'europe-zone-1': 2,     // Zammad Group: 欧洲
  'europe-zone-2': 1,     // TODO: Create Europe Zone 2 group in Zammad (using Users as fallback)
  'cis': 5,               // Zammad Group: 独联体
}

/**
 * Get Zammad Group ID by region value
 */
export function getGroupIdByRegion(region: RegionValue): number {
  return REGION_GROUP_MAPPING[region]
}

/**
 * Reverse mapping: Zammad Group ID to Region
 * Only includes groups that have a dedicated Zammad group (not fallback to Users group)
 */
export const GROUP_REGION_MAPPING: Record<number, RegionValue> = {
  4: 'asia-pacific',      // Zammad Group: 亚太
  3: 'middle-east',       // Zammad Group: 中东
  2: 'europe-zone-1',     // Zammad Group: 欧洲
  5: 'cis',               // Zammad Group: 独联体
  // Note: group_id = 1 (非洲 Users) is NOT mapped to any specific region
  // It's a fallback group for africa, north-america, latin-america, europe-zone-2 which don't have dedicated groups yet
}

/**
 * Get region value by Zammad Group ID
 * Returns undefined for group_id = 1 (Users group) since it's a fallback group
 */
export function getRegionByGroupId(groupId: number): RegionValue | undefined {
  return GROUP_REGION_MAPPING[groupId]
}

/**
 * Get region label by region value
 */
export function getRegionLabel(region: RegionValue, locale: 'zh' | 'en' = 'zh'): string {
  const regionObj = REGIONS.find(r => r.value === region)
  if (!regionObj) return region
  return locale === 'en' ? regionObj.labelEn : regionObj.label
}

/**
 * Validate if a region value is valid
 */
export function isValidRegion(region: string): region is RegionValue {
  return REGIONS.some(r => r.value === region)
}

