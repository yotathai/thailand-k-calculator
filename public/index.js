// App State
let masterData = null;
let commodities = [];
let availablePeriods = [];
let selectedCommodities = ['S', 'C', 'F']; // Default selected
let monthlyDataCache = {}; // Cache of { "year-month": [data] }
let activeChart = null;
let chartType = 'index'; // 'index' or 'change'
let calculatorMode = 'single'; // 'single' or 'multi'
let installmentRows = []; // Array of installment row objects

// Predefined K Formulas
const K_FORMULAS = {
  K1: {
    name: "งานอาคาร (K1)",
    constant: 0.25,
    coefs: { I: 0.15, C: 0.10, M: 0.40, S: 0.10 }
  },
  K21: {
    name: "งานดิน (K2.1)",
    constant: 0.30,
    coefs: { I: 0.10, E: 0.40, F: 0.20 }
  },
  K22: {
    name: "งานหินเรียง (K2.2)",
    constant: 0.40,
    coefs: { I: 0.20, M: 0.20, F: 0.20 }
  },
  K23: {
    name: "งานเจาะระเบิดหิน (K2.3)",
    constant: 0.45,
    coefs: { I: 0.15, M: 0.10, E: 0.20, F: 0.10 }
  },
  K31: {
    name: "งานผิวทาง PC, TC, SC (K3.1)",
    constant: 0.30,
    coefs: { A: 0.40, E: 0.20, F: 0.10 }
  },
  K33: {
    name: "งานผิวทาง AC, PM (K3.3)",
    constant: 0.30,
    coefs: { M: 0.10, A: 0.40, E: 0.10, F: 0.10 }
  },
  K34: {
    name: "งานถนน คสล. (K3.4)",
    constant: 0.30,
    coefs: { I: 0.10, C: 0.35, M: 0.10, S: 0.15 }
  },
  K41: {
    name: "งานสะพาน คสล. (K4.1)",
    constant: 0.30,
    coefs: { I: 0.10, C: 0.15, M: 0.20, S: 0.25 }
  },
  K43: {
    name: "งานโครงสร้างเหล็ก (K4.3)",
    constant: 0.25,
    coefs: { I: 0.10, C: 0.05, M: 0.20, S: 0.40 }
  }
};

// Thai Month Names
const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const TH_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

// Document Elements
document.addEventListener("DOMContentLoaded", () => {
  initApp();
  setupEventListeners();
});

// App Initialization
async function initApp() {
  try {
    showLoader('chart-loader', true);
    
    // 1. Fetch Master Data
    const response = await fetch('/api/master-data');
    if (!response.ok) throw new Error("Failed to fetch master data");
    masterData = await response.json();
    
    const kConfig = masterData[0];
    commodities = kConfig.commodities;
    availablePeriods = kConfig.dataAvailablePeriods[0];
    
    // Update Data Available Range Badge
    const startText = `${TH_MONTHS[availablePeriods.startPeriod - 1]} ${availablePeriods.startYear}`;
    const endText = `${TH_MONTHS[availablePeriods.endPeriod - 1]} ${availablePeriods.endYear}`;
    document.getElementById('data-range-badge').innerText = `มีข้อมูล: ${startText} - ${endText}`;
    
    // 2. Populate Date Selectors
    populateYearSelects(availablePeriods.startYear, availablePeriods.endYear);
    
    // Set Default Range (Last 12 Months)
    setDefaultDateRange();
    
    // 3. Render Multiselect Checkboxes
    renderCommodityDropdown();
    updateCommodityTags();
    
    // 4. Load Initial Data
    await handleFetchData();
    
  } catch (error) {
    console.error("Initialization error:", error);
    alert("เกิดข้อผิดพลาดในการโหลดข้อมูลเริ่มต้น กรุณาลองใหม่อีกครั้ง");
  } finally {
    showLoader('chart-loader', false);
  }
}

// Helpers for Select Dropdowns
function populateYearSelects(startYear, endYear) {
  const selectIds = [
    'start-year', 'end-year', 'calc-base-year', 'calc-submit-year',
    'w190-sign-year', 'w190-ref-year', 'late-expiry-year', 'multi-base-year'
  ];
  
  selectIds.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '';
    for (let y = startYear; y <= endYear; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.innerText = y;
      select.appendChild(opt);
    }
  });
}

function setDefaultDateRange() {
  const startMonthSelect = document.getElementById('start-month');
  const startYearSelect = document.getElementById('start-year');
  const endMonthSelect = document.getElementById('end-month');
  const endYearSelect = document.getElementById('end-year');
  
  // Set end month and year to latest available period
  endMonthSelect.innerHTML = '';
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.innerText = TH_MONTHS[m - 1];
    endMonthSelect.appendChild(opt);
  }
  
  endMonthSelect.value = availablePeriods.endPeriod;
  endYearSelect.value = availablePeriods.endYear;
  
  // Set start month and year to 11 months prior (total 12 months)
  let startMonth = availablePeriods.endPeriod - 11;
  let startYear = availablePeriods.endYear;
  
  if (startMonth <= 0) {
    startMonth += 12;
    startYear -= 1;
  }
  
  // Ensure we don't go below available start period
  if (startYear < availablePeriods.startYear || (startYear === availablePeriods.startYear && startMonth < availablePeriods.startPeriod)) {
    startMonth = availablePeriods.startPeriod;
    startYear = availablePeriods.startYear;
  }
  
  startMonthSelect.value = startMonth;
  startYearSelect.value = startYear;
  
  // Also default Calculator dates
  document.getElementById('calc-base-month').value = availablePeriods.startPeriod;
  document.getElementById('calc-base-year').value = availablePeriods.startYear;
  document.getElementById('calc-submit-month').value = availablePeriods.endPeriod;
  document.getElementById('calc-submit-year').value = availablePeriods.endYear;

  // Default multi-installment fields
  if (document.getElementById('w190-sign-month')) {
    document.getElementById('w190-sign-month').value = availablePeriods.endPeriod;
    document.getElementById('w190-sign-year').value = availablePeriods.endYear;
    document.getElementById('w190-ref-month').value = availablePeriods.endPeriod;
    document.getElementById('w190-ref-year').value = availablePeriods.endYear;
    document.getElementById('late-expiry-month').value = availablePeriods.endPeriod;
    document.getElementById('late-expiry-year').value = availablePeriods.endYear;
    document.getElementById('multi-base-month').value = availablePeriods.startPeriod;
    document.getElementById('multi-base-year').value = availablePeriods.startYear;
  }
}

// Multiselect Dropdown Utilities
function renderCommodityDropdown() {
  const dropdown = document.getElementById('multiselect-dropdown');
  dropdown.innerHTML = '';
  
  commodities.forEach(c => {
    const label = document.createElement('label');
    const checked = selectedCommodities.includes(c.code) ? 'checked' : '';
    
    label.innerHTML = `
      <input type="checkbox" value="${c.code}" ${checked}>
      <span>[${c.code}] ${c.name}</span>
    `;
    dropdown.appendChild(label);
  });
}

