import { describe, expect, it } from 'bun:test'
import { applyOtpInput, removeOtpDigit } from './otpDigits.ts'

const LENGTH = 6

describe('applyOtpInput', () => {
  it('should_fill_the_slot_and_advance_focus_when_one_digit_is_typed', () => {
    expect(applyOtpInput('12', 2, '3', LENGTH)).toEqual({ value: '123', focusIndex: 3 })
  })

  it('should_replace_the_digit_in_place_when_typing_over_a_filled_slot', () => {
    expect(applyOtpInput('123456', 1, '9', LENGTH)).toEqual({ value: '193456', focusIndex: 2 })
  })

  it('should_keep_only_the_new_digit_when_typing_in_a_filled_slot_without_selection', () => {
    expect(applyOtpInput('123', 1, '27', LENGTH).value).toBe('173')
  })

  it('should_ignore_input_when_it_has_no_digits', () => {
    expect(applyOtpInput('12', 2, 'a', LENGTH)).toEqual({ value: '12', focusIndex: 2 })
  })

  it('should_not_leave_gaps_when_typing_into_a_slot_beyond_the_first_empty_one', () => {
    expect(applyOtpInput('1', 4, '5', LENGTH).value).toBe('15')
  })

  it('should_replace_whole_code_and_cap_length_when_pasted_text_has_many_digits', () => {
    expect(applyOtpInput('12', 0, ' 98-76-54-32 ', LENGTH)).toEqual({ value: '987654', focusIndex: 5 })
  })
})

describe('removeOtpDigit', () => {
  it('should_remove_the_digit_in_the_slot_when_it_is_filled', () => {
    expect(removeOtpDigit('1234', 1)).toEqual({ value: '134', focusIndex: 1 })
  })

  it('should_remove_previous_digit_when_slot_is_empty', () => {
    expect(removeOtpDigit('123', 3)).toEqual({ value: '12', focusIndex: 2 })
  })

  it('should_keep_value_when_first_slot_is_empty', () => {
    expect(removeOtpDigit('', 0)).toEqual({ value: '', focusIndex: 0 })
  })
})
