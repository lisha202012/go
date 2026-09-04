/**
 * Extract all 945 missions from the GOFAM spec docx into apps/api/data/missions-945.json.
 *
 * Usage (from apps/api):
 *   node scripts/extract-missions-from-docx.mjs
 *   node scripts/extract-missions-from-docx.mjs --docx ../../path/to/spec.docx
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(API_ROOT, '../..');
const DEFAULT_DOCX_CANDIDATES = [
  path.resolve(REPO_ROOT, 'pictures/GOFAM_GROW_Developer_Mission.docx'), // v2.0 with WHY?
  path.resolve(REPO_ROOT, 'GOFAM_GROW_Developer_Mission_Engine_945_Missions_v1.0.docx'),
  path.resolve(REPO_ROOT, 'pictures/GOFAM_GROW_Developer_Mission_Engine_945_Missions_v1.0.docx'),
];
const OUTPUT = path.resolve(API_ROOT, 'data/missions-945.json');

const CATEGORY_CODES = ['S1E', 'S1G', 'S1R', 'A2', 'B3', 'C4', 'D5', 'V6', 'N7'];
const HILL_CODES = ['HOPE', 'HONE', 'HOLD', 'HOOD', 'HOST', 'HORN', 'HOOK'];

function parseArgs(argv) {
  const args = { docx: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--docx' && argv[i + 1]) {
      args.docx = path.resolve(argv[++i]);
    }
  }
  if (!args.docx) {
    args.docx = DEFAULT_DOCX_CANDIDATES.find((p) => fs.existsSync(p)) ?? DEFAULT_DOCX_CANDIDATES[0];
  }
  return args;
}

function decodeXml(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function cellText(cellXml) {
  return decodeXml(
    [...cellXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''),
  ).trim();
}

function readDocumentXml(docxPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gofam-docx-'));
  const zipPath = path.join(tmpDir, 'spec.zip');
  const extractDir = path.join(tmpDir, 'extracted');
  fs.copyFileSync(docxPath, zipPath);
  fs.mkdirSync(extractDir, { recursive: true });

  const powershell =
    process.env.SystemRoot != null
      ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      : 'powershell';

  let extracted = false;
  if (fs.existsSync(powershell)) {
    try {
      execSync(
        `"${powershell}" -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force"`,
        { stdio: 'pipe' },
      );
      extracted = true;
    } catch {
      extracted = false;
    }
  }

  if (!extracted) {
    execSync(`tar -xf "${zipPath}" -C "${extractDir}"`, { stdio: 'pipe', shell: true });
  }

  const xmlPath = path.join(extractDir, 'word', 'document.xml');
  if (!fs.existsSync(xmlPath)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error('Could not read word/document.xml from docx archive');
  }

  const xml = fs.readFileSync(xmlPath, 'utf8');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return xml;
}

function parseMissions(xml) {
  const missions = [];
  const rows = xml.split('<w:tr>').slice(1);

  for (const row of rows) {
    const cells = [...row.matchAll(/<w:tc[^>]*>([\s\S]*?)<\/w:tc>/g)].map((m) => cellText(m[1]));
    const externalId = cells[0] ?? '';
    if (!/^MIS-[A-Z0-9]+-[A-Z]+-\d{2}$/.test(externalId)) continue;

    const match = externalId.match(/^MIS-([A-Z0-9]+)-([A-Z]+)-(\d{2})$/);
    if (!match) continue;

    const categoryCode = match[1];
    const hillCode = match[2];
    const order = Number(match[3]);
    const missionGroup = Number(cells[1]);
    const title = cells[2] ?? '';
    const instruction = cells[3] ?? '';
    const why = (cells[4] ?? '').trim();

    missions.push({
      externalId,
      categoryCode,
      hillCode,
      order,
      missionGroup,
      title,
      instruction,
      why,
    });
  }

  return missions;
}

function validate(missions) {
  const errors = [];

  if (missions.length !== 945) {
    errors.push(`Expected 945 missions, found ${missions.length}`);
  }

  const ids = new Set(missions.map((m) => m.externalId));
  if (ids.size !== missions.length) {
    errors.push('Duplicate externalId values detected');
  }

  for (const categoryCode of CATEGORY_CODES) {
    for (const hillCode of HILL_CODES) {
      const slice = missions.filter((m) => m.categoryCode === categoryCode && m.hillCode === hillCode);
      if (slice.length !== 15) {
        errors.push(`${categoryCode}/${hillCode}: expected 15 missions, found ${slice.length}`);
      }
      for (let order = 1; order <= 15; order++) {
        const expectedId = `MIS-${categoryCode}-${hillCode}-${String(order).padStart(2, '0')}`;
        if (!ids.has(expectedId)) {
          errors.push(`Missing ${expectedId}`);
        }
      }
    }
  }

  for (const mission of missions) {
    if (!mission.title) errors.push(`${mission.externalId}: missing title`);
    if (!mission.instruction) errors.push(`${mission.externalId}: missing instruction`);
    if (!mission.why) errors.push(`${mission.externalId}: missing WHY?`);
    if (mission.missionGroup < 1 || mission.missionGroup > 5) {
      errors.push(`${mission.externalId}: invalid group ${mission.missionGroup}`);
    }
    const expectedGroup = Math.ceil(mission.order / 3);
    if (mission.missionGroup !== expectedGroup) {
      errors.push(
        `${mission.externalId}: group ${mission.missionGroup} does not match order ${mission.order} (expected ${expectedGroup})`,
      );
    }
  }

  return errors;
}

function main() {
  const { docx } = parseArgs(process.argv);
  if (!fs.existsSync(docx)) {
    console.error(`Docx not found: ${docx}`);
    process.exit(1);
  }

  console.log(`Reading ${docx}`);
  const xml = readDocumentXml(docx);
  const missions = parseMissions(xml);
  const errors = validate(missions);

  if (errors.length) {
    console.error('Validation failed:');
    for (const err of errors.slice(0, 20)) console.error(`  - ${err}`);
    if (errors.length > 20) console.error(`  ... and ${errors.length - 20} more`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  const payload = {
    version: '2.0',
    source: path.basename(docx),
    extractedAt: new Date().toISOString(),
    missionCount: missions.length,
    missions,
  };
  const withWhy = missions.filter((m) => m.why).length;
  fs.writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${missions.length} missions (${withWhy} with WHY?) to ${OUTPUT}`);
}

main();
