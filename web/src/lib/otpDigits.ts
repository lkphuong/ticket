export interface OtpEdit {
  readonly value: string
  readonly focusIndex: number
}

export function keepDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, '')
}

// Typing in a filled slot that is not selected yields the old and the new digit together; keep only the new one
function dropReplacedDigit(digits: string, existingDigit: string | undefined): string {
  if (existingDigit === undefined || digits.length !== 2) return digits
  return digits.replace(existingDigit, '')
}

// A single digit lands in the slot (never past the first empty one); several digits come from paste or autofill and replace the whole code
export function applyOtpInput(current: string, slotIndex: number, raw: string, length: number): OtpEdit {
  const digits = dropReplacedDigit(keepDigitsOnly(raw), current[slotIndex])
  if (!digits) return { value: current, focusIndex: slotIndex }

  const isBulkInput = digits.length > 1
  const startIndex = isBulkInput ? 0 : Math.min(slotIndex, current.length)
  const kept = isBulkInput ? '' : current.slice(0, startIndex)
  const tail = isBulkInput ? '' : current.slice(startIndex + 1)
  const value = `${kept}${digits}${tail}`.slice(0, length)
  return { value, focusIndex: Math.min(startIndex + digits.length, length - 1) }
}

// Removes the digit in the slot, or the previous one when the slot is already empty
export function removeOtpDigit(current: string, slotIndex: number): OtpEdit {
  const removeIndex = slotIndex < current.length ? slotIndex : slotIndex - 1
  if (removeIndex < 0 || removeIndex >= current.length) return { value: current, focusIndex: slotIndex }
  const value = `${current.slice(0, removeIndex)}${current.slice(removeIndex + 1)}`
  return { value, focusIndex: removeIndex }
}
