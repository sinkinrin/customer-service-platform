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
 * NOTE: These Group IDs must match the actual Zammad Groups created in the system
 * You need to create these groups in Zammad Admin Panel first, then update this mapping
 * 
 * To create groups in Zammad:
 * 1. Go to Zammad Admin Panel → Manage → Groups
 * 2. Create 8 groups with names matching the labelEn values above
 * 3. Note down the Group IDs
 * 4. Update this mapping with the actual IDs
 */
export const REGION_GROUP_MAPPING: Record<RegionValue, number> = {
  'asia-pacific': 1,      // TODO: Update with actual Zammad Group ID
  'middle-east': 2,       // TODO: Update with actual Zammad Group ID
  'africa': 3,            // TODO: Update with actual Zammad Group ID
  'north-america': 4,     // TODO: Update with actual Zammad Group ID
  'latin-america': 5,     // TODO: Update with actual Zammad Group ID
  'europe-zone-1': 6,     // TODO: Update with actual Zammad Group ID
  'europe-zone-2': 7,     // TODO: Update with actual Zammad Group ID
  'cis': 8,               // TODO: Update with actual Zammad Group ID
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

