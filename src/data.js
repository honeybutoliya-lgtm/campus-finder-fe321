export const categories = [
  { id: 'all', label: 'All places' },
  { id: 'food', label: 'Food' },
  { id: 'restrooms', label: 'Restrooms' },
  { id: 'exits', label: 'Exits' },
  { id: 'atm', label: 'ATM' },
  { id: 'lifts', label: 'Lifts' },
  { id: 'parking', label: 'Parking' },
  { id: 'help', label: 'Help desk' },
  { id: 'shops', label: 'Shops' },
];

const venues = [
  {
    id: 'city-mall', name: 'City Mall', type: 'Shopping mall', floors: ['Ground', 'First'],
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=82',
    location: 'Downtown district', hours: '10:00 AM - 10:00 PM',
    placeData: [
      ['Shoe Store', 'shops', 0, 'Shop the latest footwear brands and everyday essentials.'],
      ['Café Corner', 'food', 0, 'Coffee, pastries and a quiet place to take a break.'],
      ['Electronics Hub', 'shops', 0, 'Browse phones, computers and home electronics.'],
      ['Food Court', 'food', 0, 'A variety of quick meals and freshly prepared favourites.'],
      ['Toy World', 'shops', 1, 'Toys, games and gifts for all ages.'],
      ['Spa', 'help', 1, 'A relaxing wellness studio. Appointments are recommended.'],
      ['Cinema', 'shops', 1, 'Catch the latest films in comfortable auditoriums.'],
      ['Bookstore', 'shops', 1, 'Books, stationery and thoughtful gifts.'],
    ],
  },
  {
    id: 'green-valley-school', name: 'Green Valley School', type: 'School campus', floors: ['Ground', 'First'],
    image: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1200&q=82',
    location: 'North campus', hours: '7:30 AM - 5:00 PM',
    placeData: [
      ['Principal’s Office', 'help', 0, 'Administrative office for families and visitors.'],
      ['Library', 'shops', 0, 'A quiet collection of books and study spaces.'],
      ['Canteen', 'food', 0, 'Fresh snacks and lunch for students and visitors.'],
      ['Playground', 'shops', 0, 'The school’s shared outdoor play and activity area.'],
      ['Science Lab', 'help', 1, 'Science classrooms and supervised laboratory space.'],
      ['Class 5A', 'help', 1, 'Grade five classroom. Please check in at reception first.'],
      ['Computer Lab', 'help', 1, 'Computer classroom for lessons and projects.'],
      ['Auditorium', 'help', 1, 'Assembly hall for performances and school events.'],
    ],
  },
  {
    id: 'palm-bay-resort', name: 'Palm Bay Resort', type: 'Resort', floors: ['Ground', 'First'],
    image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=82',
    location: 'Palm Bay waterfront', hours: 'Open all day',
    placeData: [
      ['Spa', 'help', 0, 'Book a treatment or unwind in the wellness lounge.'],
      ['Pool Deck', 'shops', 0, 'Pool access, loungers and towel service.'],
      ['Restaurant', 'food', 0, 'Seasonal dining with indoor and outdoor seating.'],
      ['Beach Access', 'exits', 0, 'Follow the marked path to the private beach.'],
      ['Rooms 201–220', 'help', 1, 'Guest rooms on the first-floor east wing.'],
      ['Sky Lounge', 'food', 1, 'Drinks and light bites with a bay view.'],
      ['Gym', 'help', 1, 'Fitness room for resort guests.'],
      ['Conference Room', 'help', 1, 'Meeting and event space. Ask reception for access.'],
    ],
  },
];

const roomSlots = [[190, 128], [410, 128], [630, 128], [850, 128]];
const mobileLabels = {
  'Shoe Store': 'Shoes', 'Café Corner': 'Cafe', 'Electronics Hub': 'Tech', 'Food Court': 'Food',
  'Toy World': 'Toys', 'Spa': 'Spa', 'Cinema': 'Cinema', 'Bookstore': 'Books',
  'Principal’s Office': 'Office', 'Library': 'Library', 'Canteen': 'Canteen', 'Playground': 'Play',
  'Science Lab': 'Science', 'Class 5A': 'Class 5A', 'Computer Lab': 'Computer', 'Auditorium': 'Hall',
  'Pool Deck': 'Pool', 'Restaurant': 'Dining', 'Beach Access': 'Beach', 'Rooms 201–220': 'Rooms',
  'Sky Lounge': 'Lounge', 'Gym': 'Gym', 'Conference Room': 'Meeting',
  'Main entrance': 'Entrance', 'Restrooms': 'Restroom', 'Help desk': 'Help',
};

