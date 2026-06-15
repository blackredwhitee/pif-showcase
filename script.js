/* ==========================================================
   Витрина ПИФ — основная логика
   Все данные берутся из локального файла funds-data.js (FUNDS_DATA)
   ========================================================== */

// ---------- Вспомогательные функции для форматирования ----------

// Возвращает "нет данных", если значение пустое/не указано
function fmt(value) {
  if (value === null || value === undefined) return 'нет данных';
  if (typeof value === 'string') {
    const v = value.trim();
    if (!v || v === 'не предусмотрено' || v === '-') return 'нет данных';
    return v;
  }
  return value;
}

// Форматирование процента (число) -> "1,5%"
function fmtPct(num) {
  if (num === null || num === undefined || isNaN(num)) return 'нет данных';
  return String(num).replace('.', ',') + '%';
}

// Форматирование доходности с цветом
function fmtYield(num) {
  if (num === null || num === undefined || isNaN(num)) return { text: 'нет данных', cls: '' };
  const sign = num > 0 ? '+' : '';
  const text = sign + String(num).replace('.', ',') + '%';
  const cls = num > 0 ? 'yield-pos' : (num < 0 ? 'yield-neg' : '');
  return { text, cls };
}

function hasIncome(fund) {
  return fund.incomeRight === 'предусмотрено' &&
    fund.incomePeriod && fund.incomePeriod !== 'не предусмотрено';
}

function isPassive(fund) {
  return fund.strategy === 'пассивная';
}

function isActiveStrategy(fund) {
  return fund.strategy === 'активная';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str === null || str === undefined ? '' : String(str);
  return div.innerHTML;
}

// ---------- Глобальное состояние ----------

const ALL_FUNDS = FUNDS_DATA;
let visibleCount = 12; // постраничный показ карточек в каталоге
const PAGE_SIZE = 12;
const compareSet = []; // массив rulesNumber выбранных для сравнения фондов

// ---------- Инициализация ----------

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('data-date').textContent = FUNDS_UPDATED;
  document.getElementById('data-date-2').textContent = FUNDS_UPDATED;

  renderStats();
  fillFilterOptions();
  bindFilterEvents();
  renderCatalog();

  bindQuizEvents();
  bindModalEvents();
  renderCompare();
});

// ==========================================================
// Ключевые метрики
// ==========================================================

