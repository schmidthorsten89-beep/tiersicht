'use strict';

const $ = (id) => document.getElementById(id);
const leinwand = $('leinwand');
const video = $('video');
const teiler = $('teiler');
const hinweis = $('hinweis');
const infoDialog = $('info');
const fotoAnsicht = $('foto');
const dateiFeld = $('datei');

// Neutrale Filterwerte; jedes Tier überschreibt nur, was es braucht.
const NEUTRAL = {
  fisch: 0, kreis: 0, zoom: 1, facette: 0, unschaerfe: 0, schaerfen: 0,
  matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], saettigung: 1, toenung: [1, 1, 1],
  dunst: 0, dunstFarbe: [0, 0, 0], hell: 1, staebchen: 0, rauschen: 0, waerme: 0, vignette: 0,
};

const zustand = {
  tier: TIERE[0],
  vergleich: false,
  teilung: 0.5,
  richtung: 'environment',
  strom: null,
  quelle: null, // 'video' | 'bild' | null
  bild: null,
  bildNeu: false,
  kameraVersuch: 0,
  kameraVorPause: false,
  fotoBlob: null,
  fotoUrl: '',
};

// ---------- WebGL ----------

const ECKEN_SHADER = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FARB_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uBild;
uniform vec2 uAufl;      // Leinwand in Pixeln
uniform vec2 uSkala;     // sichtbarer Ausschnitt des Kamerabilds
uniform float uSeiten;   // Breite / Höhe
uniform float uSpiegeln;
uniform float uTeilung;  // links davon: Menschensicht
uniform float uZeit;
uniform float uFisch, uKreis, uZoom, uFacette, uUnschaerfe, uSchaerfen;
uniform mat3 uFarbe;
uniform float uSaettigung;
uniform vec3 uToenung;
uniform float uDunst;
uniform vec3 uDunstFarbe;
uniform float uHell, uStaebchen, uRauschen, uWaerme, uVignette;

vec3 hole(vec2 p) {
  vec2 t = (p - 0.5) * uSkala + 0.5;
  if (uSpiegeln > 0.5) t.x = 1.0 - t.x;
  return texture2D(uBild, t).rgb;
}

// 16 Punkte auf einer Spirale ergeben eine gleichmäßige Scheibe; Radius in Bildhöhen.
vec3 weich(vec2 p, float radius) {
  vec3 summe = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    float r = sqrt((fi + 0.5) / 16.0) * radius;
    float a = fi * 2.39996323;
    summe += hole(p + vec2(cos(a) * r / uSeiten, sin(a) * r));
  }
  return summe / 16.0;
}

vec3 waermeFarbe(float w) {
  vec3 a = vec3(0.0, 0.0, 0.12);
  vec3 b = vec3(0.38, 0.0, 0.55);
  vec3 c = vec3(0.9, 0.12, 0.25);
  vec3 d = vec3(1.0, 0.62, 0.0);
  vec3 e = vec3(1.0, 1.0, 0.85);
  if (w < 0.25) return mix(a, b, w / 0.25);
  if (w < 0.5) return mix(b, c, (w - 0.25) / 0.25);
  if (w < 0.75) return mix(c, d, (w - 0.5) / 0.25);
  return mix(d, e, (w - 0.75) / 0.25);
}

