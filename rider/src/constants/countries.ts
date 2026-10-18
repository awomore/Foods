/**
 * Countries a rider can verify an ID from. Mirrors mobile/src/constants/countries.ts
 * (the customer app's list); this app has no expo-localization, so the default
 * comes from the rider's phone number instead of the device region.
 */
export type Country = { iso: string; name: string; dial: string; maxLen: number };

export const COUNTRIES: Country[] = [
  { iso: 'DZ', name: 'Algeria', dial: '213', maxLen: 9 },
  { iso: 'AO', name: 'Angola', dial: '244', maxLen: 9 },
  { iso: 'AR', name: 'Argentina', dial: '54', maxLen: 11 },
  { iso: 'AU', name: 'Australia', dial: '61', maxLen: 9 },
  { iso: 'AT', name: 'Austria', dial: '43', maxLen: 13 },
  { iso: 'BD', name: 'Bangladesh', dial: '880', maxLen: 10 },
  { iso: 'BE', name: 'Belgium', dial: '32', maxLen: 9 },
  { iso: 'BJ', name: 'Benin', dial: '229', maxLen: 10 },
  { iso: 'BW', name: 'Botswana', dial: '267', maxLen: 8 },
  { iso: 'BR', name: 'Brazil', dial: '55', maxLen: 11 },
  { iso: 'BF', name: 'Burkina Faso', dial: '226', maxLen: 8 },
  { iso: 'CM', name: 'Cameroon', dial: '237', maxLen: 9 },
  { iso: 'CA', name: 'Canada', dial: '1', maxLen: 10 },
  { iso: 'CL', name: 'Chile', dial: '56', maxLen: 9 },
  { iso: 'CN', name: 'China', dial: '86', maxLen: 11 },
  { iso: 'CO', name: 'Colombia', dial: '57', maxLen: 10 },
  { iso: 'CD', name: 'Congo (DRC)', dial: '243', maxLen: 9 },
  { iso: 'CI', name: "Côte d'Ivoire", dial: '225', maxLen: 10 },
  { iso: 'CZ', name: 'Czechia', dial: '420', maxLen: 9 },
  { iso: 'DK', name: 'Denmark', dial: '45', maxLen: 8 },
  { iso: 'EG', name: 'Egypt', dial: '20', maxLen: 10 },
  { iso: 'ET', name: 'Ethiopia', dial: '251', maxLen: 9 },
  { iso: 'FI', name: 'Finland', dial: '358', maxLen: 10 },
  { iso: 'FR', name: 'France', dial: '33', maxLen: 9 },
  { iso: 'GM', name: 'Gambia', dial: '220', maxLen: 7 },
  { iso: 'DE', name: 'Germany', dial: '49', maxLen: 11 },
  { iso: 'GH', name: 'Ghana', dial: '233', maxLen: 9 },
  { iso: 'GR', name: 'Greece', dial: '30', maxLen: 10 },
  { iso: 'GN', name: 'Guinea', dial: '224', maxLen: 9 },
  { iso: 'HK', name: 'Hong Kong', dial: '852', maxLen: 8 },
  { iso: 'HU', name: 'Hungary', dial: '36', maxLen: 9 },
  { iso: 'IN', name: 'India', dial: '91', maxLen: 10 },
  { iso: 'ID', name: 'Indonesia', dial: '62', maxLen: 12 },
  { iso: 'IE', name: 'Ireland', dial: '353', maxLen: 9 },
  { iso: 'IL', name: 'Israel', dial: '972', maxLen: 9 },
  { iso: 'IT', name: 'Italy', dial: '39', maxLen: 11 },
  { iso: 'JM', name: 'Jamaica', dial: '1', maxLen: 10 },
  { iso: 'JP', name: 'Japan', dial: '81', maxLen: 10 },
  { iso: 'KE', name: 'Kenya', dial: '254', maxLen: 9 },
  { iso: 'KR', name: 'South Korea', dial: '82', maxLen: 10 },
  { iso: 'LR', name: 'Liberia', dial: '231', maxLen: 9 },
  { iso: 'MG', name: 'Madagascar', dial: '261', maxLen: 9 },
  { iso: 'MW', name: 'Malawi', dial: '265', maxLen: 9 },
  { iso: 'MY', name: 'Malaysia', dial: '60', maxLen: 10 },
  { iso: 'ML', name: 'Mali', dial: '223', maxLen: 8 },
  { iso: 'MX', name: 'Mexico', dial: '52', maxLen: 10 },
  { iso: 'MA', name: 'Morocco', dial: '212', maxLen: 9 },
  { iso: 'MZ', name: 'Mozambique', dial: '258', maxLen: 9 },
  { iso: 'NA', name: 'Namibia', dial: '264', maxLen: 9 },
  { iso: 'NL', name: 'Netherlands', dial: '31', maxLen: 9 },
  { iso: 'NZ', name: 'New Zealand', dial: '64', maxLen: 10 },
  { iso: 'NE', name: 'Niger', dial: '227', maxLen: 8 },
  { iso: 'NG', name: 'Nigeria', dial: '234', maxLen: 10 },
  { iso: 'NO', name: 'Norway', dial: '47', maxLen: 8 },
  { iso: 'PK', name: 'Pakistan', dial: '92', maxLen: 10 },
  { iso: 'PE', name: 'Peru', dial: '51', maxLen: 9 },
  { iso: 'PH', name: 'Philippines', dial: '63', maxLen: 10 },
  { iso: 'PL', name: 'Poland', dial: '48', maxLen: 9 },
  { iso: 'PT', name: 'Portugal', dial: '351', maxLen: 9 },
  { iso: 'QA', name: 'Qatar', dial: '974', maxLen: 8 },
  { iso: 'RO', name: 'Romania', dial: '40', maxLen: 9 },
  { iso: 'RU', name: 'Russia', dial: '7', maxLen: 10 },
  { iso: 'RW', name: 'Rwanda', dial: '250', maxLen: 9 },
  { iso: 'SA', name: 'Saudi Arabia', dial: '966', maxLen: 9 },
  { iso: 'SN', name: 'Senegal', dial: '221', maxLen: 9 },
  { iso: 'SL', name: 'Sierra Leone', dial: '232', maxLen: 8 },
  { iso: 'SG', name: 'Singapore', dial: '65', maxLen: 8 },
  { iso: 'SO', name: 'Somalia', dial: '252', maxLen: 9 },
  { iso: 'ZA', name: 'South Africa', dial: '27', maxLen: 9 },
  { iso: 'ES', name: 'Spain', dial: '34', maxLen: 9 },
  { iso: 'SD', name: 'Sudan', dial: '249', maxLen: 9 },
  { iso: 'SE', name: 'Sweden', dial: '46', maxLen: 10 },
  { iso: 'CH', name: 'Switzerland', dial: '41', maxLen: 9 },
  { iso: 'TZ', name: 'Tanzania', dial: '255', maxLen: 9 },
  { iso: 'TH', name: 'Thailand', dial: '66', maxLen: 9 },
  { iso: 'TG', name: 'Togo', dial: '228', maxLen: 8 },
  { iso: 'TT', name: 'Trinidad and Tobago', dial: '1', maxLen: 10 },
  { iso: 'TN', name: 'Tunisia', dial: '216', maxLen: 8 },
  { iso: 'TR', name: 'Türkiye', dial: '90', maxLen: 10 },
  { iso: 'UG', name: 'Uganda', dial: '256', maxLen: 9 },
  { iso: 'UA', name: 'Ukraine', dial: '380', maxLen: 9 },
  { iso: 'AE', name: 'United Arab Emirates', dial: '971', maxLen: 9 },
  { iso: 'GB', name: 'United Kingdom', dial: '44', maxLen: 10 },
  { iso: 'US', name: 'United States', dial: '1', maxLen: 10 },
  { iso: 'VN', name: 'Vietnam', dial: '84', maxLen: 10 },
  { iso: 'ZM', name: 'Zambia', dial: '260', maxLen: 9 },
  { iso: 'ZW', name: 'Zimbabwe', dial: '263', maxLen: 9 },
];

/** The country whose dialling code starts this phone number (longest match). */
export function countryFromPhone(phone?: string | null): Country | undefined {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return [...COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find(c => digits.startsWith(c.dial) && !(c.dial === '1' && c.iso !== 'US'));
}

export function countryByIso(iso?: string | null): Country | undefined {
  return iso ? COUNTRIES.find(c => c.iso === iso.toUpperCase()) : undefined;
}