function renderStats() {
  const total = ALL_FUNDS.length;
  const active = ALL_FUNDS.filter(isActiveStrategy).length;
  const passive = ALL_FUNDS.filter(isPassive).length;
  const withIncome = ALL_FUNDS.filter(hasIncome).length;

  const yields = ALL_FUNDS.map(f => f.yield12m).filter(v => typeof v === 'number');
  const avgYield = yields.length ? (yields.reduce((a, b) => a + b, 0) / yields.length) : null;

  const expenses = ALL_FUNDS.map(f => f.maxExpensesPct).filter(v => typeof v === 'number');
  const avgExpenses = expenses.length ? (expenses.reduce((a, b) => a + b, 0) / expenses.length) : null;

  const stats = [
    { label: 'Всего фондов', value: total },
    { label: 'Активная стратегия', value: active },
    { label: 'Пассивная стратегия', value: passive },
    { label: 'С выплатой дохода', value: withIncome },
    { label: 'Средняя доходность за 12 мес.', value: avgYield !== null ? avgYield.toFixed(2).replace('.', ',') + '%' : 'нет данных' },
    { label: 'Средние макс. расходы', value: avgExpenses !== null ? avgExpenses.toFixed(2).replace('.', ',') + '%' : 'нет данных' },
  ];

  const grid = document.getElementById('stats-grid');
  grid.innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-card__value">${s.value}</div>
      <div class="stat-card__label">${s.label}</div>
    </div>
  `).join('');
}

// ==========================================================
// Каталог: фильтры
// ==========================================================

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
}

function fillFilterOptions() {
  const types = uniqueSorted(ALL_FUNDS.map(f => f.type));
  const categories = uniqueSorted(ALL_FUNDS.map(f => f.category));
  const strategies = uniqueSorted(ALL_FUNDS.map(f => f.strategy));
  const statuses = uniqueSorted(ALL_FUNDS.map(f => f.status));

  fillSelect('f-type', types);
  fillSelect('f-category', categories);
  fillSelect('f-strategy', strategies);
  fillSelect('f-status', statuses);
}

function fillSelect(id, values) {
  const select = document.getElementById(id);
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
}

function bindFilterEvents() {
  ['f-search', 'f-type', 'f-category', 'f-strategy', 'f-status', 'f-income'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      visibleCount = PAGE_SIZE;
      renderCatalog();
    });
  });

  const yieldMin = document.getElementById('f-yield-min');
  const yieldMax = document.getElementById('f-yield-max');
  const expMin = document.getElementById('f-exp-min');
  const expMax = document.getElementById('f-exp-max');

  [yieldMin, yieldMax, expMin, expMax].forEach(el => {
    el.addEventListener('input', () => {
      // не даём диапазону "перевернуться"
      if (parseFloat(yieldMin.value) > parseFloat(yieldMax.value)) {
        if (el === yieldMin) yieldMax.value = yieldMin.value; else yieldMin.value = yieldMax.value;
      }
      if (parseFloat(expMin.value) > parseFloat(expMax.value)) {
        if (el === expMin) expMax.value = expMin.value; else expMin.value = expMax.value;
      }
      updateRangeLabels();
      visibleCount = PAGE_SIZE;
      renderCatalog();
    });
  });

  document.getElementById('f-reset').addEventListener('click', () => {
    document.getElementById('f-search').value = '';
    document.getElementById('f-type').value = '';
    document.getElementById('f-category').value = '';
    document.getElementById('f-strategy').value = '';
    document.getElementById('f-status').value = '';
    document.getElementById('f-income').value = '';
    yieldMin.value = -50; yieldMax.value = 100;
    expMin.value = 0; expMax.value = 10;
    updateRangeLabels();
    visibleCount = PAGE_SIZE;
    renderCatalog();
  });

  document.getElementById('catalog-more').addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    renderCatalog();
  });

  updateRangeLabels();
}

function updateRangeLabels() {
  const yieldMin = document.getElementById('f-yield-min');
  const yieldMax = document.getElementById('f-yield-max');
  const expMin = document.getElementById('f-exp-min');
  const expMax = document.getElementById('f-exp-max');

  const yMinFull = yieldMin.value == -50;
  const yMaxFull = yieldMax.value == 100;
  document.getElementById('f-yield-val').textContent =
    (yMinFull && yMaxFull) ? 'любая' : `от ${yieldMin.value}% до ${yieldMax.value}%`;

  const eMinFull = expMin.value == 0;
  const eMaxFull = expMax.value == 10;
  document.getElementById('f-exp-val').textContent =
    (eMinFull && eMaxFull) ? 'любые' : `от ${expMin.value}% до ${expMax.value}%`;
}

function getFilteredFunds() {
  const search = document.getElementById('f-search').value.trim().toLowerCase();
  const type = document.getElementById('f-type').value;
  const category = document.getElementById('f-category').value;
  const strategy = document.getElementById('f-strategy').value;
  const status = document.getElementById('f-status').value;
  const income = document.getElementById('f-income').value;

  const yieldMin = parseFloat(document.getElementById('f-yield-min').value);
  const yieldMax = parseFloat(document.getElementById('f-yield-max').value);
  const expMin = parseFloat(document.getElementById('f-exp-min').value);
  const expMax = parseFloat(document.getElementById('f-exp-max').value);

  const yieldFilterActive = !(yieldMin === -50 && yieldMax === 100);
  const expFilterActive = !(expMin === 0 && expMax === 10);

  return ALL_FUNDS.filter(f => {
    if (search) {
      const hay = `${f.name} ${f.company} ${f.isin}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (type && f.type !== type) return false;
    if (category && f.category !== category) return false;
    if (strategy && f.strategy !== strategy) return false;
    if (status && f.status !== status) return false;
    if (income === 'yes' && !hasIncome(f)) return false;
    if (income === 'no' && hasIncome(f)) return false;

    if (yieldFilterActive) {
      if (typeof f.yield12m !== 'number') return false;
      if (f.yield12m < yieldMin || f.yield12m > yieldMax) return false;
    }
    if (expFilterActive) {
      if (typeof f.maxExpensesPct !== 'number') return false;
      if (f.maxExpensesPct < expMin || f.maxExpensesPct > expMax) return false;
    }

    return true;
  });
}

// ==========================================================
// Каталог: рендер карточек
// ==========================================================

