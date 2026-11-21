const messages = {
  en: {
    home: 'Discover places', venues: 'Venues', favorites: 'Saved', help: 'Help', admin: 'Admin',
    tagline: 'Find your way inside.', searchVenue: 'Search a mall, school, resort…',
    scan: 'Scan QR code', openMap: 'Open map', floors: 'floors', findPlace: 'Where would you like to go?',
    at: 'I am at', destination: 'Search a place or room…', all: 'All places', food: 'Food',
    restrooms: 'Restrooms', exits: 'Exits', atm: 'ATM', lifts: 'Lifts', parking: 'Parking', shops: 'Shops',
    helpDesk: 'Help desk', stepFree: 'Step-free route', directions: 'Directions', readAloud: 'Read aloud',
    next: 'Next', back: 'Back', details: 'Place details', navigate: 'Navigate here',
    noResults: 'No place found. Try another word.', recent: 'Recent searches',
  },
  hi: {
    home: 'जगहें देखें', venues: 'स्थल', favorites: 'पसंदीदा', help: 'मदद', admin: 'एडमिन',
    tagline: 'अंदर अपना रास्ता खोजें।', searchVenue: 'मॉल, स्कूल, रिसॉर्ट खोजें…',
    scan: 'QR कोड स्कैन करें', openMap: 'मैप खोलें', floors: 'मंज़िलें', findPlace: 'आप कहाँ जाना चाहते हैं?',
    at: 'मैं यहाँ हूँ', destination: 'जगह या कमरा खोजें…', all: 'सभी जगहें', food: 'खाना',
    restrooms: 'शौचालय', exits: 'निकास', atm: 'एटीएम', lifts: 'लिफ्ट', parking: 'पार्किंग', shops: 'दुकानें',
    helpDesk: 'सहायता केंद्र', stepFree: 'सीढ़ी-मुक्त रास्ता', directions: 'दिशा-निर्देश', readAloud: 'बोलकर सुनें',
    next: 'आगे', back: 'पीछे', details: 'जगह की जानकारी', navigate: 'यहाँ जाएँ',
    noResults: 'जगह नहीं मिली। दूसरा शब्द आज़माएँ।', recent: 'हाल की खोजें',
  },
};

export const translate = (language, key) => messages[language]?.[key] ?? messages.en[key] ?? key;
