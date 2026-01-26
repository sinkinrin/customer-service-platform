/**
 * Regional Constants and Mappings
 * 
 * Defines the 8 service regions and their mappings to Zammad Groups
 */

export const REGIONS = [
  { value: 'asia-pacific' },
  { value: 'middle-east' },
  { value: 'africa' },
  { value: 'north-america' },
  { value: 'latin-america' },
  { value: 'europe-zone-1' },
  { value: 'europe-zone-2' },
  { value: 'cis' },
] as const

export type RegionValue = typeof REGIONS[number]['value']

/**
 * Zammad staging group ID for newly created email tickets awaiting routing.
 */
export const STAGING_GROUP_ID = 9

/**
 * Region to Zammad Group ID Mapping
 *
 * NOTE: These Group IDs match the actual Zammad Groups in the system
 * Updated on 2025-12-23 - All regions now have dedicated Zammad Groups
 *
 * Zammad Groups:
 * - ID 1: 非洲 Users (Africa)
 * - ID 2: 欧洲 (Europe Zone 1)
 * - ID 3: 中东 (Middle East)
 * - ID 4: 亚太 (Asia-Pacific)
 * - ID 5: 独联体 (CIS)
 * - ID 6: 北美 (North America)
 * - ID 7: 拉美 (Latin America)
 * - ID 8: 欧洲二区 (Europe Zone 2)
 */
export const REGION_GROUP_MAPPING: Record<RegionValue, number> = {
  'asia-pacific': 4,      // Zammad Group: 亚太
  'middle-east': 3,       // Zammad Group: 中东
  'africa': 1,            // Zammad Group: 非洲 Users
  'north-america': 6,     // Zammad Group: 北美
  'latin-america': 7,     // Zammad Group: 拉美
  'europe-zone-1': 2,     // Zammad Group: 欧洲
  'europe-zone-2': 8,     // Zammad Group: 欧洲二区
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
 * All 8 regions now have dedicated Zammad groups
 */
export const GROUP_REGION_MAPPING: Record<number, RegionValue> = {
  1: 'africa',            // Zammad Group: 非洲 Users
  2: 'europe-zone-1',     // Zammad Group: 欧洲
  3: 'middle-east',       // Zammad Group: 中东
  4: 'asia-pacific',      // Zammad Group: 亚太
  5: 'cis',               // Zammad Group: 独联体
  6: 'north-america',     // Zammad Group: 北美
  7: 'latin-america',     // Zammad Group: 拉美
  8: 'europe-zone-2',     // Zammad Group: 欧洲二区
}

/**
 * Get region value by Zammad Group ID
 * Returns the region for any valid Zammad Group ID
 */
export function getRegionByGroupId(groupId: number): RegionValue | undefined {
  return GROUP_REGION_MAPPING[groupId]
}

/**
 * Get region label by region value from a provided label map
 */
export function getRegionLabel(
  region: RegionValue,
  labels: Record<string, string> | undefined
): string {
  if (!labels) return region
  return labels[region] || region
}

/**
 * Validate if a region value is valid
 */
export function isValidRegion(region: string): region is RegionValue {
  return REGIONS.some(r => r.value === region)
}

