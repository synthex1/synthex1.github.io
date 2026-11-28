/* Fathom — species data.
   Lengths and weights are approximate maximum recorded sizes (cm / kg).
   For rays the "length" is total length, except the manta (wingspan). */
(function () {
  const AREAS = [
    { id: 'pond',  name: 'Pond',       water: 'fresh', need: 0, cost: 0,    mult: 1,
      blurb: 'Still, weedy water. A gentle place to learn the ropes.',
      sky: ['#bfe3f2', '#eaf6ea'], sea: ['#4f9a7a', '#1d5244'] },
    { id: 'river', name: 'River',      water: 'fresh', need: 5, cost: 100,  mult: 1.5,
      blurb: 'Fast, cold currents full of trout, salmon and stranger things.',
      sky: ['#a9d8ee', '#e6f3f0'], sea: ['#4a93a8', '#1b4d61'] },
    { id: 'lake',  name: 'Lake',       water: 'fresh', need: 6, cost: 300,  mult: 2.2,
      blurb: 'Wide, deep water where the real freshwater giants live.',
      sky: ['#9fc9ea', '#dfeef5'], sea: ['#3f7fa6', '#173f5f'] },
    { id: 'coast', name: 'Coast',      water: 'salt',  need: 6, cost: 700,  mult: 3.2,
      blurb: 'Piers, estuaries and surf. Salt water at last.',
      sky: ['#f4c9a0', '#fbe9cf'], sea: ['#3d8f9c', '#16475a'] },
    { id: 'reef',  name: 'Reef',       water: 'salt',  need: 7, cost: 1500, mult: 4.5,
      blurb: 'Warm, bright shallows crowded with colour.',
      sky: ['#8fdcf0', '#e3f8f4'], sea: ['#2bb5b0', '#0f5f77'] },
    { id: 'ocean', name: 'Open Ocean', water: 'salt',  need: 7, cost: 3000, mult: 6.5,
      blurb: 'Blue water, far from land. Everything out here is fast or enormous.',
      sky: ['#6fb3e6', '#cfe6f6'], sea: ['#1f66b0', '#0a2a5c'] },
    { id: 'deep',  name: 'Deep Sea',   water: 'salt',  need: 7, cost: 6000, mult: 9,
      blurb: 'A very long line into the dark.',
      sky: ['#0d1a33', '#1f2f55'], sea: ['#12264d', '#03060f'] },
    /* Expeditions: opened by how full the whole journal is, not by the area before. */
    { id: 'mangrove', name: 'Mangrove', water: 'salt', needTotal: 40, cost: 4000, mult: 10,
      blurb: 'Warm, muddy channels under a tangle of roots, where rivers meet the sea.',
      sky: ['#bfe0c8', '#f1f0c8'], sea: ['#6f8f5a', '#2a3f2a'] },
    { id: 'kelp', name: 'Kelp Forest', water: 'salt', needTotal: 60, cost: 8000, mult: 11,
      blurb: 'Cold Pacific water and towering kelp, full of things that hide.',
      sky: ['#9fc4d6', '#e6eef0'], sea: ['#2f7a6f', '#0f3a3a'] },
    { id: 'polar', name: 'Polar Ice', water: 'salt', needTotal: 80, cost: 15000, mult: 12,
      blurb: 'Open leads between the floes, at both ends of the Earth.',
      sky: ['#0f2347', '#5f8fb0'], sea: ['#3f7fa0', '#0a2540'] }
  ];

  const REGIONS = {
    NA: ['N.Am', 'North America'], SA: ['S.Am', 'South America'], EU: ['Eur', 'Europe'],
    AS: ['Asia', 'Asia'], AF: ['Afr', 'Africa'], OC: ['Oce', 'Oceania'],
    ATL: ['Atl', 'Atlantic Ocean'], PAC: ['Pac', 'Pacific Ocean'], IND: ['Ind', 'Indian Ocean'],
    ARC: ['Arc', 'Arctic Ocean'], SOU: ['Sou', 'Southern Ocean']
  };

  const DIETS = {
    fish: 'Fish-eater', inv: 'Invertebrates', omni: 'Omnivore',
    plant: 'Plants & algae', plank: 'Plankton'
  };

  const RARITY = {
    common:    { name: 'Common',    weight: 58, coins: 8,   diff: 1.0 },
    uncommon:  { name: 'Uncommon',  weight: 28, coins: 20,  diff: 1.25 },
    rare:      { name: 'Rare',      weight: 11, coins: 50,  diff: 1.55 },
    legendary: { name: 'Legendary', weight: 3,  coins: 150, diff: 1.9 }
  };

  const ALL = ['ATL', 'IND', 'PAC'];
  const FISH = [];
  function F(id, name, sci, group, area, range, diet, len, kg, rarity, clue, art) {
    FISH.push({ id, name, sci, group, area, range, diet, len, kg, rarity, clue, art });
  }

  /* ---------------- Pond ---------------- */
  F('bluegill', 'Bluegill', 'Lepomis macrochirus', 'Sunfish & bass', 'pond', ['NA'], 'inv', 41, 2.2, 'common',
    'Males scoop out saucer-shaped nests packed side by side in colonies of dozens.',
    { s: 'deep', c: '#5f7f4a', b: '#e2a23c', f: '#4b6740', p: 'bars', pc: '#2e4630', x: { marks: [[0.2, -6, 3.4, '#16202b']] } });
  F('goldfish', 'Goldfish', 'Carassius auratus', 'Carp & minnows', 'pond', ['AS'], 'omni', 48, 3, 'common',
    'Bred in China over a thousand years ago from a dull olive-brown wild ancestor.',
    { s: 'classic', c: '#f08a1d', b: '#ffd27a', f: '#f6a23a', x: { h: 28, b: 27, th: 27, dorsal: 'long' } });
  F('carp', 'Common carp', 'Cyprinus carpio', 'Carp & minnows', 'pond', ['EU', 'AS'], 'omni', 120, 45, 'uncommon',
    'Has two pairs of barbels at its mouth and has been farmed since Roman times.',
    { s: 'classic', c: '#a9843d', b: '#ecd9a0', f: '#8a6a30', x: { h: 28, b: 26, dorsal: 'long', barbels: 1 } });
  F('largemouth', 'Largemouth bass', 'Micropterus salmoides', 'Sunfish & bass', 'pond', ['NA'], 'fish', 97, 10, 'uncommon',
    'Its upper jaw reaches back beyond its eye, and the world record has stood since 1932.',
    { s: 'classic', c: '#5f8a3c', b: '#eef0d2', f: '#4d7133', p: 'stripe', pc: '#23381c' });
  F('yellowperch', 'Yellow perch', 'Perca flavescens', 'Perch', 'pond', ['NA'], 'inv', 50, 1.9, 'common',
    'Lays its eggs in long jelly-like ribbons draped over water weeds.',
    { s: 'classic', c: '#d8b53a', b: '#f6edc0', f: '#e0782a', p: 'bars', pc: '#3c4a1e', x: { h: 23, b: 22 } });
  F('tench', 'Tench', 'Tinca tinca', 'Carp & minnows', 'pond', ['EU', 'AS'], 'omni', 70, 7.5, 'uncommon',
    'Nicknamed the "doctor fish" from an old belief that its slime healed other fish.',
    { s: 'classic', c: '#5b6e2c', b: '#c9b560', f: '#46551f', x: { tail: 'fan', dorsal: 'one', eyeC: '#d8452f' } });
  F('bullhead', 'Brown bullhead', 'Ameiurus nebulosus', 'Catfish', 'pond', ['NA'], 'omni', 55, 3, 'common',
    'Both parents guard the young, shepherding them around in a tight black ball.',
    { s: 'catfish', c: '#6b5334', b: '#e3d3a2', f: '#58432a', p: 'mottle', pc: '#453420' });
  F('pumpkinseed', 'Pumpkinseed', 'Lepomis gibbosus', 'Sunfish & bass', 'pond', ['NA'], 'inv', 40, 0.6, 'common',
    'Special throat teeth let it crush snails, and it wears a red-edged "ear" flap.',
    { s: 'deep', c: '#c98a2e', b: '#f0b23a', f: '#5f8f7f', p: 'spots', pc: '#2f8f9a', x: { marks: [[0.2, -6, 3.2, '#d23a2a']] } });
  F('grasscarp', 'Grass carp', 'Ctenopharyngodon idella', 'Carp & minnows', 'pond', ['AS'], 'plant', 150, 45, 'rare',
    'Stocked around the world as a living lawnmower for weed-choked waterways.',
    { s: 'torpedo', c: '#8b9463', b: '#eef0dc', f: '#6f774e', x: { h: 21, b: 20 } });
  F('crappie', 'Black crappie', 'Pomoxis nigromaculatus', 'Sunfish & bass', 'pond', ['NA'], 'fish', 49, 2.7, 'uncommon',
    'Nicknamed "papermouth" because its thin lips tear so easily on the hook.',
    { s: 'deep', c: '#b9c2b4', b: '#f2f4ee', f: '#7c8a7a', p: 'mottle', pc: '#2a332c', x: { h: 34, b: 32 } });
  F('rudd', 'Rudd', 'Scardinius erythrophthalmus', 'Carp & minnows', 'pond', ['EU', 'AS'], 'omni', 51, 2.1, 'common',
    'Its upturned mouth is built for sipping insects off the surface, and its fins are blood red.',
    { s: 'classic', c: '#d0a93c', b: '#f4e6b0', f: '#d5412b', x: { dorsal: 'one' } });
  F('bowfin', 'Bowfin', 'Amia calva', 'Ancient lineages', 'pond', ['NA'], 'fish', 109, 9.8, 'legendary',
    'A survivor of a lineage from the age of dinosaurs that gulps air to live in stagnant water.',
    { s: 'long', c: '#5d6b3f', b: '#d8d5a0', f: '#4c5a34', p: 'mottle', pc: '#39452a', x: { h: 16, b: 15, nx: 20, dorsal: 'ridge', tail: 'fan', marks: [[0.97, -5, 3, '#111', '#e0a83a']] } });

  /* ---------------- River ---------------- */
  F('rainbow', 'Rainbow trout', 'Oncorhynchus mykiss', 'Salmon & trout', 'river', ['NA', 'AS', 'PAC'], 'inv', 122, 25, 'common',
    'Individuals that migrate out to sea go by a different name: steelhead.',
    { s: 'torpedo', c: '#7a8f6a', b: '#f1ede2', f: '#6c7f5e', p: 'spots', pc: '#262b26', x: { stripe: '#e0708a', adipose: true } });
  F('brown', 'Brown trout', 'Salmo trutta', 'Salmon & trout', 'river', ['EU', 'AS', 'ATL'], 'fish', 140, 20, 'common',
    'Shipped around the world as eggs in the 1800s, it now lives on every continent except Antarctica.',
    { s: 'torpedo', c: '#9a7a3a', b: '#f0dfa6', f: '#86672f', p: 'spots', pc: '#3a2414', x: { adipose: true, tail: 'fan', h: 20 } });
  F('atlsalmon', 'Atlantic salmon', 'Salmo salar', 'Salmon & trout', 'river', ['EU', 'NA', 'ATL'], 'fish', 150, 46.8, 'rare',
    'Unlike its Pacific cousins, it can survive spawning and head back to sea to do it all again.',
    { s: 'torpedo', c: '#8e9aa6', b: '#f4f6f8', f: '#6f7a86', p: 'spots', pc: '#2b3138', x: { n: 16, adipose: true } });
  F('chinook', 'Chinook salmon', 'Oncorhynchus tshawytscha', 'Salmon & trout', 'river', ['NA', 'AS', 'PAC'], 'fish', 150, 61, 'rare',
    'The largest of its genus, nicknamed "king"; some swim more than 3,000 km upriver to spawn.',
    { s: 'torpedo', c: '#5f7f86', b: '#e9eef0', f: '#4c666c', p: 'spots', pc: '#1f2a2e', x: { h: 22, b: 21, adipose: true } });
  F('pike', 'Northern pike', 'Esox lucius', 'Pike', 'river', ['NA', 'EU', 'AS'], 'fish', 150, 28, 'uncommon',
    'An ambush hunter found right around the Northern Hemisphere, with a duck-bill snout and hundreds of backward-pointing teeth.',
    { s: 'long', c: '#5c7a3e', b: '#e9e7c4', f: '#b06a2e', p: 'bigspots', pc: '#dfe3a6' });
  F('smallmouth', 'Smallmouth bass', 'Micropterus dolomieu', 'Sunfish & bass', 'river', ['NA'], 'fish', 69, 5.4, 'common',
    'Anglers call it "bronzeback" and rate it, pound for pound, among the hardest fighters in fresh water.',
    { s: 'classic', c: '#9a7b3e', b: '#e6dcb0', f: '#7d6332', p: 'bars', pc: '#5a4520', x: { eyeC: '#c8432e' } });
  F('channelcat', 'Channel catfish', 'Ictalurus punctatus', 'Catfish', 'river', ['NA'], 'omni', 132, 26, 'common',
    'Its whole body is covered in taste buds, making it effectively a swimming tongue.',
    { s: 'catfish', c: '#7f8c92', b: '#eef0ee', f: '#66737a', p: 'spots', pc: '#2d3438', x: { tail: 'fork', n: 14 } });
  F('eueel', 'European eel', 'Anguilla anguilla', 'Eels', 'river', ['EU', 'AF', 'ATL'], 'inv', 133, 6.6, 'uncommon',
    'Born in the Sargasso Sea, it drifts thousands of kilometres to grow up in rivers, and nobody has ever watched it spawn in the wild.',
    { s: 'eel', c: '#5f6a3a', b: '#d9d7a0', f: '#4b552e' });
  F('wels', 'Wels catfish', 'Silurus glanis', 'Catfish', 'river', ['EU', 'AS'], 'fish', 300, 150, 'rare',
    'Europe\'s biggest freshwater fish; some have learned to lunge onto riverbanks to grab pigeons.',
    { s: 'catfish', c: '#55603f', b: '#dcd9b0', f: '#454f33', p: 'mottle', pc: '#343c26', x: { nx: 14, px: 196, h: 15, b: 17, dorsal: 'tiny', anal: 'long', th: 12 } });
  F('grayling', 'Grayling', 'Thymallus thymallus', 'Salmon & trout', 'river', ['EU'], 'inv', 60, 6.7, 'uncommon',
    'Called the "lady of the stream" for its huge sail-like dorsal fin, and said to smell faintly of thyme.',
    { s: 'torpedo', c: '#8f9aa8', b: '#eef1f4', f: '#a0527a', p: 'spots', pc: '#2d3238', x: { n: 10, dorsal: 'sailsmall', adipose: true } });
  F('piranha', 'Red-bellied piranha', 'Pygocentrus nattereri', 'Characins', 'river', ['SA'], 'omni', 50, 3.9, 'uncommon',
    'Its fearsome reputation is mostly myth: it scavenges more than it hunts, and it "barks" when handled.',
    { s: 'deep', c: '#8d97a0', b: '#d43a2a', f: '#8f2a25', p: 'spots', pc: '#4b5560', x: { h: 34, b: 36, blunt: true, teeth: true } });
  F('electriceel', 'Electric eel', 'Electrophorus electricus', 'Knifefish', 'river', ['SA'], 'fish', 250, 20, 'rare',
    'Not a true eel at all. It breathes air and can deliver shocks of several hundred volts.',
    { s: 'eel', c: '#4e4a3e', b: '#d98a3a', f: '#3d3a30', x: { A: 7, W: 10.5, under: true } });
  F('arapaima', 'Arapaima', 'Arapaima gigas', 'Ancient lineages', 'river', ['SA'], 'fish', 300, 200, 'legendary',
    'An air-breather that must surface every 10 to 20 minutes, with scales tough enough to shrug off piranha bites.',
    { s: 'long', c: '#4f6b5a', b: '#c9d4c0', f: '#b33a2e', p: 'rearspots', pc: '#c8412f', x: { h: 16, b: 15, nx: 18, tail: 'fan' } });

  /* ---------------- Lake ---------------- */
  F('walleye', 'Walleye', 'Sander vitreus', 'Perch', 'lake', ['NA'], 'fish', 107, 11.3, 'common',
    'A reflective layer in its eyes lets it hunt at dusk, when its prey can barely see.',
    { s: 'classic', c: '#8a7f3e', b: '#f1ecd0', f: '#766c35', p: 'mottle', pc: '#4a431f', x: { h: 21, b: 20, eye: 5.2, eyeC: '#dfe8ee' } });
  F('laketrout', 'Lake trout', 'Salvelinus namaycush', 'Salmon & trout', 'lake', ['NA'], 'fish', 150, 33, 'uncommon',
    'A char rather than a true trout, it can live for more than 50 years in cold, deep water.',
    { s: 'torpedo', c: '#56685a', b: '#e8e6d2', f: '#4a5a4d', p: 'spots', pc: '#dadec4', x: { adipose: true, h: 21 } });
  F('lakesturgeon', 'Lake sturgeon', 'Acipenser fulvescens', 'Ancient lineages', 'lake', ['NA'], 'inv', 274, 125, 'rare',
    'Armoured with rows of bony plates instead of scales, it can live for more than a century.',
    { s: 'sturgeon', c: '#6f6a55', b: '#e2dcc0', f: '#5a5645' });
  F('muskie', 'Muskellunge', 'Esox masquinongy', 'Pike', 'lake', ['NA'], 'fish', 183, 32, 'rare',
    'Known to anglers as "the fish of ten thousand casts".',
    { s: 'long', c: '#7a8a52', b: '#ecebd0', f: '#9a5a2c', p: 'bars', pc: '#3f4a2a', x: { n: 9 } });
  F('euperch', 'European perch', 'Perca fluviatilis', 'Perch', 'lake', ['EU', 'AS'], 'fish', 60, 4.8, 'common',
    'Green with black tiger stripes and orange fins; the young hunt in packs.',
    { s: 'classic', c: '#7c8f3a', b: '#f0efd0', f: '#e0612a', p: 'bars', pc: '#1f2a18', x: { h: 27, b: 23 } });
  F('nileperch', 'Nile perch', 'Lates niloticus', 'Snook & barramundi', 'lake', ['AF'], 'fish', 200, 200, 'rare',
    'Released into Lake Victoria in the 1950s, it drove hundreds of native cichlid species toward extinction.',
    { s: 'classic', c: '#8d959b', b: '#f2f4f4', f: '#70787e', x: { h: 29, b: 25, tail: 'fan' } });
  F('tilapia', 'Nile tilapia', 'Oreochromis niloticus', 'Cichlids', 'lake', ['AF'], 'plant', 60, 4.3, 'common',
    'Mothers carry their eggs and fry in their mouths; today it is one of the most farmed fish on Earth.',
    { s: 'deep', c: '#8a8f83', b: '#e7e3d6', f: '#70756a', p: 'bars', pc: '#50554c', x: { h: 32, b: 29 } });
  F('peacock', 'Butterfly peacock bass', 'Cichla ocellaris', 'Cichlids', 'lake', ['SA'], 'fish', 74, 6.8, 'uncommon',
    'Wears a gold-ringed false "eye" on its tail to confuse attackers.',
    { s: 'classic', c: '#b9a23a', b: '#f2c23a', f: '#5a7a3a', p: 'bars', pc: '#1b1f16', x: { n: 3, tail: 'fan', marks: [[0.96, -3, 3.4, '#111', '#f6d54a']] } });
  F('gar', 'Alligator gar', 'Atractosteus spatula', 'Ancient lineages', 'lake', ['NA'], 'fish', 305, 148, 'legendary',
    'Its diamond-shaped scales are so hard that people once used them as arrowheads.',
    { s: 'long', c: '#6a6f4c', b: '#e3e0c2', f: '#585c3e', p: 'rearspots', pc: '#2b2e20', x: { nx: 40, snout: 'gar', tail: 'fan', h: 13, b: 13 } });
  F('zander', 'Zander', 'Sander lucioperca', 'Perch', 'lake', ['EU', 'AS'], 'fish', 100, 20, 'uncommon',
    'Fang-toothed and glassy-eyed, it thrives in murky water where other predators struggle to see.',
    { s: 'classic', c: '#7f8a5c', b: '#eef0e0', f: '#6a744d', p: 'bars', pc: '#3a4228', x: { h: 20, b: 19, n: 8, eyeC: '#dfe8ee' } });
  F('roach', 'Roach', 'Rutilus rutilus', 'Carp & minnows', 'lake', ['EU', 'AS'], 'omni', 50, 1.8, 'common',
    'A silver shoaling fish with a red eye, and the bread-and-butter catch of European match anglers.',
    { s: 'classic', c: '#a9b4bd', b: '#f3f5f6', f: '#d0553a', x: { dorsal: 'one', eyeC: '#d8452f' } });
  F('paddlefish', 'American paddlefish', 'Polyodon spathula', 'Ancient lineages', 'lake', ['NA'], 'plank', 221, 91, 'rare',
    'Its long, flat snout is covered in electroreceptors that pick up swarms of plankton.',
    { s: 'sturgeon', c: '#6f7a86', b: '#e6eaee', f: '#5b6570', x: { nx: 62, snout: 'paddle', scutes: false, barbels: 0, h: 14, b: 13 } });
  F('burbot', 'Burbot', 'Lota lota', 'Cod & kin', 'lake', ['NA', 'EU', 'AS'], 'fish', 152, 34, 'uncommon',
    'The only member of its family that lives entirely in fresh water. It spawns under the ice in midwinter.',
    { s: 'long', c: '#6b5e3a', b: '#e6ddb5', f: '#574c2f', p: 'mottle', pc: '#3b3320', x: { nx: 20, h: 15, b: 16, dorsal: 'ridge', anal: 'long', tail: 'fan', barbels: 1 } });

  /* ---------------- Coast ---------------- */
  F('mackerel', 'Atlantic mackerel', 'Scomber scombrus', 'Tuna & mackerel', 'coast', ['ATL'], 'plank', 60, 3.4, 'common',
    'It has no swim bladder, so it must keep swimming or sink.',
    { s: 'tuna', c: '#2f8f8a', b: '#f1f5f5', f: '#3b5560', p: 'backbars', pc: '#12333a', x: { h: 17, b: 16, th: 22 } });
  F('eubass', 'European sea bass', 'Dicentrarchus labrax', 'Temperate bass', 'coast', ['ATL'], 'fish', 103, 12, 'uncommon',
    'Sold on restaurant menus as "branzino" or "loup de mer".',
    { s: 'classic', c: '#8d9aa5', b: '#f4f6f7', f: '#6f7b85', x: { h: 22, b: 21 } });
  F('striper', 'Striped bass', 'Morone saxatilis', 'Temperate bass', 'coast', ['NA', 'ATL'], 'fish', 200, 57, 'rare',
    'It runs up rivers to spawn, and its eggs must drift in the current for days or they sink and die.',
    { s: 'classic', c: '#9aa5ad', b: '#f6f7f8', f: '#76828a', p: 'hstripes', pc: '#1f262b' });
  F('plaice', 'European plaice', 'Pleuronectes platessa', 'Flatfish', 'coast', ['ATL'], 'inv', 100, 7, 'common',
    'Born upright like any other fish. Then one eye migrates across its head.',
    { s: 'flat', c: '#7b6a45', f: '#8f7c52', p: 'spots', pc: '#e8702a' });
  F('cod', 'Atlantic cod', 'Gadus morhua', 'Cod & kin', 'coast', ['ATL', 'ARC'], 'fish', 200, 96, 'uncommon',
    'Once so plentiful it built economies and started wars. A single female can release millions of eggs.',
    { s: 'classic', c: '#8a8355', b: '#eeeada', f: '#746d45', p: 'spots', pc: '#5a4f2a', x: { h: 22, b: 23, dorsal: 'three', tail: 'fan', barbels: 1, th: 16 } });
  F('barramundi', 'Barramundi', 'Lates calcarifer', 'Snook & barramundi', 'coast', ['AS', 'OC', 'IND', 'PAC'], 'fish', 200, 60, 'rare',
    'Most start life as males and turn female after a few years.',
    { s: 'classic', c: '#9aa2a0', b: '#f3f4f0', f: '#77807d', x: { h: 28, b: 24, tail: 'fan', eyeC: '#e8a0a0' } });
  F('mullet', 'Flathead grey mullet', 'Mugil cephalus', 'Mullet', 'coast', ALL, 'plant', 100, 12, 'common',
    'Leaps clear of the water for reasons scientists still argue about, and grinds its food in a gizzard-like stomach.',
    { s: 'torpedo', c: '#8c97a0', b: '#f2f4f5', f: '#6d7881', p: 'hstripes', pc: '#5f6a73', x: { blunt: true } });
  F('tarpon', 'Tarpon', 'Megalops atlanticus', 'Tarpon & bonefish', 'coast', ['ATL'], 'fish', 250, 161, 'legendary',
    'The "silver king". It gulps air at the surface and wears scales as wide as your palm.',
    { s: 'classic', c: '#b8c4cc', b: '#f7f9fa', f: '#6d7a84', x: { h: 24, b: 25, th: 28, dorsal: 'one', nose: -4 } });
  F('bonefish', 'Bonefish', 'Albula vulpes', 'Tarpon & bonefish', 'coast', ['ATL'], 'inv', 104, 10, 'uncommon',
    'The "grey ghost of the flats", famous for blistering runs across ankle-deep water.',
    { s: 'torpedo', c: '#b9c3c4', b: '#f6f8f8', f: '#8a9596', p: 'hstripes', pc: '#97a2a3', x: { nose: 3 } });
  F('catshark', 'Small-spotted catshark', 'Scyliorhinus canicula', 'Sharks', 'coast', ['ATL'], 'inv', 100, 2, 'common',
    'Its leathery egg cases wash up on beaches as "mermaid\'s purses".',
    { s: 'shark', c: '#b59a6a', b: '#f0e6cc', f: '#9d8358', p: 'spots', pc: '#5a4326', x: { h: 13, b: 11, dorsal: 'sharkback' } });
  F('thornback', 'Thornback ray', 'Raja clavata', 'Rays & skates', 'coast', ['ATL'], 'inv', 130, 18, 'uncommon',
    'Its back and tail are studded with thorn-like spines called bucklers.',
    { s: 'ray', c: '#8a7650', p: 'spots', pc: '#e7dcae' });
  F('herring', 'Atlantic herring', 'Clupea harengus', 'Herring & kin', 'coast', ['ATL'], 'plank', 45, 1.1, 'common',
    'Its schools can number in the billions, and members keep in touch by releasing streams of bubbles.',
    { s: 'torpedo', c: '#5f7f9a', b: '#f3f6f8', f: '#55697a', x: { h: 16, b: 17 } });
  F('snook', 'Common snook', 'Centropomus undecimalis', 'Snook & barramundi', 'coast', ['ATL'], 'fish', 140, 24, 'uncommon',
    'A black racing stripe runs down its side, and its razor-edged gill plates can slice fishing line.',
    { s: 'classic', c: '#a7a88a', b: '#f4f3e6', f: '#c9b33a', p: 'stripe', pc: '#15181a', x: { h: 20, b: 19, nose: 3 } });

  /* ---------------- Reef ---------------- */
  F('clownfish', 'Ocellaris clownfish', 'Amphiprion ocellaris', 'Damselfish', 'reef', ['IND', 'PAC'], 'omni', 11, 0.02, 'common',
    'Lives among stinging anemone tentacles. If the dominant female dies, the top male changes sex to replace her.',
    { s: 'classic', c: '#f07a1a', b: '#f6932e', f: '#f07a1a', p: 'bands', pc: '#ffffff', x: { h: 27, b: 27, tail: 'fan', dorsal: 'long', blunt: true } });
  F('bluetang', 'Blue tang', 'Paracanthurus hepatus', 'Surgeonfish', 'reef', ['IND', 'PAC'], 'omni', 31, 0.6, 'common',
    'Carries a scalpel-sharp spine at the base of its tail and "plays dead" when stressed.',
    { s: 'deep', c: '#2456d8', b: '#2e62e0', f: '#16245e', p: 'palette', pc: '#0e1738', x: { h: 32, b: 30, tailC: '#f5d21f' } });
  F('humphead', 'Humphead wrasse', 'Cheilinus undulatus', 'Wrasse & parrotfish', 'reef', ['IND', 'PAC'], 'inv', 229, 191, 'legendary',
    'One of the few predators of the crown-of-thorns starfish. It can live for 30 years and change from female to male.',
    { s: 'classic', c: '#3f8f8a', b: '#7fc0a8', f: '#2f7570', p: 'mottle', pc: '#2a6f7a', x: { h: 36, b: 30, hump: true, tail: 'fan', dorsal: 'long' } });
  F('parrotfish', 'Stoplight parrotfish', 'Sparisoma viride', 'Wrasse & parrotfish', 'reef', ['ATL'], 'plant', 64, 1.6, 'common',
    'Bites off chunks of rock with a beak of fused teeth and passes it out as white sand.',
    { s: 'classic', c: '#2fa79a', b: '#f07a5a', f: '#e8c93a', x: { h: 28, b: 27, dorsal: 'long', blunt: true } });
  F('goliath', 'Goliath grouper', 'Epinephelus itajara', 'Groupers', 'reef', ['ATL'], 'fish', 250, 455, 'rare',
    'Makes a boom you can feel in your chest, and swallows prey whole in a single gulp.',
    { s: 'classic', c: '#7d6f45', b: '#cbbf90', f: '#6a5d39', p: 'mottle', pc: '#3f361e', x: { h: 32, b: 31, tail: 'fan', dorsal: 'long', blunt: true } });
  F('coraltrout', 'Leopard coral grouper', 'Plectropomus leopardus', 'Groupers', 'reef', ['PAC'], 'fish', 120, 23.6, 'uncommon',
    'Has been filmed doing a headstand to point out hidden prey to octopuses and moray eels.',
    { s: 'classic', c: '#d9482e', b: '#f2a08a', f: '#c23d27', p: 'spots', pc: '#49b4f0', x: { tail: 'fan', dorsal: 'long', n: 44 } });
  F('lionfish', 'Red lionfish', 'Pterois volitans', 'Scorpionfish & sculpins', 'reef', ['PAC'], 'fish', 38, 1.2, 'uncommon',
    'Armed with venomous fan-like spines, and now an infamous invader of the Caribbean.',
    { s: 'classic', c: '#f0e2cf', b: '#f6ecdf', f: '#a8442e', p: 'fullbars', pc: '#8a2f22', x: { h: 26, b: 25, spines: true, tail: 'fan', dorsal: 'none', n: 9 } });
  F('barracuda', 'Great barracuda', 'Sphyraena barracuda', 'Barracudas', 'reef', ALL, 'fish', 200, 50, 'rare',
    'A chrome torpedo with a jutting underbite, drawn to shiny objects it mistakes for prey.',
    { s: 'long', c: '#9aa6ad', b: '#f3f5f6', f: '#5d6970', p: 'backbars', pc: '#5f6b72', x: { n: 12, dorsal: 'twofar', teeth: true } });
  F('blacktip', 'Blacktip reef shark', 'Carcharhinus melanopterus', 'Sharks', 'reef', ['IND', 'PAC'], 'fish', 200, 14, 'uncommon',
    'Patrols water so shallow that its dark-tipped dorsal fin slices the surface.',
    { s: 'shark', c: '#a89a80', b: '#f6f2e6', f: '#a89a80', x: { tips: '#15171a' } });
  F('moray', 'Giant moray', 'Gymnothorax javanicus', 'Eels', 'reef', ['IND', 'PAC'], 'fish', 300, 30, 'rare',
    'Has a second set of jaws in its throat that shoots forward to drag prey down.',
    { s: 'eel', c: '#8a6f3a', b: '#b9985a', f: '#7a6030', p: 'spots', pc: '#2e2212', x: { W: 12, A: 10 } });
  F('angelfish', 'Emperor angelfish', 'Pomacanthus imperator', 'Angelfish', 'reef', ['IND', 'PAC'], 'inv', 40, 1.4, 'uncommon',
    'Juveniles wear blue-and-white rings so unlike the adult\'s stripes that they were once thought to be a separate species.',
    { s: 'deep', c: '#1f4fb0', b: '#2456b8', f: '#f0d11f', p: 'hstripes', pc: '#f5d92a', x: { h: 34, b: 34, tailC: '#f5d21f', n: 9, mask: '#12203f' } });
  F('triggerfish', 'Clown triggerfish', 'Balistoides conspicillum', 'Pufferfish & kin', 'reef', ['IND', 'PAC'], 'inv', 50, 2, 'rare',
    'Wedges itself into crevices by raising a dorsal spine that only a second "trigger" spine can unlock.',
    { s: 'deep', c: '#1c1c22', b: '#1c1c22', f: '#e9c32b', p: 'bellyspots', pc: '#ffffff', x: { h: 34, b: 34, lips: '#f08a1e' } });
  F('seahorse', 'Common seahorse', 'Hippocampus kuda', 'Seahorses & pipefish', 'reef', ['IND', 'PAC'], 'plank', 17, 0.03, 'uncommon',
    'The male gets pregnant, carrying the eggs in a belly pouch. With no stomach, it has to eat almost constantly.',
    { s: 'seahorse', c: '#e3b53a', f: '#c9972a' });

  /* ---------------- Open Ocean ---------------- */
  F('bluefin', 'Atlantic bluefin tuna', 'Thunnus thynnus', 'Tuna & mackerel', 'ocean', ['ATL'], 'fish', 458, 684, 'rare',
    'Keeps its muscles warmer than the sea around it, letting it hunt from the tropics to near-Arctic water and cross an ocean in weeks.',
    { s: 'tuna', c: '#1f3a66', b: '#e9eef2', f: '#24354f', x: { finlets: '#f2c81e' } });
  F('yellowfin', 'Yellowfin tuna', 'Thunnus albacares', 'Tuna & mackerel', 'ocean', ALL, 'fish', 239, 200, 'uncommon',
    'Often swims beneath pods of dolphins, and is sold as "ahi".',
    { s: 'tuna', c: '#27466e', b: '#eef1f2', f: '#f2c81e', x: { finlets: '#f2c81e', longfins: true, stripe: '#f2d75a', h: 21, b: 20 } });
  F('skipjack', 'Skipjack tuna', 'Katsuwonus pelamis', 'Tuna & mackerel', 'ocean', ALL, 'fish', 110, 34.5, 'common',
    'The most-caught tuna on Earth. Most canned "light" tuna is this fish, and it is shaved into Japanese bonito flakes.',
    { s: 'tuna', c: '#2c3f73', b: '#eef2f5', f: '#2a3555', p: 'bellystripes', pc: '#2b2f44', x: { h: 22, b: 22 } });
  F('mahi', 'Mahi-mahi', 'Coryphaena hippurus', 'Dolphinfish', 'ocean', ALL, 'fish', 210, 40, 'common',
    'Flashes electric gold, green and blue, then fades to grey within minutes of dying. One of the fastest-growing fish in the sea.',
    { s: 'classic', c: '#2fae7a', b: '#f4d42a', f: '#1f6fb0', p: 'spots', pc: '#1f6fb0', x: { h: 27, b: 19, blunt: true, dorsal: 'crest', th: 28, ph: 3.5, n: 26 } });
  F('marlin', 'Blue marlin', 'Makaira nigricans', 'Billfish', 'ocean', ALL, 'fish', 500, 820, 'rare',
    'Females can outweigh males four to one. It slashes its spear through schools of fish to stun them.',
    { s: 'bill', c: '#1f3f8a', b: '#e9edf2', f: '#1b2f66', p: 'bars', pc: '#6f9cf0', x: { n: 9 } });
  F('sailfish', 'Sailfish', 'Istiophorus platypterus', 'Billfish', 'ocean', ALL, 'fish', 348, 100, 'uncommon',
    'Raises an enormous dorsal fin to herd sardines, flashing colour changes across its body as it hunts.',
    { s: 'bill', c: '#2a3f7a', b: '#e6eaf0', f: '#27408f', x: { dorsal: 'sail', h: 15, b: 13 } });
  F('swordfish', 'Swordfish', 'Xiphias gladius', 'Billfish', 'ocean', ALL, 'fish', 455, 650, 'rare',
    'A special organ heats its eyes and brain for hunting in the cold deep. Adults have no teeth and no scales.',
    { s: 'bill', c: '#4a4560', b: '#d9d6dc', f: '#3a3650', x: { bill: 50, nx: 56, dorsal: 'shark', eye: 5 } });
  F('greatwhite', 'Great white shark', 'Carcharodon carcharias', 'Sharks', 'ocean', ALL, 'fish', 640, 2000, 'rare',
    'Senses the faint electric fields of living prey, and rolls its eyes back for protection as it bites.',
    { s: 'shark', c: '#7f8a94', b: '#f6f7f8', f: '#7f8a94', x: { h: 22, b: 18 } });
  F('mako', 'Shortfin mako', 'Isurus oxyrinchus', 'Sharks', 'ocean', ALL, 'fish', 445, 550, 'uncommon',
    'The fastest shark, capable of bursts around 70 km/h and leaps several metres clear of the water.',
    { s: 'shark', c: '#2f4fa0', b: '#f6f7f9', f: '#2f4fa0', x: { h: 16, b: 14, tail: 'lunate', th: 28 } });
  F('whaleshark', 'Whale shark', 'Rhincodon typus', 'Sharks', 'ocean', ALL, 'plank', 1800, 20000, 'legendary',
    'The largest fish alive. Every individual\'s pattern of spots is unique, like a fingerprint.',
    { s: 'shark', c: '#4a6382', b: '#eef2f5', f: '#4a6382', p: 'spots', pc: '#eaf2f8', x: { h: 21, b: 16, blunt: true, n: 60, nose: -2 } });
  F('manta', 'Giant manta ray', 'Mobula birostris', 'Rays & skates', 'ocean', ALL, 'plank', 700, 3000, 'rare',
    'Has the largest brain of any fish and may recognise itself in a mirror. (Its "length" here is wingspan.)',
    { s: 'ray', c: '#23272e', x: { manta: true } });
  F('mola', 'Ocean sunfish', 'Mola mola', 'Pufferfish & kin', 'ocean', ALL, 'inv', 333, 2300, 'uncommon',
    'Looks like a swimming head. A female can carry 300 million eggs, more than any other vertebrate.',
    { s: 'mola', c: '#9aa3ab', b: '#dfe4e8', f: '#7f8890' });
  F('flyingfish', 'Two-wing flying fish', 'Exocoetus volitans', 'Flying fish', 'ocean', ALL, 'plank', 30, 0.1, 'common',
    'Escapes predators by gliding on wing-like fins, sometimes for more than 100 metres.',
    { s: 'torpedo', c: '#2f5fa8', b: '#eef3f8', f: '#7fb0e0', x: { h: 13, b: 12, wing: true, th: 20 } });

  /* ---------------- Deep Sea ---------------- */
  F('halibut', 'Atlantic halibut', 'Hippoglossus hippoglossus', 'Flatfish', 'deep', ['ATL', 'ARC'], 'fish', 470, 320, 'rare',
    'The largest flatfish in the world, and it can live for 50 years.',
    { s: 'flat', c: '#5a5a44', f: '#6a6a50', p: 'mottle', pc: '#3f3f2e', x: { rx: 80, ry: 22 } });
  F('seadevil', 'Humpback anglerfish', 'Melanocetus johnsonii', 'Anglerfish', 'deep', ALL, 'fish', 18, 0.1, 'uncommon',
    'Dangles a lure lit by glowing bacteria. The male is a tiny fraction of the female\'s size.',
    { s: 'angler', c: '#2a2422', f: '#1e1a19', x: { glow: true } });
  F('monkfish', 'Monkfish', 'Lophius piscatorius', 'Anglerfish', 'deep', ['ATL'], 'fish', 200, 58, 'uncommon',
    'Mostly head and mouth. It lies on the seabed and waves a fleshy "fishing rod" above its jaws.',
    { s: 'angler', c: '#7a6645', f: '#5f4f35', x: { glow: false } });
  F('coelacanth', 'Coelacanth', 'Latimeria chalumnae', 'Ancient lineages', 'deep', ['IND'], 'fish', 200, 95, 'legendary',
    'Thought to have died out 66 million years ago, until one turned up in a South African fishing net in 1938.',
    { s: 'classic', c: '#2f4a7a', b: '#3f5a8a', f: '#27406a', p: 'bigspots', pc: '#dfe6f0', x: { h: 26, b: 26, tail: 'lobed', ph: 9, lobed: true } });
  F('greenland', 'Greenland shark', 'Somniosus microcephalus', 'Sharks', 'deep', ['ATL', 'ARC'], 'fish', 640, 1000, 'rare',
    'The longest-lived vertebrate known. Some are estimated to be around 400 years old.',
    { s: 'shark', c: '#6a6860', b: '#8a877c', f: '#5d5b54', x: { h: 20, b: 19, blunt: true, dorsal: 'sharksmall' } });
  F('roughy', 'Orange roughy', 'Hoplostethus atlanticus', 'Roughies & fangtooths', 'deep', ALL, 'inv', 75, 7, 'common',
    'Can live past 150 and does not breed until its twenties or thirties, which makes it very easy to overfish.',
    { s: 'deep', c: '#e8552a', b: '#f08a5a', f: '#d9431e', x: { h: 34, b: 32, eye: 6, blunt: true, tail: 'fork' } });
  F('toothfish', 'Patagonian toothfish', 'Dissostichus eleginoides', 'Antarctic fishes', 'deep', ['SOU', 'ATL', 'PAC'], 'fish', 215, 200, 'uncommon',
    'Renamed "Chilean sea bass" by a fish merchant in 1977 to help it sell.',
    { s: 'classic', c: '#5d5a55', b: '#c9c5bb', f: '#4a4844', p: 'mottle', pc: '#35332f', x: { h: 20, b: 20, tail: 'fan', dorsal: 'ridge', anal: 'long' } });
  F('oarfish', 'Giant oarfish', 'Regalecus glesne', 'Oarfish', 'deep', ALL, 'plank', 800, 272, 'rare',
    'The longest bony fish. It hangs upright in the water and probably inspired legends of sea serpents.',
    { s: 'eel', c: '#c9d2da', b: '#eef1f4', f: '#d8362a', p: 'bars', pc: '#7f8a94', x: { A: 4, W: 8, crest: true, freq: 0.9 } });
  F('gulper', 'Pelican eel', 'Eurypharynx pelecanoides', 'Eels', 'deep', ALL, 'inv', 100, 0.5, 'uncommon',
    'Its enormous hinged mouth balloons open far wider than its body, and the tip of its tail glows.',
    { s: 'eel', c: '#1d1b22', b: '#2a2730', f: '#1d1b22', x: { gulper: true, A: 9, W: 5 } });
  F('viperfish', 'Sloane\'s viperfish', 'Chauliodus sloani', 'Dragonfish', 'deep', ALL, 'fish', 35, 0.03, 'common',
    'Its fangs are too long to fit in its mouth, so they curve up past its eyes instead.',
    { s: 'long', c: '#1f2a3a', b: '#3a4a60', f: '#1a2230', x: { nx: 22, fangs: true, photophores: true, dorsal: 'whip', eye: 4.4 } });
  F('blobfish', 'Blobfish', 'Psychrolutes marcidus', 'Scorpionfish & sculpins', 'deep', ['PAC', 'IND'], 'inv', 30, 2, 'uncommon',
    'Looks like an ordinary fish at depth. It only sags into its famous droopy face when hauled to the surface.',
    { s: 'blob', c: '#e8b4b0' });
  F('goblin', 'Goblin shark', 'Mitsukurina owstoni', 'Sharks', 'deep', ALL, 'fish', 617, 210, 'rare',
    'Its jaws catapult forward out of its face to snatch prey from beneath a long, blade-like snout.',
    { s: 'shark', c: '#d99a9a', b: '#f2d6d2', f: '#c98888', x: { nx: 40, snout: 'blade', h: 14, b: 13, dorsal: 'sharksmall' } });
  F('fangtooth', 'Common fangtooth', 'Anoplogaster cornuta', 'Roughies & fangtooths', 'deep', ALL, 'fish', 18, 0.1, 'common',
    'Has the largest teeth of any fish for its size, with sockets in its skull so it does not stab its own brain.',
    { s: 'deep', c: '#3a2a22', b: '#4a372d', f: '#2c1f19', x: { h: 32, b: 32, blunt: true, fangs: true, tail: 'fork', dorsal: 'one' } });
  F('grenadier', 'Roundnose grenadier', 'Coryphaenoides rupestris', 'Cod & kin', 'deep', ['ATL'], 'inv', 110, 1.7, 'common',
    'A "rattail": big head, bulging eyes and a body tapering to a whip. It can live for more than 50 years.',
    { s: 'eel', c: '#7a7f88', b: '#b9bdc4', f: '#5f646c', x: { rattail: true, A: 2, W: 17, freq: 0.6 } });

  /* The first 91 species above are the original set. The daily puzzle's first
     cycle is drawn from them alone, so keep new species below this line. */
  const ORIGINAL_COUNT = FISH.length;

  /* ---------------- Mangrove ---------------- */
  F('greysnapper', 'Grey snapper', 'Lutjanus griseus', 'Snappers', 'mangrove', ['ATL'], 'fish', 89, 20, 'common',
    'Its young shelter among tangled roots in the shallows before moving out to reefs as adults.',
    { s: 'classic', c: '#9a6f5a', b: '#e8c9b8', f: '#7d5646', x: { h: 26, b: 24, dorsal: 'long' } });
  F('mudskipper', 'Atlantic mudskipper', 'Periophthalmus barbarus', 'Gobies', 'mangrove', ['AF', 'ATL'], 'inv', 16, 0.03, 'common',
    'A fish that spends most of its time out of the water, walking on its fins and breathing through its skin.',
    { s: 'long', c: '#8a7a5a', b: '#e6dcc0', f: '#5f8fb0', p: 'spots', pc: '#3aa0d0', x: { nx: 30, px: 186, h: 13, b: 12, blunt: true, eye: 5, dorsal: 'two', tail: 'fan', nose: -2 } });
  F('archerfish', 'Banded archerfish', 'Toxotes jaculatrix', 'Archerfish', 'mangrove', ['AS', 'OC', 'IND', 'PAC'], 'inv', 30, 0.5, 'uncommon',
    'Spits a jet of water to knock insects off overhanging leaves, correcting its aim for the bending of light.',
    { s: 'deep', c: '#d9dcd6', b: '#f4f5f0', f: '#3a3f3a', p: 'bars', pc: '#1f231f', x: { h: 30, b: 30, n: 5, nose: -6, dorsal: 'back' } });
  F('mangrovejack', 'Mangrove jack', 'Lutjanus argentimaculatus', 'Snappers', 'mangrove', ['IND', 'PAC'], 'fish', 150, 16, 'rare',
    'An ambush hunter that anglers know for bolting straight back into the roots the instant it is hooked.',
    { s: 'classic', c: '#b5553a', b: '#e9b9a0', f: '#8f3f2a', x: { h: 27, b: 25, dorsal: 'long', tail: 'fan' } });
  F('bullshark', 'Bull shark', 'Carcharhinus leucas', 'Sharks', 'mangrove', ALL, 'fish', 400, 316, 'rare',
    'Can live in fresh water, and has been found thousands of kilometres up rivers such as the Amazon.',
    { s: 'shark', c: '#8a8f93', b: '#f2f3f3', f: '#8a8f93', x: { h: 23, b: 19, blunt: true } });
  F('sawfish', 'Largetooth sawfish', 'Pristis pristis', 'Rays & skates', 'mangrove', ALL, 'fish', 700, 600, 'legendary',
    'A ray with a long, toothed snout that senses the electric fields of its prey and then slashes through them.',
    { s: 'shark', c: '#9a8f6f', b: '#efe9d6', f: '#8a7f60', x: { nx: 70, snout: 'saw', h: 14, b: 11 } });
  F('tripletail', 'Tripletail', 'Lobotes surinamensis', 'Tripletails', 'mangrove', ALL, 'inv', 110, 19, 'uncommon',
    'Floats on its side near the surface, passing itself off as a drifting leaf.',
    { s: 'deep', c: '#6f5f3a', b: '#b9a36a', f: '#5a4c2e', p: 'mottle', pc: '#3d331d', x: { h: 36, b: 36, blunt: true } });
  F('milkfish', 'Milkfish', 'Chanos chanos', 'Milkfish', 'mangrove', ['IND', 'PAC'], 'plant', 180, 14, 'common',
    'The national fish of the Philippines, where it has been farmed in ponds for centuries.',
    { s: 'torpedo', c: '#a9b8c2', b: '#f6f8f9', f: '#6f7f8a', x: { h: 19, b: 18, th: 28 } });
  F('scat', 'Spotted scat', 'Scatophagus argus', 'Scats', 'mangrove', ['IND', 'PAC'], 'omni', 38, 1, 'common',
    'Its scientific name means "dung-eater", from its habit of gathering wherever waste washes into the water.',
    { s: 'deep', c: '#b9b08a', b: '#e9e6cf', f: '#8f8763', p: 'bigspots', pc: '#2a261a', x: { h: 36, b: 34 } });
  F('foureyes', 'Four-eyed fish', 'Anableps anableps', 'Four-eyed fishes', 'mangrove', ['SA', 'ATL'], 'inv', 32, 0.4, 'uncommon',
    'Each eye is split in two, letting it watch above and below the waterline at the same time.',
    { s: 'long', c: '#8f8a6a', b: '#e9e4c8', f: '#6f6a4f', p: 'hstripes', pc: '#4a4632', x: { nx: 22, h: 11, b: 10, eye: 5, tail: 'fan', nose: -3 } });
  F('crevalle', 'Crevalle jack', 'Caranx hippos', 'Jacks', 'mangrove', ['ATL'], 'fish', 124, 32, 'uncommon',
    'Hunts in packs that pin baitfish against beaches and seawalls, and grunts loudly when it is landed.',
    { s: 'classic', c: '#8fa3a0', b: '#f2d26a', f: '#c9a52e', x: { h: 29, b: 25, tail: 'lunate', th: 28, dorsal: 'tuna', blunt: true, ph: 3 } });
  F('milkpuffer', 'Milk-spotted puffer', 'Chelonodon patoca', 'Pufferfish & kin', 'mangrove', ['IND', 'PAC'], 'inv', 38, 1, 'uncommon',
    'Gulps water to balloon to twice its size, and its organs carry a powerful nerve poison.',
    { s: 'deep', c: '#6a7f4a', b: '#f1f1e6', f: '#d9c23a', p: 'spots', pc: '#f1f1e6', x: { h: 30, b: 32, blunt: true, dorsal: 'back' } });

  /* ---------------- Kelp Forest ---------------- */
  F('garibaldi', 'Garibaldi', 'Hypsypops rubicundus', 'Damselfish', 'kelp', ['PAC'], 'inv', 36, 0.9, 'common',
    'The state marine fish of California. Males scrub a patch of rock clean and guard a garden of red algae for their eggs.',
    { s: 'deep', c: '#f2701a', b: '#f58a2e', f: '#e0600f', x: { h: 34, b: 32, tail: 'fork' } });
  F('sheephead', 'California sheephead', 'Semicossyphus pulcher', 'Wrasse & parrotfish', 'kelp', ['PAC'], 'inv', 91, 16, 'uncommon',
    'Every one is born female and the largest turn male. Its appetite for sea urchins helps keep the forest standing.',
    { s: 'classic', c: '#d1453a', b: '#e9a59a', f: '#1c1c20', x: { h: 30, b: 28, hump: true, mask: '#1c1c20', tailC: '#1c1c20', tail: 'fan', dorsal: 'long' } });
  F('kelpbass', 'Kelp bass', 'Paralabrax clathratus', 'Groupers', 'kelp', ['PAC'], 'fish', 72, 6.6, 'common',
    'Known to California anglers as the "calico bass" for its checkered pattern.',
    { s: 'classic', c: '#6f6a3a', b: '#e9e6c8', f: '#5a5630', p: 'mottle', pc: '#d9d6a8' });
  F('giantseabass', 'Giant sea bass', 'Stereolepis gigas', 'Wreckfish', 'kelp', ['PAC'], 'fish', 250, 256, 'legendary',
    'Can outweigh a grizzly bear and live for more than 70 years. The young are bright orange with black spots.',
    { s: 'classic', c: '#3f434a', b: '#8a8f96', f: '#33373d', p: 'bigspots', pc: '#22252a', x: { h: 33, b: 31, tail: 'fan', dorsal: 'long', blunt: true } });
  F('leopardshark', 'Leopard shark', 'Triakis semifasciata', 'Sharks', 'kelp', ['PAC'], 'inv', 198, 18, 'uncommon',
    'Gathers in warm shallows by the hundreds, and gives birth to live pups.',
    { s: 'shark', c: '#b3a58a', b: '#f2ede0', f: '#a39679', p: 'bars', pc: '#3a3226', x: { h: 15, b: 12, n: 9 } });
  F('lingcod', 'Lingcod', 'Ophiodon elongatus', 'Scorpionfish & sculpins', 'kelp', ['PAC'], 'fish', 152, 59, 'rare',
    'Roughly one in five has flesh that is bright blue-green, which turns white when it is cooked.',
    { s: 'long', c: '#6f6a4a', b: '#d9d4b0', f: '#5a5638', p: 'mottle', pc: '#3a3722', x: { nx: 18, h: 17, b: 17, dorsal: 'ridge', tail: 'fan', teeth: true } });
  F('cabezon', 'Cabezon', 'Scorpaenichthys marmoratus', 'Scorpionfish & sculpins', 'kelp', ['PAC'], 'inv', 99, 14, 'uncommon',
    'Its name is Spanish for "big-headed", and its eggs are poisonous to eat.',
    { s: 'classic', c: '#7a5a3a', b: '#c9b48a', f: '#6a4c30', p: 'mottle', pc: '#3f2c1a', x: { h: 30, b: 28, blunt: true, tail: 'fan', dorsal: 'long' } });
  F('wolfeel', 'Wolf eel', 'Anarrhichthys ocellatus', 'Wolffish', 'kelp', ['PAC'], 'inv', 240, 18, 'rare',
    'Not an eel at all. Pairs share a rocky den for life and crush crabs and urchins in powerful jaws.',
    { s: 'eel', c: '#7f8a94', b: '#b9c2c9', f: '#5f6a74', p: 'spots', pc: '#2f363d', x: { W: 11, A: 9 } });
  F('calhalibut', 'California halibut', 'Paralichthys californicus', 'Flatfish', 'kelp', ['PAC'], 'fish', 152, 33, 'uncommon',
    'Unusually for a flatfish, it can have its eyes on either the left side or the right.',
    { s: 'flat', c: '#6a5f45', f: '#7a6f52', p: 'mottle', pc: '#463e2a', x: { rx: 76, ry: 26 } });
  F('batray', 'Bat ray', 'Myliobatis californica', 'Rays & skates', 'kelp', ['PAC'], 'inv', 180, 82, 'rare',
    'Flaps its wings against the seabed to dig out clams, leaving pits that other fish come to feed in. (Its "length" here is wingspan.)',
    { s: 'ray', c: '#4a4238', p: 'spots', pc: '#5f574a' });
  F('hornshark', 'Horn shark', 'Heterodontus francisci', 'Sharks', 'kelp', ['PAC'], 'inv', 122, 10, 'common',
    'Lays spiral, corkscrew-shaped egg cases that it wedges into cracks in the rock.',
    { s: 'shark', c: '#b39a72', b: '#efe4cc', f: '#a0885f', p: 'spots', pc: '#3a2c1a', x: { h: 16, b: 13, blunt: true, n: 24 } });
  F('senorita', 'Señorita', 'Oxyjulis californica', 'Wrasse & parrotfish', 'kelp', ['PAC'], 'inv', 25, 0.1, 'common',
    'A cleaner fish that picks parasites off bigger fish, and buries itself in the sand to sleep.',
    { s: 'torpedo', c: '#e0a34a', b: '#f6e3b0', f: '#d18a2e', x: { h: 13, b: 12, tail: 'fan', dorsal: 'ridge', marks: [[0.99, 0, 4, '#1a1a1a']] } });

  /* ---------------- Polar Ice ---------------- */
  F('arcticchar', 'Arctic char', 'Salvelinus alpinus', 'Salmon & trout', 'polar', ['NA', 'EU', 'AS', 'ARC'], 'fish', 107, 15, 'common',
    'Lives farther north than any other freshwater fish, in lakes that are frozen over for most of the year.',
    { s: 'torpedo', c: '#4f7a6a', b: '#e86a3a', f: '#d9552a', p: 'spots', pc: '#f2d9c9', x: { adipose: true, h: 20 } });
  F('arcticcod', 'Arctic cod', 'Boreogadus saida', 'Cod & kin', 'polar', ['ARC'], 'plank', 40, 0.2, 'common',
    'Antifreeze proteins in its blood let it live under the sea ice, where it is the main food of seals, narwhals and belugas.',
    { s: 'torpedo', c: '#7a7f6a', b: '#e9ebe0', f: '#5f6452', x: { h: 15, b: 14, dorsal: 'three', barbels: 1 } });
  F('capelin', 'Capelin', 'Mallotus villosus', 'Smelts', 'polar', ['ATL', 'PAC', 'ARC'], 'plank', 25, 0.05, 'common',
    'Throws itself onto beaches by the million to spawn. Its orange roe is the "masago" on sushi.',
    { s: 'torpedo', c: '#7f9a6a', b: '#f1f4f0', f: '#6a8458', x: { h: 12, b: 11, adipose: true } });
  F('greenlandhalibut', 'Greenland halibut', 'Reinhardtius hippoglossoides', 'Flatfish', 'polar', ['ATL', 'PAC', 'ARC'], 'fish', 120, 45, 'uncommon',
    'A flatfish that swims upright like an ordinary fish, with one eye that only made it as far as the top of its head.',
    { s: 'flat', c: '#3a3a3f', f: '#4a4a50', p: 'mottle', pc: '#2a2a2e', x: { rx: 78, ry: 24 } });
  F('wolffish', 'Atlantic wolffish', 'Anarhichas lupus', 'Wolffish', 'polar', ['ATL', 'ARC'], 'inv', 150, 24, 'uncommon',
    'Makes its own antifreeze, and regrows a full set of shell-crushing teeth every year.',
    { s: 'long', c: '#6f7f8a', b: '#c9d2d9', f: '#55636e', p: 'bars', pc: '#3a454e', x: { nx: 18, h: 18, b: 17, dorsal: 'ridge', tail: 'fan', blunt: true, fangs: true, n: 10 } });
  F('inconnu', 'Inconnu', 'Stenodus leucichthys', 'Salmon & trout', 'polar', ['NA', 'AS', 'ARC'], 'fish', 150, 40, 'rare',
    'Its name is French for "unknown", given by fur traders who had never seen its like. Anglers call it the tarpon of the north.',
    { s: 'torpedo', c: '#9aa5ad', b: '#f4f6f7', f: '#6f7a84', x: { h: 19, b: 18, adipose: true, nose: 2 } });
  F('lumpfish', 'Lumpfish', 'Cyclopterus lumpus', 'Scorpionfish & sculpins', 'polar', ['ATL', 'ARC'], 'inv', 61, 9.6, 'uncommon',
    'Clings to rocks with a suction cup on its belly, and is put to work on salmon farms eating parasites.',
    { s: 'deep', c: '#5f7f8f', b: '#c9d6d9', f: '#4a6a7a', p: 'bigspots', pc: '#3a5564', x: { h: 36, b: 36, blunt: true, nx: 54, px: 176, dorsal: 'back' } });
  F('antarctictoothfish', 'Antarctic toothfish', 'Dissostichus mawsoni', 'Antarctic fishes', 'polar', ['SOU'], 'fish', 200, 135, 'rare',
    'Its heart beats only about once every six seconds, and antifreeze in its blood stops it freezing solid.',
    { s: 'classic', c: '#4f4a45', b: '#b9b5ab', f: '#3f3b37', p: 'mottle', pc: '#2a2725', x: { h: 21, b: 21, tail: 'fan', dorsal: 'ridge', anal: 'long' } });
  F('icefish', 'Mackerel icefish', 'Champsocephalus gunnari', 'Antarctic fishes', 'polar', ['SOU'], 'plank', 66, 2, 'uncommon',
    'Its blood is clear. Its family are the only vertebrates with no haemoglobin, the stuff that makes blood red.',
    { s: 'long', c: '#c9d6dc', b: '#f4f8fa', f: '#8fa3ad', p: 'bars', pc: '#7f97a3', x: { nx: 20, h: 14, b: 13, dorsal: 'two', eye: 4.2, n: 7 } });
  F('thornyskate', 'Thorny skate', 'Amblyraja radiata', 'Rays & skates', 'polar', ['ATL', 'ARC'], 'inv', 105, 11, 'uncommon',
    'A row of heavy thorns runs down the middle of its back and tail.',
    { s: 'ray', c: '#7a6a55', p: 'spots', pc: '#d9cfae' });
  F('sleepershark', 'Pacific sleeper shark', 'Somniosus pacificus', 'Sharks', 'polar', ['PAC', 'ARC'], 'fish', 440, 363, 'legendary',
    'Glides so slowly and silently that it ambushes far faster prey. One was filmed inside an active underwater volcano.',
    { s: 'shark', c: '#5a5f66', b: '#7f858c', f: '#4d5258', x: { h: 21, b: 19, blunt: true, dorsal: 'sharksmall' } });

  window.FATHOM_DATA = { AREAS, REGIONS, DIETS, RARITY, FISH, ORIGINAL_COUNT };
})();
