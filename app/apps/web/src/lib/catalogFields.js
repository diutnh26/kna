// Listings and products as a provider edits them: the same fields the admin
// console uses (apps/api src/admin/resources.ts), minus which provider owns
// the record — for a provider that is always themselves.

export const LISTING_FIELDS = [
  { name: 'imageUrl', type: 'image', create: true, edit: true },
  { name: 'title', type: 'text', create: true, edit: true, required: true },
  { name: 'category', type: 'select', options: ['STAY', 'GUIDED_WALK', 'CRAFT_SESSION', 'CEREMONY'], create: true, edit: true, required: true },
  { name: 'priceVnd', type: 'money', create: true, edit: true, required: true },
  { name: 'unit', type: 'select', options: ['per night', 'per person'], create: true, edit: true, required: true },
  { name: 'inventory', type: 'number', create: true, edit: true, required: true },
  { name: 'maxGuestsPerRoom', type: 'number', create: true, edit: true, required: true },
  { name: 'published', type: 'boolean', create: true, edit: true },
  { name: 'blurb', type: 'textarea', create: true, edit: true, required: true },
  { name: 'duration', type: 'text', create: true, edit: true, required: true },
  { name: 'groupSize', type: 'text', create: true, edit: true, required: true },
  { name: 'carbonRating', type: 'text', create: true, edit: true, required: true },
  { name: 'customs', type: 'textarea', create: true, edit: true },
];

export const PRODUCT_FIELDS = [
  { name: 'imageUrl', type: 'image', create: true, edit: true },
  { name: 'title', type: 'text', create: true, edit: true, required: true },
  { name: 'category', type: 'select', options: ['Textile', 'Basketry', 'Woodwork', 'Coffee', 'Jewellery'], create: true, edit: true, required: true },
  { name: 'priceVnd', type: 'money', create: true, edit: true, required: true },
  { name: 'stock', type: 'number', create: true, edit: true, required: true },
  { name: 'published', type: 'boolean', create: true, edit: true },
  { name: 'note', type: 'textarea', create: true, edit: true, required: true },
];

export const PROFILE_FIELDS = [
  { name: 'imageUrl', type: 'image', edit: true },
  { name: 'displayName', type: 'text', edit: true, required: true },
  { name: 'bio', type: 'textarea', edit: true },
];
