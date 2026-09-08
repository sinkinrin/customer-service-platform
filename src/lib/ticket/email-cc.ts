/** Extract mailbox addresses, never email-looking text from display names. */
export function parseCcAddresses(cc?: string | null): string[] {
  if (!cc?.trim()) return []

  const recipients: string[] = []
  let part = ''
  let quoted = false
  let escaped = false
  let inAngle = false
  for (const char of cc) {
    if (escaped) {
      escaped = false
    } else if (quoted && char === '\\') {
      escaped = true
    } else if (char === '"') {
      quoted = !quoted
    } else if (!quoted) {
      // RFC address groups are display-only for now. Reject the entire list,
      // rather than dropping the group prefix and treating the remaining members as unique.
      if (!inAngle && (char === ':' || char === '(' || char === ')')) return []
      if (char === '<') inAngle = true
      if (char === '>') inAngle = false
      if ((char === ',' || char === ';') && !inAngle) {
        recipients.push(part.trim())
        part = ''
        continue
      }
    }
    part += char
  }
  if (quoted || inAngle) return []
  recipients.push(part.trim())

  const addresses: string[] = []
  for (const recipient of recipients) {
    if (!recipient) return []
    const angle = recipient.match(/^(?:"(?:\\.|[^"\\])*"|[^"<>])*<([^<>]+)>$/)
    const address = (angle ? angle[1] : recipient).trim().toLowerCase()
    // Any unparsed recipient makes uniqueness unknown. Fall back for the whole CC
    // instead of assigning from an incomplete list (comments/groups/quoted locals, etc.).
    if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(address)) {
      return []
    }
    addresses.push(address)
  }
  return [...new Set(addresses)]
}
