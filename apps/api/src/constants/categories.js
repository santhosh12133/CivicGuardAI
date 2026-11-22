// Issue categories. The API serves this list at GET /api/issues/categories so
// the apps stay in sync; ids are stored in the database, labels are for display.
const CATEGORIES = [
  { id: 'pothole', label: 'Pothole' },
  { id: 'road_damage', label: 'Road damage' },
  { id: 'streetlight', label: 'Streetlight' },
  { id: 'garbage', label: 'Garbage' },
  { id: 'water_supply', label: 'Water supply' },
  { id: 'drainage', label: 'Drainage / sewage' },
  { id: 'traffic_signal', label: 'Traffic signal' },
  { id: 'fallen_tree', label: 'Fallen tree' },
  { id: 'other', label: 'Other' },
];

const CATEGORY_IDS = CATEGORIES.map((category) => category.id);
const DEFAULT_CATEGORY = 'other';

module.exports = { CATEGORIES, CATEGORY_IDS, DEFAULT_CATEGORY };