function updateCommodityTags() {
  const tagsContainer = document.getElementById('selected-commodities-tags');
  tagsContainer.innerHTML = '';
  
  selectedCommodities.forEach(code => {
    const comm = commodities.find(c => c.code === code);
    if (!comm) return;
    
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `
      [${comm.code}] ${comm.name.replace('ดัชนีราคา', '').trim()}
      <i class="fa-solid fa-xmark" data-code="${comm.code}"></i>
    `;
    tagsContainer.appendChild(tag);
  });
  
  // Update select box text
  const selectBoxBtn = document.getElementById('multiselect-btn').querySelector('span');
  if (selectedCommodities.length === 0) {
    selectBoxBtn.innerText = 'เลือกรายการดัชนี';
  } else {
    selectBoxBtn.innerText = `เลือกแล้ว ${selectedCommodities.length} รายการ`;
  }
}

// Event Listeners Configuration
function setupEventListeners() {
  // Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    document.body.classList.toggle('light-theme');
    
    const icon = themeToggle.querySelector('i');
    if (document.body.classList.contains('light-theme')) {
      icon.className = 'fa-solid fa-moon';
    } else {
      icon.className = 'fa-solid fa-sun';
    }
    
    // Update chart text colors
    if (activeChart) {
      updateChartColors();
    }
  });
  
  // Tab Switching
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const targetPanel = btn.getAttribute('data-tab');
      const panels = document.querySelectorAll('.tab-panel');
      panels.forEach(p => p.classList.remove('active'));
      document.getElementById(targetPanel).classList.add('active');
      
      // Re-render chart on tab reveal to prevent canvas sizing bugs
      if (targetPanel === 'tab-dashboard' && activeChart) {
        activeChart.resize();
      }
    });
  });
  
  // Dropdown Multiselect Open/Close
  const multiselectBtn = document.getElementById('multiselect-btn');
  const multiselectDropdown = document.getElementById('multiselect-dropdown');
  
  multiselectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    multiselectDropdown.classList.toggle('hidden');
  });
  
  document.addEventListener('click', (e) => {
    if (!multiselectDropdown.contains(e.target) && e.target !== multiselectBtn) {
      multiselectDropdown.classList.add('hidden');
    }
  });
  
  // Checkbox Changes
  multiselectDropdown.addEventListener('change', (e) => {
    if (e.target.tagName === 'INPUT') {
      const code = e.target.value;
      if (e.target.checked) {
        if (!selectedCommodities.includes(code)) {
          selectedCommodities.push(code);
        }
      } else {
        selectedCommodities = selectedCommodities.filter(c => c !== code);
      }
      updateCommodityTags();
    }
  });
  
  // Tag Remove Event (Delegated)
  document.getElementById('selected-commodities-tags').addEventListener('click', (e) => {
    if (e.target.classList.contains('fa-xmark')) {
      const code = e.target.getAttribute('data-code');
      selectedCommodities = selectedCommodities.filter(c => c !== code);
      
      // Uncheck inside dropdown
      const checkbox = multiselectDropdown.querySelector(`input[value="${code}"]`);
      if (checkbox) checkbox.checked = false;
      
      updateCommodityTags();
    }
  });
  
  // Fetch Data Button
  document.getElementById('fetch-data-btn').addEventListener('click', handleFetchData);
  
  // Chart Type Toggle
  const chartTypeBtns = document.querySelectorAll('.chart-type-btn');
  chartTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      chartTypeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      chartType = btn.getAttribute('data-type');
      renderChart();
    });
  });
  
  // K Preset Selection Change
  const kPresetSelect = document.getElementById('k-formula-preset');
  const customFormulaEditor = document.getElementById('custom-formula-editor');
  
  kPresetSelect.addEventListener('change', () => {
    if (kPresetSelect.value === 'custom') {
      customFormulaEditor.classList.remove('hidden');
      updateCustomFormulaSum();
    } else {
      customFormulaEditor.classList.add('hidden');
    }
  });
  
  // Custom Formula inputs listener
  const coefInputs = customFormulaEditor.querySelectorAll('input[type="number"]');
  coefInputs.forEach(input => {
    input.addEventListener('input', updateCustomFormulaSum);
  });
  
  // Calculate K Button
  document.getElementById('calculate-k-btn').addEventListener('click', handleCalculateK);
  
  // Print Report Button
  document.getElementById('print-report-btn').addEventListener('click', () => {
    window.print();
  });

  // Print Multi-installment Report Button
  const printMultiBtn = document.getElementById('print-multi-report-btn');
  if (printMultiBtn) {
    printMultiBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // Calculator Sub-Tabs (Single vs Multi Mode)
  const subTabButtons = document.querySelectorAll('.sub-tab-btn');
  subTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      subTabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const targetMode = btn.getAttribute('data-sub-tab');
      if (targetMode === 'single-mode') {
        calculatorMode = 'single';
        document.getElementById('single-mode-inputs').classList.remove('hidden');
        document.getElementById('multi-mode-inputs').classList.add('hidden');
        
        // Hide report views
        document.getElementById('empty-report-view').classList.remove('hidden');
        document.getElementById('report-content-view').classList.add('hidden');
        document.getElementById('multi-report-content-view').classList.add('hidden');
      } else {
        calculatorMode = 'multi';
        document.getElementById('single-mode-inputs').classList.add('hidden');
        document.getElementById('multi-mode-inputs').classList.remove('hidden');
        
        // Hide report views
        document.getElementById('empty-report-view').classList.remove('hidden');
        document.getElementById('report-content-view').classList.add('hidden');
        document.getElementById('multi-report-content-view').classList.add('hidden');
        
        // Add default row if empty
        const tbody = document.getElementById('installment-rows-tbody');
        if (tbody.children.length === 0) {
          addInstallmentRow();
        }
      }
    });
  });

  // Toggle ว190 options display
  const w190Checkbox = document.getElementById('enable-w190');
  if (w190Checkbox) {
    w190Checkbox.addEventListener('change', () => {
      const details = document.getElementById('w190-details');
      if (w190Checkbox.checked) {
        details.classList.remove('hidden');
      } else {
        details.classList.add('hidden');
      }
    });
  }

  // Toggle Late options display
  const lateCheckbox = document.getElementById('enable-late');
  if (lateCheckbox) {
    lateCheckbox.addEventListener('change', () => {
      const details = document.getElementById('late-details');
      if (lateCheckbox.checked) {
        details.classList.remove('hidden');
      } else {
        details.classList.add('hidden');
      }
    });
  }

  // Add Installment Row Button
  const addInstBtn = document.getElementById('add-installment-row-btn');
  if (addInstBtn) {
    addInstBtn.addEventListener('click', () => {
      addInstallmentRow();
    });
  }

  // Calculate Multi-K Button
  const calculateMultiBtn = document.getElementById('calculate-multi-k-btn');
  if (calculateMultiBtn) {
    calculateMultiBtn.addEventListener('click', handleCalculateMultiK);
  }
  
  // Table Search and Sorting
  document.getElementById('table-search').addEventListener('input', handleTableSearch);
  
  const headers = document.querySelectorAll('#data-table-element th.sortable');
  headers.forEach(h => {
    h.addEventListener('click', () => {
      const field = h.getAttribute('data-sort');
      handleTableSort(field, h);
    });
  });
  
  // Export CSV Button
  document.getElementById('export-csv-btn').addEventListener('click', handleExportCSV);
}

