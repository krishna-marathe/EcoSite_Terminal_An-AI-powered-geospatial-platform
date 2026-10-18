import { describe, expect, it } from 'vitest'
import { serializeCsv } from '../utils/csvExport'

describe('serializeCsv', () => {
  it('serializes simple rows correctly', () => {
    const rows = [
      ['Name', 'Value'],
      ['Test', '123'],
    ]
    const result = serializeCsv(rows)
    expect(result).toBe('"Name","Value"\r\n"Test","123"')
  })

  it('escapes double quotes in values', () => {
    const rows = [['Name'], ['Say "hello"']]
    const result = serializeCsv(rows)
    expect(result).toContain('"Say ""hello"""')
  })

  it('prevents formula injection by prefixing dangerous cells', () => {
    const dangerous = ['=1+1', '+1+1', '@1+1', '-1+1']
    for (const value of dangerous) {
      const rows = [['A'], [value]]
      const result = serializeCsv(rows)
      expect(result).toContain(`"'${value}"`)
    }
  })

  it('handles null and undefined values', () => {
    const rows = [['A', 'B'], [null, undefined]]
    const result = serializeCsv(rows)
    expect(result).toContain('"Unavailable","Unavailable"')
  })

  it('handles empty array', () => {
    expect(serializeCsv([])).toBe('')
  })
})
