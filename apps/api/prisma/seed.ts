import { hashPassword } from '../src/lib/password';
import { HILL_DOMAINS, HILL_CODE_ORDER } from '../src/lib/hillDomains';
import { ensureAllMissionPools } from '../src/lib/ensureMissionPool';
import { seedGapQuestions } from '../src/lib/gapService';
import { GAP_TOTAL_QUESTIONS } from '../src/services/gapScoring';
import { AGE_CATEGORY_CODES } from '../src/lib/ageCategories';
import { prisma } from '../src/lib/prisma';

const HILLS = HILL_CODE_ORDER.map((code) => {
  const meta = HILL_DOMAINS[code];
  return {
    code,
    name: meta.domain,
    description: meta.description,
    virtueName: meta.hill,
    colorTheme: meta.colorTheme,
  };
});

const CAMPS = [
  { number: 1, name: 'Base Camp', stepThreshold: 1, coinReward: 500 },
  { number: 2, name: 'Camp 2', stepThreshold: 3, coinReward: 750 },
  { number: 3, name: 'Camp 3', stepThreshold: 7, coinReward: 1000 },
  { number: 4, name: 'Camp 4', stepThreshold: 14, coinReward: 1250 },
  { number: 5, name: 'Camp 5', stepThreshold: 21, coinReward: 1500 },
  { number: 6, name: 'Camp 6', stepThreshold: 35, coinReward: 2000 },
  { number: 7, name: 'Summit', stepThreshold: 49, coinReward: 10000 },
];

const ADMIN_CONFIG = [
  {
    key: 'mission_coin_amounts',
    value: { default: 5, withReflection: 5, withEvidence: 5, family: 5 },
    description: 'Coins granted per mission completed (Section 7 — flat +5)',
  },
  {
    key: 'growth_set_bonus',
    value: 15,
    description: 'Bonus coins when all 3 missions in a hill cycle are completed (+15)',
  },
  {
    key: 'flow_week_bonus',
    value: 200,
    description: 'Bonus coins for completing a Flow Week',
  },
  {
    key: 'camp_rewards',
    value: [500, 750, 1000, 1250, 1500, 2000, 10000],
    description: 'Coin rewards for camps 1 through 7',
  },
  {
    key: 'welcome_bonus',
    value: 100,
    description: 'Coins granted to new users on signup',
  },
  {
    key: 'max_seed_inventory',
    value: 49,
    description: 'Maximum Glow Seeds a user may hold in inventory',
  },
  {
    key: 'seed_expiry_days',
    value: 30,
    description: 'Days after send before a pending Glow Seed expires',
  },
  {
    key: 'monthly_send_limit',
    value: 49,
    description: 'Maximum Glow Seeds a user may send per calendar month',
  },
  {
    key: 'virtue_probabilities',
    value: {
      Kindness: 0.15,
      Responsibility: 0.15,
      Discipline: 0.14,
      Integrity: 0.14,
      HardWork: 0.14,
      Courage: 0.14,
      Patience: 0.14,
    },
    description: 'Relative probabilities for virtue bloom outcomes',
  },
  {
    key: 'mission_multiplier',
    value: 1.0,
    description: 'Global multiplier applied to mission coin rewards',
  },
];