// Custom Formula Coef Sum
function updateCustomFormulaSum() {
  const customFormulaEditor = document.getElementById('custom-formula-editor');
  const inputs = customFormulaEditor.querySelectorAll('input[type="number"]');
  let sum = 0;
  
  inputs.forEach(input => {
    if (input.id !== 'coef-const') {
      sum += parseFloat(input.value) || 0;
    }
  });
  
  const constantVal = parseFloat(document.getElementById('coef-const').value) || 0;
  const totalSum = sum + constantVal;
  
  const sumInfo = document.getElementById('coef-sum-info');
  const sumValEl = document.getElementById('coef-sum-val');
  
  sumValEl.innerText = totalSum.toFixed(2);
  
  if (Math.abs(totalSum - 1.0) > 0.001) {
    sumInfo.className = 'coef-sum-status invalid';
    sumInfo.innerHTML = `ผลรวมสัมประสิทธิ์: <span id="coef-sum-val">${totalSum.toFixed(2)}</span> (ผลรวมควรเท่ากับ 1.00)`;
  } else {
    sumInfo.className = 'coef-sum-status';
    sumInfo.innerHTML = `ผลรวมสัมประสิทธิ์: <span id="coef-sum-val">${totalSum.toFixed(2)}</span> (ถูกต้อง)`;
  }
}

// Helper to show/hide loader
function showLoader(elementId, show) {
  const el = document.getElementById(elementId);
  if (show) {
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

// Core Data Fetching Function
async function handleFetchData() {
  const startMonth = parseInt(document.getElementById('start-month').value);
  const startYear = parseInt(document.getElementById('start-year').value);
  const endMonth = parseInt(document.getElementById('end-month').value);
  const endYear = parseInt(document.getElementById('end-year').value);
  
  // Validate Range
  if (startYear > endYear || (startYear === endYear && startMonth > endMonth)) {
    alert("วันเริ่มต้นต้องไม่มากกว่าวันสิ้นสุด");
    return;
  }
  
  try {
    showLoader('chart-loader', true);
    
    // Generate all year-month pairs in selected range
    const monthsToFetch = [];
    let curYear = startYear;
    let curMonth = startMonth;
    
    while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
      monthsToFetch.push({ year: curYear, month: curMonth });
      curMonth++;
      if (curMonth > 12) {
        curMonth = 1;
        curYear++;
      }
    }
    
    // Fetch in parallel for uncached months
    const fetchPromises = monthsToFetch.map(async ({ year, month }) => {
      const cacheKey = `${year}-${month}`;
      if (monthlyDataCache[cacheKey]) return; // Skip if in cache
      
      const res = await fetch('/api/month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yearBase: 2530,
          year: year,
          month: month,
          type: "K",
          commodities: [] // Fetch all to easily cache them
        })
      });
      
      if (!res.ok) throw new Error(`Failed to fetch data for ${month}/${year}`);
      const data = await res.json();
      monthlyDataCache[cacheKey] = data;
    });
    
    await Promise.all(fetchPromises);
    
    // Render Dashboard widgets
    renderMetrics();
    renderChart();
    renderTable();
    
  } catch (error) {
    console.error("Data fetching error:", error);
    alert("เกิดข้อผิดพลาดในการเชื่อมต่อดึงข้อมูลดัชนี");
  } finally {
    showLoader('chart-loader', false);
  }
}

// Metrics Cards Generator
function renderMetrics() {
  const container = document.getElementById('metrics-container');
  container.innerHTML = '';
  
  if (selectedCommodities.length === 0) {
    container.innerHTML = `
      <div class="metric-card glass empty-state">
        <p>ไม่มีดัชนีที่เลือก กรุณาเลือกวัสดุอย่างน้อย 1 รายการเพื่อแสดงผลสรุปข้อมูล</p>
      </div>
    `;
    return;
  }
  
  // Find latest available month that has cache
  const sortedCacheKeys = Object.keys(monthlyDataCache).sort((a, b) => {
    const [ay, am] = a.split('-').map(Number);
    const [by, bm] = b.split('-').map(Number);
    return ay !== by ? ay - by : am - bm;
  });
  
  if (sortedCacheKeys.length === 0) return;
  
  const latestKey = sortedCacheKeys[sortedCacheKeys.length - 1];
  const previousKey = sortedCacheKeys.length > 1 ? sortedCacheKeys[sortedCacheKeys.length - 2] : null;
  
  const [latestYear, latestMonth] = latestKey.split('-').map(Number);
  const latestData = monthlyDataCache[latestKey];
  const previousData = previousKey ? monthlyDataCache[previousKey] : null;
  
  selectedCommodities.forEach(code => {
    const commInfo = commodities.find(c => c.code === code);
    if (!commInfo) return;
    
    const latestItem = latestData.find(d => d.commodityCode === code);
    if (!latestItem) return;
    
    const prevItem = previousData ? previousData.find(d => d.commodityCode === code) : null;
    
    const val = latestItem.index;
    let changeVal = 0;
    let changeClass = 'change-neutral';
    let changeText = '0.0%';
    let changeIcon = '';
    
    if (prevItem && prevItem.index > 0) {
      changeVal = ((val - prevItem.index) / prevItem.index) * 100;
      if (changeVal > 0.05) {
        changeClass = 'change-up';
        changeText = `+${changeVal.toFixed(1)}%`;
        changeIcon = '<i class="fa-solid fa-arrow-trend-up"></i>';
      } else if (changeVal < -0.05) {
        changeClass = 'change-down';
        changeText = `${changeVal.toFixed(1)}%`;
        changeIcon = '<i class="fa-solid fa-arrow-trend-down"></i>';
      }
    }
    
    // Calculate Peak value in selected range
    let peakVal = val;
    sortedCacheKeys.forEach(k => {
      const item = monthlyDataCache[k].find(d => d.commodityCode === code);
      if (item && item.index > peakVal) peakVal = item.index;
    });
    
    const card = document.createElement('div');
    card.className = 'metric-card glass';
    card.innerHTML = `
      <div class="metric-header">
        <div class="metric-title">${commInfo.name}</div>
        <div class="metric-code">${code}</div>
      </div>
      <div class="metric-value-row">
        <div class="metric-value">${val.toFixed(1)}</div>
        <div class="metric-change ${changeClass}">
          ${changeIcon} ${changeText}
        </div>
      </div>
      <div class="metric-meta">
        <span>ล่าสุด: ${TH_MONTHS_SHORT[latestMonth - 1]} ${latestYear}</span>
        <span>สูงสุดช่วงเลือก: ${peakVal.toFixed(1)}</span>
      </div>
    `;
    
    container.appendChild(card);
  });
}

