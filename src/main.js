import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

// =============================================
// STATE
// =============================================
let malaysianData = null;
let globalData = null;
let fleetData = null;
let emissionFactors = null;
let mitigationStrategies = null;
let currentView = 'dashboard';
let filters = { shipType: 'all', fuelType: 'all', rating: 'all', search: '' };
let selectedShip = null;

// =============================================
// DATA LOADING
// =============================================
async function loadData() {
  const [myRes, glRes, emRes, mitRes] = await Promise.all([
    fetch('/data/fleet-data.json'),
    fetch('/data/global-fleet-data.json'),
    fetch('/data/emission-factors.json'),
    fetch('/data/mitigation-strategies.json')
  ]);
  malaysianData = await myRes.json();
  globalData = await glRes.json();
  fleetData = malaysianData;
  emissionFactors = await emRes.json();
  mitigationStrategies = await mitRes.json();
}

// =============================================
// ROUTING
// =============================================
function setupNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });

  const toggle = document.getElementById('fleetToggle');
  if (toggle) {
    toggle.addEventListener('change', (e) => {
      fleetData = e.target.checked ? globalData : malaysianData;
      selectedShip = null;
      filters = { shipType: 'all', fuelType: 'all', rating: 'all', search: '' };
      ['filterShipType', 'filterFuelType', 'filterRating'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 'all';
      });
      const search = document.getElementById('filterSearch');
      if (search) search.value = '';
      
      renderView();
    });
  }
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-view="${view}"]`).classList.add('active');
  renderView();
}

function renderView() {
  const main = document.getElementById('appMain');
  switch (currentView) {
    case 'dashboard': main.innerHTML = renderDashboard(); setupDashboard(); break;
    case 'simulator': main.innerHTML = renderSimulator(); setupSimulator(); break;
    case 'recommendations': main.innerHTML = renderRecommendations(); break;
  }
}

// =============================================
// HELPERS
// =============================================
function getFilteredShips() {
  return fleetData.ships.filter(s => {
    if (filters.shipType !== 'all' && s.shipType !== filters.shipType) return false;
    if (filters.fuelType !== 'all' && s.primaryFuel !== filters.fuelType) return false;
    if (filters.rating !== 'all') {
      const latestRating = getLatestRating(s);
      if (latestRating !== filters.rating) return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.imo.includes(q)) return false;
    }
    return true;
  });
}

function getLatestRating(ship) {
  for (const yr of [2022, 2021, 2020, 2019]) {
    if (ship.years[yr] && ship.years[yr].rating) return ship.years[yr].rating;
  }
  return '';
}

function getLatestCII(ship) {
  for (const yr of [2022, 2021, 2020, 2019]) {
    if (ship.years[yr] && ship.years[yr].attainedCII > 0) return ship.years[yr];
  }
  return null;
}

function ratingColor(rating) {
  const colors = { A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', E: '#ef4444' };
  return colors[rating] || '#64748b';
}

function formatNum(n, decimals = 1) {
  if (n === 0 || isNaN(n)) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(decimals) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(decimals) + 'K';
  return n.toFixed(decimals);
}

// =============================================
// DASHBOARD VIEW
// =============================================
function renderDashboard() {
  const ships = getFilteredShips();
  const shipsWithRatings = ships.filter(s => getLatestRating(s));
  const ratingCounts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  shipsWithRatings.forEach(s => {
    const r = getLatestRating(s);
    if (r) ratingCounts[r]++;
  });
  const deCount = ratingCounts.D + ratingCounts.E;
  const dePercent = shipsWithRatings.length > 0 ? ((deCount / shipsWithRatings.length) * 100).toFixed(0) : 0;
  const totalCO2 = ships.reduce((sum, s) => {
    const latest = getLatestCII(s);
    return sum + (latest ? latest.totalCO2 : 0);
  }, 0);

  const shipTypes = [...new Set(fleetData.ships.map(s => s.shipType))].sort();
  const fuelTypes = [...new Set(fleetData.ships.map(s => s.primaryFuel))].sort();

  return `
    <div class="view-container">
      <div class="view-header">
        <h2>Fleet CII Dashboard</h2>
        <p>Carbon Intensity Indicator compliance overview for ${fleetData.metadata.totalShips.toLocaleString()} ${fleetData.metadata.source.includes('Global') ? 'global ships in the IMO DCS database' : 'Malaysian-flagged ships'} (${fleetData.metadata.years.join(', ')})</p>
      </div>

      <div class="filters-bar" id="filtersBar">
        <div class="filter-group">
          <span class="filter-label">Ship Type</span>
          <select class="filter-select" id="filterShipType">
            <option value="all">All Types</option>
            ${shipTypes.map(t => `<option value="${t}" ${filters.shipType === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">Fuel Type</span>
          <select class="filter-select" id="filterFuelType">
            <option value="all">All Fuels</option>
            ${fuelTypes.map(f => `<option value="${f}" ${filters.fuelType === f ? 'selected' : ''}>${f}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">CII Rating</span>
          <select class="filter-select" id="filterRating">
            <option value="all">All Ratings</option>
            ${['A','B','C','D','E'].map(r => `<option value="${r}" ${filters.rating === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group search-box">
          <span class="filter-label">Search</span>
          <span class="search-icon">🔍</span>
          <input type="text" class="filter-input" id="filterSearch" placeholder="Ship name or IMO..." value="${filters.search}">
        </div>
      </div>

      <div class="stats-grid">
        <div class="card stat-card">
          <div class="stat-icon">🚢</div>
          <div class="card-title">Total Ships</div>
          <div class="card-value">${ships.length}</div>
          <div class="card-subtitle">${shipsWithRatings.length} with CII ratings</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon">⚠️</div>
          <div class="card-title">D or E Rated</div>
          <div class="card-value" style="color: var(--rating-e)">${deCount}</div>
          <div class="card-subtitle">${dePercent}% of rated vessels</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon">🏆</div>
          <div class="card-title">A or B Rated</div>
          <div class="card-value" style="color: var(--rating-a)">${ratingCounts.A + ratingCounts.B}</div>
          <div class="card-subtitle">Superior performance</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon">💨</div>
          <div class="card-title">Total CO₂</div>
          <div class="card-value">${formatNum(totalCO2)}</div>
          <div class="card-subtitle">Metric tonnes</div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="card chart-card">
          <div class="card-header">
            <span class="card-title">CII Rating Distribution</span>
          </div>
          <div class="chart-container"><canvas id="chartRatingDist"></canvas></div>
        </div>
        <div class="card chart-card">
          <div class="card-header">
            <span class="card-title">Emissions by Ship Type</span>
          </div>
          <div class="chart-container"><canvas id="chartShipType"></canvas></div>
        </div>
        <div class="card chart-card">
          <div class="card-header">
            <span class="card-title">CII Rating by Fuel Type</span>
          </div>
          <div class="chart-container"><canvas id="chartFuelType"></canvas></div>
        </div>
        <div class="card chart-card">
          <div class="card-header">
            <span class="card-title">DWT vs Attained CII</span>
          </div>
          <div class="chart-container"><canvas id="chartDwtCii"></canvas></div>
        </div>
      </div>

      <div class="card" style="margin-bottom: var(--space-xl)">
        <div class="card-header">
          <span class="card-title">Fleet Vessels (${shipsWithRatings.length} with ratings)</span>
        </div>
        <div class="data-table-wrapper">
          <table class="data-table" id="shipTable">
            <thead>
              <tr>
                <th>Ship Name</th>
                <th>IMO</th>
                <th>Type</th>
                <th>DWT</th>
                <th>Fuel</th>
                <th>CII Rating</th>
                <th>Attained CII</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              ${shipsWithRatings.slice(0, 50).map(s => {
                const rating = getLatestRating(s);
                const latest = getLatestCII(s);
                return `
                <tr data-imo="${s.imo}" class="ship-row">
                  <td><strong>${s.name || 'N/A'}</strong></td>
                  <td style="font-family: var(--font-mono); font-size: 0.8rem;">${s.imo}</td>
                  <td>${s.shipType}</td>
                  <td style="font-family: var(--font-mono);">${s.dwt > 0 ? formatNum(s.dwt, 0) : 'N/A'}</td>
                  <td>${s.primaryFuel}</td>
                  <td><span class="rating-badge rating-badge-sm rating-${rating}">${rating}</span></td>
                  <td style="font-family: var(--font-mono);">${latest ? latest.attainedCII.toFixed(2) : 'N/A'}</td>
                  <td>${s.trend}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function setupDashboard() {
  // Filters
  ['filterShipType', 'filterFuelType', 'filterRating'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      const key = id.replace('filter', '').replace('ShipType', 'shipType').replace('FuelType', 'fuelType').replace('Rating', 'rating');
      filters[key] = e.target.value;
      renderView();
    });
  });
  document.getElementById('filterSearch')?.addEventListener('input', (e) => {
    filters.search = e.target.value;
    renderView();
  });

  // Ship row click -> go to simulator
  document.querySelectorAll('.ship-row').forEach(row => {
    row.addEventListener('click', () => {
      const imo = row.dataset.imo;
      selectedShip = fleetData.ships.find(s => s.imo === imo);
      switchView('simulator');
    });
  });

  // Charts
  renderRatingChart();
  renderShipTypeChart();
  renderFuelTypeChart();
  renderDwtCiiChart();
}

function renderRatingChart() {
  const ships = getFilteredShips().filter(s => getLatestRating(s));
  const counts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  ships.forEach(s => { const r = getLatestRating(s); if (r) counts[r]++; });

  new Chart(document.getElementById('chartRatingDist'), {
    type: 'doughnut',
    data: {
      labels: ['A (Superior)', 'B (Minor Superior)', 'C (Moderate)', 'D (Minor Inferior)', 'E (Inferior)'],
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'],
        borderColor: '#111827',
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12, font: { size: 11 } } }
      },
      cutout: '55%'
    }
  });
}

