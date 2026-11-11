import { expect, it } from 'vitest'
import { liveReturn } from './live-return'
it('restores shared rooms without accepting arbitrary redirect destinations', () => {
  const path = '/live/watch/12345678-abcd-abcd-abcd-123456789abc'
  expect(liveReturn(path)).toBe(path)
  for (const value of [undefined, [path], '//example.com', 'https://example.com', path + '?other=1', path + '/extra', '/live/watch/bad']) {
    expect(liveReturn(value)).toBeUndefined()
  }
})
