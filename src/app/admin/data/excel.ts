// Génération de classeurs Excel (.xlsx) dans le navigateur, sans dépendance externe.
// Un .xlsx est une archive ZIP de fichiers XML (Office Open XML) : l'archive est écrite ici sans
// compression (méthode « stored »), ce qu'Excel, LibreOffice et Google Sheets ouvrent sans difficulté.

export type ValeurCellule = string | number | boolean | Date | null | undefined;

/** Image placée dans une cellule (PNG ou JPEG), dimensions d'affichage en pixels. */
export interface ImageCellule {
  /** Ligne de données (0 = première ligne sous l'en-tête). */
  ligne: number;
  colonne: number;
  octets: Uint8Array;
  format: 'png' | 'jpeg';
  largeur: number;
  hauteur: number;
  description?: string;
}

export interface Feuille {
  /** Nom de l'onglet (31 caractères au plus, rendu unique automatiquement). */
  nom: string;
  colonnes: string[];
  lignes: ValeurCellule[][];
  /** Photos insérées dans les cellules (la ligne et la colonne s'agrandissent pour les contenir). */
  images?: ImageCellule[];
}

// --- Archive ZIP (stockage sans compression) --------------------------------------------------

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(octets: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function archiveZip(fichiers: { nom: string; contenu: string | Uint8Array }[]): Blob {
  const encodeur = new TextEncoder();
  const maintenant = new Date();
  const heure = (maintenant.getHours() << 11) | (maintenant.getMinutes() << 5) | (maintenant.getSeconds() >> 1);
  const jour = ((maintenant.getFullYear() - 1980) << 9) | ((maintenant.getMonth() + 1) << 5) | maintenant.getDate();

  const parties: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let decalage = 0;

  for (const f of fichiers) {
    const nom = encodeur.encode(f.nom);
    const donnees = typeof f.contenu === 'string' ? encodeur.encode(f.contenu) : f.contenu;
    const crc = crc32(donnees);

    const entete = new DataView(new ArrayBuffer(30));
    entete.setUint32(0, 0x04034b50, true);
    entete.setUint16(4, 20, true);
    entete.setUint16(6, 0x0800, true); // noms en UTF-8
    entete.setUint16(8, 0, true); // stored
    entete.setUint16(10, heure, true);
    entete.setUint16(12, jour, true);
    entete.setUint32(14, crc, true);
    entete.setUint32(18, donnees.length, true);
    entete.setUint32(22, donnees.length, true);
    entete.setUint16(26, nom.length, true);
    entete.setUint16(28, 0, true);
    parties.push(new Uint8Array(entete.buffer), nom, donnees);

    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, heure, true);
    c.setUint16(14, jour, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, donnees.length, true);
    c.setUint32(24, donnees.length, true);
    c.setUint16(28, nom.length, true);
    c.setUint32(42, decalage, true);
    central.push(new Uint8Array(c.buffer), nom);

    decalage += 30 + nom.length + donnees.length;
  }

  const tailleCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, fichiers.length, true);
  fin.setUint16(10, fichiers.length, true);
  fin.setUint32(12, tailleCentral, true);
  fin.setUint32(16, decalage, true);

  return new Blob([...parties, ...central, new Uint8Array(fin.buffer)] as BlobPart[], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// --- Office Open XML ----------------------------------------------------------------------------

/** Échappement XML (et retrait des caractères de contrôle interdits). */
const xml = (s: string) => s
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Lettre(s) de colonne : 0 → A, 26 → AA. */
function lettre(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Date JavaScript → numéro de série Excel (jours depuis le 30/12/1899, heure locale). */
const serieExcel = (d: Date) => (d.getTime() - d.getTimezoneOffset() * 60000) / 86400000 + 25569;

// Styles : 0 = normal, 1 = en-tête (gras, fond bleu, texte blanc), 2 = date, 3 = date et heure, 4 = texte renvoyé à la ligne.
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function cellule(ref: string, v: ValeurCellule, style = 0): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${style ? ` s="${style}"` : ''}><v>${v}</v></c>`;
  if (typeof v === 'boolean') return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const avecHeure = v.getHours() || v.getMinutes();
    return `<c r="${ref}" s="${avecHeure ? 3 : 2}"><v>${serieExcel(v)}</v></c>`;
  }
  const texte = String(v).slice(0, 32767); // limite d'une cellule Excel
  const s = style || (texte.includes('\n') ? 4 : 0);
  return `<c r="${ref}" t="inlineStr"${s ? ` s="${s}"` : ''}><is><t xml:space="preserve">${xml(texte)}</t></is></c>`;
}

/** Marge autour d'une image dans sa cellule (pixels). */
const MARGE_IMAGE = 3;
/** Pixels → EMU (unité des dessins Office : 9525 EMU par pixel). */
const emu = (px: number) => Math.round(px * 9525);

function feuilleXml(f: Feuille, avecDessin: boolean): string {
  const nbCol = Math.max(f.colonnes.length, ...f.lignes.map((l) => l.length), 1);
  const images = f.images ?? [];
  // Hauteur des lignes et largeur des colonnes qui portent une image (pixels).
  const hauteurLigne = new Map<number, number>();
  const largeurImage = new Map<number, number>();
  for (const im of images) {
    hauteurLigne.set(im.ligne, Math.max(hauteurLigne.get(im.ligne) ?? 0, im.hauteur + 2 * MARGE_IMAGE));
    largeurImage.set(im.colonne, Math.max(largeurImage.get(im.colonne) ?? 0, im.largeur + 2 * MARGE_IMAGE));
  }
  // Largeur de colonne selon le contenu le plus long (bornée) ; ~7 px par unité de largeur Excel.
  const largeurs = Array.from({ length: nbCol }, (_, i) => {
    if (largeurImage.has(i)) return Math.max(String(f.colonnes[i] ?? '').length + 2, Math.ceil((largeurImage.get(i)! + 5) / 7));
    const max = Math.max(
      String(f.colonnes[i] ?? '').length,
      ...f.lignes.slice(0, 500).map((l) => {
        const v = l[i];
        if (v instanceof Date) return 16;
        return Math.max(...String(v ?? '').split('\n').map((x) => x.length));
      }),
    );
    return Math.min(60, Math.max(8, max + 2));
  });
  const cols = largeurs.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const entete = `<row r="1">${f.colonnes.map((c, i) => cellule(`${lettre(i)}1`, c, 1)).join('')}</row>`;
  const lignes = f.lignes.map((l, r) => {
    const h = hauteurLigne.get(r);
    const hauteur = h ? ` ht="${Math.round(h * 0.75 * 100) / 100}" customHeight="1"` : '';
    return `<row r="${r + 2}"${hauteur}>${l.map((v, i) => cellule(`${lettre(i)}${r + 2}`, v)).join('')}</row>`;
  }).join('');
  const derniere = `${lettre(nbCol - 1)}${f.lignes.length + 1}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols>
<sheetData>${entete}${lignes}</sheetData>
${f.colonnes.length ? `<autoFilter ref="A1:${derniere}"/>` : ''}
<ignoredErrors><ignoredError sqref="A1:${derniere}" numberStoredAsText="1"/></ignoredErrors>
${avecDessin ? '<drawing r:id="rId1"/>' : ''}
</worksheet>`;
}

/**
 * Dessin d'une feuille : chaque image est ancrée dans sa cellule (« déplacer avec les cellules »),
 * elle suit donc sa ligne lors d'un tri ou d'un filtre. `premiereImage` : numéro global du média.
 */
function dessinXml(f: Feuille): string {
  const ancres = (f.images ?? []).map((im, k) => {
    const ligne = im.ligne + 1; // ligne 0 = en-tête
    return `<xdr:twoCellAnchor editAs="oneCell">
<xdr:from><xdr:col>${im.colonne}</xdr:col><xdr:colOff>${emu(MARGE_IMAGE)}</xdr:colOff><xdr:row>${ligne}</xdr:row><xdr:rowOff>${emu(MARGE_IMAGE)}</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>${im.colonne}</xdr:col><xdr:colOff>${emu(MARGE_IMAGE + im.largeur)}</xdr:colOff><xdr:row>${ligne}</xdr:row><xdr:rowOff>${emu(MARGE_IMAGE + im.hauteur)}</xdr:rowOff></xdr:to>
<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${k + 2}" name="Image ${k + 1}" descr="${xml(im.description ?? '')}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>
<xdr:blipFill><a:blip r:embed="rId${k + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(im.largeur)}" cy="${emu(im.hauteur)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>
<xdr:clientData/></xdr:twoCellAnchor>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${ancres}
</xdr:wsDr>`;
}

/** Noms d'onglets valides (sans []:*?/\, 31 caractères au plus) et uniques. */
function nomsOnglets(feuilles: Feuille[]): string[] {
  const vus = new Set<string>();
  return feuilles.map((f, i) => {
    const base = (f.nom || `Feuille ${i + 1}`).replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || `Feuille ${i + 1}`;
    let nom = base;
    for (let n = 2; vus.has(nom.toLowerCase()); n++) nom = `${base.slice(0, 31 - String(n).length - 1)} ${n}`;
    vus.add(nom.toLowerCase());
    return nom;
  });
}

/** Classeur .xlsx (une feuille par élément). */
export function classeurXlsx(feuilles: Feuille[]): Blob {
  const noms = nomsOnglets(feuilles);
  // Dessins (un par feuille qui a des images) et médias numérotés globalement.
  const dessins: { feuille: number; numero: number }[] = [];
  const medias: { feuille: number; chemin: string; octets: Uint8Array }[] = [];
  feuilles.forEach((f, i) => {
    if (!f.images?.length) return;
    dessins.push({ feuille: i, numero: dessins.length + 1 });
    for (const im of f.images) medias.push({ feuille: i, chemin: `image${medias.length + 1}.${im.format === 'png' ? 'png' : 'jpeg'}`, octets: im.octets });
  });
  const fichiersDessins = dessins.flatMap(({ feuille, numero }) => {
    const sesMedias = medias.filter((m) => m.feuille === feuille);
    return [
      { nom: `xl/worksheets/_rels/sheet${feuille + 1}.xml.rels`, contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${numero}.xml"/></Relationships>` },
      { nom: `xl/drawings/drawing${numero}.xml`, contenu: dessinXml(feuilles[feuille]) },
      { nom: `xl/drawings/_rels/drawing${numero}.xml.rels`, contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sesMedias.map((m, k) => `<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${m.chemin}"/>`).join('')}</Relationships>` },
    ];
  });
  const fichiers = [
    {
      nom: '[Content_Types].xml',
      contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Default Extension="jpeg" ContentType="image/jpeg"/>
${dessins.map((d) => `<Override PartName="/xl/drawings/drawing${d.numero}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`).join('\n')}
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${feuilles.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`,
    },
    {
      nom: '_rels/.rels',
      contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      nom: 'xl/workbook.xml',
      contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${noms.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`,
    },
    {
      nom: 'xl/_rels/workbook.xml.rels',
      contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${feuilles.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { nom: 'xl/styles.xml', contenu: STYLES },
    ...feuilles.map((f, i) => ({ nom: `xl/worksheets/sheet${i + 1}.xml`, contenu: feuilleXml(f, dessins.some((d) => d.feuille === i)) })),
    ...fichiersDessins,
    ...medias.map((m) => ({ nom: `xl/media/${m.chemin}`, contenu: m.octets })),
  ];
  return archiveZip(fichiers);
}

/**
 * Vignette JPEG d'une image (photo d'identité) pour l'insérer dans une cellule : le plus grand
 * côté ramené à `taille` pixels (affichage) et dessiné en double résolution pour rester net.
 * Renvoie null si l'image est illisible.
 */
export async function miniature(blob: Blob, taille = 80): Promise<Pick<ImageCellule, 'octets' | 'format' | 'largeur' | 'hauteur'> | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const echelle = Math.min(1, taille / Math.max(bitmap.width, bitmap.height));
    const largeur = Math.max(1, Math.round(bitmap.width * echelle));
    const hauteur = Math.max(1, Math.round(bitmap.height * echelle));
    const canvas = document.createElement('canvas');
    canvas.width = largeur * 2;
    canvas.height = hauteur * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff'; // fond blanc (transparence PNG)
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const jpeg = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    if (!jpeg) return null;
    return { octets: new Uint8Array(await jpeg.arrayBuffer()), format: 'jpeg', largeur, hauteur };
  } catch {
    return null;
  }
}