float zufall(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uAufl;
  if (uv.x < uTeilung) {
    gl_FragColor = vec4(hole(uv), 1.0);
    return;
  }

  // Abstand zur Bildmitte, in Bildhöhen gemessen
  vec2 d = uv - 0.5;
  d.x *= uSeiten;
  float r = length(d);
  float rEcke = r / (0.5 * sqrt(1.0 + uSeiten * uSeiten)); // 1 = Bildecke
  float rRand = r / (0.5 * min(uSeiten, 1.0));              // 1 = nächster Bildrand

  // 1. Verzerrung
  vec2 s = d;
  if (uKreis > 0.0) {
    // Rundes Fenster: Wölbung innerhalb des Kreises, der Kreisrand zeigt den Bildrand.
    float rn = rRand / uKreis;
    s *= (1.0 + uFisch * rn * rn) / (1.0 + uFisch) / uKreis;
  } else if (uFisch > 0.0) {
    s *= (1.0 + uFisch * rEcke * rEcke) / (1.0 + uFisch);
  }
  if (uZoom > 1.0) s *= mix(1.0 / uZoom, 1.0, smoothstep(0.1, 0.38, r));
  vec2 p = vec2(s.x / uSeiten, s.y) + 0.5;

  // 2./3. Facettenauge, Unschärfe oder Nachschärfen
  vec3 farbe;
  if (uFacette > 0.0) {
    vec2 q = vec2(p.x * uSeiten, p.y) * uFacette;
    vec2 raster = vec2(1.0, 1.7320508);
    vec2 h = raster * 0.5;
    vec2 a = mod(q, raster) - h;
    vec2 b = mod(q - h, raster) - h;
    vec2 g = dot(a, a) < dot(b, b) ? a : b;
    vec2 mitte = q - g;
    vec2 pm = vec2(mitte.x / uFacette / uSeiten, mitte.y / uFacette);
    farbe = weich(pm, max(uUnschaerfe, 0.45 / uFacette));
    farbe *= mix(0.45, 1.0, 1.0 - smoothstep(0.36, 0.52, length(g)));
  } else if (uUnschaerfe > 0.0) {
    farbe = weich(p, uUnschaerfe);
  } else {
    farbe = hole(p);
    if (uSchaerfen > 0.0) farbe += (farbe - weich(p, 0.004)) * uSchaerfen;
  }
  farbe = clamp(farbe, 0.0, 1.0);

  // Wärme-Schätzung (Darstellungsidee): hell und rötlich = warm, bläulich = kalt
  vec3 waerme = vec3(0.0);
  if (uWaerme > 0.0) {
    float hellG = dot(farbe, vec3(0.299, 0.587, 0.114));
    float w = 0.45 * hellG + 1.3 * max(farbe.r - max(farbe.g, farbe.b), 0.0) - 0.8 * max(farbe.b - farbe.r, 0.0);
    waerme = waermeFarbe(clamp(w * 1.25, 0.0, 1.0));
  }

  // 4./5. Farben und Licht in linearem RGB
  vec3 lin = pow(farbe, vec3(2.2));
  lin = max(uFarbe * lin, 0.0);
  if (uStaebchen > 0.0) {
    float skot = dot(lin, vec3(0.05, 0.55, 0.40));
    lin = mix(lin, skot * vec3(0.85, 0.95, 1.12), uStaebchen);
  }
  float lum = dot(lin, vec3(0.2126, 0.7152, 0.0722));
  lin = max(mix(vec3(lum), lin, uSaettigung), 0.0);
  lin *= uToenung;
  lin = mix(lin, uDunstFarbe, uDunst);
  if (uHell > 1.0) lin = (1.0 - exp(-lin * uHell * 1.5)) / (1.0 - exp(-uHell * 1.5));
  farbe = pow(clamp(lin, 0.0, 1.0), vec3(1.0 / 2.2));

  // 6. Wärmebild darüberlegen
  if (uWaerme > 0.0) farbe = mix(farbe, waerme, uWaerme);

  if (uRauschen > 0.0) {
    farbe += (zufall(gl_FragCoord.xy + fract(uZeit) * vec2(91.7, 37.3)) - 0.5) * uRauschen * 2.0;
  }

  // Ränder
  if (uVignette > 0.0) farbe *= 1.0 - uVignette * smoothstep(0.45, 1.0, rEcke);
  if (uKreis > 0.0) {
    farbe = mix(farbe, vec3(0.02, 0.1, 0.12), smoothstep(uKreis - 0.04, uKreis, rRand));
  }

  gl_FragColor = vec4(clamp(farbe, 0.0, 1.0), 1.0);
}
`;

let gl = null;
let programm = null;
let orte = {};

function baueShader(art, quelltext) {
  const shader = gl.createShader(art);
  gl.shaderSource(shader, quelltext);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'Shader-Fehler');
  }
  return shader;
}

function starteWebGL() {
  gl = leinwand.getContext('webgl', { alpha: false, antialias: false, depth: false, premultipliedAlpha: false });
  if (!gl) return false;

  programm = gl.createProgram();
  gl.attachShader(programm, baueShader(gl.VERTEX_SHADER, ECKEN_SHADER));
  gl.attachShader(programm, baueShader(gl.FRAGMENT_SHADER, FARB_SHADER));
  gl.linkProgram(programm);
  if (!gl.getProgramParameter(programm, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(programm) || 'Programm-Fehler');
  }
  gl.useProgram(programm);

  const puffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, puffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(programm, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const textur = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, textur);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  orte = {};
  ['uBild', 'uAufl', 'uSkala', 'uSeiten', 'uSpiegeln', 'uTeilung', 'uZeit', 'uFisch', 'uKreis', 'uZoom',
    'uFacette', 'uUnschaerfe', 'uSchaerfen', 'uFarbe', 'uSaettigung', 'uToenung', 'uDunst', 'uDunstFarbe',
    'uHell', 'uStaebchen', 'uRauschen', 'uWaerme', 'uVignette'].forEach((name) => {
    orte[name] = gl.getUniformLocation(programm, name);
  });
  gl.uniform1i(orte.uBild, 0);
  setzeFilter(zustand.tier.filter);
  zustand.bildNeu = Boolean(zustand.bild);
  return true;
}

function setzeFilter(werte) {
  if (!gl) return;
  const f = Object.assign({}, NEUTRAL, werte);
  const m = f.matrix;
  // GLSL erwartet Spalten; die Tierdaten sind zeilenweise geschrieben.
  gl.uniformMatrix3fv(orte.uFarbe, false, new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]));
  gl.uniform1f(orte.uFisch, f.fisch);
  gl.uniform1f(orte.uKreis, f.kreis);
  gl.uniform1f(orte.uZoom, f.zoom);
  gl.uniform1f(orte.uFacette, f.facette);
  gl.uniform1f(orte.uUnschaerfe, f.unschaerfe);
  gl.uniform1f(orte.uSchaerfen, f.schaerfen);
  gl.uniform1f(orte.uSaettigung, f.saettigung);
  gl.uniform3fv(orte.uToenung, f.toenung);
  gl.uniform1f(orte.uDunst, f.dunst);
  gl.uniform3fv(orte.uDunstFarbe, f.dunstFarbe);
  gl.uniform1f(orte.uHell, f.hell);
  gl.uniform1f(orte.uStaebchen, f.staebchen);
  gl.uniform1f(orte.uRauschen, f.rauschen);
  gl.uniform1f(orte.uWaerme, f.waerme);
  gl.uniform1f(orte.uVignette, f.vignette);
}

function quellMasse() {
  if (zustand.quelle === 'video' && video.readyState >= 2 && video.videoWidth > 0) {
    return [video.videoWidth, video.videoHeight];
  }
  if (zustand.quelle === 'bild' && zustand.bild) return [zustand.bild.width, zustand.bild.height];
  return null;
}

function passeGroesseAn() {
  const faktor = Math.min(window.devicePixelRatio || 1, 1.5);
  const breite = Math.max(1, Math.round(leinwand.clientWidth * faktor));
  const hoehe = Math.max(1, Math.round(leinwand.clientHeight * faktor));
  if (leinwand.width !== breite || leinwand.height !== hoehe) {
    leinwand.width = breite;
    leinwand.height = hoehe;
  }
  gl.viewport(0, 0, breite, hoehe);
  return [breite, hoehe];
}

// Zeichnet ein Bild; gibt false zurück, solange keine Quelle bereit ist.
function zeichne(zeit) {
  if (!gl || gl.isContextLost()) return false;
  const masse = quellMasse();
  if (!masse) return false;
  const [breite, hoehe] = passeGroesseAn();

  if (zustand.quelle === 'video') {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
  } else if (zustand.bildNeu) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, zustand.bild);
    zustand.bildNeu = false;
  }

  // Bild füllt die Leinwand und wird an den Rändern beschnitten (wie object-fit: cover).
  const skala = Math.max(breite / masse[0], hoehe / masse[1]);
  gl.uniform2f(orte.uAufl, breite, hoehe);
  gl.uniform2f(orte.uSkala, breite / (skala * masse[0]), hoehe / (skala * masse[1]));
  gl.uniform1f(orte.uSeiten, breite / hoehe);
  gl.uniform1f(orte.uSpiegeln, zustand.quelle === 'video' && zustand.richtung === 'user' ? 1 : 0);
  gl.uniform1f(orte.uTeilung, zustand.vergleich ? zustand.teilung : -1);
  gl.uniform1f(orte.uZeit, ((zeit || performance.now()) / 1000) % 1000);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return true;
}

function schleife(zeit) {
  zeichne(zeit);
  requestAnimationFrame(schleife);
}

// ---------- Kamera ----------

function stoppeKamera() {
  if (zustand.strom) zustand.strom.getTracks().forEach((spur) => spur.stop());
  zustand.strom = null;
  video.srcObject = null;
  if (zustand.quelle === 'video') zustand.quelle = null;
}

async function starteKamera() {
  const versuch = ++zustand.kameraVersuch;
  stoppeKamera();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    zeigeHinweis('Die Kamera ist nur über eine sichere Verbindung (https) erreichbar. Du kannst aber ein Bild aus der Galerie wählen.');
    return;
  }
  try {
    const strom = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: zustand.richtung }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    if (versuch !== zustand.kameraVersuch) {
      strom.getTracks().forEach((spur) => spur.stop());
      return;
    }
    zustand.strom = strom;
    video.srcObject = strom;
    await video.play();
    zustand.quelle = 'video';
    zustand.bild = null;
    versteckeHinweis();
    aktualisiereKnoepfe();
    pruefeKameraAnzahl();
  } catch (fehler) {
    if (versuch !== zustand.kameraVersuch) return;
    stoppeKamera();
    const name = fehler && fehler.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      zeigeHinweis('Der Kamerazugriff wurde nicht erlaubt. Tippe in Chrome auf das Symbol links neben der Adresse, erlaube die Kamera und versuche es erneut – oder wähle ein Bild aus der Galerie.');
    } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      zeigeHinweis('Es wurde keine Kamera gefunden. Wähle stattdessen ein Bild aus der Galerie.');
    } else if (name === 'NotReadableError') {
      zeigeHinweis('Die Kamera wird gerade von einer anderen App benutzt. Schließe die andere App und versuche es erneut.');
    } else {
      zeigeHinweis('Die Kamera ließ sich nicht starten. Versuche es erneut oder wähle ein Bild aus der Galerie.');
    }
  }
}

async function pruefeKameraAnzahl() {
  try {
    const geraete = await navigator.mediaDevices.enumerateDevices();
    const anzahl = geraete.filter((g) => g.kind === 'videoinput').length;
    $('knopf-wechseln').hidden = anzahl < 2 || zustand.quelle !== 'video';
  } catch (_) {
    $('knopf-wechseln').hidden = true;
  }
}

function zeigeHinweis(text) {
  if (zustand.quelle === 'bild') return;
  $('hinweis-text').textContent = text;
  hinweis.hidden = false;
  aktualisiereKnoepfe();
}

function versteckeHinweis() {
  hinweis.hidden = true;
}

function aktualisiereKnoepfe() {
  const kameraLaeuft = zustand.quelle === 'video';
  $('knopf-kamera').hidden = zustand.quelle !== 'bild';
  $('platzhalter-rechts').hidden = zustand.quelle === 'bild';
  if (!kameraLaeuft) $('knopf-wechseln').hidden = true;
}

// Große Fotos werden verkleinert, weil Handys Texturen nur bis zu einer Höchstgröße annehmen.
function ladeBild(datei) {
  const adresse = URL.createObjectURL(datei);
  const bild = new Image();
  bild.onload = () => {
    URL.revokeObjectURL(adresse);
    const grenze = Math.min(2048, (gl && gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 2048);
    const faktor = Math.min(1, grenze / Math.max(bild.naturalWidth, bild.naturalHeight));
    const flaeche = document.createElement('canvas');
    flaeche.width = Math.max(1, Math.round(bild.naturalWidth * faktor));
    flaeche.height = Math.max(1, Math.round(bild.naturalHeight * faktor));
    flaeche.getContext('2d').drawImage(bild, 0, 0, flaeche.width, flaeche.height);
    zustand.kameraVersuch++;
    stoppeKamera();
    zustand.bild = flaeche;
    zustand.bildNeu = true;
    zustand.quelle = 'bild';
    versteckeHinweis();
    aktualisiereKnoepfe();
  };
  bild.onerror = () => {
    URL.revokeObjectURL(adresse);
    zeigeStatus('Das Bild konnte nicht geöffnet werden.');
  };
  bild.src = adresse;
}

// ---------- Tiere ----------

function baueTierliste() {
  const liste = $('tierliste');
  TIERE.forEach((tier) => {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'tier';
    knopf.setAttribute('role', 'option');
    knopf.dataset.id = tier.id;
    const emoji = document.createElement('span');
    emoji.className = 'tier-emoji';
    emoji.textContent = tier.emoji;
    const name = document.createElement('span');
    name.className = 'tier-name';
    name.textContent = tier.name;
    knopf.append(emoji, name);
    knopf.addEventListener('click', () => {
      if (zustand.tier === tier) oeffneInfo();
      else waehleTier(tier);
    });
    liste.append(knopf);
  });
}

function waehleTier(tier, ohneScrollen) {
  zustand.tier = tier;
  setzeFilter(tier.filter);
  $('titel-name').textContent = `${tier.emoji} ${tier.name}`;
  $('titel-kurz').textContent = tier.kurz;
  $('teiler-tier').textContent = tier.name;
  document.querySelectorAll('.tier').forEach((knopf) => {
    const aktiv = knopf.dataset.id === tier.id;
    knopf.setAttribute('aria-selected', String(aktiv));
    if (aktiv && !ohneScrollen) knopf.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
  try { localStorage.setItem('tiersicht-tier', tier.id); } catch (_) { /* egal */ }
}

// ---------- Erklärung ----------

function sektorPfad(cx, cy, r, grad) {
  if (grad >= 359) {
    return `M${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
  }
  const halb = (grad / 2) * Math.PI / 180;
  const x1 = (cx - r * Math.sin(halb)).toFixed(1);
  const y1 = (cy - r * Math.cos(halb)).toFixed(1);
  const x2 = (cx + r * Math.sin(halb)).toFixed(1);
  const gross = grad > 180 ? 1 : 0;
  return `M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${gross} 1 ${x2} ${y1} Z`;
}