function renderShipTypeChart() {
  const ships = getFilteredShips();
  const typeEmissions = {};
  ships.forEach(s => {
    const latest = getLatestCII(s);
    if (latest) {
      typeEmissions[s.shipType] = (typeEmissions[s.shipType] || 0) + latest.totalCO2;
    }
  });

  const sorted = Object.entries(typeEmissions).sort((a, b) => b[1] - a[1]);

  new Chart(document.getElementById('chartShipType'), {
    type: 'bar',
    data: {
      labels: sorted.map(([k]) => k),
      datasets: [{
        label: 'CO₂ Emissions (tonnes)',
        data: sorted.map(([, v]) => v),
        backgroundColor: 'rgba(0, 153, 255, 0.6)',
        borderColor: 'rgba(0, 153, 255, 1)',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

function renderFuelTypeChart() {
  const ships = getFilteredShips().filter(s => getLatestRating(s));
  const fuelRatings = {};
  ships.forEach(s => {
    const rating = getLatestRating(s);
    if (!fuelRatings[s.primaryFuel]) fuelRatings[s.primaryFuel] = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    fuelRatings[s.primaryFuel][rating]++;
  });

  const fuels = Object.keys(fuelRatings);
  const datasets = ['A', 'B', 'C', 'D', 'E'].map(r => ({
    label: r,
    data: fuels.map(f => fuelRatings[f][r]),
    backgroundColor: ratingColor(r) + '99',
    borderColor: ratingColor(r),
    borderWidth: 1,
    borderRadius: 3
  }));

  new Chart(document.getElementById('chartFuelType'), {
    type: 'bar',
    data: { labels: fuels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12, font: { size: 10 } } } },
      scales: {
        x: { stacked: true, ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
        y: { stacked: true, ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function renderDwtCiiChart() {
  const ships = getFilteredShips();
  const points = [];
  ships.forEach(s => {
    const latest = getLatestCII(s);
    if (latest && s.dwt > 0 && latest.attainedCII > 0) {
      points.push({
        x: s.dwt,
        y: latest.attainedCII,
        rating: getLatestRating(s)
      });
    }
  });

  new Chart(document.getElementById('chartDwtCii'), {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Ships',
        data: points.map(p => ({ x: p.x, y: p.y })),
        backgroundColor: points.map(p => ratingColor(p.rating) + '99'),
        borderColor: points.map(p => ratingColor(p.rating)),
        borderWidth: 1,
        pointRadius: 5,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: 'DWT (tonnes)', color: '#94a3b8', font: { size: 11 } }, ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { title: { display: true, text: 'Attained CII', color: '#94a3b8', font: { size: 11 } }, ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

// =============================================
// SIMULATOR VIEW
// =============================================
function renderSimulator() {
  const shipsWithRatings = fleetData.ships.filter(s => getLatestRating(s));
  const scenarios = emissionFactors.biofuelScenarios;

  return `
    <div class="view-container">
      <div class="view-header">
        <h2>What-If Fuel Scenario Simulator</h2>
        <p>Simulate the impact of switching to biofuel blends or dual-fuel operation on a vessel's CII rating, using combustion-level emission factors from published research.</p>
      </div>

      <div class="simulator-grid">
        <div class="card sim-panel">
          <div class="sim-panel-title">⚙️ Scenario Configuration</div>
          
          <div class="sim-field">
            <label>Select Vessel</label>
            <select id="simShipSelect">
              <option value="">Choose a vessel...</option>
              ${shipsWithRatings.map(s => `<option value="${s.imo}" ${selectedShip && selectedShip.imo === s.imo ? 'selected' : ''}>${s.name} (${s.imo}) - ${s.shipType}</option>`).join('')}
            </select>
          </div>

          <div id="simShipInfo" style="margin-bottom: var(--space-md);"></div>

          <div class="sim-field">
            <label>Fuel Switching Scenario</label>
            <select id="simScenario">
              ${Object.entries(scenarios).map(([key, sc]) => `<option value="${key}">${sc.name} (${sc.co2ReductionPercent}% CO₂ reduction)</option>`).join('')}
            </select>
          </div>

          <button class="sim-btn" id="simRunBtn">▶ Run Simulation</button>
        </div>

        <div class="card sim-panel" id="simResultPanel">
          <div class="sim-panel-title">📊 Simulation Results</div>
          <div style="color: var(--text-tertiary); text-align: center; padding: var(--space-2xl);">
            <p style="font-size: 2rem; margin-bottom: var(--space-md);">⚗️</p>
            <p>Select a vessel and run the simulation to see projected CII improvements.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function setupSimulator() {
  const shipSelect = document.getElementById('simShipSelect');
  const runBtn = document.getElementById('simRunBtn');

  shipSelect.addEventListener('change', () => {
    const imo = shipSelect.value;
    selectedShip = fleetData.ships.find(s => s.imo === imo);
    const infoDiv = document.getElementById('simShipInfo');
    if (selectedShip) {
      const latest = getLatestCII(selectedShip);
      const rating = getLatestRating(selectedShip);
      infoDiv.innerHTML = `
        <div class="sim-result" style="margin-top: var(--space-sm);">
          <div class="sim-detail-row"><span class="label">Ship Type</span><span class="value">${selectedShip.shipType}</span></div>
          <div class="sim-detail-row"><span class="label">DWT</span><span class="value">${selectedShip.dwt.toLocaleString()} t</span></div>
          <div class="sim-detail-row"><span class="label">Primary Fuel</span><span class="value">${selectedShip.primaryFuel}</span></div>
          <div class="sim-detail-row"><span class="label">Current CII</span><span class="value">${latest ? latest.attainedCII.toFixed(3) : 'N/A'}</span></div>
          <div class="sim-detail-row"><span class="label">Current Rating</span><span class="value"><span class="rating-badge rating-badge-sm rating-${rating}">${rating}</span></span></div>
        </div>
      `;
    } else {
      infoDiv.innerHTML = '';
    }
  });

  // Trigger if pre-selected
  if (selectedShip) {
    shipSelect.dispatchEvent(new Event('change'));
  }

  runBtn.addEventListener('click', runSimulation);
}

function runSimulation() {
  if (!selectedShip) return;

  const scenarioKey = document.getElementById('simScenario').value;
  const scenario = emissionFactors.biofuelScenarios[scenarioKey];
  const latest = getLatestCII(selectedShip);
  if (!latest || latest.attainedCII <= 0) return;

  const currentCII = latest.attainedCII;
  const reductionFactor = scenario.co2ReductionPercent / 100;
  const projectedCII = currentCII * (1 - reductionFactor);

  const currentRating = getLatestRating(selectedShip);

  // Compute projected rating
  const ciiRefParams = {
    'Bulk Carrier': { a: 4745, c: -0.622 },
    'Tanker': { a: 5247, c: -0.610 },
    'Container Ship': { a: 1984, c: -0.489 },
    'General Cargo': { a: 588, c: -0.3885 },
    'LNG Carrier': { a: 14405, c: -0.645 },
    'Chemical Tanker': { a: 5247, c: -0.610 },
    'Default': { a: 5247, c: -0.610 }
  };

  const dVectors = {
    'Bulk Carrier': { d1: 0.86, d2: 0.94, d3: 1.06, d4: 1.18 },
    'Tanker': { d1: 0.82, d2: 0.93, d3: 1.08, d4: 1.28 },
    'Container Ship': { d1: 0.83, d2: 0.94, d3: 1.07, d4: 1.19 },
    'General Cargo': { d1: 0.83, d2: 0.94, d3: 1.06, d4: 1.19 },
    'LNG Carrier': { d1: 0.89, d2: 0.98, d3: 1.06, d4: 1.13 },
    'Chemical Tanker': { d1: 0.82, d2: 0.93, d3: 1.08, d4: 1.28 },
    'Default': { d1: 0.83, d2: 0.94, d3: 1.06, d4: 1.18 }
  };

  const params = ciiRefParams[selectedShip.shipType] || ciiRefParams['Default'];
  const dv = dVectors[selectedShip.shipType] || dVectors['Default'];
  const ciiRef = params.a * Math.pow(selectedShip.dwt, params.c);
  const ratio = projectedCII / ciiRef;

  let projectedRating;
  if (ratio <= dv.d1) projectedRating = 'A';
  else if (ratio <= dv.d2) projectedRating = 'B';
  else if (ratio <= dv.d3) projectedRating = 'C';
  else if (ratio <= dv.d4) projectedRating = 'D';
  else projectedRating = 'E';

  const improved = ['A', 'B', 'C', 'D', 'E'].indexOf(projectedRating) < ['A', 'B', 'C', 'D', 'E'].indexOf(currentRating);
  const co2Reduction = latest.totalCO2 * reductionFactor;

  const resultPanel = document.getElementById('simResultPanel');
  resultPanel.innerHTML = `
    <div class="sim-panel-title">📊 Simulation Results</div>
    
    <div class="sim-comparison">
      <div class="sim-rating-box">
        <div class="label">Current</div>
        <span class="rating-badge rating-${currentRating}" style="width:56px;height:56px;font-size:1.5rem;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">${currentRating}</span>
      </div>
      <div class="sim-arrow">${improved ? '→ ✅' : '→'}</div>
      <div class="sim-rating-box">
        <div class="label">Projected</div>
        <span class="rating-badge rating-${projectedRating}" style="width:56px;height:56px;font-size:1.5rem;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">${projectedRating}</span>
      </div>
    </div>

    <div class="sim-result">
      <div class="sim-detail-row">
        <span class="label">Scenario</span>
        <span class="value">${scenario.name}</span>
      </div>
      <div class="sim-detail-row">
        <span class="label">CO₂ Reduction</span>
        <span class="value improved">${scenario.co2ReductionPercent}%</span>
      </div>
      <div class="sim-detail-row">
        <span class="label">Current CII</span>
        <span class="value">${currentCII.toFixed(3)}</span>
      </div>
      <div class="sim-detail-row">
        <span class="label">Projected CII</span>
        <span class="value improved">${projectedCII.toFixed(3)}</span>
      </div>
      <div class="sim-detail-row">
        <span class="label">CII Improvement</span>
        <span class="value improved">${(currentCII - projectedCII).toFixed(3)} (${scenario.co2ReductionPercent}%)</span>
      </div>
      <div class="sim-detail-row">
        <span class="label">CO₂ Saved</span>
        <span class="value improved">${formatNum(co2Reduction)} tonnes</span>
      </div>
      ${scenario.noxReductionPercent ? `
      <div class="sim-detail-row">
        <span class="label">NOx Reduction</span>
        <span class="value improved">${scenario.noxReductionPercent}%</span>
      </div>` : ''}
      <div class="sim-detail-row">
        <span class="label">Source</span>
        <span class="value" style="font-family: var(--font-sans); font-size: 0.75rem;">${scenario.source}</span>
      </div>
      ${scenario.validatedByOwnResearch ? `
      <div class="rec-validated">
        ✅ Validated by combustion-level research (own study)
      </div>` : ''}
    </div>
  `;
}

// =============================================
// RECOMMENDATIONS VIEW
// =============================================
function renderRecommendations() {
  const categoryClass = (cat) => {
    if (cat === 'Operational') return 'operational';
    if (cat === 'Technical') return 'technical';
    return 'fuel';
  };

  return `
    <div class="view-container">
      <div class="view-header">
        <h2>Mitigation Recommendations</h2>
        <p>Literature-based strategies for improving CII ratings. These measures are sourced from published research, not from the present study. Strategies validated by own combustion-level research are highlighted.</p>
      </div>

      <div class="rec-grid">
        ${mitigationStrategies.map(s => `
          <div class="card rec-card">
            <span class="rec-category ${categoryClass(s.category)}">${s.category}</span>
            <h3>${s.measure}</h3>
            <p>${s.description}</p>
            
            <div style="margin-bottom: var(--space-sm);">
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">
                <span>CII Improvement</span>
                <span style="color: var(--accent-primary); font-weight: 600;">${s.ciiImprovementMin}% to ${s.ciiImprovementMax}%</span>
              </div>
              <div class="improvement-bar">
                <div class="improvement-bar-fill" style="width: ${(s.ciiImprovementMax / 25) * 100}%"></div>
              </div>
            </div>

            <div class="rec-meta">
              <span class="rec-tag"><span class="tag-icon">⏱</span> ${s.timeline}</span>
              <span class="rec-tag"><span class="tag-icon">💰</span> ${s.cost}</span>
            </div>

            ${s.validatedByOwnResearch ? `
            <div class="rec-validated">
              ✅ Validated by own combustion-level research
            </div>` : ''}

            <details class="rec-sources">
              <summary>📚 Sources</summary>
              <ul>
                ${s.sources.map(src => `<li>${src}</li>`).join('')}
              </ul>
            </details>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// =============================================
// INIT
// =============================================
async function init() {
  setupNav();
  try {
    await loadData();
    renderView();
  } catch (err) {
    document.getElementById('appMain').innerHTML = `
      <div class="loading-screen">
        <p style="color: var(--rating-e);">Error loading data: ${err.message}</p>
        <p style="color: var(--text-tertiary);">Make sure fleet-data.json exists in /public/data/</p>
      </div>
    `;
  }
}

init();
