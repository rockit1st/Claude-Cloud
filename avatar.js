// Avatars for Tech Class Hub: the item catalog, the one price list, and a drawing function.
//
// Load after the Firebase scripts (the Firebase parts are optional: drawing works without them):
//   <script src="avatar.js"></script>
//
// window.Avatar:
//   SLOTS         the eight places an item can go: skin, hair, face, hat, gear, pet, back, bg
//   ITEMS         every item: { id, slot, name, price, rare }   (id is "<slot>-<word>")
//   PRICES        { id: price }  -> THE price list. The same list is copied into firestore.rules (priceFor);
//                 test-rules.mjs reads both files and fails if they ever differ. Price 0 = free for everyone.
//   DEFAULTS      what a student wears before they pick anything (all free)
//   normalize(e)  keep only slots and items that exist (anything else becomes the default or nothing)
//   render(el, equipped, size)  draw the avatar into el (it replaces what is inside). size is the width in px.
//   describe(e)   a short plain sentence for screen readers
//   attach(el, uid, size)  put a small avatar in el now (the default one) and swap in the student's real
//                 one once it has been read. Reads are batched and cached; it never blocks and never throws.
//   load(uids)    Promise -> { uid: equipped | null } (null = no avatar saved). Never rejects.
//
// Everything is drawn from the fixed parts below as inline SVG. There is no free text and no outside
// picture or font. The only things read from the database are item ids, and each one is checked against
// the catalog before it is used, so nothing the database holds can reach the page as markup.
(function () {
  'use strict';
  if (window.Avatar) return;

  var SLOTS = ['skin', 'hair', 'face', 'hat', 'gear', 'pet', 'back', 'bg'];
  var SLOT_LABEL = { skin: 'Body', hair: 'Hair', face: 'Face', hat: 'Hats', gear: 'Gear', pet: 'Pets', back: 'Back', bg: 'Scene' };
  var SLOT_ICON = { skin: '🧑‍🚀', hair: '💇', face: '😀', hat: '🎩', gear: '🥽', pet: '🐾', back: '🚀', bg: '🌌' };
  var NONE_LABEL = { skin: '', hair: '', face: '', hat: 'No hat', gear: 'No gear', pet: 'No pet', back: 'No back item', bg: '' };

  // id, name, price, rare?  (the price list copied into firestore.rules; keep them the same)
  var LIST = [
    ['skin-peach', 'Peach', 0], ['skin-tan', 'Tan', 0], ['skin-brown', 'Brown', 0], ['skin-deep', 'Deep brown', 0],
    ['skin-alien', 'Alien green', 0], ['skin-robot', 'Robot silver', 0], ['skin-gold', 'Golden robot', 60, true],
    ['hair-short', 'Short hair', 0], ['hair-long', 'Long hair', 0], ['hair-ponytail', 'Ponytail', 0], ['hair-pigtails', 'Pigtails', 0],
    ['hair-braids', 'Braids', 0], ['hair-bun', 'Bun', 0], ['hair-curly', 'Curly hair', 0], ['hair-buzz', 'Buzz cut', 0],
    ['face-smile', 'Smile', 0], ['face-grin', 'Big grin', 5], ['face-wink', 'Wink', 5], ['face-surprised', 'Surprised', 8], ['face-starry', 'Star eyes', 15],
    ['hat-beanie', 'Beanie', 8], ['hat-propeller', 'Propeller cap', 12], ['hat-bow', 'Bow', 8], ['hat-flowers', 'Flower crown', 15], ['hat-tiara', 'Silver tiara', 30], ['hat-hardhat', 'Hard hat', 15], ['hat-wizard', 'Wizard hat', 25],
    ['hat-rocket', 'Rocket helmet', 30], ['hat-astronaut', 'Space helmet', 40], ['hat-crown', 'Gold crown', 60, true],
    ['gear-earrings', 'Star earrings', 8], ['gear-glasses', 'Round glasses', 10], ['gear-sunglasses', 'Cool shades', 12], ['gear-goggles', 'Lab goggles', 15], ['gear-antenna', 'Antennas', 18], ['gear-headphones', 'Headphones', 20],
    ['pet-dog', 'Brown dog', 15], ['pet-spot', 'Spotted dog', 20], ['pet-puppy', 'Puppy', 25], ['pet-husky', 'Husky', 30],
    ['pet-cat', 'Orange cat', 15], ['pet-blackcat', 'Black cat', 20], ['pet-kitten', 'Kitten', 25], ['pet-siamese', 'Siamese cat', 30],
    ['pet-astrodog', 'Space dog', 45, true], ['pet-astrocat', 'Space cat', 45, true],
    ['back-backpack', 'Backpack', 15], ['back-cape', 'Hero cape', 25], ['back-jetpack', 'Jetpack', 45], ['back-wings', 'Star wings', 55, true],
    ['bg-sky', 'Blue sky', 0], ['bg-stars', 'Starry night', 15], ['bg-hallway', 'School hallway', 15], ['bg-lab', 'Science lab', 20],
    ['bg-launchpad', 'Launch pad', 30], ['bg-moon', 'The Moon', 40], ['bg-blackhole', 'Black hole', 55, true]
  ];
  var ITEMS = [], PRICES = {}, BY_ID = {};
  LIST.forEach(function (r) {
    var it = { id: r[0], slot: r[0].split('-')[0], name: r[1], price: r[2], rare: !!r[3] };
    ITEMS.push(it); PRICES[it.id] = it.price; BY_ID[it.id] = it;
  });
  var DEFAULTS = { skin: 'skin-peach', hair: 'hair-short', face: 'face-smile', bg: 'bg-sky' };

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function itemOf(id) { return typeof id === 'string' && has(BY_ID, id) ? BY_ID[id] : null; }
  function priceOf(id) { return typeof id === 'string' && has(PRICES, id) ? PRICES[id] : -1; }
  // keep only what exists; skin, hair, face and bg always have a value
  function normalize(e, noDefaults) {
    var out = {};
    SLOTS.forEach(function (s) {
      var v = e && typeof e === 'object' && has(e, s) ? e[s] : null, it = itemOf(v);
      if (it && it.slot === s) out[s] = it.id;
      else if (!noDefaults && has(DEFAULTS, s)) out[s] = DEFAULTS[s];
    });
    return out;
  }
  // what to write to the database: the default hair is left out (and no pet is simply absent), so a
  // student who uses neither saves exactly what the older rules accept
  function forSave(e) {
    var out = normalize(e);
    if (out.hair === DEFAULTS.hair) delete out.hair;
    return out;
  }
  function describe(e) {
    var n = normalize(e), parts = [];
    SLOTS.forEach(function (s) {
      if (!n[s]) return;
      var it = BY_ID[n[s]];
      if (s === 'skin') parts.unshift('Avatar: ' + it.name.toLowerCase());
      else if (s === 'bg') parts.push('in front of ' + it.name.toLowerCase());
      else if ((s !== 'face' && s !== 'hair') || n[s] !== DEFAULTS[s]) parts.push(it.name.toLowerCase());
    });
    return parts.join(', ').replace(', in front', ' in front');
  }

  // ── the parts (fixed SVG text; "@" is replaced by a number so ids never clash on a page) ──
  var SKIN_COL = { 'skin-peach': '#f5c9a0', 'skin-tan': '#d9a066', 'skin-brown': '#a8693e', 'skin-deep': '#6b4226', 'skin-alien': '#93e58f', 'skin-robot': '#b9c5d3', 'skin-gold': 'url(#gold@)' };
  var HAIR_COL = { 'skin-peach': '#7a4a22', 'skin-tan': '#3a2412', 'skin-brown': '#241810', 'skin-deep': '#150e0a' };
  // robots, aliens and the golden robot get a bright wig colour so every style shows on them
  var WIG_COL = { 'skin-alien': '#ff6fb5', 'skin-robot': '#3fb8ff', 'skin-gold': '#ff6fb5' };
  function star(cx, cy, r, fill) {
    var pts = [], i, a, rr;
    for (i = 0; i < 10; i++) { a = -Math.PI / 2 + i * Math.PI / 5; rr = i % 2 ? r * 0.45 : r; pts.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1)); }
    return '<polygon points="' + pts.join(' ') + '" fill="' + fill + '"/>';
  }
  function dots(list, fill) {
    return list.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '" fill="' + fill + '"/>'; }).join('');
  }
  var STARS = [[8, 10, 1], [22, 22, 0.8], [40, 8, 1.1], [60, 18, 0.8], [78, 9, 1.2], [92, 24, 0.9], [12, 44, 0.9], [90, 52, 1], [6, 70, 0.8], [94, 78, 1.1], [18, 96, 1], [84, 100, 0.9], [30, 60, 0.7], [70, 40, 0.7]];

  var BG = {
    'bg-sky': '<defs><linearGradient id="sky@" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc6ff"/><stop offset="1" stop-color="#e2f4ff"/></linearGradient></defs>' +
      '<rect width="100" height="120" fill="url(#sky@)"/><ellipse cx="22" cy="24" rx="14" ry="5" fill="#fff" opacity=".9"/><ellipse cx="30" cy="20" rx="9" ry="5" fill="#fff" opacity=".9"/><ellipse cx="80" cy="40" rx="12" ry="4" fill="#fff" opacity=".8"/>',
    'bg-stars': '<rect width="100" height="120" fill="#0b1030"/>' + dots(STARS, '#fff') + star(16, 30, 4, '#ffe58a') + star(84, 20, 3, '#ffe58a') + star(76, 66, 2.6, '#bfe0ff'),
    'bg-hallway': '<rect width="100" height="120" fill="#d5dcea"/><rect y="88" width="100" height="32" fill="#8e9bb2"/><rect y="86" width="100" height="3" fill="#6f7c94"/>' +
      '<rect x="0" y="20" width="24" height="68" fill="#3d6fb5"/><rect x="76" y="20" width="24" height="68" fill="#3d6fb5"/>' +
      '<path d="M12 20V88M88 20V88M0 54H24M76 54H100" stroke="#2a4f88" stroke-width="1.5"/><path d="M4 30h6M4 38h6M90 30h6M90 38h6M4 64h6M4 72h6M90 64h6M90 72h6" stroke="#9fc0ee" stroke-width="1.5"/>' +
      '<rect x="36" y="4" width="28" height="4" rx="2" fill="#fff6c9"/>',
    'bg-lab': '<rect width="100" height="120" fill="#e6f2ee"/><rect y="92" width="100" height="28" fill="#a47a52"/><rect y="90" width="100" height="4" fill="#7e5a38"/>' +
      '<rect x="0" y="40" width="100" height="3" fill="#b9c9c4"/>' +
      '<path d="M10 40V28l-4-8h14l-4 8v12z" fill="#7be0a8" stroke="#52a37a"/><path d="M26 40V30h10v10z" fill="#ff9aa8" stroke="#c96a78"/><path d="M78 40V26h6v14z" fill="#ffd36e" stroke="#c9a040"/><path d="M90 40V30l-3-6h8l-3 6v10z" fill="#9ad0ff" stroke="#5c9ad0"/>' +
      '<circle cx="14" cy="76" r="5" fill="#fff" stroke="#9aa" /><circle cx="86" cy="72" r="6" fill="#ffe0f0" stroke="#c9a"/>',
    'bg-launchpad': '<defs><linearGradient id="dusk@" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a6e"/><stop offset=".7" stop-color="#ff9a5a"/><stop offset="1" stop-color="#ffd28a"/></linearGradient></defs>' +
      '<rect width="100" height="120" fill="url(#dusk@)"/><rect y="100" width="100" height="20" fill="#59606e"/><rect x="0" y="98" width="100" height="3" fill="#8b93a3"/>' +
      '<rect x="4" y="30" width="8" height="70" fill="#7b8396"/><path d="M4 40L12 50M12 40L4 50M4 56L12 66M12 56L4 66M4 72L12 82M12 72L4 82" stroke="#4d5568" stroke-width="1.2"/><rect x="12" y="44" width="10" height="3" fill="#7b8396"/>' +
      '<path d="M88 40Q93 52 93 66V98H83V66Q83 52 88 40z" fill="#f4f4f8"/><path d="M88 40Q91 46 92 52H84Q85 46 88 40z" fill="#e8402a"/><path d="M83 84L78 98H83zM93 84L98 98H93z" fill="#e8402a"/>' + dots([[20, 20, .8], [50, 12, .8], [70, 24, .7], [36, 34, .6]], '#fff'),
    'bg-moon': '<rect width="100" height="120" fill="#05060f"/>' + dots(STARS.slice(0, 9), '#fff') +
      '<circle cx="50" cy="190" r="110" fill="#a9acb8"/><circle cx="50" cy="190" r="110" fill="none" stroke="#c9ccd6" stroke-width="2"/>' +
      '<ellipse cx="20" cy="98" rx="8" ry="2.6" fill="#8c8f9c"/><ellipse cx="80" cy="104" rx="10" ry="3" fill="#8c8f9c"/><ellipse cx="58" cy="112" rx="6" ry="2" fill="#8c8f9c"/>' +
      '<circle cx="82" cy="22" r="10" fill="#3f8cf0"/><path d="M76 18Q82 14 88 20Q84 24 80 22Q78 28 76 26z" fill="#4fbf6f"/>',
    'bg-blackhole': '<defs><radialGradient id="bh@" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000"/><stop offset=".45" stop-color="#000"/><stop offset=".6" stop-color="#5a2aa8"/><stop offset="1" stop-color="#0a0420"/></radialGradient></defs>' +
      '<rect width="100" height="120" fill="#0a0420"/><circle cx="50" cy="60" r="62" fill="url(#bh@)"/>' +
      '<ellipse cx="50" cy="60" rx="46" ry="12" fill="none" stroke="#ffb347" stroke-width="3" opacity=".85" transform="rotate(-18 50 60)"/>' +
      '<ellipse cx="50" cy="60" rx="38" ry="9" fill="none" stroke="#ff6fb5" stroke-width="2" opacity=".7" transform="rotate(-18 50 60)"/>' + dots(STARS.slice(0, 6), '#e9d8ff')
  };

  var BACK = {
    'back-backpack': '<rect x="14" y="82" width="72" height="36" rx="10" fill="#e07a2f"/><rect x="22" y="100" width="56" height="14" rx="4" fill="#c4611a"/><rect x="30" y="86" width="40" height="4" rx="2" fill="#ffb066"/>',
    'back-cape': '<path d="M26 80L6 120H94L74 80z" fill="#d6283b"/><path d="M26 80L16 120H50z" fill="#b01c2d" opacity=".55"/>',
    'back-jetpack': '<rect x="10" y="74" width="16" height="34" rx="7" fill="#8a96a8"/><rect x="74" y="74" width="16" height="34" rx="7" fill="#8a96a8"/><rect x="10" y="84" width="16" height="5" fill="#e8402a"/><rect x="74" y="84" width="16" height="5" fill="#e8402a"/>' +
      '<path d="M12 108L18 120L24 108z" fill="#ffb02e"/><path d="M76 108L82 120L88 108z" fill="#ffb02e"/><path d="M15 108L18 114L21 108z" fill="#fff3b0"/><path d="M79 108L82 114L85 108z" fill="#fff3b0"/>',
    'back-wings': '<path d="M30 92Q-2 80 4 36Q18 52 32 66z" fill="#f6f4ff" stroke="#c7c0ee" stroke-width="1.2"/><path d="M70 92Q102 80 96 36Q82 52 68 66z" fill="#f6f4ff" stroke="#c7c0ee" stroke-width="1.2"/>' +
      '<path d="M10 52Q18 64 28 72M16 44Q24 60 30 68" stroke="#d8d2f5" fill="none"/><path d="M90 52Q82 64 72 72M84 44Q76 60 70 68" stroke="#d8d2f5" fill="none"/>' + star(10, 30, 3.5, '#ffe58a') + star(90, 30, 3.5, '#ffe58a')
  };

  function flower(cx, cy, col) {
    var out = '', i, a;
    for (i = 0; i < 5; i++) { a = i * 1.2566; out += '<circle cx="' + (cx + 2.3 * Math.cos(a)).toFixed(1) + '" cy="' + (cy + 2.3 * Math.sin(a)).toFixed(1) + '" r="1.9" fill="' + col + '"/>'; }
    return out + '<circle cx="' + cx + '" cy="' + cy + '" r="1.5" fill="#f2a516"/>';
  }
  var HAT = {
    'hat-beanie': '<path d="M26 40Q26 12 50 12Q74 12 74 40z" fill="#e8503a"/><rect x="25" y="35" width="50" height="9" rx="4" fill="#c43d2a"/><circle cx="50" cy="10" r="5" fill="#fff"/><path d="M36 20Q38 16 42 14M58 14Q62 16 64 20" stroke="#ff9a88" stroke-width="2" fill="none"/>',
    'hat-propeller': '<path d="M28 38Q30 18 50 18Q70 18 72 38z" fill="#3a8fe8"/><path d="M50 18V34" stroke="#2a6bb8" stroke-width="2"/><rect x="26" y="35" width="48" height="6" rx="3" fill="#2a6bb8"/><rect x="49" y="8" width="2" height="10" fill="#555"/><ellipse cx="40" cy="8" rx="10" ry="2.2" fill="#ffd23f"/><ellipse cx="60" cy="8" rx="10" ry="2.2" fill="#ff6f6f"/><circle cx="50" cy="8" r="2" fill="#333"/>',
    'hat-hardhat': '<path d="M26 40Q28 12 50 12Q72 12 74 40z" fill="#ffd23f"/><rect x="46" y="12" width="8" height="28" fill="#e8b50f"/><rect x="21" y="37" width="58" height="6" rx="3" fill="#f0b800"/><rect x="42" y="22" width="16" height="6" rx="2" fill="#fff" opacity=".5"/>',
    'hat-wizard': '<path d="M50 2L78 40Q50 47 22 40z" fill="#6a3fd0"/><ellipse cx="50" cy="40" rx="33" ry="6" fill="#4f2aa8"/><path d="M26 38Q50 44 74 38" stroke="#ffd23f" stroke-width="3" fill="none"/>' + star(46, 22, 3.6, '#ffe58a') + star(56, 31, 2.6, '#ffe58a') + star(41, 32, 2, '#fff'),
    'hat-rocket': '<path d="M27 44Q27 14 50 14Q73 14 73 44z" fill="#f4f4f8"/><path d="M44 16Q50 0 56 16z" fill="#e8402a"/><path d="M27 44Q27 30 36 24L36 44z" fill="#e8402a"/><path d="M73 44Q73 30 64 24L64 44z" fill="#e8402a"/><rect x="38" y="30" width="24" height="5" rx="2" fill="#3a8fe8"/><path d="M27 38L15 52L27 52zM73 38L85 52L73 52z" fill="#c4301c"/>',
    'hat-astronaut': '<circle cx="50" cy="50" r="33" fill="#cfe8ff" opacity=".22" stroke="#e8f0fa" stroke-width="3.5"/><path d="M30 28Q36 20 46 18" stroke="#fff" stroke-width="3" fill="none" opacity=".8" stroke-linecap="round"/><path d="M26 82Q50 92 74 82L72 90Q50 98 28 90z" fill="#e8edf5" stroke="#b9c3d4"/><circle cx="34" cy="88" r="2.4" fill="#e8402a"/><circle cx="66" cy="88" r="2.4" fill="#3a8fe8"/>',
    'hat-bow': '<path d="M63 27Q50 15 50 27Q50 39 63 27z" fill="#ff5fa2" stroke="#d93a82" stroke-width="1"/><path d="M63 27Q76 15 76 27Q76 39 63 27z" fill="#ff5fa2" stroke="#d93a82" stroke-width="1"/><path d="M54 24Q56 21 59 24M72 24Q70 21 67 24" stroke="#ffb3d4" stroke-width="1.4" fill="none" stroke-linecap="round"/><circle cx="63" cy="27" r="3.4" fill="#e8408a" stroke="#d93a82" stroke-width="1"/>',
    'hat-flowers': '<path d="M28 42Q28 22 50 22Q72 22 72 42" stroke="#3f9e52" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
      flower(30, 38, '#ff7eb6') + flower(33, 29, '#ffffff') + flower(41, 24, '#b99cff') + flower(50, 22.5, '#ff7eb6') + flower(59, 24, '#ffd23f') + flower(67, 29, '#b99cff') + flower(70, 38, '#ffffff') +
      '<path d="M36 25Q38 21 41 22M64 25Q62 21 59 22" stroke="#2f8a44" stroke-width="2" fill="none" stroke-linecap="round"/>',
    'hat-tiara': '<path d="M33 37L36 24L42 31L50 19L58 31L64 24L67 37Q50 31 33 37z" fill="#dfe6f0" stroke="#8d9ab0" stroke-width="1.2" stroke-linejoin="round"/><path d="M33 37Q50 31 67 37" stroke="#b9c4d6" stroke-width="2.4" fill="none"/><circle cx="50" cy="27" r="2.6" fill="#ff6fb5" stroke="#fff" stroke-width=".8"/><circle cx="37" cy="29" r="1.5" fill="#6fc3ff"/><circle cx="63" cy="29" r="1.5" fill="#6fc3ff"/><path d="M45 24L47 21" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>',
    'hat-crown': '<path d="M29 36L32 12L41 25L50 8L59 25L68 12L71 36z" fill="#f2c230" stroke="#b88a10" stroke-width="1.2"/><rect x="29" y="33" width="42" height="6" rx="2" fill="#e0a916"/><circle cx="50" cy="19" r="2.6" fill="#e8402a"/><circle cx="36" cy="30" r="2" fill="#3a8fe8"/><circle cx="64" cy="30" r="2" fill="#3fb86a"/>'
  };

  var GEAR = {
    'gear-earrings': '<path d="M26 56.5V60M74 56.5V60" stroke="#d9a516" stroke-width="1.1"/>' + star(26, 63, 3.8, '#ffd23f') + star(74, 63, 3.8, '#ffd23f'),
    'gear-glasses': '<circle cx="41" cy="50" r="7.5" fill="#fff" fill-opacity=".25" stroke="#2c2c34" stroke-width="2"/><circle cx="59" cy="50" r="7.5" fill="#fff" fill-opacity=".25" stroke="#2c2c34" stroke-width="2"/><path d="M48.5 50H51.5M33.5 49L27 47M66.5 49L73 47" stroke="#2c2c34" stroke-width="2"/>',
    'gear-sunglasses': '<rect x="32" y="44" width="16" height="11" rx="4" fill="#15151c"/><rect x="52" y="44" width="16" height="11" rx="4" fill="#15151c"/><path d="M48 47H52M32 46L27 45M68 46L73 45" stroke="#15151c" stroke-width="2.4"/><path d="M35 47L40 47M55 47L60 47" stroke="#5a5a7a" stroke-width="1.6"/>',
    'gear-goggles': '<path d="M25 44H75V56H25z" fill="#4a3f36" opacity=".9"/><circle cx="41" cy="50" r="8.5" fill="#9ff0b8" fill-opacity=".55" stroke="#f08a2a" stroke-width="3"/><circle cx="59" cy="50" r="8.5" fill="#9ff0b8" fill-opacity=".55" stroke="#f08a2a" stroke-width="3"/><path d="M36 46Q39 43 43 44" stroke="#fff" stroke-width="1.6" fill="none"/>',
    'gear-antenna': '<path d="M38 28L30 8M62 28L70 8" stroke="#6b7488" stroke-width="2.2" stroke-linecap="round"/><circle cx="30" cy="7" r="3.6" fill="#ff4f7b"/><circle cx="70" cy="7" r="3.6" fill="#37d6a0"/>',
    'gear-headphones': '<path d="M26 54Q24 18 50 18Q76 18 74 54" stroke="#2c2c34" stroke-width="4.5" fill="none" stroke-linecap="round"/><rect x="19" y="45" width="11" height="19" rx="5" fill="#e8402a"/><rect x="70" y="45" width="11" height="19" rx="5" fill="#e8402a"/><rect x="21" y="49" width="4" height="11" rx="2" fill="#ff8a78"/><rect x="75" y="49" width="4" height="11" rx="2" fill="#ff8a78"/>'
  };


  // ── hair: a part behind the head and a part on top. Short hair is the original look. ──
  var CAP = 'M26 44Q24 24 50 22Q76 24 74 44Q66 34 50 34Q34 34 26 44z';
  var FULL_HATS = { 'hat-beanie': 1, 'hat-propeller': 1, 'hat-hardhat': 1, 'hat-wizard': 1, 'hat-rocket': 1, 'hat-astronaut': 1 };
  function hairParts(id, skin, hat) {
    var human = has(HAIR_COL, skin), c = human ? HAIR_COL[skin] : WIG_COL[skin] || '#ff6fb5', back = '', front = '', i, y, x;
    var cap = '<path d="' + CAP + '" fill="' + c + '"/>', full = !!FULL_HATS[hat], tie = '#ff5fa2';
    var fill = '<ellipse cx="50" cy="47" rx="26.5" ry="27" fill="' + c + '"/>';
    if (id === 'hair-short') { if (human) front = cap; }
    else if (id === 'hair-buzz') front = '<path d="M27 42Q26 25 50 23Q74 25 73 42Q68 32 50 31Q32 32 27 42z" fill="' + c + '"/>';
    else if (id === 'hair-long') {
      back = fill + '<path d="M27 40Q15 66 20 100Q29 106 38 100Q31 78 34 56z" fill="' + c + '"/><path d="M73 40Q85 66 80 100Q71 106 62 100Q69 78 66 56z" fill="' + c + '"/>';
      front = cap;
    } else if (id === 'hair-ponytail') {
      back = fill + '<path d="M68 29Q95 24 92 58Q91 74 82 86Q85 66 76 52Q72 42 66 38z" fill="' + c + '"/>';
      front = cap + '<ellipse cx="71" cy="33" rx="3" ry="4.8" fill="' + tie + '" transform="rotate(-25 71 33)"/>';
    } else if (id === 'hair-pigtails') {
      back = fill + '<path d="M24 40Q7 48 9 72Q11 86 20 81Q20 66 28 54z" fill="' + c + '"/><path d="M76 40Q93 48 91 72Q89 86 80 81Q80 66 72 54z" fill="' + c + '"/>';
      front = cap + '<circle cx="24" cy="42" r="3.6" fill="' + tie + '"/><circle cx="76" cy="42" r="3.6" fill="' + tie + '"/>';
    } else if (id === 'hair-braids') {
      back = fill;
      for (i = 0; i < 5; i++) {
        y = 56 + i * 9; x = i % 2 ? 24.6 : 21.4;
        back += '<ellipse cx="' + x + '" cy="' + y + '" rx="4.6" ry="6" fill="' + c + '"/><ellipse cx="' + (100 - x) + '" cy="' + y + '" rx="4.6" ry="6" fill="' + c + '"/>';
      }
      back += '<circle cx="23" cy="98" r="3" fill="' + tie + '"/><circle cx="77" cy="98" r="3" fill="' + tie + '"/>';
      front = cap;
    } else if (id === 'hair-bun') {
      front = (full ? '' : '<circle cx="50" cy="15" r="9.5" fill="' + c + '"/><path d="M42 21Q50 25 58 21" stroke="' + tie + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>') + cap;
    } else if (id === 'hair-curly') {
      var ring = [[25, 34, 8.5], [75, 34, 8.5], [20, 48, 8], [80, 48, 8], [22, 62, 7.5], [78, 62, 7.5]];
      if (!full) ring = ring.concat([[50, 19, 9], [34, 22, 8.5], [66, 22, 8.5]]);
      back = dots(ring, c);
      front = cap + dots([[33, 34, 5.4], [42, 31, 5.4], [51, 30, 5.4], [60, 31, 5.4], [68, 34, 5]], c);
    }
    return { back: back, front: front };
  }


  // ── pets: a small dog or cat in the bottom-left corner, in front of the scene (never near the face) ──
  var INK = '#1a1a1f';
  function dogSvg(o) {
    var f = o.fur, m = o.muz, eye = o.eye || 1.5;
    var s = o.curl ? '<path d="M24 25Q34 25 30.5 14Q29 10 25.5 14" stroke="' + f + '" stroke-width="4.6" fill="none" stroke-linecap="round"/><circle cx="25.6" cy="13.6" r="2.3" fill="' + (o.tip || f) + '"/>'
      : '<path d="M24 24Q31 21 29.5 12" stroke="' + f + '" stroke-width="3.8" fill="none" stroke-linecap="round"/>';
    if (o.upright) s += '<path d="M7.6 10L8 1.2L15.4 5.4z" fill="' + o.ear + '"/><path d="M24.4 10L24 1.2L16.6 5.4z" fill="' + o.ear + '"/><path d="M9.6 8L9.9 4L12.8 6z" fill="#f0bcbc"/><path d="M22.4 8L22.1 4L19.2 6z" fill="#f0bcbc"/>';
    s += '<ellipse cx="16" cy="23" rx="10" ry="7.5" fill="' + f + '"/><ellipse cx="16" cy="25.5" rx="6" ry="4.6" fill="' + m + '"/>';
    if (o.spots) s += '<circle cx="9.5" cy="21.5" r="3" fill="' + o.ear + '"/><circle cx="23.5" cy="25" r="2.4" fill="' + o.ear + '"/>';
    s += '<ellipse cx="11" cy="28.6" rx="3.8" ry="2.2" fill="' + m + '"/><ellipse cx="21" cy="28.6" rx="3.8" ry="2.2" fill="' + m + '"/>';
    s += '<circle cx="16" cy="13" r="9" fill="' + f + '"/>';
    if (o.mask) s += '<path d="M16 4.2Q9 5 8 14Q10 21 16 22Q22 21 24 14Q23 5 16 4.2z" fill="' + o.mask + '"/>';
    if (o.patch) s += '<circle cx="11.6" cy="10.4" r="4" fill="' + o.ear + '"/>';
    if (!o.upright) s += '<ellipse cx="7" cy="12" rx="3.6" ry="6.4" fill="' + o.ear + '" transform="rotate(14 7 12)"/><ellipse cx="25" cy="12" rx="3.6" ry="6.4" fill="' + o.ear + '" transform="rotate(-14 25 12)"/>';
    s += '<ellipse cx="16" cy="16.8" rx="5.4" ry="4.2" fill="' + m + '"/>';
    s += '<circle cx="12.4" cy="10.6" r="' + eye + '" fill="' + (o.eyec || INK) + '"/><circle cx="19.6" cy="10.6" r="' + eye + '" fill="' + (o.eyec || INK) + '"/>' +
      '<circle cx="12.9" cy="10" r=".55" fill="#fff"/><circle cx="20.1" cy="10" r=".55" fill="#fff"/>';
    s += '<ellipse cx="16" cy="14.9" rx="2.6" ry="1.9" fill="' + INK + '"/><ellipse cx="15.2" cy="14.3" rx=".8" ry=".45" fill="#fff" opacity=".6"/>' +
      '<path d="M16 16.8V18.4M16 18.4Q13.8 20 12.4 18.4M16 18.4Q18.2 20 19.6 18.4" stroke="' + INK + '" stroke-width=".9" fill="none" stroke-linecap="round"/><path d="M14.6 19.2Q16 23.4 17.4 19.2z" fill="#ff7a8a"/>';
    if (o.collar) s += '<rect x="8.5" y="20.4" width="15" height="2.6" rx="1.3" fill="' + o.collar + '"/><circle cx="16" cy="24" r="1.5" fill="#ffd23f"/>';
    return s;
  }
  function catSvg(o) {
    var f = o.fur, pt = o.points || f, inner = o.inner || '#ff9fb2', wh = o.whisk || '#3a3a44', er = o.eye || 1.9;
    var s = '<path d="M24 27Q34.5 27 31.5 15Q30.5 9.5 27 12" stroke="' + pt + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
    s += '<path d="M7.5 9.5L6.8 0.4L14.8 4.2z" fill="' + pt + '"/><path d="M24.5 9.5L25.2 0.4L17.2 4.2z" fill="' + pt + '"/><path d="M9 7.4L8.7 3L12.4 4.8z" fill="' + inner + '"/><path d="M23 7.4L23.3 3L19.6 4.8z" fill="' + inner + '"/>';
    s += '<ellipse cx="16" cy="23.2" rx="9.6" ry="7.3" fill="' + f + '"/>';
    if (o.stripe) s += '<path d="M8 20Q10 21 10.4 24M24 20Q22 21 21.6 24" stroke="' + o.stripe + '" stroke-width="1.4" fill="none" stroke-linecap="round"/>';
    s += '<ellipse cx="11.2" cy="28.6" rx="3.4" ry="2.1" fill="' + (o.paw || pt) + '"/><ellipse cx="20.8" cy="28.6" rx="3.4" ry="2.1" fill="' + (o.paw || pt) + '"/>';
    s += '<ellipse cx="16" cy="13.5" rx="9.8" ry="8.6" fill="' + f + '"/>';
    if (o.mask) s += '<ellipse cx="16" cy="15.4" rx="5.6" ry="5.4" fill="' + o.mask + '"/>';
    else s += '<ellipse cx="16" cy="16.8" rx="4.2" ry="3.2" fill="#fff6ea"/>';
    if (o.stripe) s += '<path d="M16 5.2V8.4M12.4 5.8L13.1 8.2M19.6 5.8L18.9 8.2" stroke="' + o.stripe + '" stroke-width="1.2" stroke-linecap="round"/>';
    s += '<ellipse cx="11.6" cy="12" rx="' + er + '" ry="' + (er + .5) + '" fill="' + o.eyec + '"/><ellipse cx="20.4" cy="12" rx="' + er + '" ry="' + (er + .5) + '" fill="' + o.eyec + '"/>' +
      '<ellipse cx="11.6" cy="12" rx=".65" ry="' + (er + .2) + '" fill="#111"/><ellipse cx="20.4" cy="12" rx=".65" ry="' + (er + .2) + '" fill="#111"/>' +
      '<circle cx="12.2" cy="11" r=".5" fill="#fff"/><circle cx="21" cy="11" r=".5" fill="#fff"/>';
    s += '<path d="M14.7 15.3H17.3L16 16.7z" fill="#ff8fa3"/><path d="M16 16.7V17.4M16 17.4Q14.6 18.8 13.2 17.6M16 17.4Q17.4 18.8 18.8 17.6" stroke="#333" stroke-width=".8" fill="none" stroke-linecap="round"/>';
    s += '<path d="M2.2 13.6L9.6 15M2.2 17.4L9.6 16.8M29.8 13.6L22.4 15M29.8 17.4L22.4 16.8" stroke="' + wh + '" stroke-width=".9" stroke-linecap="round"/>';
    if (o.collar) s += '<rect x="9" y="20.6" width="14" height="2.4" rx="1.2" fill="' + o.collar + '"/><circle cx="16" cy="24" r="1.6" fill="#ffd23f"/>';
    return s;
  }
  var HELMET = '<circle cx="16" cy="11.5" r="14.5" fill="#cfe8ff" fill-opacity=".28" stroke="#eef4fb" stroke-width="1.6"/><path d="M6 7Q8.6 2.4 13.4 1.6" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".9"/><rect x="7" y="20.4" width="18" height="3.2" rx="1.6" fill="#e8edf5" stroke="#b9c3d4" stroke-width=".7"/><circle cx="11" cy="22" r="1" fill="#e8402a"/><circle cx="21" cy="22" r="1" fill="#3a8fe8"/>';
  function pet(svg, scale) { var k = scale || 1; return '<g transform="translate(3 ' + (88 + 30 * (1 - k)).toFixed(1) + ') scale(' + k + ')">' + svg + '</g>'; }
  var BROWN = { fur: '#b9773f', ear: '#7a4a22', muz: '#f1d4a8' };
  var GREYCAT = { fur: '#9aa3b2', stripe: '#6c7686', eyec: '#8fe08a' };
  var PET = {
    'pet-dog': pet(dogSvg(BROWN)),
    'pet-spot': pet(dogSvg({ fur: '#f6f2ea', ear: '#3a2a22', muz: '#ffffff', spots: true, patch: true })),
    'pet-puppy': pet(dogSvg({ fur: '#e9b866', ear: '#c98a3c', muz: '#fbe6bf', eye: 1.9, collar: '#e8402a' }), 0.86),
    'pet-husky': pet(dogSvg({ fur: '#8b96a6', ear: '#8b96a6', muz: '#f4f6fa', upright: true, mask: '#f4f6fa', curl: true, tip: '#f4f6fa', eyec: '#3a9bf0', eye: 1.6 })),
    'pet-cat': pet(catSvg({ fur: '#f29a3c', stripe: '#cf6f14', eyec: '#8fe08a' })),
    'pet-blackcat': pet(catSvg({ fur: '#2c2c38', inner: '#6a4a72', eyec: '#ffd23f', whisk: '#e8e8f4' })),
    'pet-kitten': pet(catSvg({ fur: '#f6dcb4', stripe: '#e0a868', eyec: '#5ab4ff', eye: 2.3, collar: '#ff5fa2' }), 0.86),
    'pet-siamese': pet(catSvg({ fur: '#f3e4cc', points: '#5b4032', paw: '#5b4032', mask: '#5b4032', inner: '#a07c68', eyec: '#5ab4ff', whisk: '#e8e8f4' })),
    'pet-astrodog': pet(dogSvg(BROWN) + HELMET),
    'pet-astrocat': pet(catSvg(GREYCAT) + HELMET)
  };

  function faceSvg(id, robotish) {
    var ink = '#241a14', eyeL = '<circle cx="41" cy="50" r="2.8" fill="' + ink + '"/>', eyeR = '<circle cx="59" cy="50" r="2.8" fill="' + ink + '"/>';
    if (robotish) { eyeL = '<rect x="37" y="47" width="8" height="6" rx="2" fill="#18242e"/><circle cx="41" cy="50" r="1.6" fill="#7be0ff"/>'; eyeR = '<rect x="55" y="47" width="8" height="6" rx="2" fill="#18242e"/><circle cx="59" cy="50" r="1.6" fill="#7be0ff"/>'; }
    var mouth = '<path d="M42 62Q50 69 58 62" stroke="' + ink + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    if (id === 'face-grin') mouth = '<path d="M40 60Q50 76 60 60z" fill="#7a1d2a"/><path d="M42 61H58Q56 65 50 66Q44 65 42 61z" fill="#fff"/>';
    else if (id === 'face-wink') { eyeL = '<path d="M37 51Q41 46 45 51" stroke="' + ink + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>'; mouth = '<path d="M41 61Q50 70 59 61" stroke="' + ink + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>'; }
    else if (id === 'face-surprised') { eyeL = '<circle cx="41" cy="50" r="3.8" fill="' + ink + '"/><circle cx="42" cy="49" r="1.2" fill="#fff"/>'; eyeR = '<circle cx="59" cy="50" r="3.8" fill="' + ink + '"/><circle cx="60" cy="49" r="1.2" fill="#fff"/>'; mouth = '<ellipse cx="50" cy="64" rx="3.6" ry="4.6" fill="#7a1d2a"/>'; }
    else if (id === 'face-starry') { eyeL = star(41, 50, 5.4, '#ffcf2e'); eyeR = star(59, 50, 5.4, '#ffcf2e'); }
    return eyeL + eyeR + mouth;
  }

  function bodySvg(skin, hairId, hat) {
    var fill = SKIN_COL[skin] || SKIN_COL['skin-peach'], hp = hairParts(hairId || DEFAULTS.hair, skin, hat);
    var shirt = '<path d="M20 120Q20 84 50 82Q80 84 80 120z" fill="#2f7fd1"/><path d="M40 84Q50 94 60 84" stroke="#1f5fa6" stroke-width="3" fill="none"/><rect x="30" y="100" width="14" height="6" rx="2" fill="#fff" opacity=".35"/>';
    var s = '<defs><linearGradient id="gold@" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a0"/><stop offset=".5" stop-color="#f2c230"/><stop offset="1" stop-color="#b88a10"/></linearGradient></defs>';
    s += shirt + hp.back + '<rect x="43" y="72" width="14" height="14" rx="4" fill="' + fill + '"/>';
    if (skin === 'skin-robot' || skin === 'skin-gold') {
      s += '<rect x="25" y="25" width="50" height="52" rx="14" fill="' + fill + '" stroke="#7d8a9a" stroke-width="1.5"/><rect x="19" y="44" width="7" height="14" rx="3" fill="#8794a4"/><rect x="74" y="44" width="7" height="14" rx="3" fill="#8794a4"/><circle cx="50" cy="29" r="1.8" fill="#7d8a9a"/>';
      if (skin === 'skin-gold') s += star(31, 33, 2.4, '#fff') + star(70, 70, 2, '#fff');
    } else if (skin === 'skin-alien') {
      s += '<path d="M26 56Q18 52 14 42Q22 46 27 50z" fill="' + fill + '"/><path d="M74 56Q82 52 86 42Q78 46 73 50z" fill="' + fill + '"/><ellipse cx="50" cy="50" rx="24" ry="28" fill="' + fill + '"/><ellipse cx="42" cy="40" rx="6" ry="3" fill="#fff" opacity=".25"/>';
    } else {
      s += '<circle cx="26" cy="52" r="4.5" fill="' + fill + '"/><circle cx="74" cy="52" r="4.5" fill="' + fill + '"/><ellipse cx="50" cy="50" rx="24" ry="26" fill="' + fill + '"/>';
    }
    return s + hp.front;
  }

  var uidCounter = 0;
  var NS = 'http://www.w3.org/2000/svg';
  function build(equipped) {
    var n = normalize(equipped), robotish = n.skin === 'skin-robot' || n.skin === 'skin-gold';
    var s = BG[n.bg] || BG['bg-sky'];
    if (n.back && BACK[n.back]) s += BACK[n.back];
    s += bodySvg(n.skin, n.hair, n.hat) + faceSvg(n.face, robotish);
    if (n.hat && HAT[n.hat]) s += HAT[n.hat];
    if (n.gear && GEAR[n.gear]) s += GEAR[n.gear];
    if (n.pet && PET[n.pet]) s += PET[n.pet];
    return s.replace(/@/g, String(++uidCounter));
  }
  // The text above is fixed (from the catalog tables), never from the database. It is turned into
  // SVG nodes with the XML parser, not with innerHTML.
  function nodesFor(markup) {
    var doc = new DOMParser().parseFromString('<svg xmlns="' + NS + '">' + markup + '</svg>', 'image/svg+xml');
    return doc.documentElement;
  }
  function render(el, equipped, size, label) {
    if (!el) return;
    var w = Math.max(16, Number(size) || 96);
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 120');
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(Math.round(w * 1.2)));
    svg.setAttribute('focusable', 'false');
    svg.style.display = 'block';
    svg.style.maxWidth = '100%';
    svg.style.height = 'auto';
    if (label === false) svg.setAttribute('aria-hidden', 'true');
    else { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', typeof label === 'string' ? label : describe(equipped)); }
    var clip = document.createElementNS(NS, 'clipPath');
    clip.setAttribute('id', 'avclip' + (++uidCounter));
    var cr = document.createElementNS(NS, 'rect'); cr.setAttribute('width', '100'); cr.setAttribute('height', '120'); cr.setAttribute('rx', '10');
    clip.appendChild(cr); svg.appendChild(clip);
    var g = document.createElementNS(NS, 'g');
    g.setAttribute('clip-path', 'url(#' + clip.getAttribute('id') + ')');
    var src = nodesFor(build(equipped));
    Array.prototype.slice.call(src.childNodes).forEach(function (n) { g.appendChild(document.importNode(n, true)); });
    svg.appendChild(g);
    el.textContent = '';
    el.appendChild(svg);
  }

  // ── reading other students' avatars (small, batched, cached) ──
  var cache = {}, waiting = {}, queue = [], timer = null, MAXAGE = 120000;
  function dbOk() { return typeof firebase !== 'undefined' && firebase.firestore && firebase.auth && firebase.auth().currentUser; }
  function flush() {
    timer = null;
    var uids = queue.slice(); queue = [];
    if (!uids.length) return;
    function done(map) {
      uids.forEach(function (u) {
        cache[u] = { at: Date.now(), eq: has(map, u) ? map[u] : null };
        (waiting[u] || []).forEach(function (f) { try { f(cache[u].eq); } catch (e) { /* a page callback failed: ignore */ } });
        delete waiting[u];
      });
    }
    if (!dbOk()) { done({}); return; }
    var db = firebase.firestore(), out = {}, jobs = [], i;
    for (i = 0; i < uids.length; i += 10) {
      (function (part) {
        jobs.push(db.collection('avatars').where(firebase.firestore.FieldPath.documentId(), 'in', part).get().then(function (snap) {
          snap.forEach(function (d) { var x = d.data() || {}; out[d.id] = normalize(x.equipped, true); });
        }, function () { /* not readable (rules not published yet): everyone shows the default */ }));
      })(uids.slice(i, i + 10));
    }
    Promise.all(jobs).then(function () { done(out); }, function () { done(out); });
  }
  function request(uid, cb) {
    var c = cache[uid];
    if (c && Date.now() - c.at < MAXAGE) { cb(c.eq); return; }
    (waiting[uid] = waiting[uid] || []).push(cb);
    if (queue.indexOf(uid) < 0 && waiting[uid].length === 1) queue.push(uid);
    if (!timer) timer = setTimeout(flush, 40);
  }
  function validUid(u) { return typeof u === 'string' && /^[A-Za-z0-9]{1,128}$/.test(u); }
  function load(uids) {
    return new Promise(function (resolve) {
      var list = (uids || []).filter(validUid), res = {}, left = list.length;
      if (!left) { resolve(res); return; }
      list.forEach(function (u) { request(u, function (eq) { res[u] = eq; if (--left === 0) resolve(res); }); });
      setTimeout(function () { resolve(res); }, 8000);
    });
  }
  function attach(el, uid, size) {
    try {
      render(el, null, size, false);
      if (!validUid(uid)) return;
      request(uid, function (eq) { if (eq) { try { render(el, eq, size, false); } catch (e) { /* keep the default */ } } });
    } catch (e) { /* the page goes on without a picture */ }
  }
  function remember(uid, equipped) { if (validUid(uid)) cache[uid] = { at: Date.now(), eq: equipped ? normalize(equipped, true) : null }; }

  window.Avatar = {
    SLOTS: SLOTS, SLOT_LABEL: SLOT_LABEL, SLOT_ICON: SLOT_ICON, NONE_LABEL: NONE_LABEL,
    ITEMS: ITEMS, PRICES: PRICES, DEFAULTS: DEFAULTS, itemOf: itemOf, priceOf: priceOf,
    normalize: normalize, forSave: forSave, describe: describe, render: render, attach: attach, load: load, remember: remember
  };
})();