function makeVenue(source) {
  const nodes = [];
  const edges = [];
  const floors = source.floors.map((name, floorIndex) => ({
    id: floorIndex === 0 ? 'ground' : 'first', name,
    label: floorIndex === 0 ? 'G' : '1',
  }));
  const node = (floorIndex, id, label, x, y, type = 'junction') => {
    const record = { id: `${floors[floorIndex].id}-${id}`, label, x, y, floorId: floors[floorIndex].id, type };
    nodes.push(record);
    return record.id;
  };
  const edge = (from, to, mode = 'walk', weight) => edges.push({ from, to, mode, weight });
  const connectors = {};

  floors.forEach((floor, floorIndex) => {
    const lobby = node(floorIndex, 'entrance', floorIndex === 0 ? 'Main entrance' : 'Upper hall', 76, 280, floorIndex === 0 ? 'entrance' : 'hall');
    const j1 = node(floorIndex, 'j1', 'West junction', 270, 280);
    const j2 = node(floorIndex, 'j2', 'Central junction', 490, 280);
    const j3 = node(floorIndex, 'j3', 'East junction', 710, 280);
    const j4 = node(floorIndex, 'j4', 'East hall', 916, 280);
    const lift = node(floorIndex, 'lift', 'Lift', 710, 435, 'lift');
    const stairs = node(floorIndex, 'stairs', 'Stairs', 490, 435, 'stairs');
    const restroom = node(floorIndex, 'restrooms', 'Restrooms', 916, 435, 'restrooms');
    connectors[floor.id] = { lift, stairs };

    edge(lobby, j1); edge(j1, j2); edge(j2, j3); edge(j3, j4);
    edge(j3, lift); edge(j2, stairs); edge(j4, restroom);
    if (floorIndex === 0) {
      const atm = node(0, 'atm', 'ATM', 490, 205, 'atm');
      edge(j2, atm);
    }

    const placeIndexes = source.placeData.map((item, index) => item[2] === floorIndex ? index : -1).filter(index => index >= 0);
    placeIndexes.forEach((placeIndex) => {
      const localIndex = placeIndex % 4;
      const slotIndex = localIndex;
      const [x, y] = roomSlots[slotIndex];
      const parent = [j1, j2, j3, j4][localIndex];
      const placeNode = node(floorIndex, `place-${placeIndex}`, source.placeData[placeIndex][0], x, y, 'room');
      edge(parent, placeNode);
    });
    if (floorIndex === 0) {
      const parking = node(0, 'parking', 'Parking entrance', 76, 435, 'parking');
      edge(lobby, parking);
      const help = node(0, 'help', 'Reception', 270, 435, 'help');
      edge(j1, help);
    }
  });

  edge(connectors.ground.lift, connectors.first.lift, 'lift', 24);
  edge(connectors.ground.stairs, connectors.first.stairs, 'stairs', 15);

  const places = source.placeData.map(([name, category, floorIndex, description], index) => ({
    id: `${source.id}-place-${index + 1}`, name, category,
    mapLabel: mobileLabels[name] ?? name.slice(0, 9),
    floorId: floors[floorIndex].id, nodeId: `${floors[floorIndex].id}-place-${index}`,
    hours: source.hours, description,
  }));
  const extras = [
    { id: 'main-entrance', name: 'Main entrance', mapLabel: 'Entrance', category: 'exits', floorId: 'ground', nodeId: 'ground-entrance', hours: source.hours, description: 'The main public entrance and visitor check-in point.' },
    { id: 'restrooms', name: 'Restrooms', mapLabel: 'Restroom', category: 'restrooms', floorId: 'ground', nodeId: 'ground-restrooms', hours: source.hours, description: 'Public restrooms in the east hall.' },
    { id: 'lift', name: 'Lift', mapLabel: 'Lift', category: 'lifts', floorId: 'ground', nodeId: 'ground-lift', hours: 'Open during venue hours', description: 'Step-free connection between both floors.' },
    { id: 'stairs', name: 'Stairs', mapLabel: 'Stairs', category: 'help', floorId: 'ground', nodeId: 'ground-stairs', hours: 'Open during venue hours', description: 'Stair access between the ground and first floors.' },
    { id: 'parking', name: 'Parking', mapLabel: 'Parking', category: 'parking', floorId: 'ground', nodeId: 'ground-parking', hours: source.hours, description: 'Parking entrance and visitor drop-off area.' },
    { id: 'reception', name: 'Help desk', mapLabel: 'Help', category: 'help', floorId: 'ground', nodeId: 'ground-help', hours: source.hours, description: 'Ask the reception team for assistance.' },
    { id: 'atm', name: 'ATM', mapLabel: 'ATM', category: 'atm', floorId: 'ground', nodeId: 'ground-atm', hours: source.hours, description: 'Cash machine in the central hall.' },
  ];

  return { ...source, floors, nodes, edges, places: [...places, ...extras], startNodeId: 'ground-entrance' };
}

export const seedVenues = venues.map(makeVenue);
export const categoryLabel = Object.fromEntries(categories.map(({ id, label }) => [id, label]));
export const findNode = (venue, nodeId) => venue.nodes.find((node) => node.id === nodeId);
