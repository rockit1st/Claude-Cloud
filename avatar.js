// Avatars for Tech Class Hub: the item catalog, the one price list, and a drawing function.
//
// Load after the Firebase scripts (the Firebase parts are optional: drawing works without them):
//   <script src="avatar.js"></script>
//
// window.Avatar:
//   SLOTS         the eleven places an item can go: skin, hair, haircolor, face, outfit, hat, gear, pet, back, fx, bg
//   ITEMS         every item: { id, slot, name, price, rare }   (id is "<slot>-<word>")
//   PRICES        { id: price }  -> THE price list. The same list is copied into firestore.rules (priceFor);
//                 test-rules.mjs reads both files and fails if they ever differ. Price 0 = free for everyone.
//   DEFAULTS      what a student wears before they pick anything (all free): skin, hair, haircolor, face, outfit, bg
//                 (no hat, gear, pet, back item or effect). forSave() leaves out hair, haircolor and outfit when they are the default.
//   normalize(e)  keep only slots and items that exist (anything else becomes the default or nothing)
//   render(el, equipped, size, label, animate)  draw the avatar into el (it replaces what is inside). size is the width in px.
//                 label: omitted = spoken description, a string = that text, false = decorative (hidden from screen readers).
//                 animate: true = gentle idle motion (bob, blink, wagging tails, shimmer on rare items). Default false so
//                 lists and boards stay still and cheap; use it for the one big avatar only. Never moves when the
//                 student asks their device for reduced motion.
//   describe(e)   a short plain sentence for screen readers
//   attach(el, uid, size, animate)  put a small avatar in el now (the default one) and swap in the student's real
//                 one once it has been read. Reads are batched and cached; it never blocks and never throws.
//   load(uids)    Promise -> { uid: equipped | null } (null = no avatar saved). Never rejects.
//
// Everything is drawn from the fixed parts below as inline SVG. There is no free text and no outside
// picture or font. The only things read from the database are item ids, and each one is checked against
// the catalog before it is used, so nothing the database holds can reach the page as markup.
(function () {
  'use strict';
  if (window.Avatar) return;

  var SLOTS = ['skin', 'hair', 'haircolor', 'face', 'outfit', 'hat', 'gear', 'pet', 'back', 'fx', 'bg'];
  var SLOT_LABEL = { skin: 'Body', hair: 'Hair', haircolor: 'Hair color', face: 'Face', outfit: 'Outfits', hat: 'Hats', gear: 'Gear', pet: 'Pets', back: 'Back', fx: 'Effects', bg: 'Scene' };
  var SLOT_ICON = { skin: '🧑‍🚀', hair: '💇', haircolor: '🎨', face: '😀', outfit: '👕', hat: '🎩', gear: '🥽', pet: '🐾', back: '🚀', fx: '✨', bg: '🌌' };
  var NONE_LABEL = { skin: '', hair: '', haircolor: '', face: '', outfit: '', hat: 'No hat', gear: 'No gear', pet: 'No pet', back: 'No back item', fx: 'No effect', bg: '' };

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
    ['bg-launchpad', 'Launch pad', 30], ['bg-moon', 'The Moon', 40], ['bg-blackhole', 'Black hole', 55, true],
    ['outfit-shirt', 'Blue shirt', 0], ['outfit-hoodie', 'Red hoodie', 0], ['outfit-labcoat', 'Lab coat', 10], ['outfit-overalls', 'Overalls', 12], ['outfit-jersey', 'Team jersey', 15],
    ['outfit-party', 'Party outfit', 15], ['outfit-spacesuit', 'Space suit', 25], ['outfit-hero', 'Hero suit', 30], ['outfit-armor', 'Golden armor', 45, true],
    ['haircolor-auto', 'Normal hair', 0], ['haircolor-black', 'Black hair', 0], ['haircolor-brown', 'Brown hair', 0], ['haircolor-blond', 'Blond hair', 0], ['haircolor-red', 'Red hair', 0], ['haircolor-grey', 'Grey hair', 0],
    ['haircolor-blue', 'Blue hair', 5], ['haircolor-pink', 'Pink hair', 5], ['haircolor-green', 'Green hair', 5], ['haircolor-purple', 'Purple hair', 5], ['haircolor-silver', 'Silver hair', 10], ['haircolor-rainbow', 'Rainbow hair', 20, true],
    ['fx-sparkles', 'Sparkles', 30], ['fx-glow', 'Glow aura', 40], ['fx-trail', 'Rocket trail', 45], ['fx-lightning', 'Lightning', 55, true], ['fx-fire', 'Fire aura', 60, true], ['fx-rainbow', 'Rainbow', 60, true], ['fx-orbit', 'Stars orbit', 70, true]
  ];
  var ITEMS = [], PRICES = {}, BY_ID = {};
  LIST.forEach(function (r) {
    var it = { id: r[0], slot: r[0].split('-')[0], name: r[1], price: r[2], rare: !!r[3] };
    ITEMS.push(it); PRICES[it.id] = it.price; BY_ID[it.id] = it;
  });
  var DEFAULTS = { skin: 'skin-peach', hair: 'hair-short', haircolor: 'haircolor-auto', face: 'face-smile', outfit: 'outfit-shirt', bg: 'bg-sky' };

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
  // what to write to the database: every default that the older rules do not know is left out (the short
  // hair, the normal hair colour, the blue shirt; no pet / no effect is simply absent), so a student who uses
  // none of the newer things saves exactly what the older rules accept
  var LEAVE_OUT = ['hair', 'haircolor', 'outfit'];
  function forSave(e) {
    var out = normalize(e);
    LEAVE_OUT.forEach(function (s) { if (out[s] === DEFAULTS[s]) delete out[s]; });
    return out;
  }
  // how the newer slots are said out loud ("wearing a lab coat, blue hair, a sparkle effect")
  var SAY = {
    'outfit-shirt': 'a blue shirt', 'outfit-hoodie': 'a red hoodie', 'outfit-labcoat': 'a lab coat', 'outfit-overalls': 'overalls', 'outfit-jersey': 'a team jersey',
    'outfit-party': 'a party outfit', 'outfit-spacesuit': 'a space suit', 'outfit-hero': 'a hero suit', 'outfit-armor': 'golden armor',
    'fx-sparkles': 'a sparkle effect', 'fx-glow': 'a glow aura', 'fx-trail': 'a rocket trail', 'fx-lightning': 'a lightning effect', 'fx-fire': 'a fire aura', 'fx-rainbow': 'a rainbow effect', 'fx-orbit': 'stars orbiting'
  };
  function describe(e) {
    var n = normalize(e), parts = [];
    SLOTS.forEach(function (s) {
      if (!n[s]) return;
      var it = BY_ID[n[s]];
      if (s === 'skin') parts.unshift('Avatar: ' + it.name.toLowerCase());
      else if (s === 'bg') parts.push('in front of ' + it.name.toLowerCase());
      else if (s === 'outfit') { if (n[s] !== DEFAULTS[s]) parts.push('wearing ' + SAY[it.id]); }
      else if (s === 'fx') parts.push(SAY[it.id]);
      else if ((s !== 'face' && s !== 'hair' && s !== 'haircolor') || n[s] !== DEFAULTS[s]) parts.push(it.name.toLowerCase());
    });
    return parts.join(', ').replace(', in front', ' in front');
  }

  // ── colour helpers: every shape gets a soft gradient and a thin darker outline of its own colour ──
  // A part writes fill="url(#g-RRGGBB@)" (or #r- for a round highlight) and build() adds the matching <defs> once
  // per drawing, so thirty avatars on one page never share (or clash on) an id.
  function n6(c) { c = String(c).toLowerCase(); return c.length === 4 ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c; }
  function mix(c, t, f) {
    c = n6(c); t = n6(t);
    var o = '#', i, a, b;
    for (i = 1; i < 7; i += 2) { a = parseInt(c.substr(i, 2), 16); b = parseInt(t.substr(i, 2), 16); o += ('0' + Math.round(a + (b - a) * f).toString(16)).slice(-2); }
    return o;
  }
  function lt(c, f) { return mix(c, '#ffffff', f); }
  function dk(c, f) { return mix(c, '#000000', f); }
  function G(c) { return 'url(#g-' + n6(c).slice(1) + '@)'; }
  var G0 = G;
  function R(c) { return 'url(#r-' + n6(c).slice(1) + '@)'; }
  function ln(c, w, f) { return 'stroke="' + dk(c, f || 0.45) + '" stroke-width="' + (w || 0.9) + '"'; }
  function fg(c, w) { return 'fill="' + G(c) + '" ' + ln(c, w); }
  function fr(c, w) { return 'fill="' + R(c) + '" ' + ln(c, w); }
  function shine(d, w, o) { return '<path d="' + d + '" stroke="#fff" stroke-opacity="' + (o || 0.45) + '" stroke-width="' + (w || 2) + '" fill="none"/>'; }
  function spark(x, y, r, d, col, sc) {
    var k = r * 0.22;
    return '<path class="av-tw" style="animation-delay:' + d + 's" d="M' + x + ' ' + (y - r) + 'Q' + (x + k) + ' ' + (y - k) + ' ' + (x + r) + ' ' + y + 'Q' + (x + k) + ' ' + (y + k) + ' ' + x + ' ' + (y + r) + 'Q' + (x - k) + ' ' + (y + k) + ' ' + (x - r) + ' ' + y + 'Q' + (x - k) + ' ' + (y - k) + ' ' + x + ' ' + (y - r) + 'z" fill="' + (col || '#fff') + '"' + (sc ? ' stroke="' + sc + '" stroke-width=".7"' : '') + '/>';
  }
  // a pale band that glides across a shape now and then (still, it is a fixed gloss); shape = the outline to stay inside
  function sweep(id, shape, d) {
    return '<clipPath id="sw' + id + '@">' + shape + '</clipPath><g clip-path="url(#sw' + id + '@)"><g class="av-sweep"><path d="' + d + '" fill="#fff" fill-opacity=".42"/></g></g>';
  }
  function lin(c) {
    return '<linearGradient id="g-' + c.slice(1) + '@" x1="0" y1="0" x2=".45" y2="1"><stop offset="0" stop-color="' + lt(c, 0.26) + '"/><stop offset=".5" stop-color="' + c + '"/><stop offset="1" stop-color="' + dk(c, 0.22) + '"/></linearGradient>';
  }
  function rad(c) {
    return '<radialGradient id="r-' + c.slice(1) + '@" cx=".36" cy=".28" r=".85"><stop offset="0" stop-color="' + lt(c, 0.38) + '"/><stop offset=".48" stop-color="' + c + '"/><stop offset="1" stop-color="' + dk(c, 0.26) + '"/></radialGradient>';
  }
  var DEFS = {
    gold: '<linearGradient id="gold@" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6b8"/><stop offset=".35" stop-color="#f6d445"/><stop offset=".6" stop-color="#f2c230"/><stop offset="1" stop-color="#a87c0c"/></linearGradient>',
    vig: '<radialGradient id="vig@" cx=".5" cy=".42" r=".78"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient>',
    shd: '<radialGradient id="shd@"><stop offset="0" stop-color="#000" stop-opacity=".4"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>',
    blush: '<radialGradient id="blush@"><stop offset="0" stop-color="#ff4f78" stop-opacity=".62"/><stop offset="1" stop-color="#ff4f78" stop-opacity="0"/></radialGradient>',
    rainbow: '<linearGradient id="rainbow@" gradientUnits="userSpaceOnUse" x1="8" y1="0" x2="92" y2="0"><stop offset="0" stop-color="#ff4d4d"/><stop offset=".2" stop-color="#ff9f1c"/><stop offset=".4" stop-color="#ffe03a"/><stop offset=".6" stop-color="#3fd16b"/><stop offset=".8" stop-color="#2fa8ff"/><stop offset="1" stop-color="#b04fd8"/></linearGradient>',
    rainbowd: '<linearGradient id="rainbowd@" gradientUnits="userSpaceOnUse" x1="8" y1="0" x2="92" y2="0"><stop offset="0" stop-color="#cc3a3a"/><stop offset=".2" stop-color="#d17f14"/><stop offset=".4" stop-color="#d1b82e"/><stop offset=".6" stop-color="#32a956"/><stop offset=".8" stop-color="#2686cc"/><stop offset="1" stop-color="#8d3fad"/></linearGradient>',
    glass: '<linearGradient id="glass@" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".45" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#9fd4ff" stop-opacity=".25"/></linearGradient>'
  };

  // ── the parts (fixed SVG text; "@" is replaced by a number so ids never clash on a page) ──
  var SKIN_COL = { 'skin-peach': '#f5c9a0', 'skin-tan': '#d9a066', 'skin-brown': '#a8693e', 'skin-deep': '#6b4226', 'skin-alien': '#93e58f', 'skin-robot': '#b9c5d3', 'skin-gold': '#f2c230' };
  var HAIR_COL = { 'skin-peach': '#7a4a22', 'skin-tan': '#3a2412', 'skin-brown': '#241810', 'skin-deep': '#150e0a' };
  // the hair colour items (haircolor-auto = follow the skin tone, as before); rainbow uses a gradient, this is its outline colour
  var HAIRCOL = { 'haircolor-black': '#1c1a20', 'haircolor-brown': '#6b4226', 'haircolor-blond': '#e8c25a', 'haircolor-red': '#c1401f', 'haircolor-grey': '#8d929d',
    'haircolor-blue': '#2f7fe0', 'haircolor-pink': '#ff6fb5', 'haircolor-green': '#3fc060', 'haircolor-purple': '#8a4fe0', 'haircolor-silver': '#e2e8f4', 'haircolor-rainbow': '#b04fd8' };
  // robots, aliens and the golden robot get a bright wig colour so every style shows on them
  var WIG_COL = { 'skin-alien': '#ff6fb5', 'skin-robot': '#3fb8ff', 'skin-gold': '#ff6fb5' };
  function star(cx, cy, r, fill, stroke) {
    var pts = [], i, a, rr;
    for (i = 0; i < 10; i++) { a = -Math.PI / 2 + i * Math.PI / 5; rr = i % 2 ? r * 0.45 : r; pts.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1)); }
    return '<polygon points="' + pts.join(' ') + '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width=".6"' : '') + '/>';
  }
  function dots(list, fill, extra) {
    return list.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '" fill="' + fill + '"' + (extra ? ' ' + extra : '') + '/>'; }).join('');
  }
  var STARS = [[8, 10, 1], [22, 22, 0.8], [40, 8, 1.1], [60, 18, 0.8], [78, 9, 1.2], [92, 24, 0.9], [12, 44, 0.9], [90, 52, 1], [6, 70, 0.8], [94, 78, 1.1], [18, 96, 1], [84, 100, 0.9], [30, 60, 0.7], [70, 40, 0.7]];
  function cloud(x, y, s, o) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" opacity="' + (o || 1) + '"><ellipse cy="3.2" rx="15" ry="4.6" fill="#bcd9f2"/><ellipse cy="1.4" rx="14.5" ry="4.8" fill="#fff"/><ellipse cx="-4.5" cy="-2.6" rx="8" ry="5.6" fill="#fff"/><ellipse cx="5.5" cy="-1.6" rx="7" ry="4.6" fill="#fff"/></g>';
  }
  var VIG = '<rect width="100" height="120" fill="url(#vig@)"/>';

  var BG = {
    'bg-sky': '<defs><linearGradient id="sky@" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f9fee"/><stop offset=".6" stop-color="#9bd6ff"/><stop offset="1" stop-color="#e6f7ff"/></linearGradient><radialGradient id="sun@" cx=".84" cy=".12" r=".45"><stop offset="0" stop-color="#fff9cf"/><stop offset="1" stop-color="#fff9cf" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="100" height="120" fill="url(#sky@)"/><rect width="100" height="120" fill="url(#sun@)"/><circle cx="84" cy="14" r="5" fill="#fffbe0"/>' + cloud(22, 26, 1) + cloud(80, 44, 0.8, 0.9) + cloud(50, 70, 0.6, 0.7) + VIG,
    'bg-stars': '<defs><linearGradient id="ns@" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#090c2c"/><stop offset=".6" stop-color="#1a1650"/><stop offset="1" stop-color="#2d1a5e"/></linearGradient><radialGradient id="nb@"><stop offset="0" stop-color="#ff6fd0" stop-opacity=".45"/><stop offset="1" stop-color="#ff6fd0" stop-opacity="0"/></radialGradient><radialGradient id="nc@"><stop offset="0" stop-color="#4fa8ff" stop-opacity=".4"/><stop offset="1" stop-color="#4fa8ff" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="100" height="120" fill="url(#ns@)"/><ellipse cx="78" cy="34" rx="40" ry="30" fill="url(#nb@)"/><ellipse cx="18" cy="86" rx="40" ry="30" fill="url(#nc@)"/>' + dots(STARS, '#fff') +
      star(16, 30, 4, '#ffe58a') + star(84, 20, 3, '#ffe58a') + star(76, 66, 2.6, '#bfe0ff') + spark(16, 30, 4.6, 0) + spark(84, 20, 4, 1.1) + spark(52, 14, 3.4, 2.2, '#bfe0ff') + VIG,
    'bg-hallway': '<defs><linearGradient id="wl@" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef2fa"/><stop offset="1" stop-color="#c3cde2"/></linearGradient><linearGradient id="lk@" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a8fd6"/><stop offset="1" stop-color="#2f5ea6"/></linearGradient><linearGradient id="fl@" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a5b1c7"/><stop offset="1" stop-color="#6a7790"/></linearGradient><radialGradient id="lp@" cx=".5" cy="0" r=".8"><stop offset="0" stop-color="#fff6c9" stop-opacity=".9"/><stop offset="1" stop-color="#fff6c9" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="100" height="120" fill="url(#wl@)"/><ellipse cx="50" cy="4" rx="46" ry="30" fill="url(#lp@)"/><rect y="88" width="100" height="32" fill="url(#fl@)"/><rect y="86" width="100" height="3" fill="#6f7c94"/>' +
      '<path d="M0 100H100M0 112H100M38 89L26 120M62 89L74 120M50 89V120" stroke="#fff" stroke-opacity=".22" stroke-width="1"/>' +
      '<rect x="0" y="20" width="24" height="68" fill="url(#lk@)"/><rect x="76" y="20" width="24" height="68" fill="url(#lk@)"/><rect x="0" y="20" width="24" height="3" fill="#fff" fill-opacity=".25"/><rect x="76" y="20" width="24" height="3" fill="#fff" fill-opacity=".25"/>' +
      '<path d="M12 20V88M88 20V88M0 54H24M76 54H100" stroke="#24457a" stroke-width="1.5"/><path d="M4 30h6M4 38h6M90 30h6M90 38h6M4 64h6M4 72h6M90 64h6M90 72h6" stroke="#b5d0f4" stroke-width="1.5" stroke-linecap="round"/>' +
      '<rect x="19" y="46" width="2" height="5" rx="1" fill="#dfe6f2"/><rect x="79" y="46" width="2" height="5" rx="1" fill="#dfe6f2"/>' +
      '<rect x="34" y="4" width="32" height="5" rx="2.5" fill="#fffbe0" stroke="#e8dca0" stroke-width=".7"/>' + VIG,
    'bg-lab': '<defs><linearGradient id="lw@" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2faf7"/><stop offset="1" stop-color="#cfe6df"/></linearGradient><linearGradient id="lf@" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b78a5e"/><stop offset="1" stop-color="#8a6240"/></linearGradient></defs>' +
      '<rect width="100" height="120" fill="url(#lw@)"/><path d="M0 30H100M0 60H100M25 0V90M50 0V90M75 0V90" stroke="#b9d3ca" stroke-opacity=".55" stroke-width=".8"/><rect y="92" width="100" height="28" fill="url(#lf@)"/><rect y="90" width="100" height="4" fill="#7e5a38"/>' +
      '<rect x="0" y="40" width="100" height="4" fill="#c4d6d0"/><rect x="0" y="40" width="100" height="1.4" fill="#fff"/>' +
      '<path d="M10 40V28l-4-8h14l-4 8v12z" fill="#7be0a8" stroke="#3f8f68"/><path d="M26 40V30h10v10z" fill="#ff9aa8" stroke="#b25666"/><path d="M78 40V26h6v14z" fill="#ffd36e" stroke="#b58b2c"/><path d="M90 40V30l-3-6h8l-3 6v10z" fill="#9ad0ff" stroke="#4f86b8"/>' +
      '<path d="M9 22H18" stroke="#fff" stroke-opacity=".6" stroke-width="1.4" stroke-linecap="round"/><path d="M28 32V37" stroke="#fff" stroke-opacity=".5" stroke-width="1.4" stroke-linecap="round"/><path d="M91 32V37" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>' +
      '<circle cx="14" cy="76" r="5" fill="#fff" fill-opacity=".7" stroke="#8fa" /><circle cx="86" cy="72" r="6" fill="#ffe0f0" fill-opacity=".8" stroke="#c9a"/><circle cx="12.4" cy="74.4" r="1.4" fill="#fff"/><circle cx="84" cy="70" r="1.6" fill="#fff"/>' + VIG,
    'bg-launchpad': '<defs><linearGradient id="dusk@" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c2060"/><stop offset=".45" stop-color="#b0507e"/><stop offset=".75" stop-color="#ff9a5a"/><stop offset="1" stop-color="#ffd28a"/></linearGradient><linearGradient id="rk@" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#f0f0f6"/><stop offset="1" stop-color="#b9bfd0"/></linearGradient><radialGradient id="sn@" cx=".5" cy=".85" r=".6"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".85"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="100" height="120" fill="url(#dusk@)"/><rect width="100" height="120" fill="url(#sn@)"/>' + dots([[20, 20, .8], [50, 12, .8], [70, 24, .7], [36, 34, .6]], '#fff') +
      '<path d="M0 98Q20 86 40 96Q60 88 100 97V104H0z" fill="#3b2a55" fill-opacity=".8"/><rect y="100" width="100" height="20" fill="#59606e"/><rect x="0" y="98" width="100" height="3" fill="#8b93a3"/><path d="M0 108H100" stroke="#fff" stroke-opacity=".12"/>' +
      '<rect x="4" y="30" width="8" height="70" fill="#7b8396" stroke="#4d5568" stroke-width=".6"/><path d="M4 40L12 50M12 40L4 50M4 56L12 66M12 56L4 66M4 72L12 82M12 72L4 82" stroke="#4d5568" stroke-width="1.2"/><rect x="12" y="44" width="10" height="3" fill="#7b8396" stroke="#4d5568" stroke-width=".5"/><circle cx="8" cy="29" r="1.6" fill="#ff4f4f"/>' +
      '<path d="M88 40Q93 52 93 66V98H83V66Q83 52 88 40z" fill="url(#rk@)" stroke="#9aa0b4" stroke-width=".7"/><path d="M88 40Q91 46 92 52H84Q85 46 88 40z" fill="#e8402a"/><circle cx="88" cy="62" r="2.6" fill="#7fd0ff" stroke="#6a7288" stroke-width=".8"/><path d="M83 84L78 98H83zM93 84L98 98H93z" fill="#e8402a" stroke="#a82a18" stroke-width=".6"/>' + VIG,
    'bg-moon': '<defs><radialGradient id="mn@" cx=".4" cy=".1" r=".9"><stop offset="0" stop-color="#e2e4ee"/><stop offset=".6" stop-color="#a9acb8"/><stop offset="1" stop-color="#6e7184"/></radialGradient><radialGradient id="ea@" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#7fc0ff"/><stop offset=".6" stop-color="#3f8cf0"/><stop offset="1" stop-color="#1f4fa8"/></radialGradient></defs>' +
      '<rect width="100" height="120" fill="#05060f"/>' + dots(STARS.slice(0, 9), '#fff') +
      '<circle cx="50" cy="190" r="110" fill="url(#mn@)"/><circle cx="50" cy="190" r="110" fill="none" stroke="#e9ecf6" stroke-width="2" stroke-opacity=".8"/>' +
      '<ellipse cx="20" cy="98" rx="8" ry="2.6" fill="#7f8294"/><ellipse cx="20" cy="97.4" rx="7" ry="1.9" fill="#9a9dad"/><ellipse cx="80" cy="104" rx="10" ry="3" fill="#7f8294"/><ellipse cx="80" cy="103.3" rx="8.6" ry="2.1" fill="#9a9dad"/><ellipse cx="58" cy="112" rx="6" ry="2" fill="#7f8294"/>' +
      '<circle cx="82" cy="22" r="10" fill="url(#ea@)"/><path d="M76 18Q82 14 88 20Q84 24 80 22Q78 28 76 26z" fill="#4fbf6f"/><path d="M78 14Q84 11 89 16" stroke="#fff" stroke-opacity=".5" stroke-width="1.4" fill="none" stroke-linecap="round"/><circle cx="82" cy="22" r="10" fill="none" stroke="#bfe0ff" stroke-opacity=".5"/>' + VIG,
    'bg-blackhole': '<defs><radialGradient id="bh@" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000"/><stop offset=".45" stop-color="#000"/><stop offset=".62" stop-color="#6a2fc4"/><stop offset="1" stop-color="#0a0420"/></radialGradient><linearGradient id="ac@" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff6fb5"/><stop offset=".5" stop-color="#ffd27a"/><stop offset="1" stop-color="#ff8a3a"/></linearGradient></defs>' +
      '<rect width="100" height="120" fill="#0a0420"/><circle cx="50" cy="60" r="62" fill="url(#bh@)"/>' +
      '<g class="av-pulse"><ellipse cx="50" cy="60" rx="46" ry="12" fill="none" stroke="url(#ac@)" stroke-width="3.2" opacity=".9" transform="rotate(-18 50 60)"/>' +
      '<ellipse cx="50" cy="60" rx="38" ry="9" fill="none" stroke="#ff6fb5" stroke-width="2" opacity=".7" transform="rotate(-18 50 60)"/></g>' + dots(STARS.slice(0, 6), '#e9d8ff') + spark(14, 28, 3.6, 0.4, '#e9d8ff') + spark(88, 94, 3.6, 1.6, '#ffd27a') + VIG
  };

  var BACK = {
    'back-backpack': '<rect x="14" y="82" width="72" height="42" rx="10" ' + fg('#e07a2f', 1) + '/><rect x="22" y="100" width="56" height="16" rx="4" ' + fg('#c4611a', 0.8) + '/><rect x="30" y="86" width="40" height="4" rx="2" fill="#ffc88a"/><path d="M26 108H74" stroke="#7a3a0a" stroke-opacity=".5" stroke-width="1" stroke-dasharray="2 2"/><rect x="47" y="104" width="6" height="7" rx="1.6" fill="#ffd23f" stroke="#a87a0c" stroke-width=".7"/>' + shine('M19 92Q18 86 24 84', 1.8, 0.5),
    'back-cape': '<g class="av-cape"><path d="M26 80L6 126H94L74 80z" ' + fg('#d6283b', 1) + '/><path d="M26 80L16 126H50z" fill="#8f1424" opacity=".4"/><path d="M60 84L74 126M50 90V126" stroke="#8f1424" stroke-opacity=".35" stroke-width="1.2" fill="none"/><path d="M27 84L12 118" stroke="#fff" stroke-opacity=".28" stroke-width="2.4" fill="none"/><path d="M8 118H92" stroke="#ffd23f" stroke-width="2.4" stroke-opacity=".9"/></g>',
    'back-jetpack': '<rect x="10" y="74" width="16" height="36" rx="7" ' + fg('#9aa6b8', 1) + '/><rect x="74" y="74" width="16" height="36" rx="7" ' + fg('#9aa6b8', 1) + '/><rect x="10" y="84" width="16" height="5" fill="#e8402a" stroke="#a82a18" stroke-width=".6"/><rect x="74" y="84" width="16" height="5" fill="#e8402a" stroke="#a82a18" stroke-width=".6"/><path d="M14 78V104M78 78V104" stroke="#fff" stroke-opacity=".45" stroke-width="1.6" stroke-linecap="round"/>' +
      '<g class="av-flame"><path d="M12 110L18 124L24 110z" fill="#ff8a1e"/><path d="M14.5 110L18 120L21.5 110z" fill="#ffd23f"/><path d="M17 110L18 115L19 110z" fill="#fff6c0"/></g><g class="av-flame" style="animation-delay:.12s"><path d="M76 110L82 124L88 110z" fill="#ff8a1e"/><path d="M78.5 110L82 120L85.5 110z" fill="#ffd23f"/><path d="M81 110L82 115L83 110z" fill="#fff6c0"/></g>',
    'back-wings': '<defs><linearGradient id="wg@" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#e4defc"/><stop offset="1" stop-color="#b9acf0"/></linearGradient></defs><g class="av-wl"><path d="M30 92Q-2 80 4 36Q18 52 32 66z" fill="url(#wg@)" stroke="#a79ce0" stroke-width="1"/><path d="M10 52Q18 64 28 72M16 44Q24 60 30 68M8 42Q14 52 22 60" stroke="#c9c0f0" stroke-width=".9" fill="none"/>' + star(10, 30, 3.5, '#ffe58a', '#d4a40c') + spark(10, 30, 4.6, 0.2) + '</g>' +
      '<g class="av-wr"><path d="M70 92Q102 80 96 36Q82 52 68 66z" fill="url(#wg@)" stroke="#a79ce0" stroke-width="1"/><path d="M90 52Q82 64 72 72M84 44Q76 60 70 68M92 42Q86 52 78 60" stroke="#c9c0f0" stroke-width=".9" fill="none"/>' + star(90, 30, 3.5, '#ffe58a', '#d4a40c') + spark(90, 30, 4.6, 1.1) + '</g>'
  };

  function flower(cx, cy, col) {
    var out = '', i, a;
    for (i = 0; i < 5; i++) { a = i * 1.2566; out += '<circle cx="' + (cx + 2.3 * Math.cos(a)).toFixed(1) + '" cy="' + (cy + 2.3 * Math.sin(a)).toFixed(1) + '" r="1.9" ' + fr(col, 0.4) + '/>'; }
    return out + '<circle cx="' + cx + '" cy="' + cy + '" r="1.5" fill="#f2a516" stroke="#b87a0a" stroke-width=".4"/>';
  }
  var HAT = {
    'hat-beanie': '<path d="M26 40Q26 12 50 12Q74 12 74 40z" ' + fg('#e8503a', 1) + '/><path d="M36 38V24M43 38V17M50 38V15M57 38V17M64 38V24" stroke="#a82f1c" stroke-opacity=".35" stroke-width="1.1"/><rect x="25" y="35" width="50" height="9" rx="4" ' + fg('#c43d2a', 1) + '/><path d="M31 37V42M37 37V42M43 37V42M49 37V42M55 37V42M61 37V42M67 37V42" stroke="#7a1f12" stroke-opacity=".35" stroke-width="1"/>' +
      '<circle cx="50" cy="9.5" r="5.8" ' + fr('#ffffff', 0.7) + '/><circle cx="46.4" cy="8" r="1.8" fill="#fff"/><circle cx="53.6" cy="12" r="1.6" fill="#e6e8f4"/>' + shine('M34 24Q37 17 43 14', 2.4, 0.5),
    'hat-propeller': '<path d="M28 38Q30 18 50 18Q70 18 72 38z" ' + fg('#3a8fe8', 1) + '/><path d="M50 18V36M40 21Q36 28 36 37M60 21Q64 28 64 37" stroke="#1f5fb0" stroke-width="1.2" fill="none" stroke-opacity=".7"/><rect x="26" y="35" width="48" height="6" rx="3" ' + fg('#2a6bb8', 1) + '/><rect x="49" y="9" width="2" height="9.5" rx="1" fill="#777"/>' +
      '<g class="av-prop"><ellipse cx="40" cy="8" rx="10" ry="2.3" ' + fg('#ffd23f', 0.6) + '/><ellipse cx="60" cy="8" rx="10" ry="2.3" ' + fg('#ff6f6f', 0.6) + '/></g><circle cx="50" cy="8" r="2.2" fill="#444" stroke="#222" stroke-width=".5"/>' + shine('M33 27Q36 22 42 21', 2.2, 0.5),
    'hat-hardhat': '<path d="M26 40Q28 12 50 12Q72 12 74 40z" ' + fg('#ffd23f', 1) + '/><rect x="45.5" y="11" width="9" height="29" rx="3" ' + fg('#f0b800', 0.8) + '/><rect x="21" y="37" width="58" height="6.5" rx="3.2" ' + fg('#f0b800', 1) + '/><rect x="40" y="22" width="20" height="6" rx="2" fill="#fff" opacity=".45"/>' + shine('M33 28Q35 20 41 16', 2.6, 0.55),
    'hat-wizard': '<path d="M50 2L78 40Q50 47 22 40z" ' + fg('#6a3fd0', 1) + '/><ellipse cx="50" cy="40" rx="33" ry="6" ' + fg('#4f2aa8', 1) + '/><path d="M26 38Q50 44 74 38" stroke="#ffd23f" stroke-width="3" fill="none"/><path d="M26 38Q50 44 74 38" stroke="#fff" stroke-opacity=".4" stroke-width="1" fill="none" transform="translate(0 -.8)"/>' + star(46, 22, 3.6, '#ffe58a', '#c9a010') + star(56, 31, 2.6, '#ffe58a', '#c9a010') + star(41, 32, 2, '#fff') + shine('M47 8L36 28', 2.2, 0.35) + spark(60, 20, 4, 0.5, '#ffe58a'),
    'hat-rocket': '<path d="M27 44Q27 14 50 14Q73 14 73 44z" ' + fg('#f4f4f8', 1) + '/><path d="M44 16Q50 0 56 16z" ' + fg('#e8402a', 0.9) + '/><path d="M27 44Q27 30 36 24L36 44z" fill="#e8402a" stroke="#a82a18" stroke-width=".8"/><path d="M73 44Q73 30 64 24L64 44z" fill="#e8402a" stroke="#a82a18" stroke-width=".8"/><rect x="38" y="30" width="24" height="6" rx="3" ' + fg('#3a8fe8', 0.9) + '/><path d="M41 32H47" stroke="#fff" stroke-opacity=".7" stroke-width="1.4" stroke-linecap="round"/><path d="M27 38L15 52L27 52zM73 38L85 52L73 52z" fill="#c4301c" stroke="#8a1c0e" stroke-width=".8"/>' + shine('M32 30Q34 22 41 19', 2.4, 0.7),
    'hat-astronaut': '<defs><radialGradient id="bb@" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".6" stop-color="#cfe8ff" stop-opacity=".16"/><stop offset="1" stop-color="#8fc4f5" stop-opacity=".34"/></radialGradient></defs><circle cx="50" cy="50" r="33" fill="url(#bb@)" stroke="#eef4fb" stroke-width="3.4"/><circle cx="50" cy="50" r="31.3" fill="none" stroke="#9db6d4" stroke-opacity=".5" stroke-width=".8"/><path d="M29 30Q35 21 46 18" stroke="#fff" stroke-width="3.2" fill="none" opacity=".85" stroke-linecap="round"/><path d="M72 62Q70 70 64 75" stroke="#fff" stroke-width="2" fill="none" opacity=".45" stroke-linecap="round"/><path d="M26 82Q50 92 74 82L72 90Q50 98 28 90z" ' + fg('#e8edf5', 0.9) + '/><circle cx="34" cy="88" r="2.4" fill="#e8402a" stroke="#a82a18" stroke-width=".5"/><circle cx="66" cy="88" r="2.4" fill="#3a8fe8" stroke="#1f5fb0" stroke-width=".5"/><circle cx="50" cy="92" r="1.6" fill="#7fe08f"/>',
    'hat-bow': '<path d="M63 27Q50 15 50 27Q50 39 63 27z" ' + fg('#ff5fa2', 1) + '/><path d="M63 27Q76 15 76 27Q76 39 63 27z" ' + fg('#ff5fa2', 1) + '/><path d="M54 24Q56 21 59 24M72 24Q70 21 67 24" stroke="#ffc2de" stroke-width="1.4" fill="none" stroke-linecap="round"/><circle cx="63" cy="27" r="3.6" ' + fr('#ff5fa2', 1) + '/><circle cx="62" cy="26" r="1" fill="#fff" fill-opacity=".8"/>',
    'hat-flowers': '<path d="M28 42Q28 22 50 22Q72 22 72 42" stroke="#2f7a40" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M28 42Q28 22 50 22Q72 22 72 42" stroke="#4fb866" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      flower(30, 38, '#ff7eb6') + flower(33, 29, '#ffffff') + flower(41, 24, '#b99cff') + flower(50, 22.5, '#ff7eb6') + flower(59, 24, '#ffd23f') + flower(67, 29, '#b99cff') + flower(70, 38, '#ffffff') +
      '<path d="M36 25Q38 21 41 22M64 25Q62 21 59 22" stroke="#2f8a44" stroke-width="2" fill="none" stroke-linecap="round"/>',
    'hat-tiara': '<path d="M33 37L36 24L42 31L50 19L58 31L64 24L67 37Q50 31 33 37z" ' + fg('#dfe6f0', 1.1) + ' stroke-linejoin="round"/><path d="M33 37Q50 31 67 37" stroke="#b9c4d6" stroke-width="2.4" fill="none"/><circle cx="50" cy="27" r="2.8" ' + fr('#ff6fb5', 0.6) + '/><circle cx="37" cy="29" r="1.6" ' + fr('#6fc3ff', 0.5) + '/><circle cx="63" cy="29" r="1.6" ' + fr('#6fc3ff', 0.5) + '/><path d="M45 24L47 21" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>' + spark(50, 19, 4.4, 0.3),
    'hat-crown': '<path d="M29 36L32 12L41 25L50 8L59 25L68 12L71 36z" fill="url(#gold@)" stroke="#a8780a" stroke-width="1.2" stroke-linejoin="round"/><rect x="29" y="33" width="42" height="6.5" rx="2" fill="url(#gold@)" stroke="#a8780a" stroke-width="1"/><circle cx="50" cy="19" r="2.8" ' + fr('#e8402a', 0.6) + '/><circle cx="36" cy="30" r="2.2" ' + fr('#3a8fe8', 0.6) + '/><circle cx="64" cy="30" r="2.2" ' + fr('#3fb86a', 0.6) + '/><circle cx="32" cy="12" r="1.6" fill="#fff6b8" stroke="#a8780a" stroke-width=".5"/><circle cx="50" cy="8" r="1.6" fill="#fff6b8" stroke="#a8780a" stroke-width=".5"/><circle cx="68" cy="12" r="1.6" fill="#fff6b8" stroke="#a8780a" stroke-width=".5"/>' +
      sweep('c', '<path d="M29 36L32 12L41 25L50 8L59 25L68 12L71 36z"/>', 'M36 6L46 6L38 40L28 40z') + spark(41, 18, 4.4, 0.2) + spark(62, 24, 3.6, 1.4)
  };

  var GEAR = {
    'gear-earrings': '<path d="M26 56.5V60M74 56.5V60" stroke="#c8941a" stroke-width="1.1"/>' + star(26, 63, 3.9, '#ffd23f', '#b98a0c') + star(74, 63, 3.9, '#ffd23f', '#b98a0c') + '<circle cx="25.2" cy="62" r=".8" fill="#fff"/><circle cx="73.2" cy="62" r=".8" fill="#fff"/>',
    'gear-glasses': '<circle cx="41" cy="50" r="7.8" fill="#bfe6ff" fill-opacity=".28" stroke="#2c2c34" stroke-width="1.9"/><circle cx="59" cy="50" r="7.8" fill="#bfe6ff" fill-opacity=".28" stroke="#2c2c34" stroke-width="1.9"/><circle cx="41" cy="50" r="6.8" fill="url(#glass@)" fill-opacity=".4"/><circle cx="59" cy="50" r="6.8" fill="url(#glass@)" fill-opacity=".4"/><path d="M48.8 50H51.2M33.2 49L27 47M66.8 49L73 47" stroke="#2c2c34" stroke-width="1.9" stroke-linecap="round"/>' + shine('M36 46Q38 43.6 41 43.4', 1.3, 0.9) + shine('M54 46Q56 43.6 59 43.4', 1.3, 0.9),
    'gear-sunglasses': '<rect x="32" y="44" width="16" height="11.5" rx="4.6" fill="#1b1b26" stroke="#0c0c12" stroke-width=".8"/><rect x="52" y="44" width="16" height="11.5" rx="4.6" fill="#1b1b26" stroke="#0c0c12" stroke-width=".8"/><rect x="33" y="45" width="14" height="5" rx="2.6" fill="#3d3d66" fill-opacity=".8"/><rect x="53" y="45" width="14" height="5" rx="2.6" fill="#3d3d66" fill-opacity=".8"/><path d="M48 47H52M32 46L27 45M68 46L73 45" stroke="#15151c" stroke-width="2.4" stroke-linecap="round"/><path d="M35 47.4L40 47.4M55 47.4L60 47.4" stroke="#b9c4ff" stroke-opacity=".8" stroke-width="1.5" stroke-linecap="round"/>',
    'gear-goggles': '<path d="M25 44H75V56H25z" ' + fg('#5a4c40', 0.8) + ' opacity=".95"/><circle cx="41" cy="50" r="8.7" fill="#9ff0b8" fill-opacity=".6" stroke="#f08a2a" stroke-width="3"/><circle cx="59" cy="50" r="8.7" fill="#9ff0b8" fill-opacity=".6" stroke="#f08a2a" stroke-width="3"/><circle cx="41" cy="50" r="10.2" fill="none" stroke="#a8520c" stroke-width=".7"/><circle cx="59" cy="50" r="10.2" fill="none" stroke="#a8520c" stroke-width=".7"/><circle cx="41" cy="50" r="7" fill="url(#glass@)" fill-opacity=".6"/><circle cx="59" cy="50" r="7" fill="url(#glass@)" fill-opacity=".6"/>' + shine('M35.6 46Q38.6 42.6 43 43.6', 1.7, 0.95) + shine('M53.6 46Q56.6 42.6 61 43.6', 1.7, 0.95),
    'gear-antenna': '<g class="av-antl"><path d="M38 28L30 8" stroke="#4d566a" stroke-width="3" stroke-linecap="round"/><path d="M38 28L30 8" stroke="#a3adc0" stroke-width="1.5" stroke-linecap="round"/><circle cx="30" cy="7" r="3.8" ' + fr('#ff4f7b', 0.7) + '/><circle cx="29" cy="5.8" r="1.1" fill="#fff"/></g><g class="av-antr"><path d="M62 28L70 8" stroke="#4d566a" stroke-width="3" stroke-linecap="round"/><path d="M62 28L70 8" stroke="#a3adc0" stroke-width="1.5" stroke-linecap="round"/><circle cx="70" cy="7" r="3.8" ' + fr('#37d6a0', 0.7) + '/><circle cx="69" cy="5.8" r="1.1" fill="#fff"/></g>',
    'gear-headphones': '<path d="M26 54Q24 18 50 18Q76 18 74 54" stroke="#15151c" stroke-width="5.4" fill="none" stroke-linecap="round"/><path d="M26 54Q24 18 50 18Q76 18 74 54" stroke="#4a4a58" stroke-width="3.2" fill="none" stroke-linecap="round"/>' + shine('M31 36Q33 24 45 21', 1.4, 0.4) + '<rect x="19" y="45" width="11" height="19" rx="5.4" ' + fg('#e8402a', 1) + '/><rect x="70" y="45" width="11" height="19" rx="5.4" ' + fg('#e8402a', 1) + '/><rect x="21.4" y="49" width="4.4" height="11" rx="2.2" fill="#ff9a88"/><rect x="74.2" y="49" width="4.4" height="11" rx="2.2" fill="#ff9a88"/>'
  };


  // ── hair: a part behind the head and a part on top. Short hair is the original look. ──
  var CAP = 'M26 44Q24 24 50 22Q76 24 74 44Q66 34 50 34Q34 34 26 44z';
  var FULL_HATS = { 'hat-beanie': 1, 'hat-propeller': 1, 'hat-hardhat': 1, 'hat-wizard': 1, 'hat-rocket': 1, 'hat-astronaut': 1 };
  function hairParts(id, skin, hat, hcol) {
    var human = has(HAIR_COL, skin), c = human ? HAIR_COL[skin] : WIG_COL[skin] || '#ff6fb5', back = '', front = '', i, y, x;
    var rainbow = hcol === 'haircolor-rainbow';
    if (hcol && has(HAIRCOL, hcol)) c = HAIRCOL[hcol];
    var G = rainbow ? function (col) { return col === c ? 'url(#rainbow@)' : 'url(#rainbowd@)'; } : G0;   // (G0 = the shared gradient helper)
    var full = !!FULL_HATS[hat], tie = '#ff5fa2';
    var F = 'fill="' + G(c) + '" ' + ln(c, 0.9, 0.5), B = 'fill="' + G(dk(c, 0.12)) + '" ' + ln(c, 0.9, 0.55), T = fr(tie, 0.6);
    // the top: the soft shine across it and a few strands, then the same shape again as a thin edge
    var gl = shine('M33 31Q42 24.6 56 25.4', 3, human ? 0.3 : 0.4) + '<path d="M36 33Q40 27 46 25M44 33Q49 27 55 25.6M62 32Q65 29 68 28" stroke="' + dk(c, 0.3) + '" stroke-opacity=".5" stroke-width=".9" fill="none" stroke-linecap="round"/>';
    var cap = '<path d="' + CAP + '" ' + F + '/>' + gl, fill = '<ellipse cx="50" cy="47" rx="26.5" ry="27" ' + B + '/>';
    if (id === 'hair-short') { if (human) front = cap; }
    else if (id === 'hair-buzz') front = '<path d="M27 42Q26 25 50 23Q74 25 73 42Q68 32 50 31Q32 32 27 42z" ' + F + '/>' + shine('M34 31Q42 25 54 25.4', 2.6, 0.28) + '<path d="M34 34V31M40 32V29M46 31V28M54 31V28M60 32V29M66 34V31" stroke="' + dk(c, 0.35) + '" stroke-opacity=".5" stroke-width=".8" stroke-linecap="round"/>';
    else if (id === 'hair-long') {
      back = fill + '<path d="M27 40Q15 66 20 100Q29 106 38 100Q31 78 34 56z" ' + B + '/><path d="M73 40Q85 66 80 100Q71 106 62 100Q69 78 66 56z" ' + B + '/>' + shine('M24 56Q20 74 23 92', 1.6, 0.22) + shine('M76 56Q80 74 77 92', 1.6, 0.22);
      front = cap;
    } else if (id === 'hair-ponytail') {
      back = fill + '<path d="M68 29Q95 24 92 58Q91 74 82 86Q85 66 76 52Q72 42 66 38z" ' + B + '/>' + shine('M82 36Q90 46 87 66', 1.6, 0.25);
      front = cap + '<ellipse cx="71" cy="33" rx="3.2" ry="5" ' + T + ' transform="rotate(-25 71 33)"/>';
    } else if (id === 'hair-pigtails') {
      back = fill + '<path d="M24 40Q7 48 9 72Q11 86 20 81Q20 66 28 54z" ' + B + '/><path d="M76 40Q93 48 91 72Q89 86 80 81Q80 66 72 54z" ' + B + '/>' + shine('M14 54Q11 66 15 76', 1.5, 0.25) + shine('M86 54Q89 66 85 76', 1.5, 0.25);
      front = cap + '<circle cx="24" cy="42" r="3.7" ' + T + '/><circle cx="76" cy="42" r="3.7" ' + T + '/>';
    } else if (id === 'hair-braids') {
      back = fill;
      for (i = 0; i < 5; i++) {
        y = 56 + i * 9; x = i % 2 ? 24.6 : 21.4;
        back += '<ellipse cx="' + x + '" cy="' + y + '" rx="4.6" ry="6" ' + B + '/><ellipse cx="' + (100 - x) + '" cy="' + y + '" rx="4.6" ry="6" ' + B + '/>';
      }
      back += '<circle cx="23" cy="98" r="3.1" ' + T + '/><circle cx="77" cy="98" r="3.1" ' + T + '/>';
      front = cap;
    } else if (id === 'hair-bun') {
      front = (full ? '' : '<circle cx="50" cy="15" r="9.5" ' + F + '/><path d="M44 11Q49 8 55 10" stroke="#fff" stroke-opacity=".3" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M42 21Q50 25 58 21" stroke="' + tie + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>') + cap;
    } else if (id === 'hair-curly') {
      var ring = [[25, 34, 8.5], [75, 34, 8.5], [20, 48, 8], [80, 48, 8], [22, 62, 7.5], [78, 62, 7.5]];
      if (!full) ring = ring.concat([[50, 19, 9], [34, 22, 8.5], [66, 22, 8.5]]);
      back = dots(ring, G(dk(c, 0.1)), ln(c, 0.9, 0.55));
      front = '<path d="' + CAP + '" ' + F + '/>' + dots([[33, 34, 5.4], [42, 31, 5.4], [51, 30, 5.4], [60, 31, 5.4], [68, 34, 5]], G(c), ln(c, 0.8, 0.5)) + shine('M30 31Q34 28 38 29M46 27Q50 26 54 27', 1.6, 0.35);
    }
    return { back: back, front: front };
  }


  // ── pets: a small dog or cat in the bottom-left corner, in front of the scene (never near the face) ──
  var INK = '#1a1a1f';
  function dogSvg(o) {
    var f = o.fur, m = o.muz, e = o.ear, eye = o.eye || 1.5;
    var s = '<g class="av-tail">' + (o.curl ? '<path d="M24 25Q34 25 30.5 14Q29 10 25.5 14" stroke="' + dk(f, 0.45) + '" stroke-width="5.8" fill="none" stroke-linecap="round"/><path d="M24 25Q34 25 30.5 14Q29 10 25.5 14" stroke="' + f + '" stroke-width="4.4" fill="none" stroke-linecap="round"/><circle cx="25.6" cy="13.6" r="2.3" ' + fr(o.tip || f, 0.5) + '/>'
      : '<path d="M24 24Q31 21 29.5 12" stroke="' + dk(f, 0.45) + '" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M24 24Q31 21 29.5 12" stroke="' + f + '" stroke-width="3.6" fill="none" stroke-linecap="round"/>') + '</g>';
    if (o.upright) s += '<path d="M7.6 10L8 1.2L15.4 5.4z" ' + fg(e, 0.7) + '/><g class="av-ear"><path d="M24.4 10L24 1.2L16.6 5.4z" ' + fg(e, 0.7) + '/></g><path d="M9.6 8L9.9 4L12.8 6z" fill="#f0bcbc"/><path d="M22.4 8L22.1 4L19.2 6z" fill="#f0bcbc"/>';
    s += '<ellipse cx="16" cy="23" rx="10" ry="7.5" ' + fr(f, 0.7) + '/><ellipse cx="16" cy="25.5" rx="6" ry="4.6" ' + fr(m, 0.5) + '/>';
    if (o.spots) s += '<circle cx="9.5" cy="21.5" r="3" fill="' + e + '"/><circle cx="23.5" cy="25" r="2.4" fill="' + e + '"/>';
    s += '<ellipse cx="11" cy="28.6" rx="3.8" ry="2.2" ' + fr(m, 0.6) + '/><ellipse cx="21" cy="28.6" rx="3.8" ry="2.2" ' + fr(m, 0.6) + '/>';
    s += '<circle cx="16" cy="13" r="9" ' + fr(f, 0.75) + '/>';
    if (o.mask) s += '<path d="M16 4.2Q9 5 8 14Q10 21 16 22Q22 21 24 14Q23 5 16 4.2z" fill="' + o.mask + '"/>';
    if (o.patch) s += '<circle cx="11.6" cy="10.4" r="4" fill="' + e + '"/>';
    if (!o.upright) s += '<ellipse cx="7" cy="12" rx="3.6" ry="6.4" ' + fg(e, 0.7) + ' transform="rotate(14 7 12)"/><g class="av-ear"><ellipse cx="25" cy="12" rx="3.6" ry="6.4" ' + fg(e, 0.7) + ' transform="rotate(-14 25 12)"/></g>';
    s += '<ellipse cx="16" cy="16.8" rx="5.4" ry="4.2" ' + fr(m, 0.4) + '/>';
    s += '<ellipse cx="9.4" cy="15.6" rx="2" ry="1.3" fill="#ff6f86" fill-opacity=".35"/><ellipse cx="22.6" cy="15.6" rx="2" ry="1.3" fill="#ff6f86" fill-opacity=".35"/>';
    s += '<g class="av-eyes"><circle cx="12.4" cy="10.6" r="' + (eye + 0.1) + '" fill="' + (o.eyec || INK) + '"/><circle cx="19.6" cy="10.6" r="' + (eye + 0.1) + '" fill="' + (o.eyec || INK) + '"/>' +
      '<circle cx="12.4" cy="10.6" r="' + (eye * 0.5) + '" fill="#111"/><circle cx="19.6" cy="10.6" r="' + (eye * 0.5) + '" fill="#111"/>' +
      '<circle cx="13" cy="9.8" r=".62" fill="#fff"/><circle cx="20.2" cy="9.8" r=".62" fill="#fff"/><circle cx="11.9" cy="11.4" r=".3" fill="#fff" fill-opacity=".8"/><circle cx="19.1" cy="11.4" r=".3" fill="#fff" fill-opacity=".8"/></g>';
    s += '<ellipse cx="16" cy="14.9" rx="2.6" ry="1.9" fill="' + INK + '"/><ellipse cx="15.2" cy="14.3" rx=".9" ry=".5" fill="#fff" opacity=".7"/>' +
      '<path d="M16 16.8V18.4M16 18.4Q13.8 20 12.4 18.4M16 18.4Q18.2 20 19.6 18.4" stroke="' + INK + '" stroke-width=".9" fill="none" stroke-linecap="round"/><path d="M14.6 19.2Q16 23.4 17.4 19.2z" fill="#ff7a8a"/>';
    if (o.collar) s += '<rect x="8.5" y="20.4" width="15" height="2.6" rx="1.3" ' + fg(o.collar, 0.5) + '/><circle cx="16" cy="24" r="1.6" fill="#ffd23f" stroke="#b88a10" stroke-width=".5"/>';
    return s;
  }
  function catSvg(o) {
    var f = o.fur, pt = o.points || f, inner = o.inner || '#ff9fb2', wh = o.whisk || '#3a3a44', er = o.eye || 1.9;
    var s = '<g class="av-tail av-slow"><path d="M24 27Q34.5 27 31.5 15Q30.5 9.5 27 12" stroke="' + dk(pt, 0.45) + '" stroke-width="4.2" fill="none" stroke-linecap="round"/><path d="M24 27Q34.5 27 31.5 15Q30.5 9.5 27 12" stroke="' + pt + '" stroke-width="2.8" fill="none" stroke-linecap="round"/></g>';
    s += '<path d="M7.5 9.5L6.8 0.4L14.8 4.2z" ' + fg(pt, 0.7) + '/><g class="av-ear"><path d="M24.5 9.5L25.2 0.4L17.2 4.2z" ' + fg(pt, 0.7) + '/></g><path d="M9 7.4L8.7 3L12.4 4.8z" fill="' + inner + '"/><path d="M23 7.4L23.3 3L19.6 4.8z" fill="' + inner + '"/>';
    s += '<ellipse cx="16" cy="23.2" rx="9.6" ry="7.3" ' + fr(f, 0.7) + '/>';
    if (o.stripe) s += '<path d="M8 20Q10 21 10.4 24M24 20Q22 21 21.6 24" stroke="' + o.stripe + '" stroke-width="1.4" fill="none" stroke-linecap="round"/>';
    s += '<ellipse cx="11.2" cy="28.6" rx="3.4" ry="2.1" ' + fr(o.paw || pt, 0.6) + '/><ellipse cx="20.8" cy="28.6" rx="3.4" ry="2.1" ' + fr(o.paw || pt, 0.6) + '/>';
    s += '<ellipse cx="16" cy="13.5" rx="9.8" ry="8.6" ' + fr(f, 0.75) + '/>';
    if (o.mask) s += '<ellipse cx="16" cy="15.4" rx="5.6" ry="5.4" fill="' + o.mask + '"/>';
    else s += '<ellipse cx="16" cy="16.8" rx="4.2" ry="3.2" fill="#fff6ea"/>';
    if (o.stripe) s += '<path d="M16 5.2V8.4M12.4 5.8L13.1 8.2M19.6 5.8L18.9 8.2" stroke="' + o.stripe + '" stroke-width="1.2" stroke-linecap="round"/>';
    s += '<ellipse cx="8.6" cy="15.6" rx="2" ry="1.3" fill="#ff6f86" fill-opacity=".35"/><ellipse cx="23.4" cy="15.6" rx="2" ry="1.3" fill="#ff6f86" fill-opacity=".35"/>';
    s += '<g class="av-eyes"><ellipse cx="11.6" cy="12" rx="' + er + '" ry="' + (er + 0.5) + '" fill="' + o.eyec + '"/><ellipse cx="20.4" cy="12" rx="' + er + '" ry="' + (er + 0.5) + '" fill="' + o.eyec + '"/>' +
      '<ellipse cx="11.6" cy="12" rx=".65" ry="' + (er + 0.2) + '" fill="#111"/><ellipse cx="20.4" cy="12" rx=".65" ry="' + (er + 0.2) + '" fill="#111"/>' +
      '<circle cx="12.3" cy="10.9" r=".6" fill="#fff"/><circle cx="21.1" cy="10.9" r=".6" fill="#fff"/><circle cx="10.9" cy="13.2" r=".3" fill="#fff" fill-opacity=".8"/><circle cx="19.7" cy="13.2" r=".3" fill="#fff" fill-opacity=".8"/></g>';
    s += '<path d="M14.7 15.3H17.3L16 16.7z" fill="#ff8fa3"/><path d="M16 16.7V17.4M16 17.4Q14.6 18.8 13.2 17.6M16 17.4Q17.4 18.8 18.8 17.6" stroke="#333" stroke-width=".8" fill="none" stroke-linecap="round"/>';
    s += '<path d="M2.2 13.6L9.6 15M2.2 17.4L9.6 16.8M29.8 13.6L22.4 15M29.8 17.4L22.4 16.8" stroke="' + wh + '" stroke-width=".9" stroke-linecap="round"/>';
    if (o.collar) s += '<rect x="9" y="20.6" width="14" height="2.4" rx="1.2" ' + fg(o.collar, 0.5) + '/><circle cx="16" cy="24" r="1.7" fill="#ffd23f" stroke="#b88a10" stroke-width=".5"/>';
    return s;
  }
  var HELMET = '<defs><radialGradient id="hb@" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".6" stop-color="#cfe8ff" stop-opacity=".16"/><stop offset="1" stop-color="#8fc4f5" stop-opacity=".34"/></radialGradient></defs><circle cx="16" cy="11.5" r="14.5" fill="url(#hb@)" stroke="#eef4fb" stroke-width="1.7"/><path d="M6 7Q8.6 2.4 13.4 1.6" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".95"/><rect x="7" y="20.4" width="18" height="3.4" rx="1.7" ' + fg('#e8edf5', 0.7) + '/><circle cx="11" cy="22.1" r="1" fill="#e8402a"/><circle cx="21" cy="22.1" r="1" fill="#3a8fe8"/>' + spark(26, 3, 3.2, 0.6) + spark(4, 16, 2.6, 1.8);
  function pet(svg, scale) { var k = scale || 1; return '<g class="av-pet"><g transform="translate(3 ' + (88 + 30 * (1 - k)).toFixed(1) + ') scale(' + k + ')"><ellipse cx="16" cy="30.4" rx="14" ry="2.4" fill="url(#shd@)"/>' + svg + '</g></g>'; }
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


  // ── outfits: what the figure wears on its torso. Each one is a "body" (drawn before the head, over the
  //    same silhouette every time) and a "neck" (the collar, drawn over the neck). Details stay on the right
  //    and centre of the chest because the pet sits in front of the bottom-left corner. ──
  var TORSO = 'M20 126V120Q20 84 50 82Q80 84 80 120V126z';
  function torso(c, w, sh, so) {
    return '<path d="' + TORSO + '" ' + fg(c, w || 1) + '/><path d="M23 112Q24 92 37 86" stroke="#fff" stroke-opacity=".26" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M77 104Q76 94 70 88" stroke="' + (sh || '#000') + '" stroke-opacity="' + (so || '.16') + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
  }
  function band(d, c, w) { return '<path d="' + d + '" stroke="' + dk(c, 0.45) + '" stroke-width="' + (w + 1.6) + '" fill="none" stroke-linecap="round"/><path d="' + d + '" stroke="' + c + '" stroke-width="' + w + '" fill="none" stroke-linecap="round"/><path d="' + d + '" stroke="#fff" stroke-opacity=".3" stroke-width="' + (w * 0.3).toFixed(1) + '" fill="none" stroke-linecap="round" transform="translate(0 -' + (w * 0.22).toFixed(1) + ')"/>'; }
  var SEQ = [[30, 108, 1.1, '#fff'], [38, 118, 1, '#ffe27a'], [46, 106, 1.2, '#ff9be0'], [58, 114, 1.1, '#fff'], [66, 120, 1, '#ffe27a'], [72, 108, 1.2, '#7be0ff'], [27, 120, 1, '#ff9be0'], [53, 122, 1, '#fff'], [75, 96, 1, '#fff'], [34, 96, 1, '#ffe27a'], [62, 100, 1.1, '#ff9be0']];
  var OUTFIT = {
    'outfit-shirt': {
      body: torso('#2f7fd1', 1, '#0b2f60', '.18') + '<circle cx="65" cy="104" r="5.8" fill="#fff" fill-opacity=".92" stroke="#1f5fa6" stroke-width=".8"/>' + star(65, 104, 3.6, '#ff6f3a', '#c4451a'),
      neck: '<path d="M39 83.4Q50 98 61 83.4" stroke="#1b5496" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M39.6 83.8Q50 96.4 60.4 83.8" stroke="#5aa4ee" stroke-width="1.1" fill="none" stroke-linecap="round"/>'
    },
    'outfit-hoodie': {
      body: torso('#d6283b') + '<path d="M31 112Q50 106 69 112L73 126H27z" ' + fg('#b11f30', 0.9) + '/><path d="M35 113.6L31 125M65 113.6L69 125" stroke="#7a1020" stroke-opacity=".5" stroke-width=".9" fill="none"/><path d="M36 111.4Q50 107.6 64 111.4" stroke="#fff" stroke-opacity=".22" stroke-width="1.2" fill="none"/>',
      neck: band('M36 82Q50 104 64 82', '#d6283b', 6.4) + '<path d="M45.4 93.6Q44 100 45 107M54.6 93.6Q56 100 55 107" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/><circle cx="45" cy="107.6" r="1.5" fill="#fff" stroke="#9aa0ad" stroke-width=".5"/><circle cx="55" cy="107.6" r="1.5" fill="#fff" stroke="#9aa0ad" stroke-width=".5"/>'
    },
    'outfit-labcoat': {
      body: torso('#f4f7fb') + '<path d="M41 83.6Q50 96 59 83.6L57.5 126H42.5z" ' + fg('#4fb3d9', 0.8) + '/><path d="M43 126L41.4 88M57 126L58.6 88" stroke="#8b97a8" stroke-width=".9" fill="none"/><rect x="61" y="103" width="12" height="11" rx="2" ' + fg('#e6ebf3', 0.8) + '/><path d="M64.6 99.6V107M68.6 100.4V107" stroke="#2f7fd1" stroke-width="1.8" stroke-linecap="round"/><path d="M68.6 100.4V104" stroke="#d6283b" stroke-width="1.8" stroke-linecap="round"/><circle cx="49" cy="113" r="1.2" fill="#aab4c3"/><circle cx="49" cy="120" r="1.2" fill="#aab4c3"/><circle cx="51" cy="113" r="1.2" fill="#aab4c3"/><circle cx="51" cy="120" r="1.2" fill="#aab4c3"/>',
      neck: '<path d="M37 82.4L50 99L41 104L30 93z" ' + fg('#f4f7fb', 0.8) + '/><path d="M63 82.4L50 99L59 104L70 93z" ' + fg('#f4f7fb', 0.8) + '/>'
    },
    'outfit-overalls': {
      body: torso('#ffd23f') + '<path d="M37 126V102Q37 97 42 97H58Q63 97 63 102V126z" ' + fg('#3b6fc0', 0.9) + '/><path d="M40 97L34.6 85M60 97L65.4 85" stroke="#1f457f" stroke-width="7.4" fill="none" stroke-linecap="round"/><path d="M40 97L34.6 85M60 97L65.4 85" stroke="#4d84d6" stroke-width="5.8" fill="none" stroke-linecap="round"/><rect x="43.6" y="104" width="12.8" height="9" rx="2" fill="none" stroke="#9cc0ee" stroke-width=".9" stroke-dasharray="2 1.2"/><circle cx="40.4" cy="98.4" r="2.2" ' + fr('#ffd23f', 0.6) + '/><circle cx="59.6" cy="98.4" r="2.2" ' + fr('#ffd23f', 0.6) + '/><path d="M38.6 112V124M61.4 112V124" stroke="#9cc0ee" stroke-width=".8" stroke-dasharray="2 1.2" fill="none"/>',
      neck: '<path d="M39 83.4Q50 94 61 83.4" stroke="#c99600" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M39.6 83.8Q50 92.6 60.4 83.8" stroke="#fff0a8" stroke-width="1.1" fill="none" stroke-linecap="round"/>'
    },
    'outfit-jersey': {
      body: torso('#1fa65a') + '<path d="M21.6 112Q21 94 33 86M78.4 112Q79 94 67 86" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M42 97.6H58L49 119" stroke="#0b5a2f" stroke-width="6.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 97.6H58L49 119" stroke="#fff" stroke-width="4.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M45.6 99.6H55.4" stroke="#9fe3bd" stroke-width="1" fill="none"/>',
      neck: '<path d="M38 83.4Q50 100 62 83.4" stroke="#0b5a2f" stroke-width="5.4" fill="none" stroke-linecap="round"/><path d="M38 83.4Q50 100 62 83.4" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>'
    },
    'outfit-party': {
      body: torso('#a64bd6') + SEQ.map(function (d) { return '<circle cx="' + d[0] + '" cy="' + d[1] + '" r="' + d[2] + '" fill="' + d[3] + '" fill-opacity=".92"/>'; }).join('') + spark(57, 98, 4, 0.4, '#fff6a8', '#b98a0c') + spark(36, 111, 3.2, 1.3, '#ffffff', '#9a60c0'),
      neck: '<path d="M50 88.4L37.6 82.2V94.6z" ' + fg('#ff5fa2', 0.7) + '/><path d="M50 88.4L62.4 82.2V94.6z" ' + fg('#ff5fa2', 0.7) + '/><circle cx="50" cy="88.4" r="3" ' + fr('#ff8cc2', 0.7) + '/>'
    },
    'outfit-spacesuit': {
      body: torso('#eef1f7') + '<path d="M21.4 108Q22 92 34 86.4M78.6 108Q78 92 66 86.4" stroke="#e8802a" stroke-width="3.2" fill="none" stroke-linecap="round"/><rect x="38" y="97" width="24" height="16" rx="3.4" ' + fg('#3b4458', 0.8) + '/><circle cx="43.6" cy="102.6" r="2.1" fill="#ff5a4a"/><circle cx="50" cy="102.6" r="2.1" fill="#4fe08a"/><circle cx="56.4" cy="102.6" r="2.1" fill="#ffd23f"/><path d="M42.6 108.6H57.4" stroke="#7be0ff" stroke-width="1.8" stroke-linecap="round"/><rect x="65" y="98" width="9" height="6.2" rx="1" fill="#2f5fd1" stroke="#1a3a90" stroke-width=".6"/>' + star(69.5, 101.1, 2.2, '#fff') + '<path d="M26 118H74" stroke="#9aa6b8" stroke-width=".9" stroke-dasharray="3 2" fill="none"/>',
      neck: '<path d="M36 82Q50 100 64 82" stroke="#6f7a8d" stroke-width="7.4" fill="none" stroke-linecap="round"/><path d="M37 82.4Q50 98 63 82.4" stroke="#dfe5ee" stroke-width="4.2" fill="none" stroke-linecap="round"/><path d="M38.4 82.4Q50 95.6 61.6 82.4" stroke="#fff" stroke-opacity=".7" stroke-width="1" fill="none" stroke-linecap="round"/>'
    },
    'outfit-hero': {
      body: torso('#2d46c9') + '<path d="M20 117H80V122H20z" ' + fg('#ffd23f', 0.7) + '/><rect x="45" y="115.4" width="10" height="8" rx="2" ' + fg('#ffe27a', 0.7) + '/><path d="M50 91L60.4 95V103Q60.4 110.4 50 114.6Q39.6 110.4 39.6 103V95z" ' + fg('#ffd23f', 0.9) + '/>' + star(50, 102.6, 5.2, '#d6283b', '#8f1423') + '<path d="M44 96.4Q50 94 56 96.4" stroke="#fff" stroke-opacity=".55" stroke-width="1.1" fill="none"/>',
      neck: band('M37 83Q50 99 63 83', '#d6283b', 4.8)
    },
    'outfit-armor': {
      body: '<path d="' + TORSO + '" fill="url(#gold@)" stroke="#a8780a" stroke-width="1"/><path d="M18.6 114Q15.6 90 36 84.4L38.6 99Q26 100 18.6 114z" fill="url(#gold@)" stroke="#a8780a" stroke-width="1"/><path d="M81.4 114Q84.4 90 64 84.4L61.4 99Q74 100 81.4 114z" fill="url(#gold@)" stroke="#a8780a" stroke-width="1"/><path d="M32 91Q50 101 68 91L66 112Q50 122 34 112z" fill="url(#gold@)" stroke="#a8780a" stroke-width="1"/><path d="M50 97V119M36 100Q50 108 64 100" stroke="#a8780a" stroke-width=".9" fill="none"/><path d="M35 94Q44 98 50 98" stroke="#fff" stroke-opacity=".7" stroke-width="1.3" fill="none" stroke-linecap="round"/><circle cx="50" cy="104.6" r="4.2" fill="#d6283b" stroke="#8f1423" stroke-width=".8"/><circle cx="48.8" cy="103.4" r="1.2" fill="#fff"/><circle cx="36" cy="89" r="1.2" fill="#a8780a"/><circle cx="64" cy="89" r="1.2" fill="#a8780a"/><circle cx="35" cy="110" r="1.2" fill="#a8780a"/><circle cx="65" cy="110" r="1.2" fill="#a8780a"/>' +
        sweep('ar', '<path d="' + TORSO + '"/>', 'M30 80L40 80L30 126L20 126z') + spark(24, 96, 3.4, 0.6, '#fff'),
      neck: band('M36.6 82.4Q50 100 63.4 82.4', '#f2c230', 5.6)
    }
  };

  var EYE_INK = '#241a14';
  function eye(cx, k) {
    k = k || 1;
    return '<ellipse cx="' + cx + '" cy="50.4" rx="' + (3.1 * k).toFixed(1) + '" ry="' + (3.7 * k).toFixed(1) + '" fill="' + EYE_INK + '"/><circle cx="' + (cx + 1.15 * k).toFixed(1) + '" cy="' + (49 - (k - 1) * 2).toFixed(1) + '" r="' + (1.3 * k).toFixed(1) + '" fill="#fff"/><circle cx="' + (cx - 1.2 * k).toFixed(1) + '" cy="' + (52.2 + (k - 1)).toFixed(1) + '" r=".6" fill="#fff" fill-opacity=".75"/>';
  }
  function brows(dy) {
    var y = 44.4 + (dy || 0);
    return '<path d="M36.6 ' + y + 'Q41 ' + (y - 2.4) + ' 45.2 ' + (y - 0.2) + 'M54.8 ' + (y - 0.2) + 'Q59 ' + (y - 2.4) + ' 63.4 ' + y + '" stroke="#2a1c14" stroke-opacity=".5" stroke-width="1.5" fill="none" stroke-linecap="round"/>';
  }
  function faceSvg(id, robotish) {
    var eyes, extra = '', mouth = '<path d="M42 62Q50 69 58 62" stroke="' + EYE_INK + '" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M41.4 61.2L40.6 60.4M58.6 61.2L59.4 60.4" stroke="' + EYE_INK + '" stroke-width="1.2" stroke-linecap="round"/>', up = 0;
    if (robotish) {
      var lens = function (x) { return '<rect x="' + x + '" y="46.2" width="9" height="7.6" rx="2.8" fill="#14202a" stroke="#0a1218" stroke-width=".6"/><circle cx="' + (x + 4.5) + '" cy="50" r="2.3" fill="#7be0ff"/><circle cx="' + (x + 5.4) + '" cy="49" r=".9" fill="#fff"/>'; };
      eyes = lens(36.5) + lens(54.5);
      extra = '<circle cx="34" cy="60.5" r="1.7" fill="#7be0ff" fill-opacity=".85"/><circle cx="66" cy="60.5" r="1.7" fill="#7be0ff" fill-opacity=".85"/>';
    } else eyes = eye(41) + eye(59);
    if (id === 'face-grin') mouth = '<path d="M40 60Q50 76 60 60z" fill="#6e1526" stroke="' + EYE_INK + '" stroke-width="1" stroke-linejoin="round"/><path d="M42 61H58Q56 65 50 66Q44 65 42 61z" fill="#fff"/><ellipse cx="50" cy="66.6" rx="3.8" ry="1.4" fill="#ff7a8a"/>';
    else if (id === 'face-wink') { if (!robotish) eyes = '<path d="M37 51.4Q41 46.4 45 51.4" stroke="' + EYE_INK + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>' + eye(59); else eyes = '<path d="M36.5 51Q41 46 45.5 51" stroke="#14202a" stroke-width="2.6" fill="none" stroke-linecap="round"/>' + eyes.slice(eyes.indexOf('<rect', 10)); mouth = '<path d="M41 61Q50 70 59 61" stroke="' + EYE_INK + '" stroke-width="2.3" fill="none" stroke-linecap="round"/>'; }
    else if (id === 'face-surprised') { up = -1.6; if (!robotish) eyes = eye(41, 1.22) + eye(59, 1.22); mouth = '<ellipse cx="50" cy="64" rx="3.6" ry="4.7" fill="#6e1526" stroke="' + EYE_INK + '" stroke-width=".9"/><ellipse cx="50" cy="66.2" rx="2.2" ry="1.7" fill="#ff7a8a"/>'; }
    else if (id === 'face-starry') {
      var st = function (x) { return star(x, 50, 5.8, '#ffcf2e', '#c98a00') + '<circle cx="' + (x - 1.4) + '" cy="48.6" r="1" fill="#fff"/>'; };
      eyes = st(41) + st(59); extra = extra;
    }
    return (robotish ? '' : brows(up)) + '<g class="av-eyes">' + eyes + '</g>' + extra + mouth;
  }

  function bodySvg(skin, hairId, hat, outfitId, hairCol) {
    var base = SKIN_COL[skin] || SKIN_COL['skin-peach'], gold = skin === 'skin-gold', fill = gold ? 'url(#gold@)' : R(base), edge = gold ? '#a8780a' : dk(base, 0.42);
    var hp = hairParts(hairId || DEFAULTS.hair, skin, hat, hairCol), sk = 'fill="' + fill + '" stroke="' + edge + '" stroke-width="1"';
    var fit = OUTFIT[outfitId] || OUTFIT[DEFAULTS.outfit];
    var s = '<ellipse cx="50" cy="119" rx="44" ry="6" fill="url(#shd@)"/>';
    s += fit.body;
    s += hp.back + '<ellipse cx="52" cy="53" rx="25" ry="27" fill="#000" fill-opacity=".1"/>';
    s += '<rect x="43" y="72" width="14" height="15" rx="4" ' + sk + '/><ellipse cx="50" cy="79" rx="7.4" ry="3.6" fill="#000" fill-opacity=".16"/>' + fit.neck;
    if (skin === 'skin-robot' || skin === 'skin-gold') {
      s += '<rect x="19" y="44" width="7.4" height="14" rx="3.2" ' + fg('#8794a4', 0.8) + '/><rect x="73.6" y="44" width="7.4" height="14" rx="3.2" ' + fg('#8794a4', 0.8) + '/>';
      s += '<rect x="25" y="25" width="50" height="52" rx="14" ' + sk + '/><rect x="27.4" y="27.4" width="45.2" height="47.2" rx="12" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="1"/>' +
        '<rect x="31" y="41.5" width="38" height="30" rx="9.5" fill="' + dk(base, 0.2) + '" fill-opacity=".34" stroke="#fff" stroke-opacity=".35" stroke-width=".8"/><circle cx="50" cy="30" r="2" fill="#e8402a" stroke="#7d8a9a" stroke-width="1"/><circle cx="49.4" cy="29.4" r=".6" fill="#fff"/>' +
        '<circle cx="29" cy="31" r="1" fill="#7d8a9a"/><circle cx="71" cy="31" r="1" fill="#7d8a9a"/><circle cx="29" cy="71" r="1" fill="#7d8a9a"/><circle cx="71" cy="71" r="1" fill="#7d8a9a"/>';
      if (gold) s += star(31, 33, 2.4, '#fff') + star(70, 70, 2, '#fff') + sweep('g', '<rect x="25" y="25" width="50" height="52" rx="14"/>', 'M40 20L50 20L38 82L28 82z') + spark(68, 32, 4, 0.5) + spark(30, 66, 3.4, 1.7);
    } else if (skin === 'skin-alien') {
      s += '<path d="M26 56Q18 52 14 42Q22 46 27 50z" ' + sk + '/><path d="M74 56Q82 52 86 42Q78 46 73 50z" ' + sk + '/><ellipse cx="50" cy="50" rx="24" ry="28" ' + sk + '/><ellipse cx="41" cy="38.6" rx="6.4" ry="3" fill="#fff" opacity=".35" transform="rotate(-16 41 38.6)"/><circle cx="58" cy="35" r="1.1" fill="#4fbf6f" fill-opacity=".6"/><circle cx="62" cy="39" r=".8" fill="#4fbf6f" fill-opacity=".6"/>';
    } else {
      s += '<circle cx="26" cy="52" r="4.6" ' + sk + '/><circle cx="74" cy="52" r="4.6" ' + sk + '/><circle cx="26.4" cy="52.4" r="2" fill="' + dk(base, 0.2) + '" fill-opacity=".35"/><circle cx="73.6" cy="52.4" r="2" fill="' + dk(base, 0.2) + '" fill-opacity=".35"/><ellipse cx="50" cy="50" rx="24" ry="26" ' + sk + '/><ellipse cx="40" cy="36.4" rx="6" ry="2.8" fill="#fff" fill-opacity=".22" transform="rotate(-16 40 36.4)"/>';
    }
    if (skin !== 'skin-robot' && skin !== 'skin-gold') s += '<ellipse cx="33.4" cy="58.6" rx="5.6" ry="3.4" fill="url(#blush@)"/><ellipse cx="66.6" cy="58.6" rx="5.6" ry="3.4" fill="url(#blush@)"/><path d="M48.6 56.6Q50 58.2 51.8 56.8" stroke="' + dk(base, 0.4) + '" stroke-opacity=".55" stroke-width=".9" fill="none" stroke-linecap="round"/>';
    return s + hp.front;
  }


  // ── effects: drawn around the figure. "back" goes behind it (right after the scene), "front" in front of it
  //    (but behind the pet). Still pictures are complete on their own; the motion classes only add movement. ──
  function tongue(x, yb, h, w, c1, c2, cls, dly) {      // one flame: an outer colour and a smaller bright core
    function sh(k) {
      var hh = h * k, ww = w * k, yy = yb;
      return 'M' + (x - ww) + ' ' + yy + 'C' + (x - ww) + ' ' + (yy - hh * 0.4) + ' ' + (x - ww * 0.15) + ' ' + (yy - hh * 0.55) + ' ' + x + ' ' + (yy - hh) + 'C' + (x + ww * 0.2) + ' ' + (yy - hh * 0.5) + ' ' + (x + ww) + ' ' + (yy - hh * 0.4) + ' ' + (x + ww) + ' ' + yy + 'z';
    }
    return '<g class="' + (cls || 'av-fire') + '" style="animation-delay:' + (dly || 0) + 's"><path d="' + sh(1) + '" fill="' + c1 + '" stroke="' + dk(c1, 0.35) + '" stroke-width=".7"/><path d="' + sh(0.55) + '" fill="' + c2 + '"/></g>';
  }
  function puff(x, y, r, d) { return '<circle class="av-puff" style="animation-delay:' + d + 's" cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#e9edf5" stroke="#aab4c6" stroke-width=".8" fill-opacity=".92"/>'; }
  function bolt(x, y, k, d, tilt) {
    var pts = '0,0 9,0 4,13 12,13 -3,34 1,18 -6,18';
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + (tilt || 0) + ') scale(' + k + ')"><g class="av-flick" style="animation-delay:' + d + 's"><polygon points="' + pts + '" fill="#ffe65a" stroke="#b98a00" stroke-width="1" stroke-linejoin="round"/><polyline points="3,2 7,2 3.4,11" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/></g></g>';
  }
  // stars that circle the figure: five stars on a tilted ring; each has a "behind" and an "in front" copy, one of them visible
  var ORB_N = 5, ORB_STEPS = 24, ORB_RX = 46, ORB_RY = 13;
  function orbPos(deg) { var a = deg * Math.PI / 180; return { x: ORB_RX * Math.cos(a), y: ORB_RY * Math.sin(a), z: Math.sin(a) }; }
  function orbScale(z) { return (1 + 0.22 * z).toFixed(2); }
  function orbit() {
    var back = '<ellipse cx="0" cy="0" rx="' + ORB_RX + '" ry="' + ORB_RY + '" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="1.6" stroke-dasharray="1.6 3" stroke-linecap="round"/>', front = '', i, p, st;
    for (i = 0; i < ORB_N; i++) {
      p = orbPos(i * 360 / ORB_N + 20);
      st = star(0, 0, 5.8, '#ffe27a', '#b98a0c') + '<circle cx="-1.4" cy="-1.7" r="1.2" fill="#fff"/>';
      var tf = 'transform:translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px) scale(' + orbScale(p.z) + ');animation-delay:-' + (i * 7 / ORB_N).toFixed(2) + 's';
      back += '<g class="av-orbb" style="' + tf + ';opacity:' + (p.z > 0 ? 0 : 1) + '">' + st + '</g>';
      front += '<g class="av-orbf" style="' + tf + ';opacity:' + (p.z > 0 ? 1 : 0) + '">' + st + '</g>';
    }
    return { back: '<g transform="translate(50 66) rotate(-12)">' + back + '</g>', front: '<g transform="translate(50 66) rotate(-12)">' + front + '</g>' };
  }
  var ORB = orbit();
  function orbitCss() {
    var f = '', b = '', i, p, a, t;
    for (i = 0; i <= ORB_STEPS; i++) {
      a = i * 360 / ORB_STEPS; p = orbPos(a);
      t = 'transform:translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px) scale(' + orbScale(p.z) + ')';
      f += (i * 100 / ORB_STEPS).toFixed(2) + '%{' + t + ';opacity:' + (p.z > 0.02 ? 1 : 0) + '}';
      b += (i * 100 / ORB_STEPS).toFixed(2) + '%{' + t + ';opacity:' + (p.z > 0.02 ? 0 : 1) + '}';
    }
    return '@keyframes av-orbf{' + f + '}@keyframes av-orbb{' + b + '}';
  }
  var RAINBOW = ['#ff3b3b', '#ff9a1c', '#ffe03a', '#3fd16b', '#2fa8ff', '#5a4fe0', '#b04fd8'];
  function arch() {
    var out = '', i, r;
    for (i = 0; i < RAINBOW.length; i++) { r = 63 - i * 4.6; out += '<path d="M' + (50 - r) + ' 112A' + r + ' ' + r + ' 0 0 1 ' + (50 + r) + ' 112" stroke="' + RAINBOW[i] + '" stroke-width="4.8" fill="none"/>'; }
    return out + '<path d="M-13 112A63 63 0 0 1 113 112" stroke="#fff" stroke-opacity=".35" stroke-width="1" fill="none" transform="translate(0 -2.6)"/>';
  }
  var FX = {
    'fx-sparkles': {
      back: '',
      front: spark(13, 30, 5.6, 0, '#fff6a8', '#c98a00') + spark(87, 22, 4.6, 0.6, '#ffffff', '#7aa6d6') + spark(9, 76, 4.6, 1.2, '#ffe27a', '#c98a00') + spark(91, 66, 6, 0.3, '#ff9be0', '#c4467f') +
        spark(26, 9, 3.8, 1.8, '#ffffff', '#7aa6d6') + spark(74, 8, 3.4, 0.9, '#bfe8ff', '#4a8ac0') + spark(93, 100, 4, 1.5, '#fff6a8', '#c98a00') + spark(8, 108, 3.4, 2.1, '#ffffff', '#7aa6d6') + spark(80, 44, 2.6, 2.4, '#ffffff', '#7aa6d6')
    },
    'fx-glow': {
      back: '<defs><radialGradient id="fxg@" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff8c4" stop-opacity="1"/><stop offset=".5" stop-color="#ffd75e" stop-opacity=".8"/><stop offset=".82" stop-color="#ff9be0" stop-opacity=".45"/><stop offset="1" stop-color="#ff9be0" stop-opacity="0"/></radialGradient></defs>' +
        '<g class="av-rays"><path d="M50 66L46 -8L54 -8zM50 66L112 28L116 36zM50 66L116 96L112 104zM50 66L56 130L44 130zM50 66L-12 96L-16 88zM50 66L-12 36L-16 28z" fill="#fff6b0" fill-opacity=".34"/></g>' +
        '<g class="av-pulse"><ellipse cx="50" cy="66" rx="52" ry="62" fill="url(#fxg@)"/><ellipse cx="50" cy="66" rx="40" ry="50" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.4"/></g>',
      front: spark(18, 44, 3.4, 0.2, '#fff', '#d7a620') + spark(84, 52, 3, 1.1, '#fff', '#d7a620') + spark(22, 96, 2.6, 1.7, '#fff', '#d7a620')
    },
    'fx-trail': {
      back: '<g stroke-linejoin="round">' + '<path d="M8 60V94M14 52V90M86 58V92M92 50V88" stroke="#fff" stroke-opacity=".7" stroke-width="1.5" stroke-linecap="round"/><path d="M18 70V98M82 68V96" stroke="#ffe27a" stroke-opacity=".85" stroke-width="1.4" stroke-linecap="round"/>' +
        '<g class="av-flame" style="animation-delay:-.1s"><path d="M14 88Q-4 110 10 130Q26 114 28 92z" fill="#ff7a1c" stroke="#b83a0a" stroke-width=".8"/><path d="M16 96Q6 112 13 126Q22 112 24 98z" fill="#ffe27a"/></g>' +
        '<g class="av-flame" style="animation-delay:-.2s"><path d="M86 88Q104 110 90 130Q74 114 72 92z" fill="#ff7a1c" stroke="#b83a0a" stroke-width=".8"/><path d="M84 96Q94 112 87 126Q78 112 76 98z" fill="#ffe27a"/></g>' +
        puff(6, 116, 6.4, 0) + puff(15, 108, 4.4, 0.8) + puff(94, 114, 6.4, 0.4) + puff(86, 106, 4.4, 1.2) + '</g>',
      front: ''
    },
    'fx-lightning': {
      back: '<defs><radialGradient id="fxl@" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9fd0ff" stop-opacity=".65"/><stop offset=".7" stop-color="#7a6bff" stop-opacity=".25"/><stop offset="1" stop-color="#7a6bff" stop-opacity="0"/></radialGradient></defs><g class="av-pulse"><ellipse cx="50" cy="64" rx="54" ry="62" fill="url(#fxl@)"/></g>',
      front: bolt(14, 18, 1.05, 0, -8) + bolt(80, 12, 0.95, -0.7, 10) + bolt(8, 64, 0.8, -1.3, -4) + bolt(88, 62, 0.8, -0.35, 6)
    },
    'fx-fire': {
      back: '<defs><radialGradient id="fxf@" cx=".5" cy=".6" r=".5"><stop offset="0" stop-color="#ffb347" stop-opacity=".5"/><stop offset="1" stop-color="#ff4a1c" stop-opacity="0"/></radialGradient></defs><ellipse cx="50" cy="70" rx="52" ry="58" fill="url(#fxf@)"/><g stroke-linejoin="round">' +
        tongue(8, 124, 56, 11, '#ff4a1c', '#ffd23f', 'av-fire', 0) + tongue(22, 124, 40, 9, '#ff7a1c', '#ffe27a', 'av-fire', -0.2) + tongue(92, 124, 58, 11, '#ff4a1c', '#ffd23f', 'av-fire', -0.4) + tongue(78, 124, 42, 9, '#ff7a1c', '#ffe27a', 'av-fire', -0.1) +
        tongue(14, 84, 30, 8, '#ff7a1c', '#ffe27a', 'av-fire', -0.3) + tongue(86, 84, 32, 8, '#ff7a1c', '#ffe27a', 'av-fire', -0.5) + '</g>',
      front: '<circle class="av-tw" style="animation-delay:.3s" cx="20" cy="40" r="1.6" fill="#ffd23f"/><circle class="av-tw" style="animation-delay:1.1s" cx="84" cy="30" r="1.4" fill="#ffb347"/><circle class="av-tw" style="animation-delay:1.9s" cx="10" cy="64" r="1.2" fill="#ffd23f"/><circle class="av-tw" style="animation-delay:.7s" cx="92" cy="58" r="1.6" fill="#ffd23f"/>'
    },
    'fx-rainbow': {
      back: '<g class="av-pulse">' + arch() + '</g><g fill="#fff" stroke="#c4d6ea" stroke-width=".8"><ellipse cx="6" cy="114" rx="13" ry="7"/><ellipse cx="94" cy="114" rx="13" ry="7"/><circle cx="12" cy="109" r="6"/><circle cx="88" cy="109" r="6"/></g>',
      front: spark(20, 40, 3.4, 0.2, '#fff6a8', '#c98a00') + spark(82, 36, 3, 1.1, '#fff', '#7aa6d6')
    },
    'fx-orbit': { back: ORB.back, front: ORB.front }
  };

  var uidCounter = 0;
  var NS = 'http://www.w3.org/2000/svg';
  function build(equipped) {
    var n = normalize(equipped), robotish = n.skin === 'skin-robot' || n.skin === 'skin-gold';
    var s = BG[n.bg] || BG['bg-sky'], fx = n.fx && FX[n.fx] ? FX[n.fx] : null;
    if (fx) s += '<g stroke-linejoin="round" stroke-linecap="round">' + fx.back + '</g>';
    s += '<g class="av-fig" stroke-linejoin="round" stroke-linecap="round">';
    if (n.back && BACK[n.back]) s += BACK[n.back];
    s += bodySvg(n.skin, n.hair, n.hat, n.outfit, n.haircolor) + faceSvg(n.face, robotish);
    if (n.hat && HAT[n.hat]) s += HAT[n.hat];
    if (n.gear && GEAR[n.gear]) s += GEAR[n.gear];
    s += '</g>';
    if (fx && fx.front) s += '<g stroke-linejoin="round" stroke-linecap="round">' + fx.front + '</g>';
    if (n.pet && PET[n.pet]) s += '<g stroke-linejoin="round" stroke-linecap="round">' + PET[n.pet] + '</g>';
    // add the gradients this drawing used, once each
    var seen = {}, defs = '';
    s.replace(/url\(#([gr])-([0-9a-f]{6})@\)/g, function (m, k, h) { if (!seen[k + h]) { seen[k + h] = 1; defs += k === 'g' ? lin('#' + h) : rad('#' + h); } return m; });
    Object.keys(DEFS).forEach(function (k) { if (s.indexOf('url(#' + k + '@)') >= 0) defs += DEFS[k]; });
    return ((defs ? '<defs>' + defs + '</defs>' : '') + s).replace(/@/g, String(++uidCounter));
  }
  // The text above is fixed (from the catalog tables), never from the database. It is turned into
  // SVG nodes with the XML parser, not with innerHTML.
  function nodesFor(markup) {
    var doc = new DOMParser().parseFromString('<svg xmlns="' + NS + '">' + markup + '</svg>', 'image/svg+xml');
    return doc.documentElement;
  }

  // ── motion (only when a page asks for it, for the one big avatar): a gentle bob, a blink now and then,
  //    pets that wag or twitch, a shimmer on rare things. CSS only: the browser runs it on the GPU, nothing
  //    ticks in JavaScript, and nothing moves layout. Off for prefers-reduced-motion. ──
  var ANIM_CSS = '@media (prefers-reduced-motion:no-preference){' +
    '.av-anim .av-fig{animation:av-bob 4.2s ease-in-out infinite}' +
    '.av-anim .av-pet{animation:av-hop 4.2s ease-in-out infinite .5s}' +
    '.av-anim .av-eyes{transform-box:fill-box;transform-origin:50% 50%;animation:av-blink 5.4s infinite}' +
    '.av-anim .av-tail{transform-box:fill-box;transform-origin:0 100%;animation:av-wag 3.6s ease-in-out infinite}' +
    '.av-anim .av-tail.av-slow{animation:av-sway 3.2s ease-in-out infinite}' +
    '.av-anim .av-ear{transform-box:fill-box;transform-origin:50% 100%;animation:av-twitch 6.5s infinite 1.2s}' +
    '.av-anim .av-tw{transform-box:fill-box;transform-origin:50% 50%;animation:av-tw 2.6s ease-in-out infinite}' +
    '.av-anim .av-sweep{animation:av-sweep 4.6s ease-in-out infinite}' +
    '.av-anim .av-flame{transform-box:fill-box;transform-origin:50% 0;animation:av-flame .32s ease-in-out infinite alternate}' +
    '.av-anim .av-wl,.av-anim .av-wr{transform-box:fill-box;animation:av-flap 3.4s ease-in-out infinite}' +
    '.av-anim .av-wl{transform-origin:100% 100%}.av-anim .av-wr{transform-origin:0 100%;animation-name:av-flapr}' +
    '.av-anim .av-cape{transform-box:fill-box;transform-origin:50% 0;animation:av-cape 3.8s ease-in-out infinite}' +
    '.av-anim .av-antl,.av-anim .av-antr{transform-box:fill-box;transform-origin:50% 100%;animation:av-ant 2.8s ease-in-out infinite}.av-anim .av-antr{animation-delay:-1.4s}' +
    '.av-anim .av-prop{transform-box:fill-box;transform-origin:50% 50%;animation:av-prop .9s ease-in-out infinite alternate}' +
    '.av-anim .av-pulse{transform-box:fill-box;transform-origin:50% 50%;animation:av-pulse 4.4s ease-in-out infinite}' +
    '@keyframes av-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(1.3px)}}' +
    '@keyframes av-hop{0%,86%,100%{transform:translateY(0)}92%{transform:translateY(-1.6px)}}' +
    '@keyframes av-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}' +
    '@keyframes av-wag{0%,40%,100%{transform:rotate(0)}8%{transform:rotate(16deg)}16%{transform:rotate(-8deg)}24%{transform:rotate(16deg)}32%{transform:rotate(-8deg)}}' +
    '@keyframes av-sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(9deg)}}' +
    '@keyframes av-twitch{0%,88%,100%{transform:rotate(0)}91%{transform:rotate(-12deg)}94%{transform:rotate(3deg)}97%{transform:rotate(-8deg)}}' +
    '@keyframes av-tw{0%,100%{opacity:.1;transform:scale(.3)}50%{opacity:1;transform:scale(1)}}' +
    '@keyframes av-sweep{0%,55%{transform:translateX(-60px)}100%{transform:translateX(110px)}}' +
    '@keyframes av-flame{from{transform:scaleY(.82)}to{transform:scaleY(1.18)}}' +
    '@keyframes av-flap{0%,100%{transform:rotate(0)}50%{transform:rotate(-5deg)}}@keyframes av-flapr{0%,100%{transform:rotate(0)}50%{transform:rotate(5deg)}}' +
    '@keyframes av-cape{0%,100%{transform:skewX(0)}50%{transform:skewX(2.5deg)}}' +
    '@keyframes av-ant{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}' +
    '@keyframes av-prop{from{transform:scaleX(1)}to{transform:scaleX(.2)}}' +
    '.av-anim .av-fire{transform-box:fill-box;transform-origin:50% 100%;animation:av-fire .7s ease-in-out infinite alternate}' +
    '.av-anim .av-flick{animation:av-flick 2.6s infinite}' +
    '.av-anim .av-puff{transform-box:fill-box;transform-origin:50% 50%;animation:av-puff 2.4s ease-out infinite}' +
    '.av-anim .av-rays{transform-box:view-box;transform-origin:50px 66px;animation:av-spin 30s linear infinite}' +
    '.av-anim .av-orbf{animation:av-orbf 7s linear infinite}.av-anim .av-orbb{animation:av-orbb 7s linear infinite}' +
    '@keyframes av-pulse{0%,100%{transform:scale(.97);opacity:.85}50%{transform:scale(1.04);opacity:1}}' +
    '@keyframes av-fire{from{transform:scale(.92,.86) skewX(-3deg)}to{transform:scale(1.06,1.14) skewX(3deg)}}' +
    '@keyframes av-flick{0%,66%,100%{opacity:1}69%{opacity:.15}72%{opacity:1}76%{opacity:.35}80%{opacity:1}}' +
    '@keyframes av-puff{0%{opacity:.95;transform:translateY(0) scale(.8)}100%{opacity:0;transform:translateY(-9px) scale(1.35)}}' +
    '@keyframes av-spin{to{transform:rotate(360deg)}}' + orbitCss() + '}';
  var cssAdded = false;
  function addCss() {
    if (cssAdded) return;
    cssAdded = true;
    try { var st = document.createElement('style'); st.setAttribute('data-avatar-motion', ''); st.textContent = ANIM_CSS; (document.head || document.documentElement).appendChild(st); } catch (e) { /* no motion, still fine */ }
  }
  function calm() { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }

  // label: undefined = spoken description, a string = that text, false = decorative (hidden from screen readers)
  // animate: true = the idle motion above (leave it off for lists and boards)
  function render(el, equipped, size, label, animate) {
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
    if (animate === true && !calm()) { addCss(); svg.setAttribute('class', 'av-anim'); }
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
  function attach(el, uid, size, animate) {
    try {
      render(el, null, size, false, animate);
      if (!validUid(uid)) return;
      request(uid, function (eq) { if (eq) { try { render(el, eq, size, false, animate); } catch (e) { /* keep the default */ } } });
    } catch (e) { /* the page goes on without a picture */ }
  }
  function remember(uid, equipped) { if (validUid(uid)) cache[uid] = { at: Date.now(), eq: equipped ? normalize(equipped, true) : null }; }

  window.Avatar = {
    SLOTS: SLOTS, SLOT_LABEL: SLOT_LABEL, SLOT_ICON: SLOT_ICON, NONE_LABEL: NONE_LABEL,
    ITEMS: ITEMS, PRICES: PRICES, DEFAULTS: DEFAULTS, itemOf: itemOf, priceOf: priceOf,
    normalize: normalize, forSave: forSave, describe: describe, render: render, attach: attach, load: load, remember: remember
  };
})();
