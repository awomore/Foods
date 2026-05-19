const { sql } = require('../supabase/db');

/**
 * Check if a menu item contains allergens matching a customer's profile.
 */
async function allergenGuard(customerId, menuItemId) {
  const profiles = await sql`
    SELECT allergens FROM customer_profiles WHERE user_id = ${customerId}
  `;
  const profile = profiles[0];
  if (!profile || !profile.allergens || profile.allergens.length === 0) {
    return { hasWarning: false, matchedAllergens: [] };
  }

  const items = await sql`
    SELECT allergens FROM menu_items WHERE id = ${menuItemId}
  `;
  const item = items[0];
  if (!item || !item.allergens || item.allergens.length === 0) {
    return { hasWarning: false, matchedAllergens: [] };
  }

  const customerAllergens = profile.allergens.map(a => a.toLowerCase());
  const itemAllergens = item.allergens.map(a => a.toLowerCase());
  const matched = customerAllergens.filter(a => itemAllergens.includes(a));

  return { hasWarning: matched.length > 0, matchedAllergens: matched };
}

async function allergenGuardBatch(customerId, menuItemIds) {
  const profiles = await sql`
    SELECT allergens FROM customer_profiles WHERE user_id = ${customerId}
  `;
  const profile = profiles[0];
  if (!profile || !profile.allergens || profile.allergens.length === 0) {
    return menuItemIds.map(id => ({ menuItemId: id, hasWarning: false, matchedAllergens: [] }));
  }

  const items = await sql`
    SELECT id, allergens FROM menu_items WHERE id = ANY(${menuItemIds})
  `;

  const customerAllergens = profile.allergens.map(a => a.toLowerCase());
  return (items || []).map(item => {
    const itemAllergens = (item.allergens || []).map(a => a.toLowerCase());
    const matched = customerAllergens.filter(a => itemAllergens.includes(a));
    return { menuItemId: item.id, hasWarning: matched.length > 0, matchedAllergens: matched };
  });
}

module.exports = { allergenGuard, allergenGuardBatch };
