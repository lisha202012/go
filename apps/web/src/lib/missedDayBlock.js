export function isMissedDayBlockingError(err) {
  return err?.status === 409 && err?.details?.code === 'MISSED_DAY_BLOCKING';
}

export function redirectHomeForMissedDay() {
  window.location.assign('/home#missed-day');
}