function renderCatalog() {
  const filtered = getFilteredFunds();
  const grid = document.getElementById('catalog-cards');
  const empty = document.getElementById('catalog-empty');
  const more = document.getElementById('catalog-more');
  const countLabel = document.getElementById('f-count');

  countLabel.textContent = `Найдено фондов: ${filtered.length}`;

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.hidden = false;
    more.hidden = true;
    return;
  }
  empty.hidden = true;

  const slice = filtered.slice(0, visibleCount);
  grid.innerHTML = slice.map(renderFundCard).join('');

  more.hidden = filtered.length <= visibleCount;

  bindCardButtons(grid);
}

function renderFundCard(fund) {
  const y = fmtYield(fund.yield12m);
  const tags = [];
  tags.push(`<span class="tag">${escapeHtml(fund.type)}</span>`);
  if (isPassive(fund)) tags.push(`<span class="tag tag--passive">Пассивная</span>`);
  if (hasIncome(fund)) tags.push(`<span class="tag tag--income">Выплаты</span>`);
  if (fund.status !== 'Сформирован') tags.push(`<span class="tag tag--warn">${escapeHtml(fund.status)}</span>`);

  const isCompared = compareSet.includes(fund.rulesNumber);

  return `
    <div class="fund-card" data-id="${escapeHtml(fund.rulesNumber)}">
      <div class="fund-card__tags">${tags.join('')}</div>
      <h3 class="fund-card__name">${escapeHtml(fund.name)}</h3>
      <div class="fund-card__company">${escapeHtml(fund.company)} · ${escapeHtml(fund.category)}</div>
      <div class="fund-card__row"><span>Стратегия</span><span>${escapeHtml(fund.strategy)}</span></div>
      <div class="fund-card__row"><span>Доходность за 12 мес.</span><span class="${y.cls}">${y.text}</span></div>
      <div class="fund-card__row"><span>Макс. расходы</span><span>${fmtPct(fund.maxExpensesPct)}</span></div>
      <div class="fund-card__row"><span>Выплаты дохода</span><span>${hasIncome(fund) ? escapeHtml(fund.incomePeriod) : 'нет'}</span></div>
      <div class="fund-card__row"><span>Надбавки / скидки</span><span>${fund.premiumsMaxPct ? 'до ' + fmtPct(fund.premiumsMaxPct) : 'нет'} / ${fund.discountsMaxPct ? 'до ' + fmtPct(fund.discountsMaxPct) : 'нет'}</span></div>
      <div class="fund-card__actions">
        <button class="btn btn--ghost btn--small" data-action="details">Подробнее</button>
        <button class="btn btn--ghost btn--small" data-action="compare">${isCompared ? '✓ В сравнении' : 'Сравнить'}</button>
        <a class="fund-card__site" href="${escapeHtml(fund.companySite || '#')}" target="_blank" rel="noopener">Сайт УК →</a>
      </div>
    </div>
  `;
}

function bindCardButtons(container) {
  container.querySelectorAll('.fund-card').forEach(card => {
    const id = card.dataset.id;
    const fund = ALL_FUNDS.find(f => f.rulesNumber === id);

    const detailsBtn = card.querySelector('[data-action="details"]');
    if (detailsBtn) detailsBtn.addEventListener('click', () => openFundModal(fund));

    const compareBtn = card.querySelector('[data-action="compare"]');
    if (compareBtn) compareBtn.addEventListener('click', () => toggleCompare(fund, compareBtn));
  });
}

// ==========================================================
// Карточка-модалка с подробностями
// ==========================================================

function bindModalEvents() {
  const modal = document.getElementById('fund-modal');
  modal.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => { modal.hidden = true; });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') modal.hidden = true;
  });
}

