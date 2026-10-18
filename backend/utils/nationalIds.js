'use strict';

/**
 * The identity document a rider verifies with, per country.
 *
 * Riders verify with their national ID. BVN is deliberately NOT accepted: it is
 * a bank identifier, and holding one gives an attacker a handle on the person's
 * bank accounts. Where a country has no national ID card in common use, a
 * passport is accepted instead.
 *
 * `lookup` names an automated check the backend can run; everything else goes
 * to an admin, who compares the photo of the document with the rider's details
 * (status 'pending_review'). Only the last 4 characters of a number are stored.
 *
 * Patterns are the documented number formats; normalise() strips spaces and
 * dashes first, except where the dashes are part of the format (Ghana Card).
 */
const COUNTRIES = {
  NG: [{ type: 'national_id', label: 'NIN', placeholder: '11 digits', pattern: /^\d{11}$/, lookup: 'flutterwave_nin' }],
  GH: [{ type: 'national_id', label: 'Ghana Card number', placeholder: 'GHA-123456789-0', pattern: /^GHA-\d{9}-\d$/, keepDashes: true }],
  KE: [{ type: 'national_id', label: 'National ID number', placeholder: '7 or 8 digits', pattern: /^\d{7,8}$/ }],
  ZA: [{ type: 'national_id', label: 'SA ID number', placeholder: '13 digits', pattern: /^\d{13}$/ }],
  UG: [{ type: 'national_id', label: 'NIN', placeholder: '14 characters, e.g. CM…', pattern: /^C[MF][A-Z0-9]{12}$/ }],
  TZ: [{ type: 'national_id', label: 'NIDA number', placeholder: '20 digits', pattern: /^\d{20}$/ }],
  RW: [{ type: 'national_id', label: 'National ID number', placeholder: '16 digits', pattern: /^\d{16}$/ }],
  EG: [{ type: 'national_id', label: 'National ID number', placeholder: '14 digits', pattern: /^\d{14}$/ }],
  // No national ID card in general use: a passport stands in.
  GB: [{ type: 'passport', label: 'Passport number', placeholder: '9 characters', pattern: /^[A-Z0-9]{9}$/ }],
  US: [{ type: 'passport', label: 'Passport number', placeholder: '9 characters', pattern: /^[A-Z0-9]{9}$/ }],
};

// Anywhere else: the national ID, or a passport, checked by a person.
const FALLBACK = [
  { type: 'national_id', label: 'National ID number', placeholder: 'As printed on your ID', pattern: /^[A-Z0-9]{5,20}$/ },
  { type: 'passport', label: 'Passport number', placeholder: 'As printed on your passport', pattern: /^[A-Z0-9]{6,12}$/ },
];

function idTypesFor(country) {
  return COUNTRIES[String(country ?? '').toUpperCase()] ?? FALLBACK;
}

/** The ID types for a country, as the apps show them (no regexes). */
function publicIdTypes(country) {
  return idTypesFor(country).map(({ type, label, placeholder, lookup }) => ({
    type, label, placeholder, automatic: Boolean(lookup),
  }));
}

function normalise(value, spec) {
  const v = String(value ?? '').trim().toUpperCase();
  return spec?.keepDashes ? v.replace(/\s+/g, '') : v.replace(/[\s-]+/g, '');
}

/**
 * Validate a submitted ID for `country`.
 * @returns {{ok:true, spec:object, value:string} | {ok:false, error:string}}
 */
function validateId(country, type, value) {
  if (!/^[A-Za-z]{2}$/.test(String(country ?? ''))) return { ok: false, error: 'country must be a 2-letter country code' };
  const spec = idTypesFor(country).find(s => s.type === type);
  if (!spec) {
    const allowed = idTypesFor(country).map(s => s.label).join(' or ');
    return { ok: false, error: `Use your ${allowed} for this country` };
  }
  const v = normalise(value, spec);
  if (!spec.pattern.test(v)) return { ok: false, error: `That doesn't look like a valid ${spec.label} (${spec.placeholder})` };
  return { ok: true, spec, value: v };
}

module.exports = { idTypesFor, publicIdTypes, validateId, COUNTRIES };