function baueSichtfeld(tier) {
  const figur = $('info-sichtfeld');
  const f = tier.fakten;
  if (!f.sichtfeld) {
    figur.hidden = true;
    figur.textContent = '';
    return;
  }
  figur.hidden = false;
  const mensch = TIERE[0].fakten;
  const istMensch = tier.id === 'mensch';
  const cx = 100;
  const cy = 92;
  const r = 62;
  let svg = `<svg viewBox="0 0 200 170" role="img" aria-label="Sichtfeld von oben gesehen">`;
  svg += `<text x="100" y="12" text-anchor="middle" font-size="10" fill="#aab4bf">▲ vorn</text>`;
  svg += `<path d="${sektorPfad(cx, cy, r, f.sichtfeld)}" fill="#f2b640" fill-opacity="0.3"/>`;
  if (f.beidaeugig) svg += `<path d="${sektorPfad(cx, cy, r, f.beidaeugig)}" fill="#f2b640" fill-opacity="0.75"/>`;
  if (!istMensch) {
    svg += `<path d="${sektorPfad(cx, cy, r + 8, mensch.sichtfeld)}" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  }
  svg += `<circle cx="${cx}" cy="${cy}" r="15" fill="#1b2128"/>`;
  svg += `<text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="17">${tier.emoji}</text>`;
  svg += '</svg>';

  const teile = [`<span class="legende" style="--farbe: rgba(242,182,64,0.4)">Sichtfeld ca. ${f.sichtfeld}°</span>`];
  if (f.beidaeugig) teile.push(`<span class="legende" style="--farbe: #f2b640">beide Augen ca. ${f.beidaeugig}°</span>`);
  if (!istMensch) teile.push(`<span>– – Mensch ca. ${mensch.sichtfeld}°</span>`);
  figur.innerHTML = `${svg}<figcaption>${teile.join('')}</figcaption>`;
}

function fuegeFaktHinzu(liste, titel, wert) {
  if (!wert) return;
  const dt = document.createElement('dt');
  dt.textContent = titel;
  const dd = document.createElement('dd');
  dd.textContent = wert;
  liste.append(dt, dd);
}

function oeffneInfo() {
  const tier = zustand.tier;
  const f = tier.fakten;
  $('info-emoji').textContent = tier.emoji;
  $('info-name').textContent = tier.name;
  $('info-kurz').textContent = tier.kurz;

  const liste = $('info-fakten');
  liste.textContent = '';
  fuegeFaktHinzu(liste, 'Farben', f.farben);
  fuegeFaktHinzu(liste, 'Schärfe', f.schaerfe);
  if (f.sichtfeld) {
    fuegeFaktHinzu(liste, 'Sichtfeld', `ca. ${f.sichtfeld}°${f.beidaeugig ? `, davon ${f.beidaeugig}° mit beiden Augen` : ''}`);
  }
  fuegeFaktHinzu(liste, 'Bei Nacht', f.nacht);
  fuegeFaktHinzu(liste, 'Zeitauflösung', f.bewegung);

  baueSichtfeld(tier);

  const texte = $('info-texte');
  texte.textContent = '';
  tier.texte.forEach((absatz) => {
    const p = document.createElement('p');
    p.textContent = absatz;
    texte.append(p);
  });

  const grenze = $('info-grenze');
  grenze.textContent = '';
  if (tier.grenze) {
    const titel = document.createElement('strong');
    titel.textContent = 'Was die App nicht zeigen kann';
    grenze.append(titel, document.createTextNode(tier.grenze));
  }

  infoDialog.querySelector('.sheet-inhalt').scrollTop = 0;
  if (!infoDialog.open) infoDialog.showModal();
}

// ---------- Vergleich ----------

function setzeVergleich(an) {
  zustand.vergleich = an;
  $('knopf-vergleich').setAttribute('aria-pressed', String(an));
  teiler.hidden = !an;
  setzeTeilung(zustand.teilung);
  if (an && zustand.tier.id === 'mensch') zeigeStatus('Wähle unten ein Tier für den Vergleich.');
}

function setzeTeilung(wert) {
  zustand.teilung = Math.min(0.95, Math.max(0.05, wert));
  teiler.style.left = `${zustand.teilung * 100}%`;
}

function ziehen(ereignis) {
  const rahmen = leinwand.getBoundingClientRect();
  setzeTeilung((ereignis.clientX - rahmen.left) / rahmen.width);
}

function richteZiehenEin(element) {
  element.addEventListener('pointerdown', (e) => {
    if (!zustand.vergleich) return;
    element.setPointerCapture(e.pointerId);
    ziehen(e);
  });
  element.addEventListener('pointermove', (e) => {
    if (zustand.vergleich && element.hasPointerCapture(e.pointerId)) ziehen(e);
  });
}

// ---------- Foto ----------

function dateiname() {
  const jetzt = new Date();
  const zwei = (n) => String(n).padStart(2, '0');
  const stempel = `${jetzt.getFullYear()}-${zwei(jetzt.getMonth() + 1)}-${zwei(jetzt.getDate())}_${zwei(jetzt.getHours())}-${zwei(jetzt.getMinutes())}-${zwei(jetzt.getSeconds())}`;
  return `tiersicht-${zustand.tier.id}-${stempel}.jpg`;
}

function fotografiere() {
  // Direkt nach dem Zeichnen auslesen, solange der Bildpuffer noch gefüllt ist.
  if (!zeichne()) {
    zeigeStatus('Noch kein Bild – erlaube die Kamera oder wähle ein Bild.');
    return;
  }
  const name = dateiname();
  leinwand.toBlob((blob) => {
    if (!blob) {
      zeigeStatus('Das Foto konnte nicht erstellt werden.');
      return;
    }
    if (zustand.fotoUrl) URL.revokeObjectURL(zustand.fotoUrl);
    zustand.fotoBlob = new File([blob], name, { type: 'image/jpeg' });
    zustand.fotoUrl = URL.createObjectURL(blob);
    $('foto-bild').src = zustand.fotoUrl;
    $('foto-teilen').hidden = !(navigator.canShare && navigator.canShare({ files: [zustand.fotoBlob] }));
    fotoAnsicht.hidden = false;
  }, 'image/jpeg', 0.92);
}

async function teileFoto() {
  if (!zustand.fotoBlob) return;
  try {
    await navigator.share({ files: [zustand.fotoBlob], title: 'Tiersicht', text: `Die Welt mit Tieraugen gesehen (${zustand.tier.name}) – ungefähr.` });
  } catch (fehler) {
    if (!fehler || fehler.name !== 'AbortError') zeigeStatus('Teilen hat nicht geklappt.');
  }
}

function speichereFoto() {
  if (!zustand.fotoBlob) return;
  const link = document.createElement('a');
  link.href = zustand.fotoUrl;
  link.download = zustand.fotoBlob.name;
  document.body.append(link);
  link.click();
  link.remove();
  zeigeStatus('Foto wird im Download-Ordner gespeichert.');
}

function schliesseFoto() {
  fotoAnsicht.hidden = true;
}

// ---------- Allgemein ----------

let statusTimer = 0;
function zeigeStatus(text, dauer = 2800) {
  const status = $('status');
  status.textContent = text;
  status.hidden = false;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { status.hidden = true; }, dauer);
}

function verbindeKnoepfe() {
  $('knopf-info').addEventListener('click', oeffneInfo);
  $('knopf-titel').addEventListener('click', oeffneInfo);
  $('info-schliessen').addEventListener('click', () => infoDialog.close());
  infoDialog.addEventListener('click', (e) => {
    if (e.target === infoDialog) infoDialog.close();
  });

  $('knopf-vergleich').addEventListener('click', () => setzeVergleich(!zustand.vergleich));
  richteZiehenEin(teiler);
  richteZiehenEin(leinwand);

  $('knopf-wechseln').addEventListener('click', () => {
    zustand.richtung = zustand.richtung === 'environment' ? 'user' : 'environment';
    starteKamera();
  });
  $('knopf-erneut').addEventListener('click', starteKamera);
  $('knopf-kamera').addEventListener('click', starteKamera);

  const waehleDatei = () => dateiFeld.click();
  $('knopf-bild').addEventListener('click', waehleDatei);
  $('knopf-bild-hinweis').addEventListener('click', waehleDatei);
  dateiFeld.addEventListener('change', () => {
    const datei = dateiFeld.files && dateiFeld.files[0];
    if (datei) ladeBild(datei);
    dateiFeld.value = '';
  });

  $('knopf-foto').addEventListener('click', fotografiere);
  $('foto-teilen').addEventListener('click', teileFoto);
  $('foto-speichern').addEventListener('click', speichereFoto);
  $('foto-schliessen').addEventListener('click', schliesseFoto);

  // Kamera im Hintergrund abschalten (Akku, Kamera-Lämpchen) und beim Zurückkommen wieder starten.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      zustand.kameraVorPause = zustand.quelle === 'video';
      if (zustand.kameraVorPause) {
        zustand.kameraVersuch++;
        stoppeKamera();
      }
    } else if (zustand.kameraVorPause) {
      zustand.kameraVorPause = false;
      starteKamera();
    }
  });

  leinwand.addEventListener('webglcontextlost', (e) => e.preventDefault());
  leinwand.addEventListener('webglcontextrestored', () => {
    try { starteWebGL(); } catch (_) { /* nächster Versuch beim Neuladen */ }
  });
}

function start() {
  baueTierliste();
  let gespeichert = null;
  try { gespeichert = localStorage.getItem('tiersicht-tier'); } catch (_) { /* egal */ }
  waehleTier(TIERE.find((t) => t.id === gespeichert) || TIERE[0], true);
  verbindeKnoepfe();

  let webglOk = false;
  try {
    webglOk = starteWebGL();
  } catch (fehler) {
    console.error(fehler);
  }
  if (!webglOk) {
    $('hinweis-text').textContent = 'Dein Browser kann die Tier-Filter nicht darstellen (WebGL fehlt). Versuche es mit einem aktuellen Chrome.';
    hinweis.querySelector('.hinweis-knoepfe').style.display = 'none';
    hinweis.hidden = false;
    return;
  }
  requestAnimationFrame(schleife);
  starteKamera();
}

start();

if ('serviceWorker' in navigator) {
  // Ist schon eine ältere Version aktiv, wird nach einem Update einmal neu geladen.
  const hatteVersion = Boolean(navigator.serviceWorker.controller);
  let neuGeladen = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteVersion || neuGeladen) return;
    if (document.querySelector('dialog[open]') || !fotoAnsicht.hidden) {
      zeigeStatus('Neue Version geladen. Sie ist beim nächsten Öffnen der App aktiv.');
      return;
    }
    neuGeladen = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then((anmeldung) => {
    // Die installierte App bleibt oft im Hintergrund offen; beim Zurückholen nach Updates schauen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') anmeldung.update().catch(() => {});
    });
  }).catch(() => {});
}
