import { expect, test } from 'vitest'
import { nameMatches, normalizeName } from './names'

test('normalizeName은 공백·괄호 앞뒤 공백·대소문자를 무시한다', () => {
  expect(normalizeName('  Oriental Pearl  Tower ')).toBe('orientalpearltower')
})

test('nameMatches는 한쪽이 다른 쪽을 포함하면 같은 장소로 본다', () => {
  expect(nameMatches('동방명주', 'Oriental Pearl Tower (동방명주)')).toBe(true)
  expect(nameMatches('신천지', 'Xintiandi (신천지)')).toBe(true)
  expect(nameMatches('신천지', '와이탄')).toBe(false)
  expect(nameMatches('', '와이탄')).toBe(false)
})
