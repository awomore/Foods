// The kinds of vendor a cook profile can be. Mirrors CreatorType in
// mobile/src/types/index.ts.
const CREATOR_TYPES = [
  'home_cook','chef','pastry_chef','baker','mixologist',
  'caterer','culinary_instructor','food_brand',
];

// Returns an error message, or null when `types` is a usable creator_types value.
function creatorTypesError(types) {
  if (!Array.isArray(types) || !types.length) return 'At least one creator type required';
  const invalid = types.filter(t => !CREATOR_TYPES.includes(t));
  return invalid.length ? `Invalid types: ${invalid.join(', ')}` : null;
}

module.exports = { CREATOR_TYPES, creatorTypesError };
