// Avatars for Tech Class Hub: the item catalog, the one price list, and a drawing function.
//
// Load after the Firebase scripts (the Firebase parts are optional: drawing works without them):
//   <script src="avatar.js"></script>
//
// window.Avatar:
//   SLOTS         the six places an item can go: skin, face, hat, gear, back, bg
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

  var SLOTS = ['skin', 'face', 'hat', 'gear', 'back', 'bg'];
  var SLOT_LABEL = { skin: 'Body', face: 'Face', hat: 'Hats', gear: 'Gear', back: 'Back', bg: 'Scene' };
  var SLOT_ICON = { skin: '🧑‍🚀', face: '😀', hat: '🎩', gear: '🥽', back: '🚀', bg: '🌌' };
  var NONE_LABEL = { skin: '', face: '', hat: 'No hat', gear: 'No gear', back: 'No back item', bg: '' };

  // id, name, price, rare?  (the price list copied into firestore.rules; keep them the same)
  var LIST = [
    ['skin-peach', 'Peach', 0], ['skin-tan', 'Tan', 0], ['skin-brown', 'Brown', 0], ['skin-deep', 'Deep brown', 0],
    ['skin-alien', 'Alien green', 0], ['skin-robot', 'Robot silver', 0], ['skin-gold', 'Golden robot', 60, true],
    ['face-smile', 'Smile', 0], ['face-grin', 'Big grin', 5], ['face-wink', 'Wink', 5], ['face-surprised', 'Surprised', 8], ['face-starry', 'Star eyes', 15],
    ['hat-beanie', 'Beanie', 8], ['hat-propeller', 'Propeller cap', 12], ['hat-hardhat', 'Hard hat', 15], ['hat-wizard', 'Wizard hat', 25],
    ['hat-rocket', 'Rocket helmet', 30], ['hat-astronaut', 'Space helmet', 40], ['hat-crown', 'Gold crown', 60, true],
    ['gear-glasses', 'Round glasses', 10], ['gear-sunglasses', 'Cool shades', 12], ['gear-goggles', 'Lab goggles', 15], ['gear-antenna', 'Antennas', 18], ['gear-headphones', 'Headphones', 20],
    ['back-backpack', 'Backpack', 15], ['back-cape', 'Hero cape', 25], ['back-jetpack', 'Jetpack', 45], ['back-wings', 'Star wings', 55, true],
    ['bg-sky', 'Blue sky', 0], ['bg-stars', 'Starry night', 15], ['bg-hallway', 'School hallway', 15], ['bg-lab', 'Science lab', 20],
    ['bg-launchpad', 'Launch pad', 30], ['bg-moon', 'The Moon', 40], ['bg-blackhole', 'Black hole', 55, true]
  ];
  var ITEMS = [], PRICES = {}, BY_ID = {};
  LIST.forEach(function (r) {
    var it = { id: r[0], slot: r[0].split('-')[0], name: r[1], price: r[2], rare: !!r[3] };
    ITEMS.push(it); PRICES[it.id] = it.price; BY_ID[it.id] = it;
  });
  var DEFAULTS = { skin: 'skin-peach', face: 'face-smile', bg: 'bg-sky' };

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function itemOf(id) { return typeof id === 'string' && has(BY_ID, id) ? BY_ID[id] : null; }
  function priceOf(id) { return typeof id === 'string' && has(PRICES, id) ? PRICES[id] : -1; }
  // keep only what exists; skin, face and bg always have a value
  function normalize(e, noDefaults) {
    var out = {};
    SLOTS.forEach(function (s) {
      var v = e && typeof e === 'object' && has(e, s) ? e[s] : null, it = itemOf(v);
      if (it && it.slot === s) out[s] = it.id;
      else if (!noDefaults && has(DEFAULTS, s)) out[s] = DEFAULTS[s];
    });
    return out;
  }
  function describe(e) {
    var n = normalize(e), parts = [];
    ['skin', 'face', 'hat', 'gear', 'back', 'bg'].forEach(function (s) {
      if (!n[s]) return;
      var it = BY_ID[n[s]];
      if (s === 'skin') parts.unshift('Avatar: ' + it.name.toLowerCase());
      else if (s === 'bg') parts.push('in front of ' + it.name.toLowerCase());
      else if (s !== 'face' || n[s] !== DEFAULTS.face) parts.push(it.name.toLowerCase());
    });
    return parts.join(', ').replace(', in front', ' in front');
  }

  // ── the parts (fixed SVG text; "@" is replaced by a number so ids never clash on a page) ──
  var SKIN_COL = { 'skin-peach': '#f5c9a0', 'skin-tan': '#d9a066', 'skin-brown': '#a8693e', 'skin-deep': '#6b4226', 'skin-alien': '#93e58f', 'skin-robot': '#b9c5d3', 'skin-gold': 'url(#gold@)' };
  var HAIR_COL = { 'skin-peach': '#7a4a22', 'skin-tan': '#3a2412', 'skin-brown': '#241810', 'skin-deep': '#150e0a' };
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

  var HAT = {
    'hat-beanie': '<path d="M26 40Q26 12 50 12Q74 12 74 40z" fill="#e8503a"/><rect x="25" y="35" width="50" height="9" rx="4" fill="#c43d2a"/><circle cx="50" cy="10" r="5" fill="#fff"/><path d="M36 20Q38 16 42 14M58 14Q62 16 64 20" stroke="#ff9a88" stroke-width="2" fill="none"/>',
    'hat-propeller': '<path d="M28 38Q30 18 50 18Q70 18 72 38z" fill="#3a8fe8"/><path d="M50 18V34" stroke="#2a6bb8" stroke-width="2"/><rect x="26" y="35" width="48" height="6" rx="3" fill="#2a6bb8"/><rect x="49" y="8" width="2" height="10" fill="#555"/><ellipse cx="40" cy="8" rx="10" ry="2.2" fill="#ffd23f"/><ellipse cx="60" cy="8" rx="10" ry="2.2" fill="#ff6f6f"/><circle cx="50" cy="8" r="2" fill="#333"/>',
    'hat-hardhat': '<path d="M26 40Q28 12 50 12Q72 12 74 40z" fill="#ffd23f"/><rect x="46" y="12" width="8" height="28" fill="#e8b50f"/><rect x="21" y="37" width="58" height="6" rx="3" fill="#f0b800"/><rect x="42" y="22" width="16" height="6" rx="2" fill="#fff" opacity=".5"/>',
    'hat-wizard': '<path d="M50 2L78 40Q50 47 22 40z" fill="#6a3fd0"/><ellipse cx="50" cy="40" rx="33" ry="6" fill="#4f2aa8"/><path d="M26 38Q50 44 74 38" stroke="#ffd23f" stroke-width="3" fill="none"/>' + star(46, 22, 3.6, '#ffe58a') + star(56, 31, 2.6, '#ffe58a') + star(41, 32, 2, '#fff'),
    'hat-rocket': '<path d="M27 44Q27 14 50 14Q73 14 73 44z" fill="#f4f4f8"/><path d="M44 16Q50 0 56 16z" fill="#e8402a"/><path d="M27 44Q27 30 36 24L36 44z" fill="#e8402a"/><path d="M73 44Q73 30 64 24L64 44z" fill="#e8402a"/><rect x="38" y="30" width="24" height="5" rx="2" fill="#3a8fe8"/><path d="M27 38L15 52L27 52zM73 38L85 52L73 52z" fill="#c4301c"/>',
    'hat-astronaut': '<circle cx="50" cy="50" r="33" fill="#cfe8ff" opacity=".22" stroke="#e8f0fa" stroke-width="3.5"/><path d="M30 28Q36 20 46 18" stroke="#fff" stroke-width="3" fill="none" opacity=".8" stroke-linecap="round"/><path d="M26 82Q50 92 74 82L72 90Q50 98 28 90z" fill="#e8edf5" stroke="#b9c3d4"/><circle cx="34" cy="88" r="2.4" fill="#e8402a"/><circle cx="66" cy="88" r="2.4" fill="#3a8fe8"/>',
    'hat-crown': '<path d="M29 36L32 12L41 25L50 8L59 25L68 12L71 36z" fill="#f2c230" stroke="#b88a10" stroke-width="1.2"/><rect x="29" y="33" width="42" height="6" rx="2" fill="#e0a916"/><circle cx="50" cy="19" r="2.6" fill="#e8402a"/><circle cx="36" cy="30" r="2" fill="#3a8fe8"/><circle cx="64" cy="30" r="2" fill="#3fb86a"/>'
  };

  var GEAR = {
    'gear-glasses': '<circle cx="41" cy="50" r="7.5" fill="#fff" fill-opacity=".25" stroke="#2c2c34" stroke-width="2"/><circle cx="59" cy="50" r="7.5" fill="#fff" fill-opacity=".25" stroke="#2c2c34" stroke-width="2"/><path d="M48.5 50H51.5M33.5 49L27 47M66.5 49L73 47" stroke="#2c2c34" stroke-width="2"/>',
    'gear-sunglasses': '<rect x="32" y="44" width="16" height="11" rx="4" fill="#15151c"/><rect x="52" y="44" width="16" height="11" rx="4" fill="#15151c"/><path d="M48 47H52M32 46L27 45M68 46L73 45" stroke="#15151c" stroke-width="2.4"/><path d="M35 47L40 47M55 47L60 47" stroke="#5a5a7a" stroke-width="1.6"/>',
    'gear-goggles': '<path d="M25 44H75V56H25z" fill="#4a3f36" opacity=".9"/><circle cx="41" cy="50" r="8.5" fill="#9ff0b8" fill-opacity=".55" stroke="#f08a2a" stroke-width="3"/><circle cx="59" cy="50" r="8.5" fill="#9ff0b8" fill-opacity=".55" stroke="#f08a2a" stroke-width="3"/><path d="M36 46Q39 43 43 44" stroke="#fff" stroke-width="1.6" fill="none"/>',
    'gear-antenna': '<path d="M38 28L30 8M62 28L70 8" stroke="#6b7488" stroke-width="2.2" stroke-linecap="round"/><circle cx="30" cy="7" r="3.6" fill="#ff4f7b"/><circle cx="70" cy="7" r="3.6" fill="#37d6a0"/>',
    'gear-headphones': '<path d="M26 54Q24 18 50 18Q76 18 74 54" stroke="#2c2c34" stroke-width="4.5" fill="none" stroke-linecap="round"/><rect x="19" y="45" width="11" height="19" rx="5" fill="#e8402a"/><rect x="70" y="45" width="11" height="19" rx="5" fill="#e8402a"/><rect x="21" y="49" width="4" height="11" rx="2" fill="#ff8a78"/><rect x="75" y="49" width="4" height="11" rx="2" fill="#ff8a78"/>'
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

  function bodySvg(skin) {
    var fill = SKIN_COL[skin] || SKIN_COL['skin-peach'], hair = HAIR_COL[skin];
    var shirt = '<path d="M20 120Q20 84 50 82Q80 84 80 120z" fill="#2f7fd1"/><path d="M40 84Q50 94 60 84" stroke="#1f5fa6" stroke-width="3" fill="none"/><rect x="30" y="100" width="14" height="6" rx="2" fill="#fff" opacity=".35"/>';
    var s = '<defs><linearGradient id="gold@" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a0"/><stop offset=".5" stop-color="#f2c230"/><stop offset="1" stop-color="#b88a10"/></linearGradient></defs>';
    s += shirt + '<rect x="43" y="72" width="14" height="14" rx="4" fill="' + fill + '"/>';
    if (skin === 'skin-robot' || skin === 'skin-gold') {
      s += '<rect x="25" y="25" width="50" height="52" rx="14" fill="' + fill + '" stroke="#7d8a9a" stroke-width="1.5"/><rect x="19" y="44" width="7" height="14" rx="3" fill="#8794a4"/><rect x="74" y="44" width="7" height="14" rx="3" fill="#8794a4"/><circle cx="50" cy="29" r="1.8" fill="#7d8a9a"/>';
      if (skin === 'skin-gold') s += star(31, 33, 2.4, '#fff') + star(70, 70, 2, '#fff');
    } else if (skin === 'skin-alien') {
      s += '<path d="M26 56Q18 52 14 42Q22 46 27 50z" fill="' + fill + '"/><path d="M74 56Q82 52 86 42Q78 46 73 50z" fill="' + fill + '"/><ellipse cx="50" cy="50" rx="24" ry="28" fill="' + fill + '"/><ellipse cx="42" cy="40" rx="6" ry="3" fill="#fff" opacity=".25"/>';
    } else {
      s += '<circle cx="26" cy="52" r="4.5" fill="' + fill + '"/><circle cx="74" cy="52" r="4.5" fill="' + fill + '"/><ellipse cx="50" cy="50" rx="24" ry="26" fill="' + fill + '"/>' +
        '<path d="M26 44Q24 24 50 22Q76 24 74 44Q66 34 50 34Q34 34 26 44z" fill="' + hair + '"/>';
    }
    return s;
  }

  var uidCounter = 0;
  var NS = 'http://www.w3.org/2000/svg';
  function build(equipped) {
    var n = normalize(equipped), robotish = n.skin === 'skin-robot' || n.skin === 'skin-gold';
    var s = BG[n.bg] || BG['bg-sky'];
    if (n.back && BACK[n.back]) s += BACK[n.back];
    s += bodySvg(n.skin) + faceSvg(n.face, robotish);
    if (n.hat && HAT[n.hat]) s += HAT[n.hat];
    if (n.gear && GEAR[n.gear]) s += GEAR[n.gear];
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
    normalize: normalize, describe: describe, render: render, attach: attach, load: load, remember: remember
  };
})();