function openFundModal(fund) {
  const modal = document.getElementById('fund-modal');
  const body = document.getElementById('fund-modal-body');
  const y = fmtYield(fund.yield12m);

  body.innerHTML = `
    <h3>${escapeHtml(fund.name)}</h3>
    <dl>
      <dt>ISIN</dt><dd>${escapeHtml(fmt(fund.isin))}</dd>
      <dt>Управляющая компания</dt><dd>${escapeHtml(fmt(fund.company))} (<a href="${escapeHtml(fund.companySite || '#')}" target="_blank" rel="noopener">${escapeHtml(fmt(fund.companySite))}</a>)</dd>
      <dt>Тип / категория / статус</dt><dd>${escapeHtml(fund.type)} · ${escapeHtml(fund.category)} · ${escapeHtml(fund.status)}</dd>
      <dt>Стратегия</dt><dd>${escapeHtml(fund.strategy)}${fund.benchmark && fund.benchmark !== 'не предусмотрено' ? ' — ориентир: ' + escapeHtml(fund.benchmark) : ''}</dd>
      <dt>Допустимое отклонение от индекса</dt><dd>${escapeHtml(fmt(fund.deviation))}</dd>
      <dt>Доходность за 12 месяцев</dt><dd class="${y.cls}">${y.text}</dd>
      <dt>Вознаграждение УК</dt><dd>${escapeHtml(fmt(fund.managementFee))}</dd>
      <dt>Вознаграждение за успех</dt><dd>${escapeHtml(fmt(fund.successFee))}</dd>
      <dt>Вознаграждение инфраструктуры</dt><dd>${escapeHtml(fmt(fund.infraFee))}</dd>
      <dt>Максимальный совокупный размер расходов</dt><dd>${escapeHtml(fmt(fund.maxExpenses))}</dd>
      <dt>Право на получение дохода</dt><dd>${escapeHtml(fmt(fund.incomeRight))}${hasIncome(fund) ? ' (периодичность: ' + escapeHtml(fund.incomePeriod) + ')' : ''}</dd>
      <dt>Надбавки при выдаче паёв</dt><dd>${escapeHtml(fmt(fund.premiums))}</dd>
      <dt>Скидки при погашении паёв</dt><dd>${escapeHtml(fmt(fund.discounts))}</dd>
      <dt>Дата актуальной редакции правил</dt><dd>${escapeHtml(fmt(fund.rulesDate))}</dd>
      <dt>Номер правил ДУ</dt><dd>${escapeHtml(fmt(fund.rulesNumber))}</dd>
    </dl>
  `;
  modal.hidden = false;
}

// ==========================================================
// Сравнение фондов
// ==========================================================

function toggleCompare(fund, btn) {
  const idx = compareSet.indexOf(fund.rulesNumber);
  if (idx >= 0) {
    compareSet.splice(idx, 1);
  } else {
    if (compareSet.length >= 4) {
      alert('Можно сравнить не более 4 фондов. Уберите один, чтобы добавить новый.');
      return;
    }
    compareSet.push(fund.rulesNumber);
  }
  if (btn) btn.textContent = compareSet.includes(fund.rulesNumber) ? '✓ В сравнении' : 'Сравнить';
  renderCompare();
}

function renderCompare() {
  const empty = document.getElementById('compare-empty');
  const wrap = document.getElementById('compare-table-wrap');
  const clearBtn = document.getElementById('compare-clear');
  const table = document.getElementById('compare-table');

  if (compareSet.length < 2) {
    empty.hidden = false;
    empty.textContent = compareSet.length === 0
      ? 'Пока ничего не выбрано.'
      : 'Выберите ещё хотя бы один фонд, чтобы увидеть сравнение.';
    wrap.hidden = true;
    clearBtn.hidden = compareSet.length === 0;
    return;
  }

  empty.hidden = true;
  wrap.hidden = false;
  clearBtn.hidden = false;

  const funds = compareSet.map(id => ALL_FUNDS.find(f => f.rulesNumber === id)).filter(Boolean);

  const rows = [
    { label: 'Фонд', render: f => escapeHtml(f.name) },
    { label: 'Доходность за 12 мес.', render: f => { const y = fmtYield(f.yield12m); return `<span class="${y.cls}">${y.text}</span>`; } },
    { label: 'Стратегия', render: f => escapeHtml(f.strategy) + (f.benchmark && f.benchmark !== 'не предусмотрено' ? '<br><small>' + escapeHtml(f.benchmark) + '</small>' : '') },
    { label: 'Вознаграждение УК', render: f => escapeHtml(fmt(f.managementFee)) },
    { label: 'Макс. совокупные расходы', render: f => escapeHtml(fmt(f.maxExpenses)) },
    { label: 'Выплаты дохода', render: f => hasIncome(f) ? escapeHtml(f.incomePeriod) : 'нет' },
    { label: 'Надбавки', render: f => f.premiumsMaxPct ? 'до ' + fmtPct(f.premiumsMaxPct) : 'нет данных' },
    { label: 'Скидки', render: f => f.discountsMaxPct ? 'до ' + fmtPct(f.discountsMaxPct) : 'нет данных' },
    { label: 'Сайт УК', render: f => `<a href="${escapeHtml(f.companySite || '#')}" target="_blank" rel="noopener">${escapeHtml(fmt(f.companySite))}</a>` },
  ];

  let html = '<thead><tr><th></th>' + funds.map(() => '<th></th>').join('') + '</tr></thead><tbody>';
  rows.forEach(row => {
    html += `<tr><td>${row.label}</td>` + funds.map(f => `<td>${row.render(f)}</td>`).join('') + '</tr>';
  });
  html += '</tbody>';
  table.innerHTML = html;

  clearBtn.onclick = () => {
    compareSet.length = 0;
    renderCompare();
    renderCatalog(); // обновить кнопки "Сравнить" на карточках
  };
}

