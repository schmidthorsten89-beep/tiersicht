'use strict';

// Farbmatrizen in linearem RGB (Zeile = Ausgabekanal R, G, B).
// Zwei Zapfentypen (Blau + Gelbgrün) wie bei Hund, Katze, Pferd, Rind: Machado et al. 2009, Deuteranopie.
const MATRIX_ZWEI_ZAPFEN = [
  0.367322, 0.860646, -0.227968,
  0.280085, 0.672501, 0.047413,
  -0.011820, 0.042940, 0.968881,
];
// Biene (UV, Blau, Grün) als Falschfarben: Grün → Rot, Blau → Grün, geschätztes UV → Blau. Rot fällt fast weg.
const MATRIX_BIENE = [
  0.10, 0.90, 0.00,
  0.00, 0.10, 0.90,
  0.10, 0.15, 0.50,
];
const MATRIX_FLIEGE = [
  0.35, 0.65, 0.00,
  0.05, 0.55, 0.40,
  0.05, 0.15, 0.70,
];
// Gecko: kein Rot-Zapfen, dafür UV.
const MATRIX_GECKO = [
  0.40, 0.60, 0.00,
  0.00, 0.95, 0.05,
  0.05, 0.10, 0.85,
];

// Filter-Werte (fehlende Werte = neutral, siehe NEUTRAL in app.js):
// fisch: Wölbung wie ein Fischauge · kreis: rundes Sichtfenster (1 = Bildrand) · zoom: Lupe in der Mitte
// facette: Einzelaugen über die Bildhöhe · unschaerfe: Radius als Anteil der Bildhöhe · schaerfen: Nachschärfen
// matrix: Farbumrechnung · saettigung · toenung: Farbstich · dunst + dunstFarbe: Trübung
// hell: Lichtverstärkung · staebchen: Nachtsehen (grau-bläulich) · rauschen: Körnung
// waerme: Wärmebild-Darstellung · vignette: dunkle Ränder
const TIERE = [
  {
    id: 'mensch',
    name: 'Mensch',
    emoji: '🧑',
    kurz: 'Normales Kamerabild zum Vergleich',
    filter: {},
    fakten: {
      farben: '3 Zapfentypen (Blau, Grün, Rot)',
      schaerfe: 'Maßstab (100 %)',
      sichtfeld: 200, beidaeugig: 120,
      nacht: 'mäßig – im Dunkeln sehen wir kaum Farben',
      bewegung: 'ca. 60 Bilder pro Sekunde',
    },
    texte: [
      'Menschen gehören zu den wenigen Säugetieren mit drei Zapfentypen. Deshalb unterscheiden wir Rot, Grün und Blau und alle Mischungen davon – rund eine Million Farbtöne.',
      'Wirklich scharf sehen wir nur in einem winzigen Fleck in der Mitte der Netzhaut, der Sehgrube. Das Auge springt ständig hin und her, und das Gehirn setzt daraus ein scharfes Gesamtbild zusammen.',
      'Wähle unten ein Tier, um zu sehen, wie sich die Welt für es verändert. Mit dem Vergleichs-Knopf siehst du Mensch und Tier direkt nebeneinander.',
    ],
    grenze: '',
  },
  {
    id: 'hund',
    name: 'Hund',
    emoji: '🐕',
    kurz: 'Blau und Gelb, kein Rot-Grün – und unschärfer',
    filter: { matrix: MATRIX_ZWEI_ZAPFEN, unschaerfe: 0.0045, hell: 1.25, saettigung: 0.9 },
    fakten: {
      farben: '2 Zapfentypen (Blau, Gelbgrün)',
      schaerfe: 'etwa ¼ bis ⅓ des Menschen',
      sichtfeld: 240, beidaeugig: 60,
      nacht: 'besser als wir',
      bewegung: 'ca. 70–80 Bilder pro Sekunde',
    },
    texte: [
      'Hunde sind nicht farbenblind, aber sie haben nur zwei Zapfentypen. Blau und Gelb erkennen sie gut, Rot und Grün erscheinen ihnen dagegen als ähnliche gelblich-graue Töne. Ein roter Ball auf grüner Wiese ist für einen Hund schwer zu finden – ein blauer fällt sofort auf.',
      'Ihre Sehschärfe ist deutlich geringer als unsere: Was wir aus 75 Metern noch erkennen, muss ein Hund auf etwa 20 Meter heranholen. Dafür bemerken Hunde Bewegungen sehr gut, besonders in der Dämmerung.',
      'Je nach Rasse liegen die Augen weiter seitlich. Das Sichtfeld ist mit rund 240° größer als unseres, der Bereich, in dem beide Augen gemeinsam räumlich sehen, dafür kleiner.',
    ],
    grenze: 'Das breitere Sichtfeld kann die Handykamera nicht zeigen – sie sieht nur nach vorn.',
  },
  {
    id: 'katze',
    name: 'Katze',
    emoji: '🐈',
    kurz: 'Blasse Farben, unscharf – aber Meisterin der Dämmerung',
    filter: { matrix: MATRIX_ZWEI_ZAPFEN, saettigung: 0.55, unschaerfe: 0.007, hell: 1.8, staebchen: 0.25, rauschen: 0.02 },
    fakten: {
      farben: '2 Zapfentypen (Blau, Grün), Farben wirken blass',
      schaerfe: 'etwa ⅙ bis ⅒ des Menschen',
      sichtfeld: 200, beidaeugig: 140,
      nacht: 'sehr gut – braucht nur etwa ⅙ des Lichts',
      bewegung: '',
    },
    texte: [
      'Katzen sehen Farben, aber blass und ohne Rot. Ihre Netzhaut ist vor allem mit Stäbchen bestückt – den Sinneszellen für schwaches Licht. Das macht sie zu perfekten Dämmerungsjägern.',
      'Hinter der Netzhaut liegt eine spiegelnde Schicht. Sie schickt das Licht ein zweites Mal durch die Sinneszellen – daher leuchten Katzenaugen im Scheinwerferlicht. Die Kehrseite: Das Bild wird etwas unschärfer.',
      'Ganz nah, unter etwa 30 Zentimetern, sieht eine Katze kaum noch scharf. Beute direkt vor der Nase ertastet sie mit den Schnurrhaaren.',
    ],
    grenze: 'Die Aufhellung ist nachgestellt: Die Kamera kann nicht mehr Licht einfangen, als da ist – im Dunkeln wird das Bild deshalb körnig.',
  },
  {
    id: 'pferd',
    name: 'Pferd',
    emoji: '🐎',
    kurz: 'Fast Rundumblick, zwei Farben',
    filter: { matrix: MATRIX_ZWEI_ZAPFEN, unschaerfe: 0.0015, fisch: 0.35, vignette: 0.15 },
    fakten: {
      farben: '2 Zapfentypen (Blau, Gelbgrün)',
      schaerfe: 'etwa ⅔ des Menschen',
      sichtfeld: 350, beidaeugig: 65,
      nacht: 'gut',
      bewegung: '',
    },
    texte: [
      'Als Fluchttier hat das Pferd seitlich liegende Augen und sieht fast rundherum – etwa 350°. Nur direkt hinter sich und unmittelbar vor der Nase hat es einen toten Winkel. Deshalb nähert man sich einem Pferd nie direkt von hinten.',
      'Wie Hunde haben Pferde zwei Zapfentypen. Rot und Grün verschwimmen zu ähnlichen Tönen, Blau und Gelb sind gut zu unterscheiden. Auf einigen Rennbahnen wurden Hindernis-Markierungen deshalb von Orange auf leuchtendes Gelb und Weiß umgestellt.',
      'Pferde sehen nur etwas unschärfer als wir. Ein waagrechter Streifen besonders dicht gepackter Sinneszellen ist auf den Horizont ausgerichtet – ideal, um Gefahren in der Ferne früh zu bemerken.',
    ],
    grenze: 'Die Wölbung im Bild deutet das breite Sichtfeld nur an. Mehr als die Kamera vor sich hat, kann die App nicht zeigen.',
  },
  {
    id: 'rind',
    name: 'Rind',
    emoji: '🐄',
    kurz: 'Weite Sicht, unscharf, kein Rot',
    filter: { matrix: MATRIX_ZWEI_ZAPFEN, unschaerfe: 0.008, fisch: 0.4, saettigung: 0.85, vignette: 0.15 },
    fakten: {
      farben: '2 Zapfentypen (Blau, Gelbgrün)',
      schaerfe: 'nur ein Bruchteil des Menschen (grob 1/10)',
      sichtfeld: 330, beidaeugig: 30,
      nacht: 'gut',
      bewegung: '',
    },
    texte: [
      'Der Stierkampf-Mythos stimmt nicht: Rinder sehen kein Rot. Das Tuch des Toreros wirkt für einen Stier grau-gelblich – er reagiert auf die Bewegung, nicht auf die Farbe.',
      'Mit seitlich liegenden Augen überblicken Rinder fast die ganze Umgebung, aber nur ein schmaler Bereich nach vorn wird räumlich gesehen. Tiefen schätzen sie schlecht ein – deshalb bleiben Kühe vor Schatten, Gittern oder Pfützen gern zögernd stehen.',
      'Ihre Sehschärfe ist viel geringer als unsere. Details erkennen sie erst aus der Nähe; Geruch und Gehör sind für sie mindestens genauso wichtig.',
    ],
    grenze: 'Die Wölbung im Bild deutet das breite Sichtfeld nur an. Mehr als die Kamera vor sich hat, kann die App nicht zeigen.',
  },
  {
    id: 'biene',
    name: 'Biene',
    emoji: '🐝',
    kurz: 'Sieht Ultraviolett, aber kein Rot (Falschfarben)',
    filter: { matrix: MATRIX_BIENE, facette: 80, unschaerfe: 0.002, saettigung: 1.1 },
    fakten: {
      farben: '3 Typen: Ultraviolett, Blau, Grün',
      schaerfe: 'sehr gering, etwa 1/60 des Menschen',
      sichtfeld: 300, beidaeugig: 0,
      nacht: 'schlecht – Bienen fliegen am Tag',
      bewegung: 'ca. 200 Bilder pro Sekunde',
    },
    texte: [
      'Bienen haben wie wir drei Farbrezeptoren – aber verschoben: Sie sehen Ultraviolett, Blau und Grün. Rot ist für sie fast schwarz. Damit man sich das vorstellen kann, zeigt die App Falschfarben: Grün wird als Rot dargestellt, Blau als Grün und das (geschätzte) Ultraviolett als Blau.',
      'Viele Blüten tragen UV-Muster, die wir nicht sehen: Saftmale, die wie Landebahnen zum Nektar führen. Roter Klatschmohn wirkt für Bienen nicht rot, sondern ultraviolett.',
      'Jedes Facettenauge besteht aus rund 5.000 Einzelaugen. Jedes liefert nur einen Bildpunkt – das Bild ist grob gerastert, aber Bewegungen nimmt die Biene extrem schnell wahr.',
    ],
    grenze: 'Handykameras filtern UV heraus. Der UV-Anteil wird hier nur aus Blau und Helligkeit geschätzt – echte UV-Muster auf Blüten bleiben unsichtbar.',
  },
  {
    id: 'fliege',
    name: 'Fliege',
    emoji: '🪰',
    kurz: 'Facettenauge und Rundumblick – die Welt in Zeitlupe',
    filter: { matrix: MATRIX_FLIEGE, facette: 45, saettigung: 0.8, fisch: 0.3, vignette: 0.2 },
    fakten: {
      farben: 'Ultraviolett, Blau und Grün',
      schaerfe: 'sehr gering, etwa 1/100 des Menschen',
      sichtfeld: 350, beidaeugig: 0,
      nacht: 'schlecht',
      bewegung: 'bis zu 250 Bilder pro Sekunde',
    },
    texte: [
      'Eine Stubenfliege hat pro Auge etwa 3.000 bis 4.000 Einzelaugen. Jedes blickt in eine etwas andere Richtung und liefert einen Bildpunkt. Zusammen ergibt das ein grobes Mosaik – aber fast einen Rundumblick.',
      'Ihre eigentliche Stärke ist das Tempo: Fliegen verarbeiten bis zu etwa 250 Einzelbilder pro Sekunde, wir nur etwa 60. Eine heransausende Fliegenklatsche wirkt für sie wie in Zeitlupe – deshalb ist sie so schwer zu erwischen.',
      'Eine alte Leuchtstoffröhre, die für uns ruhig leuchtet, flackert für eine Fliege sichtbar.',
    ],
    grenze: 'Die Zeitlupen-Wahrnehmung lässt sich mit einer Kamera nicht zeigen – sie liefert nur rund 30 Bilder pro Sekunde.',
  },
  {
    id: 'adler',
    name: 'Adler',
    emoji: '🦅',
    kurz: 'Lupe in der Bildmitte, kräftigere Farben',
    filter: { zoom: 1.8, schaerfen: 0.9, saettigung: 1.35 },
    fakten: {
      farben: '4 Zapfentypen, auch Ultraviolett',
      schaerfe: 'etwa 2- bis 3-mal schärfer als der Mensch',
      sichtfeld: 260, beidaeugig: 40,
      nacht: 'schlechter als wir',
      bewegung: '',
    },
    texte: [
      'Greifvögel haben die schärfsten Augen im Tierreich. Möglich machen das dicht gepackte Sinneszellen und eine tiefe Grube in der Netzhaut, die wie eine eingebaute Lupe wirkt – die App zeigt das als Vergrößerung in der Bildmitte.',
      'Adler haben sogar zwei solcher Sehgruben pro Auge: eine für den Blick zur Seite und eine für den Blick nach vorn, wo beide Augen zusammenarbeiten.',
      'Wie die meisten Vögel besitzen sie vier Zapfentypen und dazu farbige Öltröpfchen in den Sinneszellen. Farben wirken dadurch kräftiger und feiner abgestuft als für uns.',
    ],
    grenze: 'Schärfer als die Kamera selbst kann die App nicht werden – Lupe und Nachschärfen deuten die Sehschärfe nur an.',
  },
  {
    id: 'taube',
    name: 'Taube',
    emoji: '🕊️',
    kurz: 'Fast 340° Rundumblick, Farben mit UV',
    filter: { fisch: 0.6, saettigung: 1.25, unschaerfe: 0.0015, toenung: [0.97, 1.0, 1.06], vignette: 0.2 },
    fakten: {
      farben: '4 Zapfentypen, auch Ultraviolett',
      schaerfe: 'etwas geringer als beim Menschen',
      sichtfeld: 340, beidaeugig: 25,
      nacht: 'schlecht',
      bewegung: 'über 100 Bilder pro Sekunde',
    },
    texte: [
      'Tauben haben die Augen seitlich am Kopf und überblicken fast 340° – nur ein kleiner Bereich hinter dem Kopf bleibt verborgen. Das typische Kopfnicken beim Laufen hält das Bild kurz still, damit sie scharf sehen.',
      'Mit vier Zapfentypen sehen Tauben auch Ultraviolett. Viele Gefieder schimmern im UV-Licht – für Tauben sehen Männchen und Weibchen deshalb oft verschiedener aus als für uns.',
      'Tauben unterscheiden feinste Farbnuancen. In Versuchen lernten sie sogar, Gemälde von Monet und Picasso auseinanderzuhalten.',
    ],
    grenze: 'Die starke Wölbung deutet den Rundumblick an – zeigen kann die App nur, was die Kamera vor sich hat.',
  },
  {
    id: 'schlange',
    name: 'Schlange',
    emoji: '🐍',
    kurz: 'Grobes Auge plus Wärmesinn (Darstellungsidee)',
    filter: { matrix: MATRIX_ZWEI_ZAPFEN, unschaerfe: 0.012, waerme: 0.85 },
    fakten: {
      farben: 'meist 2 Zapfentypen, teils UV',
      schaerfe: 'gering',
      sichtfeld: 0, beidaeugig: 0,
      nacht: 'Grubenottern spüren Wärme auch im Dunkeln',
      bewegung: '',
    },
    texte: [
      'Viele Schlangen sehen eher unscharf und reagieren vor allem auf Bewegung. Grubenottern, Pythons und Boas haben aber einen zusätzlichen Sinn: Grubenorgane zwischen Auge und Nase, die Wärmestrahlung spüren.',
      'Im Gehirn werden Augen- und Wärmebild übereinandergelegt. So kann eine Klapperschlange eine Maus selbst in völliger Dunkelheit orten und gezielt zubeißen.',
      'Das Wärmebild ist sehr grob – vergleichbar mit einem stark verschwommenen Foto. Für eine warme Maus vor kühlem Boden reicht es trotzdem.',
    ],
    grenze: 'Achtung: Die Handykamera misst keine Wärme! Die Farben werden hier aus Helligkeit und Rottönen geschätzt – Haut erscheint deshalb meist »warm«, ein heißer Topf nicht unbedingt.',
  },
  {
    id: 'fisch',
    name: 'Fisch',
    emoji: '🐟',
    kurz: 'Rundes Fenster nach oben, Farben unter Wasser',
    filter: {
      fisch: 0.4, kreis: 0.98, unschaerfe: 0.004, saettigung: 0.8,
      toenung: [0.55, 0.95, 1.05], dunst: 0.25, dunstFarbe: [0.02, 0.18, 0.22],
    },
    fakten: {
      farben: 'viele Arten 4 Zapfentypen, auch UV (z. B. Goldfisch)',
      schaerfe: 'gering – Fische sind meist kurzsichtig',
      sichtfeld: 300, beidaeugig: 30,
      nacht: 'je nach Art sehr unterschiedlich',
      bewegung: '',
    },
    texte: [
      'Blickt ein Fisch nach oben, sieht er die Welt über dem Wasser in einem runden Fenster, dem Snellius-Fenster. Durch die Lichtbrechung an der Wasseroberfläche wird der ganze Himmel auf einen Kreis von etwa 97° zusammengedrückt. Außerhalb des Kreises spiegelt sich nur der Gewässergrund.',
      'Wasser schluckt rotes Licht schon nach wenigen Metern. Unter Wasser wirkt alles blaugrün und verschwommen; viele Fische sind deshalb auf Blau, Grün und UV spezialisiert. Der Goldfisch hat sogar vier Zapfentypen.',
      'Die kugelförmige Fischlinse erzeugt eine starke Wölbung – daher hat auch das Fischaugen-Objektiv seinen Namen.',
    ],
    grenze: 'Die Verzerrung ist nachgestellt. Wie es tatsächlich unter Wasser aussieht, hängt stark von Tiefe und Trübung ab.',
  },
  {
    id: 'eule',
    name: 'Eule',
    emoji: '🦉',
    kurz: 'Nachtsichtgerät mit wenig Farbe',
    filter: { hell: 2.0, staebchen: 0.8, rauschen: 0.035, vignette: 0.45, unschaerfe: 0.001 },
    fakten: {
      farben: 'eingeschränkt – fast nur Stäbchen',
      schaerfe: 'gut, etwas unter dem Menschen',
      sichtfeld: 110, beidaeugig: 70,
      nacht: 'hervorragend',
      bewegung: '',
    },
    texte: [
      'Eulenaugen sind riesig und röhrenförmig – so groß, dass sie sich in den Augenhöhlen nicht bewegen können. Stattdessen dreht die Eule ihren Kopf um bis zu 270°.',
      'Die Netzhaut ist dicht mit Stäbchen bestückt, den Sinneszellen für schwaches Licht. Damit sehen Eulen in der Dämmerung und bei Mondlicht sehr gut. Farben spielen dabei kaum eine Rolle, das Bild ist eher grau-bläulich.',
      'Weil beide Augen nach vorn zeigen, schätzen Eulen Entfernungen sehr genau. Bei völliger Dunkelheit übernimmt ihr extrem feines Gehör.',
    ],
    grenze: 'Die Aufhellung ist nachgestellt – im Dunkeln wird das Kamerabild dadurch körnig, eine echte Eule sieht klarer.',
  },
  {
    id: 'gecko',
    name: 'Gecko',
    emoji: '🦎',
    kurz: 'Sieht Farben – selbst bei Nacht',
    filter: { matrix: MATRIX_GECKO, hell: 2.2, saettigung: 1.15, rauschen: 0.04, unschaerfe: 0.003 },
    fakten: {
      farben: '3 Zapfentypen: Ultraviolett, Blau, Grün',
      schaerfe: 'gering',
      sichtfeld: 0, beidaeugig: 0,
      nacht: 'sieht sogar nachts Farben',
      bewegung: '',
    },
    texte: [
      'Nachtaktive Geckos können etwas, das uns unmöglich ist: Farben bei Mondlicht sehen. Beim Helmkopfgecko haben Forschende gemessen, dass sein Farbsehen in der Dämmerung etwa 350-mal empfindlicher ist als unseres.',
      'Möglich wird das durch große Zapfen und eine Linse mit mehreren Zonen unterschiedlicher Brennweite: Licht verschiedener Farben wird gleichzeitig scharf abgebildet.',
      'Geckos haben keinen Rot-Zapfen, dafür einen für Ultraviolett. Rote Töne wirken für sie dunkler, Blau kräftiger.',
    ],
    grenze: 'Die Aufhellung ist nachgestellt: Im Dunkeln wird das Kamerabild körnig, die Farben bleiben aber erhalten – wie beim Gecko.',
  },
];