async function main() {
  const [coachExists, hillCount, gapQuestionCount] = await Promise.all([
    prisma.user.findUnique({ where: { username: 'coach_bala' } }),
    prisma.hill.count(),
    prisma.gapQuestion.count(),
  ]);

  if (coachExists && hillCount >= HILLS.length && gapQuestionCount >= AGE_CATEGORY_CODES.length * GAP_TOTAL_QUESTIONS) {
    console.log('✓ Database already seeded. Skipping seed operations.');
    return;
  }

  console.log('Starting seed operations...');

  // Batch seed hills
  for (const hill of HILLS) {
    await prisma.hill.upsert({
      where: { code: hill.code },
      update: { name: hill.name, description: hill.description, virtueName: hill.virtueName, colorTheme: hill.colorTheme },
      create: hill,
    });
  }
  console.log(`✓ Seeded ${HILLS.length} hills`);

  // Batch seed camps
  for (const camp of CAMPS) {
    await prisma.camp.upsert({
      where: { number: camp.number },
      update: { name: camp.name, stepThreshold: camp.stepThreshold, coinReward: camp.coinReward },
      create: camp,
    });
  }
  console.log(`✓ Seeded ${CAMPS.length} camps`);

  // Batch seed admin configs
  for (const config of ADMIN_CONFIG) {
    await prisma.adminConfig.upsert({
      where: { key: config.key },
      update: { value: config.value, description: config.description },
      create: config,
    });
  }
  console.log(`✓ Seeded ${ADMIN_CONFIG.length} admin configs`);

  // Mission pools: 15 missions per hill × 9 age categories (945 total)
  await ensureAllMissionPools(prisma);
  console.log('✓ Mission pools ensured for all categories and hills');

  const gapCount = await seedGapQuestions();
  console.log(`✓ ${gapCount} GAP assessment questions seeded (35 per category × 9 categories)`);

  // Official GOFAM Coach — auto-connect + welcome/monthly seeds for every new user
  const coachHash = await hashPassword('coach-bala-dev-only');
  await prisma.user.upsert({
    where: { username: 'coach_bala' },
    update: {
      displayName: 'GoFam Coach Bala',
      accountType: 'official_coach',
      officialAccount: true,
      autoConnectNewUsers: true,
      welcomeGlowSeedEnabled: true,
      monthlyGlowSeedEnabled: true,
      autoBloomReceivedSeed: true,
      qualifyingReceivedSeedLimit: 1,
    },
    create: {
      username: 'coach_bala',
      displayName: 'GoFam Coach Bala',
      email: 'coach.bala@gofam.test',
      passwordHash: coachHash,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=coachbala',
      accountType: 'official_coach',
      officialAccount: true,
      autoConnectNewUsers: true,
      welcomeGlowSeedEnabled: true,
      monthlyGlowSeedEnabled: true,
      autoBloomReceivedSeed: true,
      qualifyingReceivedSeedLimit: 1,
    },
  });
  console.log('✓ Coach Bala official account ready');

  // Comprehensive worldwide geography dataset
  const geoData = {
    IN: { name: 'India', states: { TN: { name: 'Tamil Nadu', cities: ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Trichy', 'Erode', 'Kanyakumari', 'Tiruppur'] }, MH: { name: 'Maharashtra', cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur'] }, KA: { name: 'Karnataka', cities: ['Bangalore', 'Mysore', 'Belgaum', 'Mangalore', 'Hubballi', 'Shimoga', 'Hassan'] }, AP: { name: 'Andhra Pradesh', cities: ['Hyderabad', 'Visakhapatnam', 'Vijayawada', 'Tirupati', 'Kakinada', 'Nellore'] }, TE: { name: 'Telangana', cities: ['Hyderabad', 'Warangal', 'Nizamabad', 'Khammam'] }, TG: { name: 'West Bengal', cities: ['Kolkata', 'Asansol', 'Darjeeling', 'Siliguri', 'Durgapur'] }, DL: { name: 'Delhi', cities: ['New Delhi', 'Central Delhi', 'South Delhi', 'East Delhi', 'West Delhi'] }, HR: { name: 'Haryana', cities: ['Faridabad', 'Gurgaon', 'Hisar', 'Rohtak', 'Panipat', 'Ambala'] }, UP: { name: 'Uttar Pradesh', cities: ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Noida', 'Ghaziabad', 'Meerut', 'Indore'] }, MP: { name: 'Madhya Pradesh', cities: ['Indore', 'Bhopal', 'Jabalpur', 'Ujjain', 'Sagar', 'Gwalior'] }, GJ: { name: 'Gujarat', cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Junagadh'] }, RJ: { name: 'Rajasthan', cities: ['Jaipur', 'Jodhpur', 'Udaipur', 'Bikaner', 'Kota', 'Ajmer'] }, PB: { name: 'Punjab', cities: ['Chandigarh', 'Amritsar', 'Ludhiana', 'Jalandhar', 'Patiala'] }, KL: { name: 'Kerala', cities: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Ernakulam'] }, OR: { name: 'Odisha', cities: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Sambalpur'] }, AS: { name: 'Assam', cities: ['Guwahati', 'Silchar', 'Dibrugarh', 'Nagaon'] }, JK: { name: 'Jammu & Kashmir', cities: ['Srinagar', 'Jammu', 'Leh'] }, HP: { name: 'Himachal Pradesh', cities: ['Shimla', 'Mandi', 'Kangra', 'Solan'] }, UK: { name: 'Uttarakhand', cities: ['Dehradun', 'Nainital', 'Haridwar', 'Rishikesh'] }, CT: { name: 'Chhattisgarh', cities: ['Raipur', 'Bilaspur', 'Durg', 'Raigarh'] }, JH: { name: 'Jharkhand', cities: ['Ranchi', 'Dhanbad', 'Giridih', 'Bokaro'] }, BR: { name: 'Bihar', cities: ['Patna', 'Gaya', 'Muzaffarpur', 'Darbhanga'] }, TR: { name: 'Tripura', cities: ['Agartala', 'Udaipur'] }, MN: { name: 'Manipur', cities: ['Imphal', 'Ukhrul'] }, MZ: { name: 'Mizoram', cities: ['Aizawl', 'Lunglei'] }, NL: { name: 'Nagaland', cities: ['Kohima', 'Dimapur'] }, SK: { name: 'Sikkim', cities: ['Gangtok', 'Pelling'] }, AR: { name: 'Arunachal Pradesh', cities: ['Itanagar', 'Naharlagun'] }, ML: { name: 'Meghalaya', cities: ['Shillong', 'Tura'] } } },
    US: { name: 'United States', states: { CA: { name: 'California', cities: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento', 'Oakland', 'Long Beach'] }, TX: { name: 'Texas', cities: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth', 'Arlington'] }, FL: { name: 'Florida', cities: ['Miami', 'Tampa', 'Orlando', 'Jacksonville', 'Fort Lauderdale'] }, NY: { name: 'New York', cities: ['New York City', 'Buffalo', 'Rochester', 'Albany', 'Yonkers'] }, PA: { name: 'Pennsylvania', cities: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie'] }, IL: { name: 'Illinois', cities: ['Chicago', 'Aurora', 'Rockford', 'Joliet', 'Naperville'] }, OH: { name: 'Ohio', cities: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron'] }, GA: { name: 'Georgia', cities: ['Atlanta', 'Augusta', 'Savannah', 'Athens', 'Columbus'] }, NC: { name: 'North Carolina', cities: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem'] }, MI: { name: 'Michigan', cities: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights'] }, NJ: { name: 'New Jersey', cities: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Trenton'] }, VA: { name: 'Virginia', cities: ['Virginia Beach', 'Norfolk', 'Richmond', 'Arlington', 'Alexandria'] }, WA: { name: 'Washington', cities: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver'] }, AZ: { name: 'Arizona', cities: ['Phoenix', 'Mesa', 'Chandler', 'Scottsdale', 'Glendale'] }, MA: { name: 'Massachusetts', cities: ['Boston', 'Worcester', 'Springfield', 'Cambridge'] }, CO: { name: 'Colorado', cities: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins'] }, MO: { name: 'Missouri', cities: ['Kansas City', 'St. Louis', 'Springfield', 'Independence'] }, TN: { name: 'Tennessee', cities: ['Memphis', 'Nashville', 'Knoxville', 'Chattanooga'] }, MD: { name: 'Maryland', cities: ['Baltimore', 'Frederick', 'Gaithersburg', 'Annapolis'] }, IN: { name: 'Indiana', cities: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend'] }, MN: { name: 'Minnesota', cities: ['Minneapolis', 'St. Paul', 'Rochester', 'Duluth'] } } },
    GB: { name: 'United Kingdom', states: { ENG: { name: 'England', cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Liverpool', 'Newcastle', 'Bristol'] }, SCT: { name: 'Scotland', cities: ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness'] }, WLS: { name: 'Wales', cities: ['Cardiff', 'Swansea', 'Newport', 'Wrexham'] }, NIR: { name: 'Northern Ireland', cities: ['Belfast', 'Derry', 'Lisburn'] } } },
    CA: { name: 'Canada', states: { ON: { name: 'Ontario', cities: ['Toronto', 'Ottawa', 'Hamilton', 'London', 'Mississauga'] }, QC: { name: 'Quebec', cities: ['Montreal', 'Quebec City', 'Laval', 'Gatineau'] }, BC: { name: 'British Columbia', cities: ['Vancouver', 'Victoria', 'Surrey', 'Calgary'] }, AB: { name: 'Alberta', cities: ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge'] }, MB: { name: 'Manitoba', cities: ['Winnipeg', 'Brandon', 'Thompson'] }, SK: { name: 'Saskatchewan', cities: ['Saskatoon', 'Regina', 'Prince Albert'] }, NS: { name: 'Nova Scotia', cities: ['Halifax', 'Cape Breton', 'Sydney'] }, NB: { name: 'New Brunswick', cities: ['Saint John', 'Moncton', 'Fredericton'] }, NL: { name: 'Newfoundland and Labrador', cities: ['St. John\'s', 'Corner Brook', 'Gander'] }, PE: { name: 'Prince Edward Island', cities: ['Charlottetown', 'Summerside'] } } },
    AU: { name: 'Australia', states: { NSW: { name: 'New South Wales', cities: ['Sydney', 'Newcastle', 'Wollongong', 'Central Coast'] }, VIC: { name: 'Victoria', cities: ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo'] }, QLD: { name: 'Queensland', cities: ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Cairns'] }, SA: { name: 'South Australia', cities: ['Adelaide', 'Mount Gambier', 'Port Augusta'] }, WA: { name: 'Western Australia', cities: ['Perth', 'Fremantle', 'Mandurah'] }, TAS: { name: 'Tasmania', cities: ['Hobart', 'Launceston', 'Devonport'] }, ACT: { name: 'Australian Capital Territory', cities: ['Canberra', 'Woden', 'Tuggeranong'] }, NT: { name: 'Northern Territory', cities: ['Darwin', 'Alice Springs', 'Palmerston'] } } },
    DE: { name: 'Germany', states: { BW: { name: 'Baden-Württemberg', cities: ['Stuttgart', 'Mannheim', 'Karlsruhe', 'Freiburg'] }, BY: { name: 'Bavaria', cities: ['Munich', 'Nuremberg', 'Augsburg', 'Ingolstadt'] }, BE: { name: 'Berlin', cities: ['Berlin'] }, BB: { name: 'Brandenburg', cities: ['Potsdam', 'Cottbus'] }, HB: { name: 'Bremen', cities: ['Bremen', 'Bremerhaven'] }, HH: { name: 'Hamburg', cities: ['Hamburg'] }, HE: { name: 'Hesse', cities: ['Frankfurt', 'Wiesbaden', 'Kassel'] }, MV: { name: 'Mecklenburg-Vorpommern', cities: ['Rostock', 'Schwerin'] }, NI: { name: 'Lower Saxony', cities: ['Hannover', 'Braunschweig', 'Oldenburg'] }, NW: { name: 'North Rhine-Westphalia', cities: ['Cologne', 'Düsseldorf', 'Dortmund', 'Essen'] }, RP: { name: 'Rhineland-Palatinate', cities: ['Mainz', 'Ludwigshafen'] }, SL: { name: 'Saarland', cities: ['Saarbrücken'] }, SN: { name: 'Saxony', cities: ['Dresden', 'Leipzig', 'Chemnitz'] }, ST: { name: 'Saxony-Anhalt', cities: ['Magdeburg', 'Halle'] }, SH: { name: 'Schleswig-Holstein', cities: ['Kiel', 'Lübeck'] }, TH: { name: 'Thuringia', cities: ['Erfurt', 'Jena'] } } },
    FR: { name: 'France', states: { IDF: { name: 'Île-de-France', cities: ['Paris', 'Boulogne-Billancourt', 'Saint-Denis'] }, PACA: { name: 'Provence-Alpes-Côte d\'Azur', cities: ['Marseille', 'Nice', 'Toulon', 'Aix-en-Provence'] }, ARA: { name: 'Auvergne-Rhône-Alpes', cities: ['Lyon', 'Grenoble', 'Saint-Étienne'] }, BFC: { name: 'Bourgogne-Franche-Comté', cities: ['Dijon', 'Besançon'] }, NAQ: { name: 'Nouvelle-Aquitaine', cities: ['Bordeaux', 'Toulouse', 'Limoges'] }, OCC: { name: 'Occitanie', cities: ['Toulouse', 'Montpellier'] }, BRE: { name: 'Bretagne', cities: ['Nantes', 'Rennes', 'Brest'] }, PDL: { name: 'Pays de la Loire', cities: ['Nantes', 'Angers', 'Le Mans'] }, NOR: { name: 'Normandie', cities: ['Rouen', 'Le Havre', 'Caen'] }, HDF: { name: 'Hauts-de-France', cities: ['Lille', 'Amiens'] }, COS: { name: 'Corse', cities: ['Ajaccio', 'Bastia'] } } },
    ES: { name: 'Spain', states: { AND: { name: 'Andalusia', cities: ['Seville', 'Málaga', 'Córdoba', 'Granada', 'Cádiz'] }, ARA: { name: 'Aragon', cities: ['Zaragoza', 'Teruel'] }, AST: { name: 'Asturias', cities: ['Oviedo', 'Gijón'] }, BAL: { name: 'Balearic Islands', cities: ['Palma', 'Ibiza'] }, EUS: { name: 'Basque Country', cities: ['Bilbao', 'Vitoria-Gasteiz'] }, CAL: { name: 'Castile and León', cities: ['Valladolid', 'Burgos', 'León', 'Segovia'] }, CAM: { name: 'Castile-La Mancha', cities: ['Toledo', 'Cuenca', 'Ciudad Real'] }, CAT: { name: 'Catalonia', cities: ['Barcelona', 'Girona', 'Tarragona'] }, COM: { name: 'Community of Madrid', cities: ['Madrid'] }, EXT: { name: 'Extremadura', cities: ['Badajoz', 'Cáceres'] }, GAL: { name: 'Galicia', cities: ['Santiago de Compostela', 'A Coruña', 'Vigo'] }, LRI: { name: 'La Rioja', cities: ['Logroño'] }, MUR: { name: 'Region of Murcia', cities: ['Murcia', 'Cartagena'] }, NAV: { name: 'Navarre', cities: ['Pamplona', 'Tudela'] }, VAL: { name: 'Valencian Community', cities: ['Valencia', 'Alicante', 'Castellón'] } } },
    JP: { name: 'Japan', states: { AK: { name: 'Akita', cities: ['Akita', 'Aomori'] }, AO: { name: 'Aomori', cities: ['Aomori'] }, CH: { name: 'Chiba', cities: ['Chiba', 'Funabashi'] }, EH: { name: 'Ehime', cities: ['Matsuyama'] }, FK: { name: 'Fukui', cities: ['Fukui'] }, FM: { name: 'Fukuoka', cities: ['Fukuoka', 'Kitakyushu'] }, GF: { name: 'Gifu', cities: ['Gifu', 'Nagoya'] }, GN: { name: 'Gunma', cities: ['Maebashi'] }, HR: { name: 'Hiroshima', cities: ['Hiroshima', 'Kure'] }, HK: { name: 'Hokkaido', cities: ['Sapporo', 'Asahikawa'] }, HY: { name: 'Hyogo', cities: ['Kobe', 'Himeji'] }, IG: { name: 'Ibaraki', cities: ['Mito', 'Hitachi'] }, SZ: { name: 'Shizuoka', cities: ['Shizuoka', 'Hamamatsu'] }, TK: { name: 'Tokyo', cities: ['Tokyo', 'Shinjuku', 'Shibuya'] }, KN: { name: 'Kanagawa', cities: ['Yokohama', 'Kawasaki'] }, NU: { name: 'Nagano', cities: ['Nagano'] }, NG: { name: 'Nagasaki', cities: ['Nagasaki'] }, AR: { name: 'Aichi', cities: ['Nagoya', 'Toyota'] } } },
    ZA: { name: 'South Africa', states: { EC: { name: 'Eastern Cape', cities: ['Port Elizabeth', 'East London'] }, FS: { name: 'Free State', cities: ['Bloemfontein'] }, GP: { name: 'Gauteng', cities: ['Johannesburg', 'Pretoria', 'Soweto'] }, KN: { name: 'KwaZulu-Natal', cities: ['Durban', 'Pietermaritzburg'] }, LP: { name: 'Limpopo', cities: ['Polokwane'] }, MP: { name: 'Mpumalanga', cities: ['Nelspruit'] }, NC: { name: 'Northern Cape', cities: ['Kimberley'] }, NW: { name: 'North West', cities: ['Rustenburg'] }, WC: { name: 'Western Cape', cities: ['Cape Town', 'Stellenbosch'] } } },
    BR: { name: 'Brazil', states: { AC: { name: 'Acre', cities: ['Rio Branco'] }, AL: { name: 'Alagoas', cities: ['Maceió'] }, AP: { name: 'Amapá', cities: ['Macapá'] }, AM: { name: 'Amazonas', cities: ['Manaus'] }, BA: { name: 'Bahia', cities: ['Salvador', 'Feira de Santana'] }, CE: { name: 'Ceará', cities: ['Fortaleza', 'Caucaia'] }, DF: { name: 'Federal District', cities: ['Brasília'] }, ES: { name: 'Espírito Santo', cities: ['Vitória', 'Vila Velha'] }, GO: { name: 'Goiás', cities: ['Goiânia', 'Aparecida de Goiânia'] }, MA: { name: 'Maranhão', cities: ['São Luís'] }, MT: { name: 'Mato Grosso', cities: ['Cuiabá'] }, MS: { name: 'Mato Grosso do Sul', cities: ['Campo Grande'] }, MG: { name: 'Minas Gerais', cities: ['Belo Horizonte', 'Uberlândia'] }, PA: { name: 'Pará', cities: ['Belém'] }, PB: { name: 'Paraíba', cities: ['João Pessoa'] }, PR: { name: 'Paraná', cities: ['Curitiba', 'Londrina'] }, PE: { name: 'Pernambuco', cities: ['Recife', 'Jaboatão dos Guararapes'] }, PI: { name: 'Piauí', cities: ['Teresina'] }, RJ: { name: 'Rio de Janeiro', cities: ['Rio de Janeiro', 'Niterói'] }, RN: { name: 'Rio Grande do Norte', cities: ['Natal'] }, RS: { name: 'Rio Grande do Sul', cities: ['Porto Alegre', 'Caxias do Sul'] }, RO: { name: 'Rondônia', cities: ['Porto Velho'] }, RR: { name: 'Roraima', cities: ['Boa Vista'] }, SC: { name: 'Santa Catarina', cities: ['Florianópolis', 'Joinville'] }, SP: { name: 'São Paulo', cities: ['São Paulo', 'Campinas'] }, SE: { name: 'Sergipe', cities: ['Aracaju'] }, TO: { name: 'Tocantins', cities: ['Palmas'] } } },
    MX: { name: 'Mexico', states: { AGS: { name: 'Aguascalientes', cities: ['Aguascalientes'] }, BC: { name: 'Baja California', cities: ['Tijuana', 'Mexicali'] }, BCS: { name: 'Baja California Sur', cities: ['La Paz'] }, CAM: { name: 'Campeche', cities: ['Campeche'] }, CH: { name: 'Chiapas', cities: ['Tuxtla Gutiérrez'] }, CHH: { name: 'Chihuahua', cities: ['Chihuahua', 'Ciudad Juárez'] }, CDMX: { name: 'Mexico City', cities: ['Mexico City'] }, DUR: { name: 'Durango', cities: ['Durango'] }, GTO: { name: 'Guanajuato', cities: ['León', 'Guanajuato'] }, GRO: { name: 'Guerrero', cities: ['Acapulco'] }, HGO: { name: 'Hidalgo', cities: ['Pachuca'] }, JAL: { name: 'Jalisco', cities: ['Guadalajara', 'Zapopan'] }, MEX: { name: 'State of Mexico', cities: ['Ecatepec', 'Toluca'] }, MIC: { name: 'Michoacán', cities: ['Morelia'] }, MOR: { name: 'Morelos', cities: ['Cuernavaca'] }, NAY: { name: 'Nayarit', cities: ['Tepic'] }, OAX: { name: 'Oaxaca', cities: ['Oaxaca City'] }, PUE: { name: 'Puebla', cities: ['Puebla', 'Tlaxcala'] }, QRO: { name: 'Querétaro', cities: ['Querétaro'] }, QRoo: { name: 'Quintana Roo', cities: ['Cancún'] }, SLP: { name: 'San Luis Potosí', cities: ['San Luis Potosí'] }, SIN: { name: 'Sinaloa', cities: ['Culiacán'] }, SON: { name: 'Sonora', cities: ['Hermosillo'] }, TAB: { name: 'Tabasco', cities: ['Villahermosa'] }, TAM: { name: 'Tamaulipas', cities: ['Ciudad Victoria'] }, TLX: { name: 'Tlaxcala', cities: ['Tlaxcala'] }, VER: { name: 'Veracruz', cities: ['Veracruz', 'Xalapa'] }, YUC: { name: 'Yucatán', cities: ['Mérida'] }, ZAC: { name: 'Zacatecas', cities: ['Zacatecas'] } } },
  };

  // Fast batch geo seed — reseed if the database is partial so users do not end up with a truncated country list.
  const expectedCountries = Object.keys(geoData).length;
  const existingCountries = await prisma.geoCountry.count();

  if (existingCountries < expectedCountries) {
    await prisma.geoCity.deleteMany();
    await prisma.geoState.deleteMany();
    await prisma.geoCountry.deleteMany();

    const countriesToCreate = Object.entries(geoData).map(([code, data]) => ({
      code,
      name: data.name,
    }));

    const countriesResult = await prisma.geoCountry.createMany({ data: countriesToCreate });
    console.log(`✓ Seeded ${countriesResult.count} countries`);

    const allCountries = await prisma.geoCountry.findMany();
    const countryMap = Object.fromEntries(allCountries.map((c) => [c.code, c.id]));

    const statesToCreate: Array<{ countryId: string; name: string }> = [];
    for (const [countryCode, countryData] of Object.entries(geoData)) {
      const countryId = countryMap[countryCode];
      for (const stateData of Object.values(countryData.states)) {
        statesToCreate.push({ countryId, name: stateData.name });
      }
    }

    const statesResult = await prisma.geoState.createMany({ data: statesToCreate });
    console.log(`✓ Seeded ${statesResult.count} states`);

    const allStates = await prisma.geoState.findMany();
    const stateMap = Object.fromEntries(allStates.map((s) => [`${s.countryId}|${s.name}`, s.id]));

    const citiesToCreate: Array<{ stateId: string; name: string }> = [];
    for (const [countryCode, countryData] of Object.entries(geoData)) {
      const countryId = countryMap[countryCode];
      for (const stateData of Object.values(countryData.states)) {
        const stateId = stateMap[`${countryId}|${stateData.name}`];
        if (!stateId) continue;
        for (const cityName of stateData.cities) {
          citiesToCreate.push({ stateId, name: cityName });
        }
      }
    }

    const citiesResult = await prisma.geoCity.createMany({ data: citiesToCreate });
    console.log(`✓ Seeded ${citiesResult.count} cities`);
  } else {
    console.log('✓ Geography data already populated, skipping...');
  }

  // Re-fetch Chennai for school seed data
  const india = await prisma.geoCountry.findUnique({ where: { code: 'IN' } });
  const tn = await prisma.geoState.findUnique({
    where: { countryId_name: { countryId: india.id, name: 'Tamil Nadu' } },
  });
  const chennai = await prisma.geoCity.findUnique({
    where: { stateId_name: { stateId: tn.id, name: 'Chennai' } },
  });
  await prisma.organization.upsert({
    where: { id: 'seed-org-velammal-mugappair' },
    update: { inviteCode: 'VELAMMAL-GOFAM', status: 'gofam_verified' },
    create: {
      id: 'seed-org-velammal-mugappair',
      name: 'Velammal Mugappair',
      type: 'school',
      status: 'gofam_verified',
      inviteCode: 'VELAMMAL-GOFAM',
      cityId: chennai.id,
    },
  });
  await prisma.organization.upsert({
    where: { id: 'seed-org-don-bosco-egmore' },
    update: {},
    create: {
      id: 'seed-org-don-bosco-egmore',
      name: 'Don Bosco Egmore',
      type: 'school',
      status: 'community_interest',
      cityId: chennai.id,
    },
  });
  console.log('✓ Geography + sample schools (Velammal, Don Bosco Egmore)');

  const adminHash = await hashPassword('Admin@123');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admn@gmail.com' },
    update: {
      role: 'admin',
      passwordHash: adminHash,
      onboardingCompleted: true,
      adminPasswordMustReset: true,
    },
    create: {
      username: 'gofam_admin',
      email: 'admn@gmail.com',
      passwordHash: adminHash,
      role: 'admin',
      onboardingCompleted: true,
      adminPasswordMustReset: true,
    },
  });
  const existingSuperAdmin = await prisma.adminStaffAssignment.findFirst({
    where: { userId: adminUser.id, role: 'super_admin', institutionId: null },
  });
  if (!existingSuperAdmin) {
    await prisma.adminStaffAssignment.create({
      data: { userId: adminUser.id, role: 'super_admin' },
    });
  }
  console.log('✓ Seed complete: gofam_admin (admn@gmail.com) super_admin — run ensure-admin-user.ts for MFA secret');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