// ==========================================================
// Виджет подбора фонда («Подберите фонд под себя»)
// ==========================================================

function bindQuizEvents() {
  const form = document.getElementById('quiz-form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    runQuiz();
  });
  document.getElementById('quiz-reset').addEventListener('click', () => {
    document.getElementById('quiz-result').hidden = true;
  });
}

// Категории риска (приблизительная классификация по категории фонда)
const RISK_BY_CATEGORY = {
  'Акций': 'high',
  'Недвижимости': 'mid',
  'Смешанных инвестиций': 'mid',
  'Рентный': 'mid',
  'Фонд рыночных финансовых инструментов': 'low',
};

function runQuiz() {
  const form = document.getElementById('quiz-form');
  const data = new FormData(form);
  const answers = {
    horizon: data.get('horizon'),
    risk: data.get('risk'),
    priority: data.get('priority'),
    income: data.get('income'),
    approach: data.get('approach'),
    fees: data.get('fees'),
    exit: data.get('exit'),
  };

  // Проверяем, что ответили на все вопросы
  for (const key in answers) {
    if (!answers[key]) {
      alert('Пожалуйста, ответьте на все вопросы.');
      return;
    }
  }

  // Берём только действующие фонды
  let candidates = ALL_FUNDS.filter(f => f.status === 'Сформирован');

  // ---- Жёсткие отсечения ----

  // Регулярные выплаты обязательны
  if (answers.income === 'yes') {
    candidates = candidates.filter(hasIncome);
  }
  // Если выплаты не нужны — не настаиваем (фонд без выплат подходит большинству)

  // Короткий срок или быстрый выход -> избегаем фондов с высокими скидками при погашении
  const shortTerm = answers.horizon === 'short' || answers.exit === 'soon';
  if (shortTerm) {
    candidates = candidates.filter(f => f.discountsMaxPct === null || f.discountsMaxPct === undefined || f.discountsMaxPct <= 2);
  }

  // Низкий риск -> избегаем категории "Акций"
  if (answers.risk === 'low') {
    candidates = candidates.filter(f => f.category !== 'Акций');
  }

  // ---- Скоринг оставшихся фондов ----

  candidates = candidates.map(f => {
    let score = 0;
    const reasons = [];

    // Срок инвестирования
    if (answers.horizon === 'short') {
      if (f.discountsMaxPct === null || f.discountsMaxPct === undefined || f.discountsMaxPct === 0) {
        score += 3; reasons.push('нет скидок при погашении — удобно для короткого срока');
      }
    } else if (answers.horizon === 'long') {
      // длинный горизонт допускает более рисковые фонды
      if (f.category === 'Акций') { score += 1; }
    }

    // Риск / приоритет
    const riskLevel = RISK_BY_CATEGORY[f.category] || 'mid';
    if (answers.risk === 'low' && riskLevel === 'low') { score += 3; reasons.push('консервативная категория, соответствует низкому риску'); }
    if (answers.risk === 'mid' && riskLevel === 'mid') { score += 2; reasons.push('категория со средним уровнем риска'); }
    if (answers.risk === 'high' && riskLevel === 'high') { score += 2; reasons.push('фонд акций — повышенный риск и потенциал доходности'); }
    if (answers.risk === 'high' && f.strategy === 'активная') { score += 1; }

    if (answers.priority === 'stability' && riskLevel === 'low') { score += 2; reasons.push('подходит для приоритета «стабильность»'); }
    if (answers.priority === 'balance' && riskLevel === 'mid') { score += 2; reasons.push('баланс риска и доходности — категория смешанная/рентная/недвижимость'); }
    if (answers.priority === 'growth' && riskLevel === 'high') { score += 2; reasons.push('ориентирован на потенциально высокую доходность'); }

    // Регулярные выплаты
    if (answers.income === 'yes' && hasIncome(f)) { score += 3; reasons.push(`есть право на доход с периодичностью «${f.incomePeriod}»`); }
    if (answers.income === 'no' && !hasIncome(f)) { score += 1; }

    // Подход (активная/пассивная)
    if (answers.approach === 'passive') {
      if (isPassive(f)) { score += 3; reasons.push('пассивная стратегия следования за индексом'); }
      if (f.benchmark && f.benchmark !== 'не предусмотрено') { score += 1; }
    } else if (answers.approach === 'active') {
      if (isActiveStrategy(f)) { score += 2; reasons.push('активное управление'); }
    }

    // Комиссии
    const totalFee = (f.managementFeePct || 0) + (f.maxExpensesPct || 0);
    if (answers.fees === 'critical') {
      if (typeof f.maxExpensesPct === 'number' && f.maxExpensesPct <= 0.5) { score += 3; reasons.push('низкий максимальный размер расходов'); }
      if (typeof f.managementFeePct === 'number' && f.managementFeePct <= 1) { score += 2; reasons.push('низкое вознаграждение УК'); }
      score -= totalFee; // штраф пропорционально суммарным издержкам
    } else if (answers.fees === 'moderate') {
      score -= totalFee * 0.4;
    }
    // flexible -> комиссии не влияют на скор

    // Выход из фонда / скидки
    if (answers.exit === 'soon') {
      if (f.discountsMaxPct === null || f.discountsMaxPct === undefined || f.discountsMaxPct === 0) {
        score += 2; reasons.push('отсутствуют скидки при погашении — можно гибко выйти');
      } else {
        score -= f.discountsMaxPct;
      }
    } else if (answers.exit === 'hold') {
      // долгий горизонт — небольшие скидки не критичны
      score += 0.5;
    }

    // Лёгкий бонус за позитивную доходность, но не основной фактор
    if (typeof f.yield12m === 'number' && f.yield12m > 0) score += Math.min(f.yield12m / 10, 1);

    return { fund: f, score, reasons };
  });

  // Сортировка по убыванию скора
  candidates.sort((a, b) => b.score - a.score);

  // Если высокий риск — добавляем предупреждение в подсказку
  const hint = document.getElementById('quiz-result-hint');
  if (answers.risk === 'high' || answers.priority === 'growth') {
    hint.textContent = '⚠️ Вы выбрали высокий риск / потенциально высокую доходность. Такие фонды (часто фонды акций с активной стратегией) могут показывать как высокую прибыль, так и значительные убытки. Ниже — варианты, которые в наибольшей степени соответствуют вашим ответам.';
  } else {
    hint.textContent = 'Ниже — варианты, которые в наибольшей степени соответствуют вашим ответам. Это не единственно верный выбор — изучите детали каждого фонда перед решением.';
  }

  const top = candidates.slice(0, 5).filter(c => c.score > -1000);

  const container = document.getElementById('quiz-result-cards');
  if (top.length === 0) {
    container.innerHTML = '<div class="empty-state">К сожалению, по заданным критериям не нашлось подходящих фондов. Попробуйте изменить ответы.</div>';
  } else {
    container.innerHTML = top.map(c => renderQuizCard(c)).join('');
  }

  document.getElementById('quiz-result').hidden = false;
  bindCardButtons(container);
  document.getElementById('quiz-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderQuizCard(c) {
  const cardHtml = renderFundCard(c.fund);
  const reasonsHtml = c.reasons.length
    ? `<div class="fund-card__row" style="border-top:none; flex-direction:column; align-items:flex-start; gap:4px;"><span>Почему подходит:</span><span style="font-weight:400; text-align:left;">${c.reasons.map(escapeHtml).join('; ')}</span></div>`
    : '';
  // вставляем причины перед блоком действий
  return cardHtml.replace('<div class="fund-card__actions">', reasonsHtml + '<div class="fund-card__actions">');
}
