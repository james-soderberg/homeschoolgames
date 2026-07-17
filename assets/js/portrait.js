/* =========================================================
   HomeschoolGames - Cartoon Portrait engine
   ---------------------------------------------------------
   One parameterized SVG avatar renderer. A person is a small
   feature config (skin, hair, facial hair, hat, glasses, clothes);
   the same shapes drawn in a flat dark fill make the "locked"
   silhouette for the Hall of Fame.

     HSGPortrait.svg({ skin:'light', hair:'#2a2a2a', hairStyle:'short',
                       facial:'beardChin', hat:'tophat', clothes:'#222' });

   Returns an <svg> string (viewBox 0 0 100 116). Wrap it in an
   element with class .locked to render it as a silhouette (CSS).
   ========================================================= */
(function () {
  'use strict';

  var SKIN = {
    light:  '#f0c9a3', fair: '#f4d3b0', tan: '#d9a878',
    olive:  '#c79560', brown: '#a06a3f', deep: '#7a4a28'
  };
  function skinOf(s) { return SKIN[s] || s || SKIN.light; }
  function shade(hex, k) {
    // darken a #rrggbb by factor k (0..1)
    var n = parseInt(hex.slice(1), 16);
    var r = Math.round(((n >> 16) & 255) * (1 - k));
    var g = Math.round(((n >> 8) & 255) * (1 - k));
    var b = Math.round((n & 255) * (1 - k));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // ---- clothing / shoulders ----
  function shoulders(f) {
    var c = f.clothes || '#3a4a6a';
    var collar = f.collar || shade(c, 0.18);
    var s = '<path class="fig" d="M10 116 Q10 86 38 80 L62 80 Q90 86 90 116 Z" fill="' + c + '"/>';
    // lapels / collar hint
    s += '<path class="fig" d="M41 81 L50 94 L59 81 Q50 86 41 81 Z" fill="' + collar + '"/>';
    if (f.tie) s += '<path class="fig" d="M48 84 L52 84 L54 100 L50 106 L46 100 Z" fill="' + f.tie + '"/>';
    if (f.bowtie) s += '<path class="fig" d="M44 88 L50 91 L44 94 Z M56 88 L50 91 L56 94 Z" fill="' + f.bowtie + '"/><rect class="fig" x="49" y="89.5" width="2" height="3" fill="' + shade(f.bowtie, 0.3) + '"/>';
    if (f.shawl) s += '<path class="fig" d="M10 116 Q12 90 34 82 L40 96 L30 116 Z M90 116 Q88 90 66 82 L60 96 L70 116 Z" fill="' + f.shawl + '"/>';
    return s;
  }

  // ---- head, ears, neck ----
  function head(skin) {
    var sh = shade(skin, 0.12);
    return '<rect class="fig" x="44" y="64" width="12" height="16" rx="5" fill="' + sh + '"/>' +
      '<circle class="fig" cx="29" cy="50" r="5" fill="' + skin + '"/>' +
      '<circle class="fig" cx="71" cy="50" r="5" fill="' + skin + '"/>' +
      '<ellipse class="fig" cx="50" cy="48" rx="21" ry="24.5" fill="' + skin + '"/>';
  }

  // ---- face features ----
  function face(f) {
    var brow = f.hair && f.hairStyle !== 'bald' ? f.hair : '#6b4a32';
    if (f.hairStyle === 'bald' || f.hairStyle === 'baldTop') brow = f.facialColor || '#7a5a40';
    var eye = '#2c2622';
    var s = '';
    // brows
    s += '<path d="M37 41.5 Q42 39.5 47 41.5" stroke="' + brow + '" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
    s += '<path d="M53 41.5 Q58 39.5 63 41.5" stroke="' + brow + '" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
    // eyes
    s += '<ellipse cx="42" cy="47" rx="2.3" ry="3" fill="' + eye + '"/><ellipse cx="58" cy="47" rx="2.3" ry="3" fill="' + eye + '"/>';
    s += '<circle cx="42.8" cy="46.2" r="0.8" fill="#fff"/><circle cx="58.8" cy="46.2" r="0.8" fill="#fff"/>';
    // nose
    s += '<path d="M50 49 L47.5 57 Q50 59 52.5 57" stroke="' + shade(skinOf(f.skin), 0.22) + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    // mouth (hidden behind a full beard)
    if (f.facial !== 'beardFull') s += '<path d="M44 62 Q50 66.5 56 62" stroke="#a55b4a" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
    return s;
  }

  // ---- facial hair ----
  function facialHair(f) {
    var c = f.facialColor || f.hair || '#3a2a1c';
    switch (f.facial) {
      case 'mustache':
        return '<path class="fig" d="M43 59 Q50 62 57 59 Q50 61.5 43 59 Z" fill="' + c + '"/>';
      case 'mustacheBush':
        return '<path class="fig" d="M40 58 Q50 65 60 58 Q57 62 50 62 Q43 62 40 58 Z" fill="' + c + '"/>';
      case 'mustacheThin':
        return '<path class="fig" d="M44 59.5 Q50 61 56 59.5" stroke="' + c + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
      case 'goatee':
        return '<path class="fig" d="M44 59 Q50 61 56 59 Q55 61 50 61 Q45 61 44 59 Z" fill="' + c + '"/>' +
          '<path class="fig" d="M46 64 Q50 72 54 64 Q52 67 50 67 Q48 67 46 64 Z" fill="' + c + '"/>';
      case 'beardChin': // Lincoln: jaw + chin, no mustache
        return '<path class="fig" d="M30 50 Q31 70 50 76 Q69 70 70 50 Q66 64 50 67 Q34 64 30 50 Z" fill="' + c + '"/>';
      case 'beardFull':
        return '<path class="fig" d="M29 46 Q30 74 50 80 Q70 74 71 46 Q70 60 62 60 Q57 58 50 58 Q43 58 38 60 Q30 60 29 46 Z" fill="' + c + '"/>' +
          '<path class="fig" d="M41 58 Q50 64 59 58 Q50 61 41 58 Z" fill="' + shade(c, 0.15) + '"/>';
      case 'whiskers':
        return '<path class="fig" d="M28 48 Q27 64 40 66 Q34 58 33 48 Z" fill="' + c + '"/>' +
          '<path class="fig" d="M72 48 Q73 64 60 66 Q66 58 67 48 Z" fill="' + c + '"/>';
      default: return '';
    }
  }

  // ---- hair (back layer behind head, drawn before head) ----
  function hairBack(f) {
    var c = f.hair || '#2a2a2a';
    switch (f.hairStyle) {
      case 'long':
        return '<path class="fig" d="M24 44 Q22 80 34 86 L34 50 Q34 30 50 29 Q66 30 66 50 L66 86 Q78 80 76 44 Q74 22 50 21 Q26 22 24 44 Z" fill="' + c + '"/>';
      case 'bun':
        return '<circle class="fig" cx="50" cy="20" r="8" fill="' + c + '"/>';
      case 'updo':
        return '<path class="fig" d="M28 40 Q26 22 50 19 Q74 22 72 40 Q60 26 50 26 Q40 26 28 40 Z" fill="' + c + '"/>';
      case 'braids':
        return '<path class="fig" d="M27 44 Q24 84 33 90 Q30 70 33 50 Z" fill="' + c + '"/>' +
          '<path class="fig" d="M73 44 Q76 84 67 90 Q70 70 67 50 Z" fill="' + c + '"/>';
      case 'longCurl':
        return '<path class="fig" d="M24 44 Q20 78 33 88 Q28 64 33 48 Z" fill="' + c + '"/>' +
          '<path class="fig" d="M76 44 Q80 78 67 88 Q72 64 67 48 Z" fill="' + c + '"/>';
      default: return '';
    }
  }

  // ---- hair (front/top, drawn after head) ----
  function hairTop(f) {
    var c = f.hair || '#2a2a2a';
    var hi = shade(c, -0.0);
    switch (f.hairStyle) {
      case 'bald': return '';
      case 'baldTop': // bald crown, hair on the sides (Franklin)
        return '<path class="fig" d="M28 52 Q26 34 33 33 Q31 44 31 52 Z" fill="' + c + '"/>' +
          '<path class="fig" d="M72 52 Q74 34 67 33 Q69 44 69 52 Z" fill="' + c + '"/>';
      case 'receding':
        return '<path class="fig" d="M30 42 Q31 33 40 31 Q35 36 34 44 Z" fill="' + c + '"/>' +
          '<path class="fig" d="M70 42 Q69 33 60 31 Q65 36 66 44 Z" fill="' + c + '"/>';
      case 'short':
        return '<path class="fig" d="M29 45 Q29 24 50 23 Q71 24 71 45 Q67 32 50 31.5 Q33 32 29 45 Z" fill="' + c + '"/>';
      case 'sidePart':
        return '<path class="fig" d="M29 46 Q29 24 50 23 Q71 24 71 44 Q69 33 52 32 Q50 26 44 27 Q33 30 29 46 Z" fill="' + c + '"/>' +
          '<path class="fig" d="M44 27 Q40 35 33 40" stroke="' + shade(c, 0.25) + '" stroke-width="1" fill="none"/>';
      case 'sweptBack':
        return '<path class="fig" d="M29 44 Q31 25 50 24 Q71 25 71 44 Q64 31 50 31 Q36 31 29 44 Z" fill="' + c + '"/>' +
          '<path class="fig" d="M34 36 Q50 30 66 36" stroke="' + shade(c, 0.22) + '" stroke-width="1" fill="none"/>';
      case 'wild': // Einstein
        return '<path class="fig" d="M27 46 Q20 30 28 28 Q24 22 32 22 Q33 16 42 20 Q46 14 54 19 Q62 14 66 21 Q74 19 72 27 Q80 30 73 46 Q70 32 50 31 Q30 32 27 46 Z" fill="' + c + '"/>';
      case 'curly':
        return '<path class="fig" d="M28 46 Q26 30 34 28 Q34 22 42 24 Q46 19 52 24 Q60 21 64 27 Q73 27 72 44 Q66 33 50 33 Q34 33 28 46 Z" fill="' + c + '"/>' +
          '<circle class="fig" cx="33" cy="34" r="4" fill="' + c + '"/><circle class="fig" cx="67" cy="34" r="4" fill="' + c + '"/><circle class="fig" cx="50" cy="26" r="4.5" fill="' + c + '"/>';
      case 'caesar': // short forward fringe
        return '<path class="fig" d="M30 44 Q30 26 50 25 Q70 26 70 44 Q66 36 60 37 Q56 33 50 34 Q44 33 40 37 Q34 36 30 44 Z" fill="' + c + '"/>';
      case 'long':
      case 'bun':
      case 'updo':
      case 'braids':
      case 'longCurl':
        // front fringe to pair with the back layer
        return '<path class="fig" d="M30 45 Q30 27 50 26 Q70 27 70 45 Q66 34 50 34 Q34 34 30 45 Z" fill="' + c + '"/>';
      default:
        return '<path class="fig" d="M29 45 Q29 24 50 23 Q71 24 71 45 Q67 32 50 31.5 Q33 32 29 45 Z" fill="' + c + '"/>';
    }
  }

  // ---- glasses ----
  function glasses(f) {
    if (!f.glasses) return '';
    var st = '#2c2622', w = f.glasses === 'round' ? 6 : 6.5, ry = f.glasses === 'round' ? 6 : 4.8;
    var rx = f.glasses === 'round' ? 6 : 6.5;
    return '<g fill="none" stroke="' + st + '" stroke-width="1.4">' +
      '<ellipse cx="42" cy="47" rx="' + rx + '" ry="' + ry + '"/>' +
      '<ellipse cx="58" cy="47" rx="' + rx + '" ry="' + ry + '"/>' +
      '<path d="M48 47 H52"/><path d="M36 46 L31 45"/><path d="M64 46 L69 45"/></g>';
  }

  // ---- headwear (drawn last) ----
  function hat(f) {
    switch (f.hat) {
      case 'tophat':
        return '<g class="fig"><rect x="24" y="14" width="52" height="6" rx="2" fill="#1c1a18"/>' +
          '<rect x="31" y="-6" width="38" height="22" rx="2" fill="#26221e"/>' +
          '<rect x="31" y="8" width="38" height="3" fill="#6a4a2a"/></g>';
      case 'laurel':
        return '<g class="fig" fill="#5b8f4a">' +
          '<path d="M30 40 Q20 30 24 18 Q30 28 33 38 Z"/><path d="M70 40 Q80 30 76 18 Q70 28 67 38 Z"/>' +
          '<circle cx="24" cy="20" r="2.4"/><circle cx="27" cy="27" r="2.4"/><circle cx="30" cy="34" r="2.2"/>' +
          '<circle cx="76" cy="20" r="2.4"/><circle cx="73" cy="27" r="2.4"/><circle cx="70" cy="34" r="2.2"/></g>';
      case 'bicorne': // naval / cocked hat
        return '<g class="fig"><path d="M22 22 Q50 6 78 22 Q50 18 22 22 Z" fill="#1a2240"/>' +
          '<path d="M24 21 Q50 10 76 21 L74 25 Q50 16 26 25 Z" fill="#2a3258"/>' +
          '<circle cx="64" cy="19" r="2.5" fill="#d4af37"/></g>';
      case 'headscarf':
        return '<g class="fig"><path d="M27 46 Q24 20 50 19 Q76 20 73 46 Q70 30 50 29 Q30 30 27 46 Z" fill="' + (f.scarf || '#e8e4d8') + '"/>' +
          '<path d="M27 44 Q26 52 31 58 L36 50 Q31 48 27 44 Z" fill="' + shade(f.scarf || '#e8e4d8', 0.12) + '"/></g>';
      case 'feather':
        return '<g class="fig"><path d="M30 44 Q30 26 50 25 Q70 26 70 44 Q66 33 50 33 Q34 33 30 44 Z" fill="' + (f.hair || '#1c1c1c') + '"/>' +
          '<path d="M64 30 Q70 12 74 8 Q72 18 70 30 Z" fill="#d96b4a"/><path d="M66 26 Q71 14 73 11" stroke="#fff" stroke-width="0.8" fill="none"/>' +
          '<rect x="62" y="30" width="8" height="3" rx="1" fill="#b85a3a"/></g>';
      case 'helmet': // spacesuit collar + helmet ring
        return '<g class="fig"><path d="M22 70 Q22 56 50 54 Q78 56 78 70 Z" fill="#e8eaee"/>' +
          '<rect x="30" y="64" width="40" height="4" rx="2" fill="#c2c6cc"/>' +
          '<circle cx="50" cy="20" r="3" fill="#d4d8de"/></g>';
      default: return '';
    }
  }

  function svg(f, opts) {
    opts = opts || {};
    var skin = skinOf(f.skin);
    var bg = opts.bg || f.bg || '#efe7d6';
    var inner =
      '<rect class="hof-bg" x="0" y="0" width="100" height="116" fill="' + bg + '"/>' +
      shoulders(f) +
      hairBack(f) +
      head(skin) +
      face(f) +
      facialHair(f) +
      hairTop(f) +
      glasses(f) +
      hat(f);
    return '<svg class="hof-svg" viewBox="0 0 100 116" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  }

  window.HSGPortrait = { svg: svg, skinOf: skinOf, shade: shade };
})();
