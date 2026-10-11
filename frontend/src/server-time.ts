// Anchor authoritative epoch time to a monotonic clock, independent of device clock changes.
let serverAt = Date.now()
let receivedAt = performance.now()
let latestStamp = 0
export function syncServerTime(at: number, roundTrip = 0) {
  if(at<latestStamp)return
  latestStamp=at
  serverAt = at + Math.min(roundTrip / 2, 1000)
  receivedAt = performance.now()
}
export const serverNow = () => serverAt + performance.now() - receivedAt
