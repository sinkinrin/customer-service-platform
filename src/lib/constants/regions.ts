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
 * Retrieved from Zammad API on 2025-01-15
 *
 * Zammad Groups:
 * - ID 1: Users (default group)
 * - ID 2: Middle-East
 * - ID 3: European
 * - ID 4: Latin America
 * - ID 5: Asia-Pacific
 * - ID 6: CIS
 * - ID 7: North America
 *
 * NOTE: Africa and Europe Zone 2 groups don't exist in Zammad yet (ID = 1 as fallback to Users group)
 */
export const REGION_GROUP_MAPPING: Record<RegionValue, number> = {
  'asia-pacific': 5,      // Zammad Group: Asia-Pacific
  'middle-east': 2,       // Zammad Group: Middle-East
  'africa': 1,            // TODO: Create Africa group in Zammad (using Users as fallback)
  'north-america': 7,     // Zammad Group: North America
  'latin-america': 4,     // Zammad Group: Latin America
  'europe-zone-1': 3,     // Zammad Group: European
  'europe-zone-2': 1,     // TODO: Create Europe Zone 2 group in Zammad (using Users as fallback)
  'cis': 6,               // Zammad Group: CIS
}

/**
 * Get Zammad Group ID by region value
 */
export function getGroupIdByRegion(region: RegionValue): number {
  return REGION_GROUP_MAPPING[region]
}

/**
 * Get region value by Zammad Group ID
 */
export function getRegionByGroupId(groupId: number): RegionValue | undefined {
  return Object.keys(REGION_GROUP_MAPPING).find(
    key => REGION_GROUP_MAPPING[key as RegionValue] === groupId
  ) as RegionValue | undefined
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

