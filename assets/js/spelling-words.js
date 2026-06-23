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

  function pick(level, avoid) {
    const list = BANK[level] || BANK.easy;
    if (avoid && avoid.size) {
      const free = list.filter(w => !avoid.has(w[0]));
      if (free.length) return free[Math.floor(Math.random() * free.length)];
    }
    return list[Math.floor(Math.random() * list.length)];
  }

  window.HSGSpellWords = {
    levels: ['easy', 'medium', 'hard'],
    bank: BANK,
    pick
  };
})();
