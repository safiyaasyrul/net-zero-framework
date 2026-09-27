import XLSX from 'xlsx';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const JLM_DIR = 'C:\\Users\\Dr Dyana\\Documents\\Consultation\\JLM';
const DATA_DIR = join(JLM_DIR, 'data');
const OUT_DIR = join(__dirname, '..', 'public', 'data');

mkdirSync(OUT_DIR, { recursive: true });

function getStr(val) {
  return String(val || '').trim();
}

function getNum(val) {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function classifyFuel(fuelStr) {
  const f = String(fuelStr).toLowerCase();
  if (f.includes('lng') || f.includes('liquefied natural gas')) return 'LNG';
  if (f.includes('heavy fuel') || f.includes('hfo') || f.includes('residual')) return 'HFO';
  if (f.includes('light fuel') || f.includes('lfo')) return 'LFO';
  if (f.includes('diesel') || f.includes('gas oil') || f.includes('mdo') || f.includes('mgo')) return 'MDO/MGO';
  if (f.includes('lpg')) return 'LPG';
  if (f.includes('methanol')) return 'Methanol';
  return 'Other';
}

function classifyShipType(typeStr) {
  const t = String(typeStr).toLowerCase();
  if (t.includes('lng')) return 'LNG Carrier';
  if (t.includes('chemical')) return 'Chemical Tanker';
  if (t.includes('tanker') || t.includes('oil')) return 'Tanker';
  if (t.includes('bulk')) return 'Bulk Carrier';
  if (t.includes('container')) return 'Container Ship';
  if (t.includes('general cargo') || t.includes('cargo')) return 'General Cargo';
  if (t.includes('ro-ro') || t.includes('roro') || t.includes('vehicle')) return 'Ro-Ro';
  if (t.includes('offshore') || t.includes('supply') || t.includes('platform')) return 'Offshore/Supply';
  if (t.includes('tug')) return 'Tug';
  if (t.includes('passenger') || t.includes('cruise')) return 'Passenger';
  if (t.includes('gas')) return 'Gas Carrier';
  return typeStr || 'Unknown';
}

// IMO CII reference line parameters by ship type (simplified)
const ciiRefParams = {
  'Bulk Carrier':     { a: 4745, c: -0.622 },
  'Tanker':           { a: 5247, c: -0.610 },
  'Container Ship':   { a: 1984, c: -0.489 },
  'General Cargo':    { a: 588,  c: -0.3885 },
  'LNG Carrier':      { a: 14405,c: -0.645 },
  'Gas Carrier':      { a: 14405,c: -0.645 },
  'Chemical Tanker':  { a: 5247, c: -0.610 },
  'Ro-Ro':            { a: 764,  c: -0.3804 },
  'Default':          { a: 5247, c: -0.610 }
};

const dVectors = {
  'Bulk Carrier':     { d1: 0.86, d2: 0.94, d3: 1.06, d4: 1.18 },
  'Tanker':           { d1: 0.82, d2: 0.93, d3: 1.08, d4: 1.28 },
  'Container Ship':   { d1: 0.83, d2: 0.94, d3: 1.07, d4: 1.19 },
  'General Cargo':    { d1: 0.83, d2: 0.94, d3: 1.06, d4: 1.19 },
  'LNG Carrier':      { d1: 0.89, d2: 0.98, d3: 1.06, d4: 1.13 },
  'Gas Carrier':      { d1: 0.85, d2: 0.95, d3: 1.06, d4: 1.18 },
  'Chemical Tanker':  { d1: 0.82, d2: 0.93, d3: 1.08, d4: 1.28 },
  'Ro-Ro':            { d1: 0.86, d2: 0.94, d3: 1.06, d4: 1.18 },
  'Default':          { d1: 0.83, d2: 0.94, d3: 1.06, d4: 1.18 }
};

const reductionFactors = { 2019: 0, 2020: 0.01, 2021: 0.02, 2022: 0.03, 2023: 0.05 };

function computeRating(attainedCII, dwt, shipType, year) {
  const sType = classifyShipType(shipType);
  const params = ciiRefParams[sType] || ciiRefParams['Default'];
  const dv = dVectors[sType] || dVectors['Default'];
  const z = reductionFactors[year] || 0;
  
  const ciiRef = params.a * Math.pow(dwt, params.c);
  const requiredCII = ciiRef * (1 - z);
  
  const ratio = attainedCII / requiredCII;
  
  let rating;
  if (ratio <= dv.d1) rating = 'A';
  else if (ratio <= dv.d2) rating = 'B';
  else if (ratio <= dv.d3) rating = 'C';
  else if (ratio <= dv.d4) rating = 'D';
  else rating = 'E';
  
  return { requiredCII, rating, ratio };
}

console.log('========================================');
console.log('Extracting Global IMO DCS Data');
console.log('========================================');

const allShips = new Map();

function ensureShip(id, year, defaults = {}) {
  if (!allShips.has(id)) {
    allShips.set(id, {
      imo: id, // We use Report number as a proxy for IMO
      name: `Ship ${id}`,
      shipType: defaults.shipType || 'Unknown',
      grossTonnage: defaults.grossTonnage || 0,
      dwt: defaults.dwt || 0,
      yearOfBuild: '',
      fuelTypesSet: new Set(),
      yearData: {}
    });
  }
  const ship = allShips.get(id);
  if (!ship.yearData[year]) {
    ship.yearData[year] = {
      totalCO2: 0,
      distanceTravelled: 0,
      attainedCII: 0,
      requiredCII: 0,
      rating: ''
    };
  }
  return ship;
}

const yearsToProcess = [2019, 2020, 2022];

for (const yr of yearsToProcess) {
  const filePath = join(DATA_DIR, `${yr}.xlsx`);
  try {
    console.log(`Processing ${yr} data...`);
    const wb = XLSX.readFile(filePath);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    console.log(`  Parsed ${rows.length} rows`);

    let rowCount = 0;
    for (const row of rows) {
      rowCount++;
      const reportNum = getStr(row['Report number']);
      if (!reportNum) continue;

      const typeRaw = getStr(row['Ship Type']);
      const gt = getNum(row['Gross Tonnage']);
      const dwt = getNum(row['Deadweight Tonnage']);
      const fuelType = getStr(row['Fuel Oil Type']);
      const fuelQty = getNum(row['Fuel Quantity']);
      const cf = getNum(row['CF value']);
      const dist = getNum(row['Distance Travelled']);
      
      const ship = ensureShip(reportNum, yr, { shipType: typeRaw, grossTonnage: gt, dwt });
      
      // Update basic info if better data exists
      if (!ship.shipType || ship.shipType === 'Unknown') ship.shipType = typeRaw;
      if (dwt > ship.dwt) ship.dwt = dwt;
      if (gt > ship.grossTonnage) ship.grossTonnage = gt;

      if (fuelType) ship.fuelTypesSet.add(fuelType);

      const yd = ship.yearData[yr];
      
      // Calculate CO2 for this fuel row
      const co2 = fuelQty * cf;
      yd.totalCO2 += co2;
      
      // Assume distance might be duplicated across multiple fuel rows for the same year/ship.
      // Take the max distance reported.
      if (dist > yd.distanceTravelled) {
        yd.distanceTravelled = dist;
      }
    }
  } catch (e) {
    console.error(`  Error processing ${yr}:`, e.message);
  }
}

console.log('\nComputing CII ratings for global fleet...');
let computedCount = 0;
let invalidCount = 0;

for (const [id, ship] of allShips) {
  for (const yr of yearsToProcess) {
    const yd = ship.yearData[yr];
    if (!yd) continue;
    
    // IMO CII calculation
    if (yd.totalCO2 > 0 && yd.distanceTravelled > 0 && ship.dwt > 0) {
      // Attained CII = CO2 in grams / (DWT * Distance)
      // CO2 is in tonnes, so * 1,000,000 to get grams
      yd.attainedCII = (yd.totalCO2 * 1000000) / (ship.dwt * yd.distanceTravelled);
      
      const result = computeRating(yd.attainedCII, ship.dwt, ship.shipType, yr);
      yd.rating = result.rating;
      yd.requiredCII = result.requiredCII;
      computedCount++;
    } else {
      invalidCount++;
    }
  }
}

console.log(`Computed ratings for ${computedCount} ship-years. Skipped ${invalidCount} due to missing DWT/Dist/Fuel.`);

console.log('\nBuilding final aggregated dataset...');
const ships = [];
let withRatings = 0;

for (const [id, ship] of allShips) {
  const fuelCategories = [...ship.fuelTypesSet].map(classifyFuel);
  const uniqueFuels = [...new Set(fuelCategories)];
  const primaryFuel = uniqueFuels[0] || 'Unknown';

  const ratings = [];
  for (const yr of yearsToProcess) {
    const yd = ship.yearData[yr];
    if (yd && yd.rating) ratings.push({ year: yr, rating: yd.rating });
  }

  let trend = 'Insufficient Data';
  if (ratings.length >= 2) {
    const ratingToNum = { A: 1, B: 2, C: 3, D: 4, E: 5 };
    const nums = ratings.map(r => ratingToNum[r.rating] || 3);
    const first = nums[0];
    const last = nums[nums.length - 1];
    const allSame = nums.every(n => n === first);
    
    if (allSame) trend = 'Constant';
    else if (last < first) trend = 'Improving';
    else if (last > first) trend = 'Worsening';
    else trend = 'Fluctuating';
  } else if (ratings.length === 1) {
    trend = 'Single Year';
  }

  if (ratings.length > 0) withRatings++;

  const record = {
    imo: id, // Using report number
    name: ship.name,
    shipType: classifyShipType(ship.shipType),
    shipTypeRaw: ship.shipType,
    grossTonnage: ship.grossTonnage,
    dwt: ship.dwt,
    yearOfBuild: ship.yearOfBuild,
    primaryFuel,
    fuelTypes: uniqueFuels,
    trend,
    years: {}
  };

  for (const yr of yearsToProcess) {
    const yd = ship.yearData[yr];
    if (yd) {
      record.years[yr] = {
        totalCO2: Math.round(yd.totalCO2 * 100) / 100,
        distanceTravelled: Math.round(yd.distanceTravelled * 100) / 100,
        attainedCII: Math.round((yd.attainedCII || 0) * 1000) / 1000,
        requiredCII: Math.round((yd.requiredCII || 0) * 1000) / 1000,
        rating: yd.rating || ''
      };
    }
  }

  // Only keep ships that have at least some basic validity (DWT > 0)
  if (record.dwt > 0) {
    ships.push(record);
  }
}

console.log(`Total valid unique ships: ${ships.length}`);
console.log(`Ships with CII ratings: ${withRatings}`);

// Compute summary stats for ALL ships
const ratingDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };
const typeDist = {};
const fuelDist = {};
const trendDist = {};
const yearlyRatingDist = {};

