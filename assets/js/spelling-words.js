// ============================================================
// HSGSpellWords — shared, graded spelling word bank.
// Lowercase, letters a–z only, so it drops straight into any
// spelling game. Three difficulty bands by length / trickiness.
// API:  HSGSpellWords.pick(level)            -> a random word
//       HSGSpellWords.pick(level, avoidSet)  -> avoids first letters in the Set
//       HSGSpellWords.levels                 -> ['easy','medium','hard']
// ============================================================
(function () {
  const BANK = {
    easy: [
      "cat","dog","sun","hat","bug","cup","bed","box","pig","fox",
      "owl","jam","web","fan","map","key","bus","pen","net","ant",
      "fish","ball","tree","book","frog","milk","jump","hand","star","cake",
      "ship","gold","rain","leaf","bird","king","lamp","ring","sock","nest",
      "gift","sand","wolf","corn","drum","flag","snow","moon","kite","bear",
      "duck","road","song","hill","boat"
    ],
    medium: [
      "apple","river","plant","cloud","bread","grass","house","mouse","table","chair",
      "happy","smile","water","light","night","sweet","dream","storm","green","brown",
      "bridge","dragon","garden","pencil","animal","orange","basket","castle","flower","jungle",
      "planet","rocket","school","spider","turtle","window","yellow","pirate","knight","monkey",
      "rabbit","guitar","winter","summer","forest","island","picture","morning","thunder","diamond",
      "kitchen","blanket"
    ],
    hard: [
      "elephant","dinosaur","mountain","hospital","computer","treasure","umbrella","butterfly","chocolate","adventure",
      "beautiful","dangerous","knowledge","vegetable","telescope","lightning","calendar","alphabet","geography","celebrate",
      "important","different","necessary","separate","beginning","surprise","scissors","sandwich","birthday","kangaroo",
      "crocodile","strawberry","wonderful","furniture","exercise","question","language","favorite","remember","together",
      "yesterday","neighbor","because","february","wednesday","rhythm","library","science"
    ]
  };

  // Super-obvious, kid-friendly clues. Each one all but names the word so the
  // only challenge left is spelling it. Emoji up front for instant recognition.
  const CLUES = {
    // ---- easy ----
    cat:"🐱 The furry pet that says \"meow\"", dog:"🐶 The pet that barks and wags its tail",
    sun:"☀️ The bright star that lights up the day", hat:"🎩 You wear this on your head",
    bug:"🐛 A tiny crawling insect", cup:"🥤 You drink water out of this",
    bed:"🛏️ You sleep in this at night", box:"📦 A square cardboard container",
    pig:"🐷 The pink farm animal that says \"oink\"", fox:"🦊 The clever orange animal with a bushy tail",
    owl:"🦉 The bird that says \"hoo\" at night", jam:"🍓 Sweet fruit spread for your toast",
    web:"🕸️ A spider spins this to catch bugs", fan:"🌀 It spins to blow cool air on you",
    map:"🗺️ It shows you where places are", key:"🔑 You use this to unlock a door",
    bus:"🚌 The big yellow vehicle that takes kids to school", pen:"🖊️ You write with this in ink",
    net:"🥅 You catch fish or score goals with this", ant:"🐜 A tiny insect that lives in a hill",
    fish:"🐟 The animal that swims and breathes underwater", ball:"⚽ A round toy you bounce, kick, or throw",
    tree:"🌳 A tall plant with a trunk and leaves", book:"📖 You read the pages of this",
    frog:"🐸 The green animal that hops and says \"ribbit\"", milk:"🥛 The white drink that comes from cows",
    jump:"🦘 To leap up off the ground", hand:"✋ The part of your body with five fingers",
    star:"⭐ A tiny twinkling light in the night sky", cake:"🎂 The sweet treat you eat on your birthday",
    ship:"🚢 A big boat that sails the ocean", gold:"🥇 The shiny yellow treasure metal",
    rain:"🌧️ Water that falls from the clouds", leaf:"🍃 The green part that grows on a tree",
    bird:"🐦 An animal with wings and feathers that flies", king:"👑 The man who rules a kingdom",
    lamp:"💡 You switch this on for light", ring:"💍 Shiny jewelry you wear on a finger",
    sock:"🧦 You wear this on your foot inside a shoe", nest:"🪺 The cozy home a bird builds for its eggs",
    gift:"🎁 A wrapped present you give someone", sand:"🏖️ The tiny grains you find at the beach",
    wolf:"🐺 The wild animal that howls at the moon", corn:"🌽 The yellow veggie on a cob",
    drum:"🥁 You bang on this to make a beat", flag:"🚩 A piece of cloth that waves on a pole",
    snow:"❄️ The cold white flakes that fall in winter", moon:"🌙 The big light in the night sky",
    kite:"🪁 You fly this on a string in the wind", bear:"🐻 The big furry animal that loves honey",
    duck:"🦆 The bird that says \"quack\" and swims", road:"🛣️ Cars drive on this",
    song:"🎵 Words and music you sing", hill:"⛰️ A small mountain you can climb",
    boat:"⛵ It floats on water and carries you across",
    // ---- medium ----
    apple:"🍎 The red fruit that keeps the doctor away", river:"🏞️ A long stream of water that flows to the sea",
    plant:"🌱 A green thing that grows from a seed", cloud:"☁️ The fluffy white thing in the sky",
    bread:"🍞 You make a sandwich with slices of this", grass:"🌿 The green stuff that covers a lawn",
    house:"🏠 The building where a family lives", mouse:"🐭 The tiny animal that says \"squeak\"",
    table:"🪑 You eat your dinner on top of this", chair:"🪑 You sit down on this",
    happy:"😊 The feeling when you're full of joy", smile:"🙂 You do this with your mouth when you're glad",
    water:"💧 The clear drink you need to stay alive", light:"💡 The opposite of dark",
    night:"🌃 The dark time when you go to sleep", sweet:"🍬 The taste of candy and sugar",
    dream:"💭 The story your mind plays while you sleep", storm:"⛈️ Wild weather with thunder and lightning",
    green:"🟢 The color of grass and leaves", brown:"🟤 The color of chocolate and tree trunks",
    bridge:"🌉 You cross this to get over a river", dragon:"🐉 The fire-breathing monster with wings",
    garden:"🌷 Where you grow flowers and veggies", pencil:"✏️ You write with this and erase mistakes",
    animal:"🐾 A living creature like a dog or lion", orange:"🍊 The round fruit that's also a color",
    basket:"🧺 A woven container with a handle", castle:"🏰 The huge stone home where a king lives",
    flower:"🌸 The pretty colorful part of a plant", jungle:"🌴 A thick hot forest full of wild animals",
    planet:"🪐 A huge round world like Earth or Mars", rocket:"🚀 The ship that blasts off into space",
    school:"🏫 The place where kids go to learn", spider:"🕷️ The eight-legged bug that spins webs",
    turtle:"🐢 The slow animal with a hard shell", window:"🪟 The glass you look out of in a wall",
    yellow:"🟡 The color of the sun and bananas", pirate:"🏴‍☠️ A sea robber who hunts for treasure",
    knight:"⚔️ A warrior in shining armor", monkey:"🐒 The animal that swings in trees and eats bananas",
    rabbit:"🐰 The hopping animal with long ears", guitar:"🎸 The instrument with six strings you strum",
    winter:"⛄ The cold snowy season of the year", summer:"🌞 The hot sunny season of the year",
    forest:"🌲 A big area covered in trees", island:"🏝️ Land with water all around it",
    picture:"🖼️ A photo or drawing you hang on a wall", morning:"🌅 The early part of the day when the sun rises",
    thunder:"🌩️ The loud boom you hear in a storm", diamond:"💎 The sparkly precious gem",
    kitchen:"🍳 The room where you cook food", blanket:"🛌 The soft cover that keeps you warm in bed",
    // ---- hard ----
    elephant:"🐘 The huge gray animal with a long trunk", dinosaur:"🦕 The giant reptile from long, long ago",
    mountain:"🏔️ A giant rocky peak you climb", hospital:"🏥 Where doctors help sick people get better",
    computer:"💻 The machine with a screen and keyboard", treasure:"💰 A chest of gold and jewels pirates hunt for",
    umbrella:"☂️ You hold this over your head in the rain", butterfly:"🦋 The pretty insect with colorful wings",
    chocolate:"🍫 The sweet brown candy everyone loves", adventure:"🗺️ An exciting and daring journey",
    beautiful:"😍 Very, very pretty to look at", dangerous:"⚠️ Something that can hurt you — not safe",
    knowledge:"🧠 All the things you know and have learned", vegetable:"🥦 Healthy food like broccoli or carrots",
    telescope:"🔭 You look through this to see the stars up close", lightning:"⚡ The bright flash in the sky during a storm",
    calendar:"📅 It shows all the days and months of the year", alphabet:"🔤 All 26 letters from A to Z",
    geography:"🌍 The study of the world's countries and maps", celebrate:"🎉 To have a party for something special",
    important:"❗ Something that really, really matters", different:"🔀 Not the same as something else",
    necessary:"✅ Something you absolutely need to have", separate:"✂️ To split things apart into pieces",
    beginning:"🏁 The very start, where something first begins", surprise:"🎈 Something unexpected that shocks you",
    scissors:"✂️ The tool with two blades for cutting paper", sandwich:"🥪 Two slices of bread with filling inside",
    birthday:"🎂 The special day you were born, with cake", kangaroo:"🦘 The hopping animal with a pouch from Australia",
    crocodile:"🐊 The big green reptile with sharp teeth", strawberry:"🍓 The red juicy fruit with tiny seeds",
    wonderful:"🌟 Really, really great and amazing", furniture:"🛋️ Things like chairs, tables, and sofas",
    exercise:"🏃 Moving your body to stay fit and strong", question:"❓ Something you ask when you want an answer",
    language:"🗣️ The words people speak, like English or Spanish", favorite:"⭐ The one you like the very best",
    remember:"🧠 To keep something in your mind, not forget", together:"🤝 When people are joined with each other",
    yesterday:"📆 The day right before today", neighbor:"🏡 The person who lives right next door",
    because:"💬 The word you use to give a reason", february:"❄️ The short, cold second month of the year",
    wednesday:"📅 The day in the middle of the school week", rhythm:"🥁 The steady beat in music you tap along to",
    library:"📚 The quiet place full of books you can borrow", science:"🔬 The study of nature, experiments, and how things work"
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
    levels: ['easy', 'medium', 'hard'],
    bank: BANK,
    clues: CLUES,
    pick,
    clue
  };
})();
