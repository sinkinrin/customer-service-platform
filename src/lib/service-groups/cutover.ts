export const SERVICE_GROUP_ASSIGNMENT_CUTOVER_ENV = 'SERVICE_GROUP_ASSIGNMENT_CUTOVER'

export function isServiceGroupAssignmentCutoverActive(): boolean {
  return process.env[SERVICE_GROUP_ASSIGNMENT_CUTOVER_ENV] === 'true'
}