for (const yr of yearsToProcess) {
  yearlyRatingDist[yr] = { A: 0, B: 0, C: 0, D: 0, E: 0 };
}

for (const ship of ships) {
  typeDist[ship.shipType] = (typeDist[ship.shipType] || 0) + 1;
  fuelDist[ship.primaryFuel] = (fuelDist[ship.primaryFuel] || 0) + 1;
  trendDist[ship.trend] = (trendDist[ship.trend] || 0) + 1;

  for (const yr of yearsToProcess) {
    if (ship.years[yr] && ship.years[yr].rating) {
      yearlyRatingDist[yr][ship.years[yr].rating]++;
    }
  }

  // Latest rating for overall distribution
  for (const yr of [2022, 2020, 2019]) { // Order of preference
    if (ship.years[yr] && ship.years[yr].rating) {
      ratingDist[ship.years[yr].rating]++;
      break;
    }
  }
}

// Sort ships by name (or ID)
ships.sort((a, b) => a.imo.localeCompare(b.imo));

const output = {
  metadata: {
    source: 'IMO Data Collection System (Global)',
    years: yearsToProcess,
    totalShips: ships.length,
    shipsWithRatings: withRatings,
    extractedAt: new Date().toISOString()
  },
  summary: {
    ratingDistribution: ratingDist,
    yearlyRatingDistribution: yearlyRatingDist,
    shipTypeDistribution: typeDist,
    fuelTypeDistribution: fuelDist,
    trendDistribution: trendDist
  },
  ships: ships
};

writeFileSync(join(OUT_DIR, 'global-fleet-data.json'), JSON.stringify(output, null, 2));
console.log(`\nWritten to ${join(OUT_DIR, 'global-fleet-data.json')} with ${ships.length} ships.`);
console.log('Global data processing complete!');