// Chart.js Visualization Builder
function renderChart() {
  const ctx = document.getElementById('trendsChart').getContext('2d');
  
  if (activeChart) {
    activeChart.destroy();
  }
  
  // Sort date cache keys in range
  const startMonth = parseInt(document.getElementById('start-month').value);
  const startYear = parseInt(document.getElementById('start-year').value);
  const endMonth = parseInt(document.getElementById('end-month').value);
  const endYear = parseInt(document.getElementById('end-year').value);
  
  const sortedRangeKeys = Object.keys(monthlyDataCache).filter(key => {
    const [y, m] = key.split('-').map(Number);
    return (y > startYear || (y === startYear && m >= startMonth)) &&
           (y < endYear || (y === endYear && m <= endMonth));
  }).sort((a, b) => {
    const [ay, am] = a.split('-').map(Number);
    const [by, bm] = b.split('-').map(Number);
    return ay !== by ? ay - by : am - bm;
  });
  
  if (sortedRangeKeys.length === 0) return;
  
  // X-Axis Labels (Thai Month Short + Year)
  const labels = sortedRangeKeys.map(key => {
    const [y, m] = key.split('-').map(Number);
    return `${TH_MONTHS_SHORT[m - 1]} ${y.toString().slice(-2)}`;
  });
  
  // Dynamic Datasets creation
  const colors = [
    '#6366f1', '#0ea5e9', '#10b981', '#f43f5e', '#f59e0b',
    '#a855f7', '#ec4899', '#14b8a6', '#84cc16', '#eab308'
  ];
  
  const datasets = selectedCommodities.map((code, idx) => {
    const comm = commodities.find(c => c.code === code);
    const name = comm ? comm.name.replace('ดัชนีราคา', '').trim() : code;
    
    const dataPoints = sortedRangeKeys.map((key, keyIdx) => {
      const list = monthlyDataCache[key];
      const item = list.find(d => d.commodityCode === code);
      if (!item) return null;
      
      if (chartType === 'index') {
        return item.index;
      } else {
        // MoM Change
        if (keyIdx === 0) return 0;
        const prevKey = sortedRangeKeys[keyIdx - 1];
        const prevItem = monthlyDataCache[prevKey].find(d => d.commodityCode === code);
        if (!prevItem || prevItem.index === 0) return 0;
        return ((item.index - prevItem.index) / prevItem.index) * 100;
      }
    });
    
    return {
      label: `[${code}] ${name}`,
      data: dataPoints,
      borderColor: colors[idx % colors.length],
      backgroundColor: colors[idx % colors.length] + '15',
      borderWidth: 2.5,
      pointRadius: 3.5,
      pointHoverRadius: 6,
      tension: 0.2,
      fill: false
    };
  });
  
  const isDark = !document.body.classList.contains('light-theme');
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  
  activeChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: 'Prompt', size: 12 },
            color: isDark ? '#f1f5f9' : '#1e293b'
          }
        },
        tooltip: {
          titleFont: { family: 'Prompt', size: 13 },
          bodyFont: { family: 'Outfit', size: 12 },
          padding: 12,
          boxPadding: 6,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          titleColor: isDark ? '#f1f5f9' : '#1e293b',
          bodyColor: isDark ? '#e2e8f0' : '#475569',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: {
            font: { family: 'Prompt', size: 11 },
            color: textColor
          }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            font: { family: 'Outfit', size: 11 },
            color: textColor
          },
          title: {
            display: true,
            text: chartType === 'index' ? 'ดัชนีราคา (ฐาน 2530)' : 'อัตราการเปลี่ยนแปลง MoM (%)',
            font: { family: 'Prompt', size: 12 },
            color: textColor
          }
        }
      }
    }
  });
}

function updateChartColors() {
  if (!activeChart) return;
  const isDark = !document.body.classList.contains('light-theme');
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  
  activeChart.options.plugins.legend.labels.color = isDark ? '#f1f5f9' : '#1e293b';
  activeChart.options.scales.x.grid.color = gridColor;
  activeChart.options.scales.x.ticks.color = textColor;
  activeChart.options.scales.y.grid.color = gridColor;
  activeChart.options.scales.y.ticks.color = textColor;
  activeChart.options.scales.y.title.color = textColor;
  
  activeChart.update();
}

