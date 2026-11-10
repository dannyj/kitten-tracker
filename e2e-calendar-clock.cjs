// Loaded only by the calendar parity target, never by production startup.
const NativeDate = Date;
const frozen = NativeDate.parse("2026-11-07T23:30:00Z");
function CalendarTestDate(...args) {
  if (new.target) {
    return Reflect.construct(NativeDate, args.length ? args : [frozen], new.target);
  }
  return new NativeDate(frozen).toString();
}
Object.setPrototypeOf(CalendarTestDate, NativeDate);
CalendarTestDate.prototype = NativeDate.prototype;
CalendarTestDate.now = () => frozen;
CalendarTestDate.UTC = NativeDate.UTC;
CalendarTestDate.parse = NativeDate.parse;
globalThis.Date = CalendarTestDate;
