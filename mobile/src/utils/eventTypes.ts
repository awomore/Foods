import i18n from 'i18next';

/**
 * Private-chef occasions. `label` is the English value stored in bookings.event_type
 * (the server and older bookings use it), so it must not change; what users read
 * comes from hire_cook.event_type_<key>.
 */
export const EVENT_TYPES = [
  { key: 'birthday_party', label: 'Birthday Party' },
  { key: 'anniversary', label: 'Anniversary' },
  { key: 'corporate_dinner', label: 'Corporate Dinner' },
  { key: 'wedding', label: 'Wedding' },
  { key: 'house_party', label: 'House Party' },
  { key: 'graduation', label: 'Graduation' },
  { key: 'date_night', label: 'Date Night' },
  { key: 'other', label: 'Other' },
] as const;

/** A stored event type in the reader's language; free text a customer typed is shown as typed. */
export function eventTypeLabel(stored: string | null | undefined): string {
  if (!stored) return '';
  const known = EVENT_TYPES.find(e => e.label === stored || e.key === stored);
  return known ? i18n.t(`hire_cook.event_type_${known.key}`) : stored;
}
