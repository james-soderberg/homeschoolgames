// ============================================================
// HSGSpellWords — shared, graded spelling word bank.
// Lowercase, letters a–z only, so it drops straight into any
// spelling game. Four difficulty bands, by real grade level:
//   easy     — 1st–3rd grade  (short, decodable, common sight words)
//   medium   — 4th–7th grade  (multi-syllable everyday vocabulary)
//   hard     — high school +  (advanced & notoriously misspelled words)
//   einstein — expert/bee     (long science & SAT-level brain-benders)
// API:  HSGSpellWords.pick(level)            -> a random word
//       HSGSpellWords.pick(level, avoidSet)  -> avoids first letters in the Set
//       HSGSpellWords.levels                 -> ['easy','medium','hard','einstein']
//       HSGSpellWords.clue(word)             -> a kid-friendly clue (or null)
// ============================================================
(function () {
  const BANK = {
    // ---------- 1st–3rd grade ----------
    easy: [
      "cat","dog","sun","hat","run","bug","cup","bed","pig","fox",
      "owl","web","fan","map","key","bus","pen","ant","fish","ball",
      "tree","book","frog","milk","jump","hand","star","cake","ship","rain",
      "leaf","bird","king","lamp","ring","sock","nest","gift","sand","corn",
      "drum","flag","snow","moon","kite","bear","duck","road","hill","boat",
      "happy","apple","water","green","smile","house","mouse","table","chair","sleep",
      "train","clock","grape","sheep","candy","puppy","bread","grass","cloud","plant",
      "friend","school"
    ],
    // ---------- 4th–7th grade ----------
    medium: [
      "river","garden","pencil","animal","orange","basket","castle","flower","jungle","spider",
      "turtle","window","pirate","knight","guitar","forest","island","picture","morning","thunder",
      "diamond","kitchen","blanket","dragon","planet","rocket","monkey","rabbit","winter","summer",
      "yellow","elephant","dinosaur","mountain","hospital","computer","treasure","umbrella","butterfly","chocolate",
      "adventure","beautiful","dangerous","vegetable","telescope","lightning","calendar","celebrate","important","different",
      "surprise","sandwich","birthday","crocodile","strawberry","wonderful","furniture","favorite","remember","neighbor",
      "library","science","sentence","special","suddenly","dictionary","character","volcano","continent","paragraph",
      "weather","machine","distance","decision","attention","finally"
    ],
    // ---------- high school and beyond ----------
    hard: [
      "knowledge","necessary","separate","beginning","definitely","embarrass","rhythm","parallel","privilege","lieutenant",
      "maintenance","conscience","conscious","pronunciation","accommodate","occurrence","recommend","possess","miscellaneous","perseverance",
      "mischievous","exaggerate","guarantee","hierarchy","restaurant","vacuum","weird","foreign","sovereign","acquaintance",
      "questionnaire","millennium","vengeance","fluorescent","liaison","silhouette","camouflage","rendezvous","gauge","leisure",
      "environment","government","temperature","independence","immediately","license","judgment","existence","especially","experience",
      "equipment","persuade","ancient","opinion","original","scissors","rhinoceros","february","wednesday"
    ],
    // ---------- expert / spelling-bee brain-benders (short but devious) ----------
    einstein: [
      "psyche","fuchsia","tsunami","yacht","bourgeois","epitome","facade","pharaoh","asthma","diaphragm",
      "mnemonic","bivouac","schism","zephyr","sergeant","colonel","receipt","maneuver","isthmus","quartz",
      "bouquet","plateau","seize","aisle","debris","subtle","khaki","czar","gnaw","knead",
      "wraith","sleigh","hygiene","syringe","pneumonia","gnome","feign","beige","freight","jeopardy"
    ]
  };

  // Kid-friendly clues — each one points at the word so the challenge is the
  // SPELLING, not guessing the meaning. Emoji up front for instant recognition.
  const CLUES = {
    // ---- easy: 1st–3rd grade ----
    cat:"🐱 The furry pet that says \"meow\"", dog:"🐶 The pet that barks and wags its tail",
    sun:"☀️ The bright star that lights up the day", hat:"🎩 You wear this on your head",
    run:"🏃 To move fast on your feet", bug:"🐛 A tiny crawling insect",
    cup:"🥤 You drink water out of this", bed:"🛏️ You sleep in this at night",
    pig:"🐷 The pink farm animal that says \"oink\"", fox:"🦊 The clever orange animal with a bushy tail",
    owl:"🦉 The bird that says \"hoo\" at night", web:"🕸️ A spider spins this to catch bugs",
    fan:"🌀 It spins to blow cool air on you", map:"🗺️ It shows you where places are",
    key:"🔑 You use this to unlock a door", bus:"🚌 The big yellow vehicle that takes kids to school",
    pen:"🖊️ You write with this in ink", ant:"🐜 A tiny insect that lives in a hill",
    fish:"🐟 The animal that swims and breathes underwater", ball:"⚽ A round toy you bounce, kick, or throw",
    tree:"🌳 A tall plant with a trunk and leaves", book:"📖 You read the pages of this",
    frog:"🐸 The green animal that hops and says \"ribbit\"", milk:"🥛 The white drink that comes from cows",
    jump:"🦘 To leap up off the ground", hand:"✋ The part of your body with five fingers",
    star:"⭐ A tiny twinkling light in the night sky", cake:"🎂 The sweet treat you eat on your birthday",
    ship:"🚢 A big boat that sails the ocean", rain:"🌧️ Water that falls from the clouds",
    leaf:"🍃 The green part that grows on a tree", bird:"🐦 An animal with wings and feathers that flies",
    king:"👑 The man who rules a kingdom", lamp:"💡 You switch this on for light",
    ring:"💍 Shiny jewelry you wear on a finger", sock:"🧦 You wear this on your foot inside a shoe",
    nest:"🪺 The cozy home a bird builds for its eggs", gift:"🎁 A wrapped present you give someone",
    sand:"🏖️ The tiny grains you find at the beach", corn:"🌽 The yellow veggie on a cob",
    drum:"🥁 You bang on this to make a beat", flag:"🚩 A piece of cloth that waves on a pole",
    snow:"❄️ The cold white flakes that fall in winter", moon:"🌙 The big light in the night sky",
    kite:"🪁 You fly this on a string in the wind", bear:"🐻 The big furry animal that loves honey",
    duck:"🦆 The bird that says \"quack\" and swims", road:"🛣️ Cars drive on this",
    hill:"⛰️ A small mountain you can climb", boat:"⛵ It floats on water and carries you across",
    happy:"😊 The feeling when you're full of joy", apple:"🍎 The red fruit that keeps the doctor away",
    water:"💧 The clear drink you need to stay alive", green:"🟢 The color of grass and leaves",
    smile:"🙂 You do this with your mouth when you're glad", house:"🏠 The building where a family lives",
    mouse:"🐭 The tiny animal that says \"squeak\"", table:"🍽️ You eat your dinner on top of this",
    chair:"🪑 You sit down on this", sleep:"😴 To close your eyes and rest at night",
    train:"🚂 The long vehicle that rides on rails", clock:"🕐 It hangs on the wall and tells the time",
    grape:"🍇 A small round fruit that grows in bunches", sheep:"🐑 The fluffy farm animal that says \"baa\"",
    candy:"🍬 A sweet sugary treat", puppy:"🐶 A baby dog",
    bread:"🍞 You make a sandwich with slices of this", grass:"🌿 The green stuff that covers a lawn",
    cloud:"☁️ The fluffy white thing in the sky", plant:"🌱 A green thing that grows from a seed",
    friend:"🤗 Someone you like to play and spend time with", school:"🏫 The place where kids go to learn",

    // ---- medium: 4th–7th grade ----
    river:"🏞️ A long stream of water that flows to the sea", garden:"🌷 Where you grow flowers and veggies",
    pencil:"✏️ You write with this and erase mistakes", animal:"🐾 A living creature like a dog or lion",
    orange:"🍊 The round fruit that's also a color", basket:"🧺 A woven container with a handle",
    castle:"🏰 The huge stone home where a king lives", flower:"🌸 The pretty colorful part of a plant",
    jungle:"🌴 A thick hot forest full of wild animals", spider:"🕷️ The eight-legged bug that spins webs",
    turtle:"🐢 The slow animal with a hard shell", window:"🪟 The glass you look out of in a wall",
    pirate:"🏴‍☠️ A sea robber who hunts for treasure", knight:"⚔️ A warrior in shining armor",
    guitar:"🎸 The instrument with six strings you strum", forest:"🌲 A big area covered in trees",
    island:"🏝️ Land with water all around it", picture:"🖼️ A photo or drawing you hang on a wall",
    morning:"🌅 The early part of the day when the sun rises", thunder:"🌩️ The loud boom you hear in a storm",
    diamond:"💎 The sparkly precious gem", kitchen:"🍳 The room where you cook food",
    blanket:"🛌 The soft cover that keeps you warm in bed", dragon:"🐉 The fire-breathing monster with wings",
    planet:"🪐 A huge round world like Earth or Mars", rocket:"🚀 The ship that blasts off into space",
    monkey:"🐒 The animal that swings in trees and eats bananas", rabbit:"🐰 The hopping animal with long ears",
    winter:"⛄ The cold snowy season of the year", summer:"🌞 The hot sunny season of the year",
    yellow:"🟡 The color of the sun and bananas", elephant:"🐘 The huge gray animal with a long trunk",
    dinosaur:"🦕 The giant reptile from long, long ago", mountain:"🏔️ A giant rocky peak you climb",
    hospital:"🏥 Where doctors help sick people get better", computer:"💻 The machine with a screen and keyboard",
    treasure:"💰 A chest of gold and jewels pirates hunt for", umbrella:"☂️ You hold this over your head in the rain",
    butterfly:"🦋 The pretty insect with colorful wings", chocolate:"🍫 The sweet brown candy everyone loves",
    adventure:"🗺️ An exciting and daring journey", beautiful:"😍 Very, very pretty to look at",
    dangerous:"⚠️ Something that can hurt you — not safe", vegetable:"🥦 Healthy food like broccoli or carrots",
    telescope:"🔭 You look through this to see the stars up close", lightning:"⚡ The bright flash in the sky during a storm",
    calendar:"📅 It shows all the days and months of the year", celebrate:"🎉 To have a party for something special",
    important:"❗ Something that really, really matters", different:"🔀 Not the same as something else",
    surprise:"🎈 Something unexpected that shocks you", sandwich:"🥪 Two slices of bread with filling inside",
    birthday:"🎂 The special day you were born, with cake", crocodile:"🐊 The big green reptile with sharp teeth",
    strawberry:"🍓 The red juicy fruit with tiny seeds", wonderful:"🌟 Really, really great and amazing",
    furniture:"🛋️ Things like chairs, tables, and sofas", favorite:"⭐ The one you like the very best",
    remember:"🧠 To keep something in your mind, not forget", neighbor:"🏡 The person who lives right next door",
    library:"📚 The quiet place full of books you can borrow", science:"🔬 The study of nature and how things work",
    sentence:"✍️ A group of words that makes a complete thought", special:"🌟 Better or different in a great way",
    suddenly:"💥 Happening quickly and without warning", dictionary:"📖 The book that tells you what words mean",
    character:"🎭 A person in a story, or your inner nature", volcano:"🌋 A mountain that erupts with lava",
    continent:"🌎 One of Earth's seven huge land masses", paragraph:"📄 A group of sentences about one idea",
    weather:"🌦️ Sun, rain, wind, and clouds outside", machine:"⚙️ A device with parts that does work",
    distance:"📏 How far apart two things are", decision:"🤔 A choice you make after thinking",
    attention:"👀 Carefully watching or listening", finally:"🏁 At last, after a long wait",

    // ---- hard: high school and beyond ----
    knowledge:"🧠 All the things you know and have learned", necessary:"✅ Something you absolutely need (one c, two s)",
    separate:"✂️ To split apart (there's \"a rat\" in the middle)", beginning:"🏁 The very start (double the n)",
    definitely:"💯 For sure, without any doubt (\"finite\" inside)", embarrass:"😳 To make someone feel shy (two r, two s)",
    rhythm:"🥁 The steady beat in music (no regular vowels!)", parallel:"🟰 Side-by-side lines that never meet (middle ll)",
    privilege:"🎟️ A special right or advantage (no d)", lieutenant:"🎖️ A military officer below a captain",
    maintenance:"🔧 Keeping something in good working order", conscience:"😇 The inner voice of right and wrong",
    conscious:"👁️ Awake and aware of what's happening", pronunciation:"🗣️ The way a word is said out loud (no \"noun\")",
    accommodate:"🛏️ To make room for someone (two c, two m)", occurrence:"📅 Something that happens (two c, two r)",
    recommend:"👍 To suggest something is good (one c, two m)", possess:"🫳 To own or have something (two s, two s)",
    miscellaneous:"🗃️ A mix of various different things", perseverance:"💪 Never giving up, even when it's hard",
    mischievous:"😈 Playfully causing a little trouble (no extra i)", exaggerate:"📈 To make something sound bigger (two g)",
    guarantee:"🤝 A firm promise that something will happen", hierarchy:"🪜 A ranking from highest to lowest",
    restaurant:"🍽️ A place where you go to eat a meal", vacuum:"🧹 The machine that sucks up dust (two u)",
    weird:"👽 Strange or unusual (this one breaks \"i before e\")", foreign:"🌍 From another country (e before i)",
    sovereign:"👑 A supreme ruler, like a king or queen", acquaintance:"🤝 Someone you know, but not a close friend",
    questionnaire:"📋 A printed list of questions to answer (two n)", millennium:"🗓️ A period of one thousand years (two l, two n)",
    vengeance:"⚔️ Getting revenge for a wrong", fluorescent:"💡 Glowing bright, like a neon light",
    liaison:"🔗 A go-between who links two groups", silhouette:"👤 A dark shadow outline of a shape",
    camouflage:"🦎 Coloring that helps an animal blend in", rendezvous:"📍 A planned meeting at a set place",
    gauge:"📏 A tool that measures an amount", leisure:"🛋️ Free time to relax and do what you like",
    environment:"🌳 The natural world around us (don't forget the n)", government:"🏛️ The group that runs a country (the hidden n)",
    temperature:"🌡️ How hot or cold something is", independence:"🗽 Being free and self-governing",
    immediately:"⚡ Right now, without any delay (two m)", license:"🪪 An official card giving permission",
    judgment:"⚖️ A careful decision or opinion (no e in the middle)", existence:"🌌 The state of being real",
    especially:"⭐ More than usual; particularly", experience:"🎓 Knowledge gained by doing something",
    equipment:"🧰 The tools and gear needed for a job", persuade:"💬 To convince someone to do something",
    ancient:"🏺 Very, very old, from long ago", opinion:"💭 What you personally think or believe",
    original:"🥇 The first of its kind, not a copy", scissors:"✂️ The tool with two blades for cutting paper",
    rhinoceros:"🦏 The big animal with a horn on its nose", february:"❄️ The short, cold second month (don't drop the r)",
    wednesday:"📅 The day in the middle of the week (a silent d)",

    // ---- einstein: short but tricky spelling-bee words ----
    psyche:"🧠 The human soul, spirit, or mind", fuchsia:"🌸 A vivid pinkish-purple color",
    tsunami:"🌊 A giant ocean wave set off by an earthquake", yacht:"⛵ A sleek boat for sailing or racing",
    bourgeois:"🎩 Relating to the middle class", epitome:"💯 A perfect example of something",
    facade:"🏛️ The front face of a building", pharaoh:"👑 A king of ancient Egypt",
    asthma:"🫁 A condition that makes breathing hard", diaphragm:"🌬️ The muscle below the lungs that helps you breathe",
    mnemonic:"🧠 A trick or rhyme that helps you remember (silent m)", bivouac:"⛺ A temporary camp with no tents",
    schism:"🪓 A split into opposing groups", zephyr:"🍃 A gentle, mild breeze",
    sergeant:"🎖️ A rank of officer in the army or police", colonel:"🪖 A senior army officer (it sounds like \"kernel\")",
    receipt:"🧾 A slip that proves you paid (silent p)", maneuver:"🤸 A skillful or tricky movement",
    isthmus:"🗺️ A narrow strip of land joining two bigger ones", quartz:"💎 A hard, glassy mineral",
    bouquet:"💐 A bunch of flowers", plateau:"🏔️ A flat, raised stretch of high land",
    seize:"✊ To grab hold of suddenly", aisle:"🚶 A walkway between rows of seats",
    debris:"🪨 Scattered broken pieces (silent s)", subtle:"🤏 So slight it's hard to notice (silent b)",
    khaki:"🟤 A dull yellow-brown color", czar:"👑 A Russian emperor of old",
    gnaw:"🦫 To chew on something over and over (silent g)", knead:"🍞 To press and fold dough (silent k)",
    wraith:"👻 A ghost or phantom", sleigh:"🛷 A sled pulled over the snow",
    hygiene:"🧼 Keeping clean to stay healthy", syringe:"💉 A tube with a needle for giving shots",
    pneumonia:"🫁 A serious illness that fills the lungs (silent p)", gnome:"🧙 A little garden figure or earth spirit (silent g)",
    feign:"🎭 To fake or pretend (silent g)", beige:"🟫 A pale sandy tan color",
    freight:"🚂 Goods carried by train, ship, or truck", jeopardy:"⚠️ Danger or risk of harm"
  };

  function pick(level, avoid) {
    const list = BANK[level] || BANK.easy;
    if (avoid && avoid.size) {
      const free = list.filter(w => !avoid.has(w[0]));
      if (free.length) return free[Math.floor(Math.random() * free.length)];
    }
    return list[Math.floor(Math.random() * list.length)];
  }

  function clue(word) {
    return CLUES[String(word || '').toLowerCase()] || null;
  }

  window.HSGSpellWords = {
    levels: ['easy', 'medium', 'hard', 'einstein'],
    bank: BANK,
    clues: CLUES,
    pick,
    clue
  };
})();