// K Calculator Handler
async function handleCalculateK() {
  const presetKey = document.getElementById('k-formula-preset').value;
  const baseMonth = parseInt(document.getElementById('calc-base-month').value);
  const baseYear = parseInt(document.getElementById('calc-base-year').value);
  const submitMonth = parseInt(document.getElementById('calc-submit-month').value);
  const submitYear = parseInt(document.getElementById('calc-submit-year').value);
  
  // Define custom formula or preset
  let formulaName = "";
  let constant = 0;
  let coefs = {};
  
  if (presetKey === 'custom') {
    formulaName = "สูตรกำหนดเอง (Custom)";
    constant = parseFloat(document.getElementById('coef-const').value) || 0;
    
    // Extract non-zero coefficients
    const inputs = document.getElementById('custom-formula-editor').querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
      if (input.id !== 'coef-const') {
        const code = input.id.replace('coef-', '');
        const val = parseFloat(input.value) || 0;
        if (val > 0) coefs[code] = val;
      }
    });
    
    // Verify coefficient sum
    let totalSum = constant;
    Object.values(coefs).forEach(v => totalSum += v);
    if (Math.abs(totalSum - 1.0) > 0.05) {
      if (!confirm(`คำเตือน: ผลรวมสัมประสิทธิ์ปัจจุบันคือ ${totalSum.toFixed(2)} (ควรเป็น 1.00) ต้องการคำนวณต่อหรือไม่?`)) {
        return;
      }
    }
  } else {
    const preset = K_FORMULAS[presetKey];
    formulaName = preset.name;
    constant = preset.constant;
    coefs = preset.coefs;
  }
  
  try {
    showLoader('report-loader', true);
    
    // Get unique commodity codes needed for calculation
    const neededCodes = Object.keys(coefs);
    
    // Fetch base and submit months if not cached
    const baseKey = `${baseYear}-${baseMonth}`;
    const submitKey = `${submitYear}-${submitMonth}`;
    
    const monthsToFetch = [];
    if (!monthlyDataCache[baseKey]) monthsToFetch.push({ year: baseYear, month: baseMonth });
    if (!monthlyDataCache[submitKey]) monthsToFetch.push({ year: submitYear, month: submitMonth });
    
    const fetchPromises = monthsToFetch.map(async ({ year, month }) => {
      const res = await fetch('/api/month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yearBase: 2530,
          year: year,
          month: month,
          type: "K",
          commodities: []
        })
      });
      if (!res.ok) throw new Error(`Failed to fetch month data for K calculation: ${month}/${year}`);
      const data = await res.json();
      monthlyDataCache[`${year}-${month}`] = data;
    });
    
    await Promise.all(fetchPromises);
    
    // Retrieve base & submit values
    const baseData = monthlyDataCache[baseKey];
    const submitData = monthlyDataCache[submitKey];
    
    // Construct lookup values
    const indexPairs = {};
    let missingInfo = false;
    
    neededCodes.forEach(code => {
      const bItem = baseData.find(d => d.commodityCode === code);
      const sItem = submitData.find(d => d.commodityCode === code);
      const comm = commodities.find(c => c.code === code);
      
      if (!bItem || !sItem) {
        missingInfo = true;
        return;
      }
      
      indexPairs[code] = {
        name: comm ? comm.name : code,
        baseVal: bItem.index,
        submitVal: sItem.index,
        ratio: Math.floor((sItem.index / bItem.index) * 1000 + 1e-9) / 1000
      };
    });
    
    if (missingInfo) {
      alert("ไม่พบค่าดัชนีบางรายการสำหรับช่วงเวลาที่เลือก กรุณาตรวจสอบประวัติขอบเขตข้อมูล");
      return;
    }
    
    // Perform K calculation following official CUCEM-K rule:
    // Truncate each term (coefficient * ratio) to 3 decimal places before summing
    let kValue = constant;
    Object.keys(coefs).forEach(code => {
      const term = Math.floor((coefs[code] * indexPairs[code].ratio) * 1000 + 1e-9) / 1000;
      kValue += term;
    });
    kValue = Math.round(kValue * 1000) / 1000; // Float precision clean-up
    
    // Render calculation report details
    document.getElementById('empty-report-view').classList.add('hidden');
    document.getElementById('report-content-view').classList.remove('hidden');
    document.getElementById('multi-report-content-view').classList.add('hidden');
    
    // Render formula string
    let formulaStr = `K = ${constant.toFixed(2)}`;
    Object.keys(coefs).forEach(code => {
      formulaStr += ` + ${coefs[code].toFixed(2)}(${code}<sub>t</sub>/${code}<sub>o</sub>)`;
    });
    document.getElementById('rep-formula-text').innerHTML = formulaStr;
    
    // Render table rows
    const tbody = document.getElementById('rep-indices-tbody');
    tbody.innerHTML = '';
    
    Object.keys(indexPairs).forEach(code => {
      const p = indexPairs[code];
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${code}</strong></td>
        <td>${p.name}</td>
        <td class="text-right">${p.baseVal.toFixed(1)}</td>
        <td class="text-right">${p.submitVal.toFixed(1)}</td>
        <td class="text-right">${p.ratio.toFixed(3)}</td>
      `;
      tbody.appendChild(row);
    });
    
    // Render math steps
    const stepsDiv = document.getElementById('rep-math-steps');
    stepsDiv.innerHTML = '';
    
    let step1 = `K = ${constant.toFixed(2)}`;
    let step2 = `K = ${constant.toFixed(2)}`;
    
    Object.keys(coefs).forEach(code => {
      const p = indexPairs[code];
      step1 += ` + ${coefs[code].toFixed(2)}(${p.submitVal.toFixed(1)} / ${p.baseVal.toFixed(1)})`;
      step2 += ` + ${coefs[code].toFixed(2)}(${p.ratio.toFixed(3)})`;
    });
    
    let step3 = `K = ${constant.toFixed(2)}`;
    Object.keys(coefs).forEach(code => {
      const p = indexPairs[code];
      const termVal = Math.floor((coefs[code] * p.ratio) * 1000 + 1e-9) / 1000;
      step3 += ` + ${termVal.toFixed(3)}`;
    });
    
    stepsDiv.innerHTML = `
      <div>ขั้นตอนที่ 1 (แทนค่าดัชนี):</div>
      <div>&nbsp;&nbsp;${step1}</div>
      <div style="margin-top:4px;">ขั้นตอนที่ 2 (คำนวณอัตราส่วน - ตัดเศษเหลือ 3 ตำแหน่ง):</div>
      <div>&nbsp;&nbsp;${step2}</div>
      <div style="margin-top:4px;">ขั้นตอนที่ 3 (คำนวณสัมประสิทธิ์คูณอัตราส่วน - ตัดเศษเหลือ 3 ตำแหน่ง):</div>
      <div>&nbsp;&nbsp;${step3}</div>
      <div style="margin-top:4px; font-weight:bold; color:#fff;">ขั้นตอนที่ 4 (สรุปผลรวม):</div>
      <div>&nbsp;&nbsp;K = ${kValue.toFixed(4)}</div>
    `;
    
    // Set K result and threshold logic based on single-use-w190
    const singleW190 = document.getElementById('single-use-w190').checked;
    const threshold = singleW190 ? 0.02 : 0.04;
    const lowerLimit = 1.0 - threshold;
    const upperLimit = 1.0 + threshold;
    
    const repKValueEl = document.getElementById('rep-k-value');
    repKValueEl.innerText = kValue.toFixed(4);
    
    const alertCard = document.getElementById('rep-alert-card');
    const statusTitle = document.getElementById('rep-status-title');
    const statusDesc = document.getElementById('rep-status-desc');
    
    // Threshold analysis
    if (kValue > upperLimit) {
      alertCard.className = 'k-result-alert increase-required';
      statusTitle.innerText = 'สถานะ: ปรับเพิ่มเงินค่างาน (เพิ่มเงินให้ผู้รับจ้าง)';
      const refundPercent = ((kValue - upperLimit) * 100).toFixed(2);
      statusDesc.innerHTML = `ดัชนีปรับสูงขึ้นเกิน ${threshold * 100}% เกณฑ์กำหนด ปรับราคาขึ้นค่างานชดเชยที่อัตรา <strong>${refundPercent}%</strong> ของงวดงานนี้ (คิดจาก K - ${upperLimit.toFixed(3)})`;
    } else if (kValue < lowerLimit) {
      alertCard.className = 'k-result-alert refund-required';
      statusTitle.innerText = 'สถานะ: ปรับลดเงินค่างาน (หักเงินคืนราชการ)';
      const refundPercent = ((lowerLimit - kValue) * 100).toFixed(2);
      statusDesc.innerHTML = `ดัชนีปรับลดลงต่ำกว่า ${threshold * 100}% เกณฑ์กำหนด หักลดค่างานคืนแก่ส่วนราชการที่อัตรา <strong>${refundPercent}%</strong> ของงวดงานนี้ (คิดจาก ${lowerLimit.toFixed(3)} - K)`;
    } else {
      alertCard.className = 'k-result-alert no-adjustment';
      statusTitle.innerText = 'สถานะ: ค่างานคงเดิม (ไม่มีการชดเชยราคา)';
      statusDesc.innerText = `เนื่องจากดัชนีราคารวม (ค่า K) เปลี่ยนแปลงไม่เกินขีดจำกัด ${threshold * 100}% (อยู่ระหว่าง ${lowerLimit.toFixed(3)} ถึง ${upperLimit.toFixed(3)})`;
    }
    
  } catch (error) {
    console.error("Calculator error:", error);
    alert("เกิดข้อผิดพลาดในการคำนวณค่า K");
  } finally {
    showLoader('report-loader', false);
  }
}

// Raw Data Table rendering and features
let tableData = [];
let filteredData = [];
let sortField = 'commodityCode';
let sortAsc = true;
let tablePage = 1;
const rowsPerPage = 10;

function renderTable() {
  tableData = [];
  
  // Transform cache map into plain array of row objects
  Object.keys(monthlyDataCache).forEach(key => {
    const [y, m] = key.split('-').map(Number);
    const list = monthlyDataCache[key];
    
    list.forEach(item => {
      const comm = commodities.find(c => c.code === item.commodityCode);
      tableData.push({
        commodityCode: item.commodityCode,
        commodityNameTH: comm ? comm.name : 'ไม่ระบุ',
        year: y,
        month: m,
        index: item.index
      });
    });
  });
  
  handleTableSearch();
}

function handleTableSearch() {
  const query = document.getElementById('table-search').value.toLowerCase().trim();
  
  if (!query) {
    filteredData = [...tableData];
  } else {
    filteredData = tableData.filter(d => {
      return d.commodityCode.toLowerCase().includes(query) ||
             d.commodityNameTH.toLowerCase().includes(query) ||
             d.year.toString().includes(query) ||
             TH_MONTHS[d.month - 1].toLowerCase().includes(query);
    });
  }
  
  // Apply sorting
  sortData();
  
  // Reset to first page on search
  tablePage = 1;
  updateTableUI();
}

function sortData() {
  filteredData.sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    
    if (typeof valA === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else {
      // Numbers/Dates
      return sortAsc ? valA - valB : valB - valA;
    }
  });
}

function handleTableSort(field, element) {
  if (sortField === field) {
    sortAsc = !sortAsc;
  } else {
    sortField = field;
    sortAsc = true;
  }
  
  // Update UI icons
  const headers = document.querySelectorAll('#data-table-element th.sortable');
  headers.forEach(h => {
    const icon = h.querySelector('i');
    if (h === element) {
      icon.className = sortAsc ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
    } else {
      icon.className = 'fa-solid fa-sort';
    }
  });
  
  sortData();
  updateTableUI();
}

function updateTableUI() {
  const tbody = document.getElementById('table-tbody');
  tbody.innerHTML = '';
  
  if (filteredData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">ไม่พบผลการค้นหาข้อมูล</td>
      </tr>
    `;
    updatePaginationUI(0, 0, 0);
    return;
  }
  
  const startIndex = (tablePage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, filteredData.length);
  
  const pageRows = filteredData.slice(startIndex, endIndex);
  
  pageRows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${r.commodityCode}</strong></td>
      <td>${r.commodityNameTH}</td>
      <td>${r.year}</td>
      <td>${TH_MONTHS[r.month - 1]}</td>
      <td>${r.index.toFixed(1)}</td>
    `;
    tbody.appendChild(tr);
  });
  
  updatePaginationUI(startIndex + 1, endIndex, filteredData.length);
}

function updatePaginationUI(start, end, total) {
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  const pageNumEl = document.getElementById('page-num');
  const paginationText = document.getElementById('pagination-text');
  
  paginationText.innerText = `แสดง ${start} ถึง ${end} จากทั้งหมด ${total} แถว`;
  pageNumEl.innerText = tablePage;
  
  prevBtn.disabled = tablePage === 1 || total === 0;
  nextBtn.disabled = end >= total || total === 0;
}

// Pagination Event Listeners
document.getElementById('prev-page').addEventListener('click', () => {
  if (tablePage > 1) {
    tablePage--;
    updateTableUI();
  }
});

document.getElementById('next-page').addEventListener('click', () => {
  const maxPage = Math.ceil(filteredData.length / rowsPerPage);
  if (tablePage < maxPage) {
    tablePage++;
    updateTableUI();
  }
});

// CSV Export Utility
function handleExportCSV() {
  if (filteredData.length === 0) {
    alert("ไม่มีข้อมูลที่จะส่งออก");
    return;
  }
  
  let csvContent = "data:text/csv;charset=utf-8,";
  // CSV Header (with BOM for Excel Thai language support)
  csvContent += "\uFEFF"; // UTF-8 BOM
  csvContent += "รหัสดัชนี,รายการดัชนี,ปี พ.ศ.,เดือน,ค่าดัชนีราคา\r\n";
  
  filteredData.forEach(r => {
    const rowStr = `"${r.commodityCode}","${r.commodityNameTH}",${r.year},"${TH_MONTHS[r.month - 1]}",${r.index.toFixed(1)}\r\n`;
    csvContent += rowStr;
  });
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `thailand_k_factor_data_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- Dynamic Installment Row Management ---
let installmentCount = 0;

function addInstallmentRow() {
  installmentCount++;
  const tbody = document.getElementById('installment-rows-tbody');
  if (!tbody) return;
  
  // Generate month select options
  let monthOptions = '';
  TH_MONTHS.forEach((mName, idx) => {
    monthOptions += `<option value="${idx + 1}">${mName}</option>`;
  });
  
  // Generate year select options
  let yearOptions = '';
  if (availablePeriods) {
    for (let y = availablePeriods.startYear; y <= availablePeriods.endYear; y++) {
      yearOptions += `<option value="${y}">${y}</option>`;
    }
  }
  
  const tr = document.createElement('tr');
  tr.id = `installment-row-${installmentCount}`;
  tr.innerHTML = `
    <td class="text-center font-weight-bold row-index-label" style="vertical-align: middle;">${tbody.children.length + 1}</td>
    <td>
      <div class="selectors-row" style="margin: 0; gap: 5px;">
        <select class="inst-month" style="padding: 4px; font-size: 13px;">
          ${monthOptions}
        </select>
        <select class="inst-year" style="padding: 4px; font-size: 13px;">
          ${yearOptions}
        </select>
      </div>
    </td>
    <td>
      <input type="number" class="inst-gross" value="0" min="0" step="1000" style="padding: 4px 8px; font-size: 13px; text-align: right; width: 100%;">
    </td>
    <td>
      <input type="number" class="inst-deduct" value="0" min="0" step="1000" style="padding: 4px 8px; font-size: 13px; text-align: right; width: 100%;">
    </td>
    <td class="text-center">
      <button type="button" class="icon-btn delete-inst-btn" style="color: #f43f5e; padding: 4px;" onclick="deleteInstallmentRow(${installmentCount})">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </td>
  `;
  
  tbody.appendChild(tr);
  
  if (availablePeriods) {
    tr.querySelector('.inst-month').value = availablePeriods.endPeriod;
    tr.querySelector('.inst-year').value = availablePeriods.endYear;
  }
}

function deleteInstallmentRow(id) {
  const row = document.getElementById(`installment-row-${id}`);
  if (row) {
    row.remove();
    reindexInstallmentRows();
  }
}

function reindexInstallmentRows() {
  const tbody = document.getElementById('installment-rows-tbody');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((row, idx) => {
    row.querySelector('.row-index-label').innerText = idx + 1;
  });
}

// --- Multi-Installment Calculator ---
async function handleCalculateMultiK() {
  const presetKey = document.getElementById('k-formula-preset').value;
  const projectName = document.getElementById('project-name').value || "-";
  const contractNo = document.getElementById('contract-no').value || "-";
  const contractorName = document.getElementById('contractor-name').value || "-";
  const contractVal = parseFloat(document.getElementById('contract-val').value) || 0;
  
  const isW190 = document.getElementById('enable-w190').checked;
  const w190SignMonth = parseInt(document.getElementById('w190-sign-month').value);
  const w190SignYear = parseInt(document.getElementById('w190-sign-year').value);
  const w190RefMonth = parseInt(document.getElementById('w190-ref-month').value);
  const w190RefYear = parseInt(document.getElementById('w190-ref-year').value);
  
  const isLate = document.getElementById('enable-late').checked;
  const lateExpiryMonth = parseInt(document.getElementById('late-expiry-month').value);
  const lateExpiryYear = parseInt(document.getElementById('late-expiry-year').value);
  
  const defaultBaseMonth = parseInt(document.getElementById('multi-base-month').value);
  const defaultBaseYear = parseInt(document.getElementById('multi-base-year').value);
  
  // 1. Determine formula constant & coefs
  let formulaName = "";
  let constant = 0;
  let coefs = {};
  
  if (presetKey === 'custom') {
    formulaName = "สูตรกำหนดเอง (Custom)";
    constant = parseFloat(document.getElementById('coef-const').value) || 0;
    
    const inputs = document.getElementById('custom-formula-editor').querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
      if (input.id !== 'coef-const') {
        const code = input.id.replace('coef-', '');
        const val = parseFloat(input.value) || 0;
        if (val > 0) coefs[code] = val;
      }
    });
    
    let totalSum = constant;
    Object.values(coefs).forEach(v => totalSum += v);
    if (Math.abs(totalSum - 1.0) > 0.05) {
      if (!confirm(`คำเตือน: ผลรวมสัมประสิทธิ์สูตรกำหนดเองปัจจุบันคือ ${totalSum.toFixed(2)} (ควรเป็น 1.00) ต้องการคำนวณต่อหรือไม่?`)) {
        return;
      }
    }
  } else {
    const preset = K_FORMULAS[presetKey];
    formulaName = preset.name;
    constant = preset.constant;
    coefs = preset.coefs;
  }
  
  // 2. Determine base month Io based on ว190 rule 2
  let baseMonth = defaultBaseMonth;
  let baseYear = defaultBaseYear;
  let ioNotice = "ปกติ (เดือนเปิดซอง)";
  
  if (isW190) {
    // Check if signed within relief window: Feb 2569 - Sep 2569 BE
    const isSignedInsideWindow = (w190SignYear === 2569 && w190SignMonth >= 2 && w190SignMonth <= 9);
    if (isSignedInsideWindow) {
      baseMonth = w190RefMonth;
      baseYear = w190RefYear;
      ioNotice = `เกณฑ์ ว190 (เปลี่ยนใช้เดือนเห็นชอบราคากลาง: ${TH_MONTHS_SHORT[w190RefMonth - 1]} ${w190RefYear})`;
    }
  }
  
  // 3. Read installment rows
  const tbody = document.getElementById('installment-rows-tbody');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr');
  if (rows.length === 0) {
    alert("กรุณาเพิ่มงวดงานอย่างน้อย 1 งวด");
    return;
  }
  
  const installments = [];
  let validationError = false;
  
  rows.forEach((row, idx) => {
    const month = parseInt(row.querySelector('.inst-month').value);
    const year = parseInt(row.querySelector('.inst-year').value);
    const gross = parseFloat(row.querySelector('.inst-gross').value) || 0;
    const deduct = parseFloat(row.querySelector('.inst-deduct').value) || 0;
    
    if (gross < 0 || deduct < 0) {
      validationError = true;
      return;
    }
    
    installments.push({
      num: idx + 1,
      month: month,
      year: year,
      gross: gross,
      deduct: deduct,
      net: gross - deduct
    });
  });
  
  if (validationError) {
    alert("กรุณากรอกจำนวนเงินค่างานและค่าหักให้ถูกต้อง (ต้องมีค่าไม่น้อยกว่า 0)");
    return;
  }
  
  try {
    showLoader('report-loader', true);
    
    // 4. Gather all unique months to fetch
    const uniqueMonths = new Set();
    uniqueMonths.add(`${baseYear}-${baseMonth}`);
    
    if (isLate) {
      uniqueMonths.add(`${lateExpiryYear}-${lateExpiryMonth}`);
    }
    
    installments.forEach(inst => {
      uniqueMonths.add(`${inst.year}-${inst.month}`);
    });
    
    // Fetch missing months in parallel
    const monthsToFetch = [];
    uniqueMonths.forEach(key => {
      if (!monthlyDataCache[key]) {
        const [y, m] = key.split('-').map(Number);
        monthsToFetch.push({ year: y, month: m });
      }
    });
    
    const fetchPromises = monthsToFetch.map(async ({ year, month }) => {
      const res = await fetch('/api/month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yearBase: 2530,
          year: year,
          month: month,
          type: "K",
          commodities: []
        })
      });
      if (!res.ok) throw new Error(`Failed to fetch month: ${month}/${year}`);
      const data = await res.json();
      monthlyDataCache[`${year}-${month}`] = data;
    });
    
    await Promise.all(fetchPromises);
    
    // 5. Run calculations per installment
    const baseKey = `${baseYear}-${baseMonth}`;
    const baseData = monthlyDataCache[baseKey];
    
    const neededCodes = Object.keys(coefs);
    
    let missingDataAlert = false;
    
    const results = installments.map(inst => {
      const instKey = `${inst.year}-${inst.month}`;
      const instData = monthlyDataCache[instKey];
      
      // Determine threshold for this installment based on delivery date: Feb 2569 - Sep 2569 BE
      const isDeliveredInsideW190 = isW190 && (inst.year === 2569 && inst.month >= 2 && inst.month <= 9);
      const threshold = isDeliveredInsideW190 ? 0.02 : 0.04;
      const lowerLimit = 1.0 - threshold;
      const upperLimit = 1.0 + threshold;
      
      // Calculate index ratios
      const indexPairs = {};
      neededCodes.forEach(code => {
        const bItem = baseData.find(d => d.commodityCode === code);
        const sItem = instData.find(d => d.commodityCode === code);
        if (!bItem || !sItem) {
          missingDataAlert = true;
          return;
        }
        indexPairs[code] = {
          ratio: Math.floor((sItem.index / bItem.index) * 1000 + 1e-9) / 1000
        };
      });
      
      if (missingDataAlert) return null;
      
      // Calculate K actual
      let kActual = constant;
      neededCodes.forEach(code => {
        const term = Math.floor((coefs[code] * indexPairs[code].ratio) * 1000 + 1e-9) / 1000;
        kActual += term;
      });
      kActual = Math.round(kActual * 1000) / 1000;
      
      let kFinal = kActual;
      let isLateApplied = false;
      let kExpiryValue = null;
      
      // Handle late delivery comparisons if applicable
      const isLateDelivery = isLate && (inst.year > lateExpiryYear || (inst.year === lateExpiryYear && inst.month > lateExpiryMonth));
      if (isLateDelivery) {
        isLateApplied = true;
        const expiryKey = `${lateExpiryYear}-${lateExpiryMonth}`;
        const expiryData = monthlyDataCache[expiryKey];
        
        const expiryPairs = {};
        neededCodes.forEach(code => {
          const bItem = baseData.find(d => d.commodityCode === code);
          const eItem = expiryData.find(d => d.commodityCode === code);
          if (!bItem || !eItem) {
            missingDataAlert = true;
            return;
          }
          expiryPairs[code] = {
            ratio: Math.floor((eItem.index / bItem.index) * 1000 + 1e-9) / 1000
          };
        });
        
        if (missingDataAlert) return null;
        
        let kExpiry = constant;
        neededCodes.forEach(code => {
          const term = Math.floor((coefs[code] * expiryPairs[code].ratio) * 1000 + 1e-9) / 1000;
          kExpiry += term;
        });
        kExpiry = Math.round(kExpiry * 1000) / 1000;
        kExpiryValue = kExpiry;
        
        // Select minimum mathematical adjustment
        let adjActual = 0;
        if (kActual > upperLimit) adjActual = kActual - upperLimit;
        else if (kActual < lowerLimit) adjActual = kActual - lowerLimit;
        
        let adjExpiry = 0;
        if (kExpiry > upperLimit) adjExpiry = kExpiry - upperLimit;
        else if (kExpiry < lowerLimit) adjExpiry = kExpiry - lowerLimit;
        
        if (adjActual < adjExpiry) {
          kFinal = kActual;
        } else {
          kFinal = kExpiry;
        }
      }
      
      // Calculate money adjustments
      let compAmount = 0;
      let refAmount = 0;
      let kAdjStr = "-";
      
      if (kFinal > upperLimit) {
        compAmount = inst.net * (kFinal - upperLimit);
        kAdjStr = `K - ${upperLimit.toFixed(3)}`;
      } else if (kFinal < lowerLimit) {
        refAmount = inst.net * (lowerLimit - kFinal);
        kAdjStr = `${lowerLimit.toFixed(3)} - K`;
      }
      
      return {
        num: inst.num,
        periodText: `${TH_MONTHS_SHORT[inst.month - 1]} ${inst.year}`,
        gross: inst.gross,
        deduct: inst.deduct,
        net: inst.net,
        k: kFinal,
        thresholdText: `±${(threshold * 100)}%`,
        kAdjStr: kAdjStr,
        compensation: compAmount,
        refund: refAmount,
        isLateApplied: isLateApplied,
        kActual: kActual,
        kExpiry: kExpiryValue
      };
    });
    
    if (missingDataAlert || results.includes(null)) {
      alert("ไม่พบค่าดัชนีบางรายการสำหรับช่วงเวลาที่เลือก กรุณาตรวจสอบข้อมูลวัสดุประวัติศาสตร์");
      return;
    }
    
    // 6. Render Output Multi report
    document.getElementById('empty-report-view').classList.add('hidden');
    document.getElementById('report-content-view').classList.add('hidden');
    document.getElementById('multi-report-content-view').classList.remove('hidden');
    
    // Metadata
    document.getElementById('out-project-name').innerText = projectName;
    document.getElementById('out-contract-no').innerText = contractNo;
    document.getElementById('out-contractor-name').innerText = contractorName;
    document.getElementById('out-contract-val').innerText = contractVal.toLocaleString("th-TH", { minimumFractionDigits: 2 });
    document.getElementById('out-base-month').innerText = `${TH_MONTHS[baseMonth - 1]} ${baseYear} (${ioNotice})`;
    
    const w190Badge = document.getElementById('out-w190-status');
    if (isW190) {
      w190Badge.className = "status-badge yes";
      w190Badge.innerText = "เปิดใช้งาน";
    } else {
      w190Badge.className = "status-badge no";
      w190Badge.innerText = "ปิดใช้งาน";
    }
    
    // Fill Table rows
    const repTbody = document.getElementById('multi-rep-tbody');
    repTbody.innerHTML = '';
    
    let sumGross = 0;
    let sumDeduct = 0;
    let sumNet = 0;
    let sumCompensation = 0;
    let sumRefund = 0;
    
    results.forEach(r => {
      sumGross += r.gross;
      sumDeduct += r.deduct;
      sumNet += r.net;
      sumCompensation += r.compensation;
      sumRefund += r.refund;
      
      let kColHtml = r.k.toFixed(4);
      if (r.isLateApplied) {
        kColHtml = `<span title="ส่งมอบล่าช้า: K(จริง)=${r.kActual.toFixed(4)}, K(สิ้นสุด)=${r.kExpiry.toFixed(4)}" style="border-bottom: 1px dotted #f43f5e; cursor: help; color: #f43f5e;">${r.k.toFixed(4)} *</span>`;
      }
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-center font-weight-bold">${r.num}</td>
        <td>${r.periodText}</td>
        <td class="text-right">${r.gross.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
        <td class="text-right">${r.deduct.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
        <td class="text-right font-weight-bold">${r.net.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
        <td class="text-center font-weight-bold">${kColHtml}</td>
        <td class="text-center">${r.thresholdText}</td>
        <td class="text-center font-style-italic">${r.kAdjStr}</td>
        <td class="text-right text-success">${r.compensation > 0 ? r.compensation.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>
        <td class="text-right text-danger">${r.refund > 0 ? r.refund.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>
      `;
      repTbody.appendChild(tr);
    });
    
    // Totals
    document.getElementById('total-gross').innerText = sumGross.toLocaleString("th-TH", { minimumFractionDigits: 2 });
    document.getElementById('total-deduction').innerText = sumDeduct.toLocaleString("th-TH", { minimumFractionDigits: 2 });
    document.getElementById('total-net-adj').innerText = sumNet.toLocaleString("th-TH", { minimumFractionDigits: 2 });
    document.getElementById('total-compensation').innerText = sumCompensation > 0 ? sumCompensation.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-";
    document.getElementById('total-refund').innerText = sumRefund > 0 ? sumRefund.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-";
    
    // Net Balance Card
    const balanceCard = document.getElementById('multi-rep-balance-card');
    const balanceValue = document.getElementById('net-balance-value');
    const balanceDesc = document.getElementById('net-balance-desc');
    
    const netDiff = sumCompensation - sumRefund;
    balanceValue.innerText = `${Math.abs(netDiff).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`;
    
    if (netDiff > 0) {
      balanceCard.className = "net-balance-card compensation";
      balanceDesc.innerText = "ดัชนีปรับเพิ่มขึ้นรวมเฉลี่ยเกินเกณฑ์ ส่วนราชการจ่ายเงินชดเชยเพิ่มให้แก่ผู้รับจ้าง";
    } else if (netDiff < 0) {
      balanceCard.className = "net-balance-card refund";
      balanceDesc.innerText = "ดัชนีปรับลดลงรวมเฉลี่ยต่ำกว่าเกณฑ์ หักค่างานเรียกคืนเงินส่งคืนคลังหลวง";
    } else {
      balanceCard.className = "net-balance-card";
      balanceDesc.innerText = "ไม่มีมูลค่าการชดเชยจ่ายเพิ่มหรือปรับลดคืนค่างานสะสมในสัญญาโครงการนี้";
    }
    
  } catch (error) {
    console.error("Multi-calculator error:", error);
    alert("เกิดข้อผิดพลาดในการคำนวณสะสมค่า K");
  } finally {
    showLoader('report-loader', false);
  }
}