/**
 * Numéro de téléphone lisible et homogène dans Excel (toujours en texte, jamais converti en
 * nombre) : « +243 81 234 5678 » pour un numéro congolais, sinon tel que saisi.
 */
export function telephoneExcel(brut: string | null | undefined): string {
  const t = String(brut ?? '').trim();
  if (!t) return '';
  let chiffres = t.replace(/\D/g, '');
  if (chiffres.startsWith('00')) chiffres = chiffres.slice(2);
  if (chiffres.length === 10 && chiffres.startsWith('0')) chiffres = `243${chiffres.slice(1)}`;
  if (chiffres.length === 9 && /^[89]/.test(chiffres)) chiffres = `243${chiffres}`;
  if (chiffres.length === 12 && chiffres.startsWith('243')) {
    return `+243 ${chiffres.slice(3, 5)} ${chiffres.slice(5, 8)} ${chiffres.slice(8)}`;
  }
  return t;
}

/** Déclenche le téléchargement d'un fichier dans le navigateur. */
export function telecharger(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nom de fichier sûr : « AMI_Patientes_2026-11-13.xlsx ». */
export function nomFichierExcel(titre: string): string {
  const propre = titre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'Export';
  const d = new Date();
  const jour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `AMI_${propre}_${jour}.xlsx`;
}
