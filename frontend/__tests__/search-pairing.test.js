/**
 * How the search screen (Mission Control) is paired with the rest of the
 * site: the pages that lead to it, picture it or describe it.
 *
 * The screen was rebuilt twice in two days (2026-11-11 and 12) and the
 * pages around it kept describing the one before: the homepage showed a
 * picture of a satellite map with tasks and chat, the pet's page promised
 * "one tap sends where you are" and sent people to a flyer tab, and the
 * site's own brief named a button that was nowhere. Like
 * search-screen-rules.test.js this is static, and it fails the moment
 * another page says something about the screen that the screen does not do.
 */

const fs = require('fs');
const path = require('path');

const FRONTEND = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(FRONTEND, rel), 'utf8');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(full);
    return /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}
const rel = (file) => path.relative(FRONTEND, file).split(path.sep).join('/');
/** Source with its comments taken out, so a note about an old wording is not read as that wording. */
const code = (source) => source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const appFiles = walk(path.join(FRONTEND, 'app')).map(rel);

describe('every way into the search screen asks it for something it does', () => {
  // Lines outside the screen's own folder that build a link to it.
  const links = appFiles
    .filter((file) => !file.startsWith('app/mission-control/'))
    .flatMap((file) =>
      read(file)
        .split('\n')
        .map((line, i) => ({ file, line: i + 1, text: line }))
        .filter(({ text }) => /mission-control\?|missionHref\}|\$\{map\}/.test(text) && !/^\s*(\*|\/\/|\/\*)/.test(text))
    );

  test('there are links to check', () => {
    expect(links.length).toBeGreaterThan(5);
    expect(links.map((l) => l.file)).toEqual(expect.arrayContaining(['app/cases/[caseNumber]/CasePageClient.js', 'app/join/[missionId]/JoinRedirect.js', 'app/lib/witness.js']));
  });

  test('the only action a link asks for is one the screen has: the sighting form, or the join card', () => {
    const asked = links.flatMap(({ file, line, text }) => [...text.matchAll(/[?&]action=([a-zA-Z$({}]+)/g)].map((m) => ({ file, line, action: m[1] })));
    // JoinRedirect passes on whatever the share link carried; the screen ignores anything it does not know.
    const literal = asked.filter((a) => !a.action.startsWith('$'));
    // The third "sighting" is the older report page (/sightings/report), which now opens the screen's form.
    expect(literal.map((a) => a.action).sort()).toEqual(['sighting', 'sighting', 'sighting', 'walk']);
    expect(literal.map((a) => a.file)).toContain('app/sightings/report/route.js');
    expect(read('app/mission-control/SearchScreen.js')).toMatch(/if \(action === 'sighting'\) openSeen\(\);\s*else if \(action === 'walk' && /);
  });

  test('nothing links to a tab: the screen has none', () => {
    expect(links.filter(({ text }) => /[?&]tab=/.test(text))).toEqual([]);
  });

  test('the way back out is the pet\'s page', () => {
    expect(read('app/mission-control/SearchScreen.js')).toMatch(/const petHref = picture \? `\/cases\/\$\{encodeURIComponent\(picture\.caseNumber\)\}` : '\/lost-and-found';/);
  });
});

describe('the pet\'s page says what the search screen does', () => {
  const help = read('app/cases/[caseNumber]/components/HowToHelp.js');
  const sheet = read('app/cases/[caseNumber]/components/SightingSheet.js');
  const intake = read('app/cases/[caseNumber]/components/HelpIntake.js');
  const page = read('app/cases/[caseNumber]/CasePageClient.js');

  test('its link to the search speaks of streets, as the screen does', () => {
    expect(help).toMatch(/'See which streets still need searching'/);
    expect(help).not.toMatch(/blocks still need/);
  });

  test('"I\'ve seen" promises the form the screen has, and not one tap', () => {
    expect(sheet).toMatch(/Mark where and when\. No account needed\./);
    expect(code(sheet)).not.toMatch(/One tap/i);
  });

  test('the sheet writes no advice of its own: how to behave near the pet is the owner\'s answer, shown on the page', () => {
    expect(code(sheet)).not.toMatch(/<li>|Don&apos;t chase|which way|Take a photo/);
    // The page shows the owner's own answer for a lost pet ("If you see Max").
    expect(page).toMatch(/c\.finderGuide && \(\s*<FinderGuide name=\{name\} guide=\{c\.finderGuide\}/);
  });

  test('someone with no account who says "on foot" lands on the join card, and is not asked again', () => {
    expect(intake).toMatch(/router\.push\(way === 'foot' \? `\$\{missionHref\}&action=walk` : /);
  });

  test('no flyer row is offered where there is no flyer, and none points at the search screen', () => {
    expect(code(page)).not.toMatch(/tab=flyer/);
    expect(code(page)).toMatch(/const flyerItem = kitReady\s*\? \{ key: 'flyer',[^\n]*href: '#share-kit' \}\s*: null;/);
  });

  test('the button has one name on the pet\'s page, the search screen and the site\'s brief', () => {
    expect(page).toMatch(/I&apos;ve seen \{name\}/);
    expect(read('app/mission-control/components/kit.js')).toMatch(/I&apos;ve seen \{name\}|`I've seen \$\{name\}`/);
    expect(code(read('app/lib/brief.js'))).not.toMatch(/"I saw/);
  });
});

describe('the brief on the pet\'s page is true there', () => {
  const { briefFor, briefOnPage } = require('@/app/lib/brief');
  const pet = { petName: 'Max', petSpecies: 'DOG' };

  test('nothing says a path or a drive is recorded: that happens only in the app', () => {
    for (const way of ['foot', 'car', 'home', 'gear']) {
      for (const unit of ['street', 'block']) {
        expect(briefOnPage(briefFor({ way, pet }), { unit }).join(' ')).not.toMatch(/records as you go/);
      }
    }
    // The brief itself still has the sentence, for the app, which says it while it records.
    expect(briefFor({ way: 'foot', pet })[0]).toBe('Walk every street in the block. Your path records as you go.');
  });

  test('a job that is one street is not told to walk every street in the block', () => {
    const street = briefOnPage(briefFor({ way: 'foot', pet }), { unit: 'street' });
    expect(street).toHaveLength(3);
    expect(street[0]).toMatch(/^Look low/);
    const block = briefOnPage(briefFor({ way: 'foot', pet }), { unit: 'block' });
    expect(block[0]).toBe('Walk every street in the block.');
    expect(block).toHaveLength(4);
  });

  test('nor is a job that is an area of ground: ground is searched, not walked street by street', () => {
    const area = briefOnPage(briefFor({ way: 'foot', pet }), { unit: 'area' });
    expect(area).toHaveLength(3);
    expect(area[0]).toMatch(/^Look low/);
    expect(area.join(' ')).not.toMatch(/every street/);
    // And the jobs the page hands out on foot are areas: what the job picker reads is the search's own ground.
    const jobs = read('app/lib/jobs.js');
    expect(jobs).toMatch(/import \{ openAreas \} from '@\/app\/lib\/searchZones';/);
    expect(jobs).toMatch(/way === 'foot' \|\| way === 'car' \? openAreas\(pet\.id, \{ viewer: userId \|\| null \}\) : \[\],/);
    expect(jobs).not.toMatch(/openBlocks/);
    const intake = read('app/cases/[caseNumber]/components/HelpIntake.js');
    expect(intake).toMatch(/job\.unit === 'area' \? 'I will search it'/);
  });

  test('no word is added, and the other ways of helping keep every line', () => {
    const foot = briefFor({ way: 'foot', pet });
    expect(briefOnPage(foot, { unit: 'street' })).toEqual(foot.slice(1));
    expect(briefOnPage(briefFor({ way: 'home', pet }), null)).toEqual(briefFor({ way: 'home', pet }));
    expect(briefOnPage(briefFor({ way: 'car', pet }), { unit: 'street' })).toEqual(briefFor({ way: 'car', pet }).slice(0, 3));
    expect(briefOnPage(undefined, null)).toEqual([]);
  });

  test('the intake shows the brief through that cut', () => {
    const intake = read('app/cases/[caseNumber]/components/HelpIntake.js');
    expect(intake).toMatch(/const brief = briefOnPage\(picked\?\.brief, job\);/);
    expect(intake).not.toMatch(/picked\.brief\.map/);
  });
});

describe('the homepage shows and describes the screen that exists', () => {
  const home = read('app/page.js');
  const GONE = /satellite|flyer|mission log|chat\b|tasks?\b|shelter call|search zone/i;

  test('the picture is described as what it shows', () => {
    const alt = home.match(/src="\/landing\/mission-control\.jpg"\s+alt="([^"]+)"/);
    expect(alt).not.toBeNull();
    expect(alt[1]).toMatch(/^Mission Control/);
    expect(alt[1]).toMatch(/street map/);
    expect(alt[1]).not.toMatch(GONE);
  });

  test('"How a search works" names only what Mission Control does', () => {
    const step = home.match(/title: 'Members search from Mission Control',\s*body: '([^']+)'/);
    expect(step).not.toBeNull();
    expect(step[1]).not.toMatch(GONE);
    expect(step[1]).toMatch(/one street/);
  });

  test('the picture is a real capture of the current screen, at the size the page lays it out', () => {
    const file = path.join(FRONTEND, 'public', 'landing', 'mission-control.jpg');
    const bytes = fs.readFileSync(file);
    // A JPEG, and neither a placeholder nor a file too heavy for a homepage.
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes.length).toBeGreaterThan(100 * 1024);
    expect(bytes.length).toBeLessThan(900 * 1024);
  });
});
