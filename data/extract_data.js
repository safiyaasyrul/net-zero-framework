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

// =============================================
// Helpers
// =============================================
function readAllSheets(filePath) {
  const wb = XLSX.readFile(filePath);
  const result = {};
  for (const name of wb.SheetNames) {
    result[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
  }
  return result;
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

function getNum(val) {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function getStr(val) {
  return String(val || '').trim();
}

// =============================================
// Master ship map
// =============================================
const allShips = new Map();

function ensureShip(imo, defaults = {}) {
  if (!allShips.has(imo)) {
    allShips.set(imo, {
      imo,
      name: '',
      shipType: '',
      grossTonnage: 0,
      dwt: 0,
      yearOfBuild: '',
      fuelTypesSet: new Set(),
      yearData: {},
      ...defaults
    });
  }
  return allShips.get(imo);
}

// =============================================
// 1. Ship Types file (has full detail + summaries with CII ratings)
// =============================================
console.log('=== Ship Types 2019 (detailed + summary) ===');
try {
  const sheets = readAllSheets(join(JLM_DIR, '2019_by_type_of_ship_rev1.xlsx'));
  
  for (const [sheetName, rows] of Object.entries(sheets)) {
    if (rows.length === 0) continue;
    const isSummary = sheetName.toLowerCase().includes('summary');
    const typeFromSheet = sheetName.replace(/\s*[Ss]ummary\s*/, '').trim();
    
    console.log(`  Sheet "${sheetName}": ${rows.length} rows (${isSummary ? 'SUMMARY' : 'detail'})`);
    
    for (const row of rows) {
      const imo = getStr(row['IMO Number']);
      if (!imo || isNaN(Number(imo))) continue;
      
      const ship = ensureShip(imo);
      
      // Name
      if (row['Ship Name'] || row['Ship name']) ship.name = getStr(row['Ship Name'] || row['Ship name']);
      
      // Ship type from sheet context
      const rawType = getStr(row['Ship type']);
      if (rawType) ship.shipType = rawType;
      else if (typeFromSheet) ship.shipType = typeFromSheet;
      
      // Tonnage
      if (row['Gross tonnage']) ship.grossTonnage = getNum(row['Gross tonnage']);
      if (row['Deadweight tonnage']) ship.dwt = getNum(row['Deadweight tonnage']);
      if (row['Year of Build']) ship.yearOfBuild = getStr(row['Year of Build']);
      
      // Fuel
      const fuelType = getStr(row['Fuel oil type']);
      if (fuelType) ship.fuelTypesSet.add(fuelType);
      
      // CII data (summary sheets have the computed values)
      if (isSummary) {
        const attCII = getNum(row['Attained CII']);
        const reqCII = getNum(row['Required CII (2023)']);
        const rating = getStr(row['Rating (2023)']);
        const totalCO2 = getNum(row['Total Mass of CO2 Emissions (Metric Tonnes) (M)']);
        const cfVal = getNum(row['Cf value']);
        
        if (attCII > 0 || rating) {
          ship.yearData[2019] = {
            ...(ship.yearData[2019] || {}),
            attainedCII: attCII || (ship.yearData[2019] || {}).attainedCII || 0,
            requiredCII: reqCII || (ship.yearData[2019] || {}).requiredCII || 0,
            rating: rating || (ship.yearData[2019] || {}).rating || '',
            totalCO2: totalCO2 || (ship.yearData[2019] || {}).totalCO2 || 0,
            cfValue: cfVal || (ship.yearData[2019] || {}).cfValue || 0
          };
        }
      } else {
        // Detail sheets: accumulate fuel quantities and CO2
        const fuelQty = getNum(row['Quantity (Metric Tonnes)']);
        const co2 = getNum(row['Mass of CO2 Emissions (Metric Tonnes)']);
        const dist = getNum(row['Distance travelled (NM)']);
        
        if (!ship.yearData[2019]) {
          ship.yearData[2019] = { totalCO2: 0, distanceTravelled: 0, attainedCII: 0, requiredCII: 0, rating: '' };
        }
        if (co2 > 0) ship.yearData[2019].totalCO2 += co2;
        if (dist > 0) ship.yearData[2019].distanceTravelled = dist;
      }
    }
  }
} catch (e) {
  console.error('Error:', e.message);
}

// =============================================
// 2. Malaysian Flag data (per year, for additional ships)
// =============================================
console.log('\n=== Malaysian Flag Ship Data ===');
for (const year of [2019, 2020, 2021, 2022]) {
  try {
    const wb = XLSX.readFile(join(DATA_DIR, `Msia Flag ${year}.xlsx`));
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    console.log(`  ${year}: ${rows.length} rows, Sheets: ${wb.SheetNames.join(', ')}`);

    for (const row of rows) {
      const imo = getStr(row['IMO Number'] || row['IMO number']);
      if (!imo || isNaN(Number(imo))) continue;

      const ship = ensureShip(imo);
      
      if (!ship.name && (row['Ship Name'] || row['Ship name'])) ship.name = getStr(row['Ship Name'] || row['Ship name']);
      if (!ship.shipType && row['Ship type']) ship.shipType = getStr(row['Ship type']);
      if (!ship.grossTonnage && row['Gross tonnage']) ship.grossTonnage = getNum(row['Gross tonnage']);
      if (!ship.dwt && row['Deadweight tonnage']) ship.dwt = getNum(row['Deadweight tonnage']);

      const fuelType = getStr(row['Fuel oil type'] || row['Fuel Oil Type']);
      if (fuelType) ship.fuelTypesSet.add(fuelType);
      
      const dist = getNum(row['Distance travelled (NM)'] || row['Distance Travelled']);
      const co2 = getNum(row['Mass of CO2 Emissions (Metric Tonnes)']);
      const totalCO2Field = getNum(row['Total Mass of CO2 Emissions (Metric Tonnes) (M)']);
      const attCII = getNum(row['Attained CII'] || row['Attained annual operational CII']);
      const reqCII = getNum(row['Required CII (2023)'] || row['Required CII']);
      const rating = getStr(row['Rating (2023)'] || row['Rating'] || row['CII Rating']);

      if (!ship.yearData[year]) {
        ship.yearData[year] = { totalCO2: 0, distanceTravelled: 0, attainedCII: 0, requiredCII: 0, rating: '' };
      }

      const yd = ship.yearData[year];
      if (co2 > 0) yd.totalCO2 += co2;
      if (totalCO2Field > 0 && totalCO2Field > yd.totalCO2) yd.totalCO2 = totalCO2Field;
      if (dist > 0) yd.distanceTravelled = dist;
      if (attCII > 0) yd.attainedCII = attCII;
      if (reqCII > 0) yd.requiredCII = reqCII;
      if (rating) yd.rating = rating;
    }
  } catch (e) {
    console.error(`  Error ${year}:`, e.message);
  }
}

// =============================================
// 3. CII Calculation workbook
// =============================================
console.log('\n=== CII Calculation ===');
try {
  const sheets = readAllSheets(join(JLM_DIR, 'Calculation CII.xlsx'));
  for (const [sheetName, rows] of Object.entries(sheets)) {
    if (rows.length === 0) continue;
    console.log(`  Sheet "${sheetName}": ${rows.length} rows`);
    for (const row of rows) {
      const imo = getStr(row['IMO Number'] || row['IMO number']);
      if (!imo || isNaN(Number(imo))) continue;

      const ship = ensureShip(imo);
      if (row['Ship Name']) ship.name = getStr(row['Ship Name']);
      if (row['Deadweight tonnage']) ship.dwt = getNum(row['Deadweight tonnage']);

      const attCII = getNum(row['Attained CII']);
      const reqCII = getNum(row['Required CII (2023)'] || row['Required CII']);
      const rating = getStr(row['Rating (2023)'] || row['Rating']);
      const totalCO2 = getNum(row['Total Mass of CO2 Emissions (Metric Tonnes) (M)']);

      // Assign to the year if sheet name hints at it, else use 2019 as default
      let targetYear = 2019;
      for (const yr of [2019, 2020, 2021, 2022]) {
        if (sheetName.includes(String(yr))) { targetYear = yr; break; }
      }

      if (attCII > 0 || rating) {
        if (!ship.yearData[targetYear]) {
          ship.yearData[targetYear] = { totalCO2: 0, distanceTravelled: 0, attainedCII: 0, requiredCII: 0, rating: '' };
        }
        const yd = ship.yearData[targetYear];
        if (attCII > 0) yd.attainedCII = attCII;
        if (reqCII > 0) yd.requiredCII = reqCII;
        if (rating) yd.rating = rating;
        if (totalCO2 > 0) yd.totalCO2 = totalCO2;
      }
    }
  }
} catch (e) {
  console.error('Error:', e.message);
}

// =============================================
// 4. Compute CII ratings where missing
//    Using IMO CII calculation: CII = CO2 / (DWT * Distance)
//    Rating boundaries per IMO MEPC.354(78)
// =============================================
console.log('\n=== Computing CII where data available ===');

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

// Rating boundary d-vectors (simplified, for 2019-2022 using 2023 boundaries)
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

// Reduction factors (Z%) per year
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

let computed = 0;
for (const [imo, ship] of allShips) {
  if (ship.dwt <= 0) continue;
  
  for (const yr of [2019, 2020, 2021, 2022]) {
    const yd = ship.yearData[yr];
    if (!yd) continue;
    
    // If we have CO2 and distance but no attainedCII, compute it
    if (!yd.attainedCII && yd.totalCO2 > 0 && yd.distanceTravelled > 0 && ship.dwt > 0) {
      yd.attainedCII = yd.totalCO2 / (ship.dwt * yd.distanceTravelled) * 1000000;
    }
    
    // If we have attainedCII but no rating, compute it
    if (yd.attainedCII > 0 && !yd.rating) {
      const result = computeRating(yd.attainedCII, ship.dwt, ship.shipType, yr);
      yd.rating = result.rating;
      yd.requiredCII = result.requiredCII;
      computed++;
    }
  }
}
console.log(`Computed ${computed} additional CII ratings`);

// =============================================
// 5. Build final output
// =============================================
console.log('\n=== Building final dataset ===');

const ships = [];
let withRatings = 0;

for (const [imo, ship] of allShips) {
  const fuelCategories = [...ship.fuelTypesSet].map(classifyFuel);
  const uniqueFuels = [...new Set(fuelCategories)];
  const primaryFuel = uniqueFuels[0] || 'Unknown';

  const ratings = [];
  for (const yr of [2019, 2020, 2021, 2022]) {
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
    imo,
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

  for (const yr of [2019, 2020, 2021, 2022]) {
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

  ships.push(record);
}

ships.sort((a, b) => a.name.localeCompare(b.name));

console.log(`Total ships: ${ships.length}`);
console.log(`Ships with CII ratings: ${withRatings}`);

// Compute summary stats
const ratingDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };
const typeDist = {};
const fuelDist = {};
const trendDist = {};
const yearlyRatingDist = {};

for (const yr of [2019, 2020, 2021, 2022]) {
  yearlyRatingDist[yr] = { A: 0, B: 0, C: 0, D: 0, E: 0 };
}

for (const ship of ships) {
  typeDist[ship.shipType] = (typeDist[ship.shipType] || 0) + 1;
  fuelDist[ship.primaryFuel] = (fuelDist[ship.primaryFuel] || 0) + 1;
  trendDist[ship.trend] = (trendDist[ship.trend] || 0) + 1;

  for (const yr of [2019, 2020, 2021, 2022]) {
    if (ship.years[yr] && ship.years[yr].rating) {
      yearlyRatingDist[yr][ship.years[yr].rating]++;
    }
  }

  // Latest rating for overall distribution
  for (const yr of [2022, 2021, 2020, 2019]) {
    if (ship.years[yr] && ship.years[yr].rating) {
      ratingDist[ship.years[yr].rating]++;
      break;
    }
  }
}

console.log('\nLatest Rating Distribution:', ratingDist);
console.log('Yearly Ratings:', yearlyRatingDist);
console.log('Ship Types:', typeDist);
console.log('Fuel Types:', fuelDist);
console.log('Trends:', trendDist);

const output = {
  metadata: {
    source: 'Jabatan Laut Malaysia (JLM)',
    years: [2019, 2020, 2021, 2022],
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
  ships
};

writeFileSync(join(OUT_DIR, 'fleet-data.json'), JSON.stringify(output, null, 2));
console.log(`\nWritten to ${join(OUT_DIR, 'fleet-data.json')}`);
console.log('Done!');
