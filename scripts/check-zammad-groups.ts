/**
 * Script to check Zammad groups and their IDs
 */

const ZAMMAD_URL = 'http://172.16.40.22:8080'
const ZAMMAD_API_TOKEN = 'gfgNF40pP1WjbDBMM9Jftwi2UIgOt9fze9WiNy3kxSb5akK4-mcV1F3ef3fJZ3Zt'

async function checkGroups() {
  try {
    const response = await fetch(`${ZAMMAD_URL}/api/v1/groups`, {
      headers: {
        'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const groups = await response.json()
    
    console.log('\n=== Zammad Groups ===\n')
    groups.forEach((group: any) => {
      console.log(`ID: ${group.id}, Name: ${group.name}`)
    })
    
    console.log('\n=== Region Mapping ===\n')
    console.log('export const REGION_GROUP_MAPPING: Record<RegionValue, number> = {')
    
    const regionMapping: Record<string, number> = {
      'asia-pacific': 0,
      'middle-east': 0,
      'africa': 0,
      'north-america': 0,
      'latin-america': 0,
      'europe-zone-1': 0,
      'europe-zone-2': 0,
      'cis': 0,
    }
    
    groups.forEach((group: any) => {
      const name = group.name.toLowerCase().replace(/\s+/g, '-')
      if (name === 'asia-pacific') regionMapping['asia-pacific'] = group.id
      else if (name === 'middle-east') regionMapping['middle-east'] = group.id
      else if (name === 'africa') regionMapping['africa'] = group.id
      else if (name === 'north-america') regionMapping['north-america'] = group.id
      else if (name === 'latin-america') regionMapping['latin-america'] = group.id
      else if (name === 'european' || name === 'europe') regionMapping['europe-zone-1'] = group.id
      else if (name === 'cis') regionMapping['cis'] = group.id
    })
    
    Object.entries(regionMapping).forEach(([region, id]) => {
      console.log(`  '${region}': ${id},`)
    })
    console.log('}')
    
  } catch (error) {
    console.error('Error fetching groups:', error)
  }
}

checkGroups()

