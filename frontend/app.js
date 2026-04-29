// FinTrack — app.js (Connected to Flask Backend)

const API = 'http://127.0.0.1:5000/api';
let allCategories = [];
let transactionsLoadedFromBackend = false;
let allRecurringPayments = [];
let allGoals = [];
let recentGoalSavingsAnimation = null;
document.body.dataset.activePage = 'dashboard';

// ── THEME ──
const html = document.documentElement;
const savedTheme = localStorage.getItem('fintrack-theme') || 'light';
html.setAttribute('data-theme', savedTheme);
document.getElementById('moonIcon').style.display = savedTheme === 'dark' ? 'none' : 'block';
document.getElementById('sunIcon').style.display  = savedTheme === 'dark' ? 'block' : 'none';

document.getElementById('themeToggle').addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('fintrack-theme', next);
    document.getElementById('moonIcon').style.display = next === 'dark' ? 'none' : 'block';
    document.getElementById('sunIcon').style.display  = next === 'dark' ? 'block' : 'none';
    if (window.incomeChart) buildIncomeChart();
});

// ── SIDEBAR COLLAPSE ──
document.getElementById('sidebarCollapse').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
    document.getElementById('main').classList.toggle('collapsed');
});

// ── NAVIGATION ──
const pageMeta = {
    dashboard: {
        title: 'Home',
        sub: "Your money overview at a glance."
    },
    transactions: {
        title: 'Transactions',
        sub: 'See where your money comes from and where it goes.'
    },
    budgets: {
        title: 'Budgets',
        sub: 'Track weekly, monthly, and custom budgets.'
    },
    goals: {
        title: 'Goals',
        sub: 'Follow your savings progress and future plans.'
    },
    investments: {
        title: 'Investments',
        sub: 'Monitor your investment performance.'
    },
    recurring: {
        title: 'Recurring Payments',
        sub: 'Manage regular bills, subscriptions, and repeated income.'
    },
    categories: {
        title: 'Money Coach',
        sub: 'Get simple guidance based on your spending and budgets.'
    },
    settings: {
        title: 'Settings',
        sub: 'Personalize your FinTrack experience.'
    },
};

document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = item.dataset.page;
        document.body.dataset.activePage = target;
        document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const pg = document.getElementById('page-' + target);
        if (pg) pg.classList.add('active');
        if (pageMeta[target]) {
            document.querySelector('.page-title').textContent    = pageMeta[target].title;
            document.querySelector('.page-subtitle').textContent = pageMeta[target].sub;
        }

        const topSearchInput = document.querySelector('.search-bar input');

        if (topSearchInput) {
            topSearchInput.placeholder =
                target === 'transactions' ? 'Search transactions...' :
                target === 'budgets' ? 'Search budgets...' :
                target === 'goals' ? 'Search goals...' :
                target === 'investments' ? 'Search investments...' :
                'Search...';
        }

        /* Hide duplicate top search on Transactions page */
        const topSearchBar =
            document.querySelector('.topbar-search') ||
            document.querySelector('.header-search') ||
            document.querySelector('.navbar-search') ||
            document.querySelector('.search-bar');

        if (topSearchBar) {
            topSearchBar.style.display = target === 'transactions' ? 'none' : '';
        }

        const addNewBtn = document.getElementById('addNewBtn');
        const addNewBtnLabel = document.getElementById('addNewBtnLabel');
        if (addNewBtnLabel) {
            addNewBtnLabel.textContent =
                target === 'recurring' ? 'Add Recurring' :
                target === 'goals' ? 'Add Goal' :
                'Add New';
        }

        // Load data for each page when clicked
        if (target === 'transactions') loadTransactions();
        if (target === 'budgets')      loadBudgets();
        if (target === 'goals')        loadGoals();
        if (target === 'investments')  loadInvestments();
    });
});

// ══════════════════════════════════════
//  HELPER — format money
// ══════════════════════════════════════
function fmt(n) {
    const num = parseFloat(n) || 0;
    return '$' + Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ══════════════════════════════════════
//  CATEGORIES
// ══════════════════════════════════════
async function loadCategories() {
    try {
        const res = await fetch(API + '/categories');
        const data = await res.json();

        if (!Array.isArray(data)) return;

        allCategories = data;
        refreshTransactionCategoryOptions();
        renderCategoryPickerGrid('');
        renderTxCategoryFilterGrid('');
    } catch (err) {
        console.log('Using fallback categories');
    }
}

function renderTransactionCategoryOptions() {
    // Premium picker no longer uses a native <select>.
    // This function now only keeps category state ready for the picker and filters.
    refreshTransactionCategoryOptions();
}

function getCategoryIcon(categoryName) {
    const match = allCategories.find(cat => (cat.name || '').toLowerCase() === String(categoryName || '').toLowerCase());
    return match?.icon || '🏷️';
}

// ══════════════════════════════════════
//  DASHBOARD — load real data from API
// ══════════════════════════════════════
async function loadDashboard() {
    try {
        const res  = await fetch(API + '/dashboard');
        const data = await res.json();

        // Update stat cards
        document.querySelector('#stat-balance').textContent  = fmt(data.total_balance);
        document.querySelector('#stat-income').textContent   = fmt(data.monthly_income);
        document.querySelector('#stat-expenses').textContent = fmt(data.monthly_expenses);
        document.querySelector('#stat-savings').textContent  = fmt(data.total_savings);

        // Update accounts total balance banner
        const bannerEl = document.querySelector('.tb-amount');
        if (bannerEl) bannerEl.textContent = fmt(data.total_balance);

        // Recent transactions list on dashboard
        renderRecentTransactions(data.recent_transactions);

    } catch (err) {
        console.log('Backend not reachable — showing demo data');
        // Keep the hardcoded demo data visible if backend is down
    }
}

function renderRecentTransactions(txList) {
    const container = document.querySelector('#dashboard-recent-tx');
    if (!container || !txList || txList.length === 0) return;

    const icons = { Income:'💰', Groceries:'🛒', Entertainment:'🎬', Transport:'🚗', Utilities:'⚡', Housing:'🏠', Dining:'☕', Health:'💊', Shopping:'📦', Other:'💳' };

    container.innerHTML = txList.map(tx => {
        const pos    = parseFloat(tx.amount) > 0;
        const amt    = (pos ? '+' : '') + fmt(tx.amount);
        const icon   = icons[tx.category] || '💳';
        const date   = new Date(tx.date).toLocaleDateString('en-US', { month:'short', day:'numeric' });
        return `
        <div class="tx-item">
            <div class="tx-icon ${pos ? 'green-icon' : 'gray-icon'}">${icon}</div>
            <div class="tx-info">
                <p class="tx-name">${tx.name}</p>
                <p class="tx-meta">${tx.category || 'Other'} · ${date}</p>
            </div>
            <div class="tx-right">
                <p class="tx-amount ${pos ? 'positive' : ''}">${amt}</p>
            </div>
        </div>`;
    }).join('');
}

// ══════════════════════════════════════
//  TRANSACTIONS PAGE
// ══════════════════════════════════════
let allTransactions = [];
let filtered        = [];
let currentPage     = 1;
const ROWS          = 10;
const exportTransactionsBtn = document.getElementById("exportTransactionsBtn");
const deleteAllTransactionsBtn = document.getElementById("deleteAllTransactionsBtn");
const clearAllTransactionFiltersBtn = document.getElementById("clearAllTransactionFiltersBtn");
const openTxCategoryFilterBtn = document.getElementById("openTxCategoryFilterBtn");
const advancedFiltersBtn = document.getElementById("advancedFiltersBtn");

async function loadTransactions() {
    try {
        const res = await fetch(API + '/transactions');
        const data = await res.json();

        transactionsLoadedFromBackend = true;
        allTransactions = Array.isArray(data) ? data : [];
        filtered = [...allTransactions];
        currentPage = 1;
        refreshTransactionCategoryOptions();
        refreshTransactionAccountOptions();
        applyFilters();
    } catch (err) {
        console.log('Using demo transactions');
        transactionsLoadedFromBackend = false;
        allTransactions = [];
        filtered = [...DEMO_TRANSACTIONS];
        currentPage = 1;
        refreshTransactionCategoryOptions();
        refreshTransactionAccountOptions();
        applyFilters();
    }
}

function updateTransactionActionStates() {
    const source = transactionsLoadedFromBackend ? allTransactions : DEMO_TRANSACTIONS;
    const hasTransactions = Array.isArray(source) && source.length > 0;

    const hasActiveFilters =
        !!document.getElementById('txSearch')?.value.trim() ||
        !!document.getElementById('txTypeFilter')?.value ||
        !!document.getElementById('txCategoryFilter')?.value ||
        !!document.getElementById('txAccountFilter')?.value ||
        !!document.getElementById('txDateFromFilter')?.value ||
        !!document.getElementById('txDateToFilter')?.value ||
        (document.getElementById('txSortFilter')?.value && document.getElementById('txSortFilter').value !== 'date_desc');

    if (exportTransactionsBtn) {
        exportTransactionsBtn.disabled = !hasTransactions;
        exportTransactionsBtn.style.opacity = hasTransactions ? '1' : '0.45';
        exportTransactionsBtn.style.cursor = hasTransactions ? 'pointer' : 'not-allowed';
    }

    if (deleteAllTransactionsBtn) {
        deleteAllTransactionsBtn.disabled = !hasTransactions;
        deleteAllTransactionsBtn.style.opacity = hasTransactions ? '1' : '0.45';
        deleteAllTransactionsBtn.style.cursor = hasTransactions ? 'pointer' : 'not-allowed';
    }

    if (clearAllTransactionFiltersBtn) {
        clearAllTransactionFiltersBtn.disabled = !hasActiveFilters;
        clearAllTransactionFiltersBtn.style.opacity = hasActiveFilters ? '1' : '0.45';
        clearAllTransactionFiltersBtn.style.cursor = hasActiveFilters ? 'pointer' : 'not-allowed';
    }

    if (openTxCategoryFilterBtn) {
        openTxCategoryFilterBtn.disabled = !hasTransactions;
        openTxCategoryFilterBtn.style.opacity = hasTransactions ? '1' : '0.55';
        openTxCategoryFilterBtn.style.cursor = hasTransactions ? 'pointer' : 'not-allowed';
    }

    if (advancedFiltersBtn) {
        advancedFiltersBtn.disabled = !hasTransactions;
        advancedFiltersBtn.style.opacity = hasTransactions ? '1' : '0.45';
        advancedFiltersBtn.style.cursor = hasTransactions ? 'pointer' : 'not-allowed';
    }
}

function renderTable() {
    const tbody = document.getElementById('txTableBody');
    if (!tbody) return;

    const start = (currentPage - 1) * ROWS;
    const slice = filtered.slice(start, start + ROWS);
    const hasActiveFilters =
        !!document.getElementById('txSearch')?.value.trim() ||
        !!document.getElementById('txTypeFilter')?.value ||
        !!document.getElementById('txCategoryFilter')?.value ||
        !!document.getElementById('txAccountFilter')?.value ||
        (document.getElementById('txSortFilter')?.value && document.getElementById('txSortFilter').value !== 'date_desc');

    const icons = { Income:'💰', Groceries:'🛒', Entertainment:'🎬', Transport:'🚗', Utilities:'⚡', Housing:'🏠', Dining:'☕', Health:'💊', Shopping:'📦', Other:'💳' };

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="premium-empty-state">
                        <div class="premium-empty-state-icon">
                            ${hasActiveFilters ? '🔎' : '🧾'}
                        </div>
                        <h3 class="premium-empty-state-title">
                            ${hasActiveFilters ? 'No matching transactions' : 'No transactions yet'}
                        </h3>
                        <p class="premium-empty-state-text">
                            ${
                                hasActiveFilters
                                    ? 'Try adjusting your filters or clear them to see more results.'
                                    : 'Start by adding your first transaction or importing a CSV file.'
                            }
                        </p>
                    </div>
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = slice.map(tx => {
            const pos  = parseFloat(tx.amount) > 0;
            const amt  = (pos ? '+' : '') + fmt(tx.amount);
            const cat  = (tx.category || 'other').toLowerCase().replace(/\s+/g, '');
            const icon = icons[tx.category] || '💳';
            const date = tx.date ? new Date(tx.date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '';
            return `<tr>
                <td><div class="tx-cell-name">
                    <div class="tx-cell-icon ${pos ? 'green-icon' : 'gray-icon'}">${icon}</div>
                    <p class="tx-cell-title">${tx.name}</p>
                </div></td>
                <td>
                    <span class="cat-badge ${pos ? 'income type-income-badge' : 'expense type-expense-badge'}">
                        ${pos ? 'Income' : 'Expense'}
                    </span>
                </td>
                <td><span class="cat-badge ${cat}">${tx.category || 'Other'}</span></td>
                <td class="tx-account-cell">${tx.account || '—'}</td>
                <td class="tx-date-cell">${date}</td>
                <td class="tx-amount-cell ${pos ? 'positive' : 'negative'}">${amt}</td>
                <td style="display:flex; gap:8px; align-items:center; justify-content:flex-end;">
                    <button class="dots-btn edit-transaction-btn" data-id="${tx.id}" title="Edit transaction">✎</button>
                    <button class="dots-btn delete-transaction-btn" data-id="${tx.id}" title="Delete transaction">✕</button>
                </td>
            </tr>`;
        }).join('');
    }

    const total = filtered.length;
    document.getElementById('paginationInfo').textContent =
        total === 0
        ? (hasActiveFilters ? 'No matching transactions' : 'No transactions yet')
        : `Showing ${start + 1}–${Math.min(start + ROWS, total)} of ${total} transactions`;

    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage >= Math.ceil(total / ROWS);
    document.querySelectorAll('.page-btn[data-pg]').forEach(b =>
        b.classList.toggle('active', parseInt(b.dataset.pg) === currentPage));
    updateTransactionActionStates();
}

function applyFilters() {
    const s = document.getElementById('txSearch').value.toLowerCase().trim();
    const t = document.getElementById('txTypeFilter').value;
    const c = (document.getElementById('txCategoryFilter').value || '').toLowerCase().trim();
    const a = document.getElementById('txAccountFilter').value;
    const sort = document.getElementById('txSortFilter').value;
    const fromDate = document.getElementById('txDateFromFilter').value;
    const toDate = document.getElementById('txDateToFilter').value;

    const source = transactionsLoadedFromBackend ? allTransactions : DEMO_TRANSACTIONS;

    filtered = source.filter(tx => {
        const name = (tx.name || '').toLowerCase();
        const category = (tx.category || '').toLowerCase();
        const account = (tx.account || '');
        const amount = parseFloat(tx.amount) || 0;
        const txDateObj = tx.date ? new Date(tx.date) : null;

        let txDateOnly = '';
        if (txDateObj && !Number.isNaN(txDateObj.getTime())) {
            const year = txDateObj.getFullYear();
            const month = String(txDateObj.getMonth() + 1).padStart(2, '0');
            const day = String(txDateObj.getDate()).padStart(2, '0');
            txDateOnly = `${year}-${month}-${day}`;
        }

        const searchTerms = s.split('/').map(term => term.trim()).filter(Boolean);
        const matchesSearch =
            !s ||
            (searchTerms.length > 1
                ? searchTerms.some(term => name.includes(term) || category.includes(term) || account.toLowerCase().includes(term))
                : name.includes(s) || category.includes(s) || account.toLowerCase().includes(s));

        const matchesType =
            !t || (t === 'income' ? amount > 0 : amount < 0);

        const matchesCategory =
            !c || category.includes(c);

        const matchesAccount =
            !a || account === a;

        const matchesFromDate =
            !fromDate || (txDateOnly && txDateOnly >= fromDate);

        const matchesToDate =
            !toDate || (txDateOnly && txDateOnly <= toDate);

        return (
            matchesSearch &&
            matchesType &&
            matchesCategory &&
            matchesAccount &&
            matchesFromDate &&
            matchesToDate
        );
    });

    filtered.sort((x, y) => {
        const xAmount = parseFloat(x.amount) || 0;
        const yAmount = parseFloat(y.amount) || 0;
        const xDate = new Date(x.date || 0).getTime();
        const yDate = new Date(y.date || 0).getTime();
        const xName = (x.name || '').toLowerCase();
        const yName = (y.name || '').toLowerCase();

        switch (sort) {
            case 'date_asc':
                return xDate - yDate;
            case 'amount_desc':
                return yAmount - xAmount;
            case 'amount_asc':
                return xAmount - yAmount;
            case 'name_asc':
                return xName.localeCompare(yName);
            case 'name_desc':
                return yName.localeCompare(xName);
            case 'date_desc':
            default:
                return yDate - xDate;
        }
    });

    currentPage = 1;
    renderTable();
    updateTransactionActionStates();
}

function refreshTransactionCategoryOptions() {
    const dataList = document.getElementById('txCategoryOptions');
    if (!dataList) return;

    const backendCategories = allCategories
        .map(cat => String(cat.name || '').trim())
        .filter(Boolean);

    const txCategories = (transactionsLoadedFromBackend ? allTransactions : DEMO_TRANSACTIONS)
        .map(tx => String(tx.category || '').trim())
        .filter(Boolean);

    const uniqueCategories = [...new Set([...backendCategories, ...txCategories])]
        .sort((a, b) => a.localeCompare(b));

    dataList.innerHTML = uniqueCategories
        .map(cat => `<option value="${cat}"></option>`)
        .join('');
}

function refreshTransactionAccountOptions() {
    const accountSelect = document.getElementById('txAccountFilter');
    if (!accountSelect) return;

    const currentValue = accountSelect.value;
    const source = transactionsLoadedFromBackend ? allTransactions : DEMO_TRANSACTIONS;

    const accounts = [...new Set(
        source
            .map(tx => String(tx.account || '').trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    accountSelect.innerHTML = `
        <option value="">All Accounts</option>
        ${accounts.map(account => `<option value="${account}">${account}</option>`).join('')}
    `;

    if (accounts.includes(currentValue)) {
        accountSelect.value = currentValue;
    }
}

let txSearchDebounceTimer;

document.getElementById('txSearch').addEventListener('input', () => {
    clearTimeout(txSearchDebounceTimer);
    txSearchDebounceTimer = setTimeout(() => {
        applyFilters();
    }, 180);
});
document.getElementById('txTypeFilter').addEventListener('change', applyFilters);
document.getElementById('txAccountFilter').addEventListener('change', applyFilters);
document.getElementById('txSortFilter').addEventListener('change', applyFilters);
document.getElementById('txDateFromFilter').addEventListener('change', applyFilters);
document.getElementById('txDateToFilter').addEventListener('change', applyFilters);
document.getElementById('prevPage').addEventListener('click', () => { currentPage--; renderTable(); });
document.getElementById('nextPage').addEventListener('click', () => { currentPage++; renderTable(); });
document.querySelectorAll('.page-btn[data-pg]').forEach(b => {
    b.addEventListener('click', () => { currentPage = parseInt(b.dataset.pg); renderTable(); });
});

const txTableBody = document.getElementById('txTableBody');

if (txTableBody) {
    txTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-transaction-btn');
        const deleteBtn = e.target.closest('.delete-transaction-btn');

        if (editBtn) {
            const txId = editBtn.dataset.id;
            if (!txId) return;

            const source = transactionsLoadedFromBackend ? allTransactions : DEMO_TRANSACTIONS;
            const tx = source.find(item => String(item.id) === String(txId));
            if (!tx) return;

            openTransactionModal(tx);
            return;
        }

        if (deleteBtn) {
            const txId = deleteBtn.dataset.id;
            if (!txId) return;

            openDeleteTransactionModal(txId);
        }
    });
}

const advancedFiltersPanel = document.getElementById('advancedFiltersPanel');
const clearAdvancedFiltersBtn = document.getElementById('clearAdvancedFiltersBtn');

if (advancedFiltersBtn && advancedFiltersPanel) {
    advancedFiltersBtn.addEventListener('click', () => {
        advancedFiltersPanel.style.display =
            advancedFiltersPanel.style.display === 'none' || !advancedFiltersPanel.style.display
                ? 'block'
                : 'none';
    });
}

function clearAllTransactionFilters() {
    const txSearch = document.getElementById('txSearch');
    const txTypeFilter = document.getElementById('txTypeFilter');
    const txAccountFilter = document.getElementById('txAccountFilter');
    const txSortFilter = document.getElementById('txSortFilter');
    const txCategoryFilterSearch = document.getElementById('txCategoryFilterSearch');
    const txDateFromFilter = document.getElementById('txDateFromFilter');
    const txDateToFilter = document.getElementById('txDateToFilter');

    if (txSearch) txSearch.value = '';
    if (txTypeFilter) txTypeFilter.value = '';
    if (txAccountFilter) txAccountFilter.value = '';
    if (txSortFilter) txSortFilter.value = 'date_desc';
    if (txCategoryFilterSearch) txCategoryFilterSearch.value = '';
    if (txDateFromFilter) txDateFromFilter.value = '';
    if (txDateToFilter) txDateToFilter.value = '';

    setTransactionCategoryFilter('', '🏷️');

    filtered = [...(transactionsLoadedFromBackend ? allTransactions : DEMO_TRANSACTIONS)];
    currentPage = 1;
    applyFilters();

    if (advancedFiltersPanel) {
        advancedFiltersPanel.style.display = 'none';
    }

    if (txCategoryFilterModal) {
        closeTxCategoryFilterModal();
    }

    showToast('Filters cleared');
    updateTransactionActionStates();
}

if (clearAdvancedFiltersBtn) {
    clearAdvancedFiltersBtn.addEventListener('click', clearAllTransactionFilters);
}

if (clearAllTransactionFiltersBtn) {
    clearAllTransactionFiltersBtn.addEventListener('click', clearAllTransactionFilters);
}

// ══════════════════════════════════════
//  BUDGETS PAGE
// ══════════════════════════════════════
let allBudgets = [];

async function loadBudgets() {
    try {
        const res = await fetch(API + '/budgets');
        const data = await res.json();
        allBudgets = Array.isArray(data) ? data : [];

        if (!Array.isArray(data) || data.length === 0) return;

        renderBudgets(data);
        updateBudgetStats(data);
    } catch (err) {
        console.log('Using demo budgets');
    }
}

function renderBudgets(budgets) {
    const budgetsPage = document.getElementById('page-budgets');
    if (!budgetsPage) return;

    const grid = budgetsPage.querySelector('.budget-cards-grid');
    if (!grid) return;

    const colors = ['#10b981', '#f97316', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

    const formatShortDate = (dateValue) => {
        if (!dateValue) return '';
        const d = new Date(dateValue);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getDaysLeft = (endDateValue) => {
        if (!endDateValue) return '';
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const end = new Date(endDateValue);
        end.setHours(0, 0, 0, 0);

        const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

        if (diff < 0) return 'Ended';
        if (diff === 0) return 'Ends today';
        if (diff === 1) return '1 day left';
        return `${diff} days left`;
    };

    grid.innerHTML = budgets.map((b, i) => {
        const spent = parseFloat(b.spent || 0);
        const amount = parseFloat(b.amount || 0);
        const rawPct = amount > 0 ? Math.round((spent / amount) * 100) : 0;
        const pct = Math.min(rawPct, 100);
        const left = Math.max(amount - spent, 0);
        const cls =
            rawPct > 100 ? 'danger' :
            rawPct >= 75 ? 'warning' :
            'ok';
        const color = colors[i % colors.length];

        const startDate = b.period_start || b.start_date;
        const endDate = b.end_date;
        const days = b.period_days || b.days || 30;

        const periodText =
            startDate && endDate
                ? `${formatShortDate(startDate)} → ${formatShortDate(endDate)} · ${days} days`
                : `${days} days`;

        const daysLeft = getDaysLeft(endDate);

        const statusText =
            rawPct > 100 ? 'Over Budget' :
            rawPct === 100 ? 'At Limit' :
            rawPct >= 75 ? 'Near Limit' :
            'On Track';

        const txCount = b.transaction_count || b.tx_count || 0;

        return `
        <div class="budget-full-card premium-budget-card" style="--accent:${color}">
            <div class="bfc-top">
                <div style="display:flex;align-items:center;gap:10px;min-width:0">
                    <div class="bfc-icon" style="background:${color}22">💰</div>
                    <div style="min-width:0">
                        <p class="bfc-name">${b.category} <span class="budget-mini-tag">• ${days} days</span></p>
                        <p class="bfc-sub">${fmt(amount)} budget</p>
                    </div>
                </div>

                <button class="dots-btn edit-budget-btn" data-id="${b.id}">···</button>
            </div>

            <div class="budget-period-row">
                <span>${periodText}</span>
                <span>${daysLeft}</span>
            </div>

            <div class="budget-status-row">
                <span class="budget-status-badge ${cls}">${statusText}</span>
                <span class="budget-source-text">Spent from ${txCount} transaction${Number(txCount) === 1 ? '' : 's'}</span>
            </div>

            <div class="bfc-amounts">
                <span class="bfc-spent">${fmt(spent)}</span>
                <span class="bfc-total"> of ${fmt(amount)}</span>
            </div>

            <div class="progress-bar" style="margin:10px 0">
                <div class="progress-fill ${cls}" style="width:${pct}%"></div>
            </div>

            <div class="bfc-footer">
                <span class="bfc-left ${cls}">${fmt(left)} left</span>
                <span class="bfc-change">${pct}% used</span>
            </div>
        </div>`;
    }).join('');

    grid.querySelectorAll(".edit-budget-btn").forEach(button => {
        button.addEventListener("click", () => {
            const budgetId = button.dataset.id;
            const budget = allBudgets.find(item => String(item.id) === String(budgetId));
            if (!budget) return;

            openBudgetModal(budget);
        });
    });
}

function updateBudgetStats(budgets) {
    const budgetsPage = document.getElementById('page-budgets');
    if (!budgetsPage) return;

    const statValues = budgetsPage.querySelectorAll('.stats-row .stat-value');
    if (statValues.length < 3) return;

    const totalBudget = budgets.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
    const totalSpent = budgets.reduce((sum, b) => sum + parseFloat(b.spent || 0), 0);

    const positiveRemaining = budgets.reduce((sum, b) => {
        const amount = parseFloat(b.amount || 0);
        const spent = parseFloat(b.spent || 0);
        return sum + Math.max(amount - spent, 0);
    }, 0);

    const overBudget = budgets.reduce((sum, b) => {
        const amount = parseFloat(b.amount || 0);
        const spent = parseFloat(b.spent || 0);
        return sum + Math.max(spent - amount, 0);
    }, 0);

    const remaining = Math.max(positiveRemaining - overBudget, 0);

    statValues[0].textContent = fmt(totalBudget);
    statValues[1].textContent = fmt(totalSpent);
    statValues[2].textContent = fmt(remaining);

    const overBudgetEl = document.getElementById("budget-over-total");
    if (overBudgetEl) {
        overBudgetEl.textContent = fmt(overBudget);
    }
}

// ══════════════════════════════════════
//  GOALS PAGE
// ══════════════════════════════════════
async function loadGoals() {
    try {
        const res  = await fetch(API + '/goals');
        const data = await res.json();
        allGoals = Array.isArray(data) ? data : [];
        renderGoals(allGoals);
        updateGoalStats(allGoals);
    } catch (err) {
        console.log('Using demo goals');
    }
}

function getGoalStatus(goal, pct) {
    const target = parseFloat(goal.target_amount || 0);
    const savedRaw = goal.effective_saved_amount !== undefined ? goal.effective_saved_amount : goal.saved_amount;
    const saved = parseFloat(savedRaw || 0);
    const remaining = Math.max(target - saved, 0);
    const deadline = goal.deadline ? new Date(goal.deadline) : null;

    if (pct >= 100) {
        return { label: 'Completed', detail: 'Target reached', className: 'completed' };
    }

    if (!deadline || Number.isNaN(deadline.getTime())) {
        return { label: 'No timeline', detail: 'Add a target date', className: 'neutral' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
    const deadlineLabel = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const remainingRatio = target > 0 ? remaining / target : 0;

    if (daysLeft < 0 && remaining > 0) {
        return {
            label: 'Missed target',
            detail: `${fmt(remaining)} left after ${deadlineLabel}`,
            className: 'behind'
        };
    }

    if (
        remaining > 0 &&
        (
            daysLeft <= 7 ||
            (daysLeft <= 14 && remainingRatio >= 0.25) ||
            (daysLeft <= 30 && remainingRatio >= 0.5)
        )
    ) {
        return {
            label: 'Needs attention',
            detail: `${fmt(remaining)} left by ${deadlineLabel}`,
            className: 'attention'
        };
    }

    const created = goal.created_at ? new Date(goal.created_at) : null;
    if (!created || Number.isNaN(created.getTime())) {
        return pct >= 50
            ? { label: 'On track', detail: `${fmt(remaining)} left`, className: 'on-track' }
            : { label: 'Behind', detail: `${fmt(remaining)} left`, className: 'behind' };
    }

    created.setHours(0, 0, 0, 0);

    const totalDays = Math.max(1, Math.ceil((deadline - created) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(0, Math.ceil((today - created) / (1000 * 60 * 60 * 24)));
    const expectedPct = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

    if (pct >= expectedPct * 1.1) {
        return { label: 'Ahead', detail: `${fmt(remaining)} left`, className: 'ahead' };
    }

    if (pct >= expectedPct * 0.9) {
        return { label: 'On track', detail: `${fmt(remaining)} left`, className: 'on-track' };
    }

    return { label: 'Behind', detail: `${fmt(remaining)} left by ${deadlineLabel}`, className: 'behind' };
}

function getGoalMonthlyNeed(goal) {
    const target = parseFloat(goal.target_amount || 0);
    const savedRaw = goal.effective_saved_amount !== undefined ? goal.effective_saved_amount : goal.saved_amount;
    const saved = parseFloat(savedRaw || 0);
    const left = Math.max(target - saved, 0);
    const deadline = goal.deadline ? new Date(goal.deadline) : null;

    if (!deadline || Number.isNaN(deadline.getTime()) || left <= 0) {
        return 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthsLeft = Math.max(
        1,
        Math.ceil((deadline - today) / (1000 * 60 * 60 * 24 * 30))
    );

    return left / monthsLeft;
}

function getGoalReminder(goal) {
    const activityDate = goal.last_goal_activity_date || goal.created_at;
    if (!activityDate) return '';

    const activity = new Date(activityDate);
    if (Number.isNaN(activity.getTime())) return '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    activity.setHours(0, 0, 0, 0);

    const daysSince = Math.floor((today - activity) / (1000 * 60 * 60 * 24));

    if (daysSince < 7) return '';

    if (!goal.last_goal_activity_date) {
        return `You have not added savings to this goal in ${daysSince} days`;
    }

    return `You have not added to this goal in ${daysSince} days`;
}

function getGoalTargetLabel(deadlineValue) {
    if (!deadlineValue) return 'No target date';

    const deadline = new Date(deadlineValue);
    if (Number.isNaN(deadline.getTime())) return 'No target date';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);

    const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
    const dateLabel = deadline.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    let relativeLabel = '';

    if (daysLeft < 0) {
        const daysAgo = Math.abs(daysLeft);
        relativeLabel = daysAgo === 1 ? '1 day overdue' : `${daysAgo} days overdue`;
    } else if (daysLeft === 0) {
        relativeLabel = 'due today';
    } else if (daysLeft === 1) {
        relativeLabel = '1 day left';
    } else {
        relativeLabel = `${daysLeft} days left`;
    }

    return `Target ${dateLabel} • ${relativeLabel}`;
}

function updateGoalStats(goals) {
    const goalRows = Array.isArray(goals) ? goals : [];
    const totalSaved = goalRows.reduce((sum, goal) => {
        const saved = goal.effective_saved_amount !== undefined ? goal.effective_saved_amount : goal.saved_amount;
        return sum + parseFloat(saved || 0);
    }, 0);
    const targetTotal = goalRows.reduce((sum, goal) => sum + parseFloat(goal.target_amount || 0), 0);
    const remaining = Math.max(targetTotal - totalSaved, 0);
    const completed = goalRows.filter(goal => {
        const saved = goal.effective_saved_amount !== undefined ? goal.effective_saved_amount : goal.saved_amount;
        return parseFloat(saved || 0) >= parseFloat(goal.target_amount || 0);
    }).length;
    const pct = targetTotal > 0 ? Math.min(Math.round((totalSaved / targetTotal) * 100), 100) : 0;

    const totalSavedEl = document.getElementById('goals-total-saved');
    const targetTotalEl = document.getElementById('goals-target-total');
    const remainingEl = document.getElementById('goals-remaining-total');
    const completedEl = document.getElementById('goals-completed-count');
    const progressNoteEl = document.getElementById('goals-progress-note');
    const countNoteEl = document.getElementById('goals-count-note');
    const completeNoteEl = document.getElementById('goals-complete-note');
    const completedNoteEl = document.getElementById('goals-completed-note');

    if (totalSavedEl) totalSavedEl.textContent = fmt(totalSaved);
    if (targetTotalEl) targetTotalEl.textContent = fmt(targetTotal);
    if (remainingEl) remainingEl.textContent = fmt(remaining);
    if (completedEl) completedEl.textContent = `${completed}/${goalRows.length}`;
    if (progressNoteEl) progressNoteEl.textContent = goalRows.length ? 'Across active goals' : 'Build your plan';
    if (countNoteEl) countNoteEl.textContent = `Across ${goalRows.length} ${goalRows.length === 1 ? 'goal' : 'goals'}`;
    if (completeNoteEl) completeNoteEl.textContent = `${pct}% complete`;
    if (completedNoteEl) completedNoteEl.textContent = completed ? 'Nice progress' : 'Keep going';
}

function escapeGoalText(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function loadGoalContributionHistory(goalId) {
    const historyEl = document.querySelector(`[data-goal-history-id="${goalId}"]`);
    if (!historyEl || historyEl.dataset.loaded === "true") return;

    historyEl.innerHTML = `<p class="goal-muted-text">Loading history...</p>`;

    try {
        const response = await fetch(API + `/goals/${goalId}/contributions`);

        if (!response.ok) {
            throw new Error("Failed to load goal history");
        }

        const rows = await response.json();
        historyEl.dataset.loaded = "true";

        if (!Array.isArray(rows) || rows.length === 0) {
            historyEl.innerHTML = `<p class="goal-muted-text">No manual savings added yet.</p>`;
            return;
        }

        historyEl.innerHTML = rows.map(item => `
            <div class="goal-history-item">
                <div>
                    <strong>${fmt(parseFloat(item.amount || 0))}</strong>
                    <span>${item.note ? escapeGoalText(item.note) : 'Added savings'}</span>
                    <em class="goal-history-source ${item.history_type === 'transaction' ? 'transaction' : 'manual'}">
                        ${item.history_type === 'transaction' ? 'From transaction' : 'Manual'}
                    </em>
                </div>
                <time>${formatDate(item.date)}</time>
            </div>
        `).join("");
    } catch (error) {
        console.error("Error loading goal history:", error);
        historyEl.innerHTML = `<p class="goal-muted-text">Could not load history.</p>`;
    }
}

function fallbackGoalSuggestions(goal) {
    if (!goal) {
        return [{
            title: 'Add context',
            action: 'Add a few recent transactions so Money Coach can spot real savings opportunities.',
            why: 'Better data turns this from generic advice into a personal plan.'
        }];
    }

    const target = parseFloat(goal.target_amount || 0);
    const savedRaw = goal.effective_saved_amount !== undefined ? goal.effective_saved_amount : goal.saved_amount;
    const saved = parseFloat(savedRaw || 0);
    const left = Math.max(target - saved, 0);
    const monthlyNeed = getGoalMonthlyNeed(goal);
    const weeklyNeed = monthlyNeed / 4.35;

    if (left <= 0) {
        return [{
            title: 'Goal complete',
            action: 'Move new savings toward your next priority instead of letting extra money sit unassigned.',
            why: 'Finished goals should automatically turn into momentum for the next one.'
        }];
    }

    return [
        {
            title: 'This week',
            action: `Move ${fmt(weeklyNeed)} into this goal this week instead of waiting until month-end.`,
            why: 'Smaller weekly moves make the target feel easier and reduce last-minute pressure.'
        },
        {
            title: 'Tradeoff to try',
            action: `Choose one flexible purchase in ${goal.category || 'this category'} and redirect it into the goal.`,
            why: `Even one skipped expense can make ${goal.name || 'this goal'} feel active instead of distant.`
        },
        {
            title: 'Make it automatic',
            action: goal.auto_link_savings
                ? 'Check the automatically added amount after your next savings transaction and remove it if it matched the wrong category.'
                : 'Turn on Auto savings for this goal so matching savings are added without extra work.',
            why: 'Automation helps the goal keep moving even when you forget to update it manually.'
        }
    ];
}

function renderGoalSuggestions(targetEl, suggestions) {
    const cleanSuggestions = Array.isArray(suggestions) ? suggestions.filter(Boolean).slice(0, 3) : [];

    if (!targetEl) return;

    if (cleanSuggestions.length === 0) {
        targetEl.innerHTML = `<p class="goal-muted-text">No suggestions available yet.</p>`;
        return;
    }

    targetEl.innerHTML = cleanSuggestions.map(item => {
        if (typeof item === "string") {
            return `<div class="goal-suggestion-card"><p>${escapeGoalText(item)}</p></div>`;
        }

        return `
            <div class="goal-suggestion-card">
                <h5>${escapeGoalText(item.title || 'Smart move')}</h5>
                <p>${escapeGoalText(item.action || '')}</p>
                ${item.why ? `<small>${escapeGoalText(item.why)}</small>` : ''}
            </div>
        `;
    }).join("");
}

async function loadGoalCoachSuggestions(goalId, goal) {
    const suggestionsEl = document.querySelector(`[data-goal-suggestions-id="${goalId}"]`);
    if (!suggestionsEl || suggestionsEl.dataset.loaded === "true") return;

    suggestionsEl.innerHTML = `<p class="goal-muted-text">Money Coach is reviewing this goal...</p>`;

    try {
        const response = await fetch(API + `/goals/${goalId}/suggestions`);

        if (!response.ok) {
            throw new Error("Failed to load Money Coach suggestions");
        }

        const data = await response.json();
        suggestionsEl.dataset.loaded = "true";
        renderGoalSuggestions(suggestionsEl, data.suggestions);
    } catch (error) {
        console.error("Error loading goal suggestions:", error);
        suggestionsEl.dataset.loaded = "true";
        renderGoalSuggestions(suggestionsEl, fallbackGoalSuggestions(goal));
    }
}

function animateGoalProgressBars(scope = document) {
    const fills = scope.querySelectorAll('.goal-progress-bar .progress-fill[data-progress]');

    fills.forEach(fill => {
        const progress = fill.dataset.progress || '0';
        fill.style.width = '0%';

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                fill.style.width = `${progress}%`;
            });
        });
    });
}

function clearGoalSavingsAnimation(scope = document) {
    setTimeout(() => {
        scope.querySelectorAll('.goal-added-pop').forEach(item => item.remove());
        recentGoalSavingsAnimation = null;
    }, 1800);
}

function renderGoals(goals) {
    const grid = document.querySelector('.goals-page-grid');
    if (!grid) return;

    if (!goals || goals.length === 0) {
        grid.innerHTML = `
            <div class="premium-empty-state goals-empty-state">
                <div class="premium-empty-state-icon">🎯</div>
                <h3 class="premium-empty-state-title">No goals yet</h3>
                <p class="premium-empty-state-text">Create your first goal and FinTrack will track your progress here.</p>
            </div>
        `;
        return;
    }

    const colors = ['#10b981','#3b82f6','#f97316','#8b5cf6', '#ec4899', '#14b8a6'];
    grid.innerHTML = goals.map((g, i) => {
        const target = parseFloat(g.target_amount || 0);
        const manualSavedRaw = g.manual_saved_amount !== undefined ? g.manual_saved_amount : g.saved_amount;
        const effectiveSavedRaw = g.effective_saved_amount !== undefined ? g.effective_saved_amount : g.saved_amount;
        const manualSaved = parseFloat(manualSavedRaw || 0);
        const linkedSavings = parseFloat(g.linked_savings_amount || 0);
        const saved = parseFloat(effectiveSavedRaw || 0);
        const pct    = target > 0 ? Math.min(Math.round((saved / target) * 100), 100) : 0;
        const left   = Math.max(target - saved, 0);
        const color  = colors[i % colors.length];
        const targetLabel = getGoalTargetLabel(g.deadline);
        const status = getGoalStatus(g, pct);
        const monthlyNeed = getGoalMonthlyNeed(g);
        const reminderText = getGoalReminder(g);
        const categoryName = g.category || 'Savings';
        const categoryIcon = getCategoryIcon(categoryName);
        const displayIcon = g.icon || categoryIcon || '🎯';
        const safeCategoryName = escapeGoalText(categoryName);
        const showAddedPop = recentGoalSavingsAnimation && String(recentGoalSavingsAnimation.goalId) === String(g.id);
        return `
        <div class="goal-page-card premium-goal-card">
            <div class="gpc-color-bar" style="background:${color}"></div>
            <div class="gpc-body">
                <div class="gpc-top">
                    <div class="goal-title-group">
                        <div class="goal-icon-wrap premium-goal-icon" style="background:${color}22;color:${color};">${displayIcon}</div>
                        <div>
                            <p class="gpc-name">${g.name}</p>
                            <p class="gpc-date">${targetLabel}</p>
                            <span class="goal-category-chip">${categoryIcon} ${categoryName}</span>
                        </div>
                    </div>
                    <div class="goal-card-actions">
                        <div class="goal-status-stack">
                            <span class="status-badge ${status.className}">${status.label}</span>
                        </div>
                        <button class="dots-btn edit-goal-btn" data-id="${g.id}" title="Edit goal">✎</button>
                        <button class="dots-btn delete-goal-btn" data-id="${g.id}" title="Delete goal">✕</button>
                    </div>
                </div>
                <div class="gpc-amounts">
                    <span class="gpc-saved">Saved: ${fmt(saved)}</span><span class="gpc-target"> / ${fmt(target)}</span>
                    ${showAddedPop ? `<span class="goal-added-pop">+${fmt(recentGoalSavingsAnimation.amount)} added</span>` : ''}
                </div>
                <div class="progress-bar goal-progress-bar"><div class="progress-fill ok" data-progress="${pct}" style="width:0%;background:${color}"></div></div>
                <div class="gpc-footer"><span>${pct}% complete</span><span>${fmt(left)} to go</span></div>
                ${g.auto_link_savings && linkedSavings > 0 ? '<p class="goal-auto-hint">Includes automatic savings</p>' : ''}
                <div class="gpc-contrib"><span>Save ${fmt(monthlyNeed)}/month to reach goal</span></div>
                ${reminderText ? `<p class="goal-reminder">${reminderText}</p>` : ''}
                <button type="button" class="goal-breakdown-toggle" data-id="${g.id}">View details</button>
                <div class="goal-savings-breakdown" data-breakdown-id="${g.id}" hidden>
                    <section class="goal-detail-section">
                        <h4>Savings details</h4>
                        <div class="goal-detail-row"><span>You added</span><strong>${fmt(manualSaved)}</strong></div>
                        <div class="goal-detail-row"><span>Automatically added</span><strong>${fmt(linkedSavings)}</strong></div>
                        <div class="goal-detail-row goal-auto-control-row">
                            <span>Auto savings for ${safeCategoryName}</span>
                            <strong>${g.auto_link_savings ? 'ON' : 'OFF'}</strong>
                        </div>
                        ${g.auto_link_savings ? '<p class="goal-detail-note">FinTrack automatically adds matching savings to this goal.</p>' : ''}
                    </section>
                    <section class="goal-detail-section">
                        <h4>History</h4>
                        <div class="goal-history-list" data-goal-history-id="${g.id}">
                            <p class="goal-muted-text">Open details to load history.</p>
                        </div>
                    </section>
                    <section class="goal-detail-section">
                        <h4>Money Coach Suggestions</h4>
                        <div class="goal-suggestion-list" data-goal-suggestions-id="${g.id}">
                            <p class="goal-muted-text">Open details to load Money Coach suggestions.</p>
                        </div>
                    </section>
                </div>
                <div class="goal-card-cta-row">
                    <button type="button" class="goal-contribute-btn" data-id="${g.id}">+ Add Savings</button>
                    <div class="goal-link-actions">
                        <span class="goal-link-badge ${g.auto_link_savings ? 'on' : 'off'}">
                            Auto savings: ${g.auto_link_savings ? 'ON' : 'OFF'}
                        </span>
                        <button
                            type="button"
                            class="goal-auto-toggle-btn ${g.auto_link_savings ? 'on' : ''}"
                            data-id="${g.id}"
                        >
                            ${g.auto_link_savings ? 'Turn off' : 'Turn on'}
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    animateGoalProgressBars(grid);
    if (recentGoalSavingsAnimation) {
        clearGoalSavingsAnimation(grid);
    }

    grid.querySelectorAll('.edit-goal-btn').forEach(button => {
        button.addEventListener('click', () => {
            const goal = allGoals.find(item => String(item.id) === String(button.dataset.id));
            if (goal) openGoalModal(goal);
        });
    });

    grid.querySelectorAll('.delete-goal-btn').forEach(button => {
        button.addEventListener('click', () => {
            openDeleteGoalModal(button.dataset.id);
        });
    });

    grid.querySelectorAll('.goal-contribute-btn').forEach(button => {
        button.addEventListener('click', () => {
            const goal = allGoals.find(item => String(item.id) === String(button.dataset.id));
            if (goal) openGoalContributionModal(goal);
        });
    });

    grid.querySelectorAll('.goal-breakdown-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const breakdown = grid.querySelector(`[data-breakdown-id="${button.dataset.id}"]`);
            if (!breakdown) return;

            const isHidden = breakdown.hasAttribute('hidden');
            if (isHidden) {
                breakdown.removeAttribute('hidden');
                button.textContent = 'Hide details';
                const goal = allGoals.find(item => String(item.id) === String(button.dataset.id));
                loadGoalContributionHistory(button.dataset.id);
                loadGoalCoachSuggestions(button.dataset.id, goal);
            } else {
                breakdown.setAttribute('hidden', '');
                button.textContent = 'View details';
            }
        });
    });

    grid.querySelectorAll('.goal-auto-toggle-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const goal = allGoals.find(item => String(item.id) === String(button.dataset.id));
            if (!goal) return;

            const enabled = !goal.auto_link_savings;
            button.disabled = true;
            button.textContent = enabled ? "Turning on..." : "Turning off...";

            try {
                await updateGoalAutoLink(goal, enabled);
                showToast(enabled
                    ? `Auto savings turned on for ${goal.category || "this goal"}`
                    : `Auto savings turned off for ${goal.category || "this goal"}`
                );
            } catch (error) {
                console.error("Error updating auto savings:", error);
                showToast("Could not update auto savings");
                button.disabled = false;
                button.textContent = enabled ? "Turn on" : "Turn off";
            }
        });
    });
}

// ══════════════════════════════════════
//  CSV UPLOAD — now sends to Flask
// ══════════════════════════════════════
document.getElementById('importCsvBtn').addEventListener('click', () => {
    document.getElementById('csvModal').style.display = 'flex';
});
document.getElementById('csvModalClose').addEventListener('click', () => {
    document.getElementById('csvModal').style.display = 'none';
});
document.getElementById('csvModalCancel').addEventListener('click', () => {
    document.getElementById('csvModal').style.display = 'none';
});
document.getElementById('csvModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('csvModal'))
        document.getElementById('csvModal').style.display = 'none';
});

const uploadZone   = document.getElementById('uploadZone');
const csvFileInput = document.getElementById('csvFileInput');
uploadZone.addEventListener('click', () => csvFileInput.click());
uploadZone.addEventListener('dragover',  (e) => { e.preventDefault(); uploadZone.style.borderColor = 'var(--green)'; });
uploadZone.addEventListener('dragleave', ()  => { uploadZone.style.borderColor = ''; });
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = '';
    if (e.dataTransfer.files[0]) uploadCSV(e.dataTransfer.files[0]);
});
csvFileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) uploadCSV(e.target.files[0]);
});

async function uploadCSV(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
        uploadZone.innerHTML = '<p>⏳ Uploading...</p>';
        const res  = await fetch(API + '/upload-csv', { method:'POST', body: formData });
        const data = await res.json();
        alert('✅ ' + data.message + '\nSource detected: ' + data.source);
        document.getElementById('csvModal').style.display = 'none';
        loadDashboard();
        loadTransactions();
    } catch (err) {
        alert('❌ Upload failed. Make sure Flask is running.');
    }
}

// ── CHART TABS ──
document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const card = tab.closest('.chart-card') || tab.closest('.card');
        if (card) card.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        if (card && card.classList.contains('investment-chart-card')) {
            buildPortfolioChart();
        }

        if (card && card.querySelector('#holdingsTableBody')) {
            currentInvestmentHoldingFilter = tab.textContent.trim();
            renderHoldingsTable(allInvestmentHoldings, investmentCurrentTotalValue);
        }
    });
});

// ══════════════════════════════════════
//  INVESTMENTS — Real stock prices
// ══════════════════════════════════════
function signedMoney(value) {
    const amount = parseFloat(value || 0);
    const sign = amount >= 0 ? '+' : '-';
    return `${sign}${fmt(amount)}`;
}

function pctText(value) {
    const pct = parseFloat(value);
    if (!Number.isFinite(pct)) return '';

    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
}

let investmentSimulatorPortfolioValue = 0;
let investmentSimulatorReady = false;
let allInvestmentHoldings = [];
let investmentCurrentTotalValue = 0;
let currentInvestmentHoldingFilter = 'All';
let dividendTrackerReady = false;
let dividendTrackerState = { annualTotal: 0, portfolioValue: 0, portfolioYield: 0 };
let investmentAlertsState = [];
let investmentAlertsExpanded = false;
const investmentTargetAllocations = {
    AAPL: 35,
    MSFT: 25,
    VOO: 40
};

async function loadInvestments() {
    try {
        const res  = await fetch(API + '/investments');
        const data = await res.json();
        const holdings = Array.isArray(data.holdings) ? data.holdings : [];
        const totalValue = parseFloat(data.total_value || 0);
        const todayChange = parseFloat(data.today_change || 0);
        const totalReturn = parseFloat(data.total_return || 0);
        const totalInvested = parseFloat(data.total_invested || 0);
        const returnPct = Number.isFinite(parseFloat(data.total_return_pct))
            ? parseFloat(data.total_return_pct)
            : totalInvested > 0 ? (totalReturn / totalInvested) * 100 : null;
        allInvestmentHoldings = holdings;
        investmentCurrentTotalValue = totalValue;

        // Update stat cards
        document.querySelector('#inv-total-value').textContent   = fmt(totalValue);

        const todayChangeEl = document.querySelector('#inv-today-change');
        const todayPct = Number.isFinite(parseFloat(data.today_change_pct)) ? parseFloat(data.today_change_pct) : null;
        if (todayChangeEl) {
            todayChangeEl.textContent = `${signedMoney(todayChange)}${todayPct === null ? '' : ` (${pctText(todayPct)})`}`;
            todayChangeEl.style.color = todayChange >= 0 ? 'var(--green)' : 'var(--red)';
        }

        const totalReturnEl = document.querySelector('#inv-total-return');
        if (totalReturnEl) {
            totalReturnEl.textContent = `${signedMoney(totalReturn)}${returnPct === null ? '' : ` (${pctText(returnPct)})`}`;
            totalReturnEl.style.color = totalReturn >= 0 ? 'var(--green)' : 'var(--red)';
        }

        document.querySelector('#inv-total-invested').textContent = fmt(totalInvested);
        const investedNote = document.querySelector('#inv-invested-note');
        if (investedNote) investedNote.textContent = `You invested ${fmt(totalInvested)}`;

        updateAllocationCard(holdings);
        updateHoldingsInsightStrip(holdings);
        updateInvestmentDecisionLayer(holdings, totalValue, totalReturn);
        setupInvestmentSimulator();
        updateInvestmentSimulator(totalValue);
        loadInvestmentGoalsCoverage(totalValue, holdings);
        updateInvestmentRiskPanel(holdings, totalValue);
        updateSectorBreakdown(holdings, totalValue);
        updateDividendTracker(holdings, totalValue);
        loadPortfolioNews(holdings);
        updateRebalancingTool(holdings, totalValue);
        updateTaxInsights(holdings);
        updatePerformanceAttribution(holdings);
        updateBenchmarkComparison(holdings, totalValue, totalInvested);
        updateInvestmentCopilotLayer(holdings, totalValue, totalReturn);
        setupInvestmentReportActions();

        renderHoldingsTable(holdings, totalValue);

    } catch(err) {
        console.log('Using demo investment data');
    }
}

function getFilteredInvestmentHoldings(holdings) {
    const rows = Array.isArray(holdings) ? holdings : [];
    const filter = currentInvestmentHoldingFilter;

    if (filter === 'Stocks') {
        return rows.filter(holding => String(holding.type || '').toLowerCase() === 'stock');
    }

    if (filter === 'ETFs') {
        return rows.filter(holding => String(holding.type || '').toLowerCase() === 'etf');
    }

    return rows;
}

function renderHoldingsTable(holdings, totalValue) {
    const tbody = document.querySelector('#holdingsTableBody');
    if (!tbody) return;

    const visibleHoldings = getFilteredInvestmentHoldings(holdings);
    updateHoldingsInsightStrip(visibleHoldings);

    if (!visibleHoldings.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10">
                    <div class="premium-empty-state" style="padding:40px 20px">
                        <div class="premium-empty-state-icon">📈</div>
                        <h3 class="premium-empty-state-title">No holdings found</h3>
                        <p class="premium-empty-state-text">Try switching the holdings filter.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = visibleHoldings.map(h => {
            const changeClass = h.day_change_pct >= 0 ? 'positive' : 'negative';
            const gainClass   = h.gain >= 0 ? 'positive' : 'negative';
            const initials    = h.symbol.slice(0, 2);
            const colors      = { AAPL:'#dcfce7;color:#16a34a', VOO:'#dbeafe;color:#1d4ed8', MSFT:'#f3e8ff;color:#7c3aed' };
            const col         = colors[h.symbol] || '#f3f4f6;color:#374151';
            const allocationPct = totalValue > 0 ? (parseFloat(h.total_value || 0) / totalValue) * 100 : 0;
            const fundamentals = getHoldingFundamentals(h.symbol);
            const trend = getHoldingSparkline(h.symbol, h.day_change_pct);
            const sparkline = renderSparkline(trend, changeClass);
            const marketBenchmark = 18;
            const performanceClass = parseFloat(h.gain_pct || 0) >= marketBenchmark ? 'beats-market' : 'under-market';
            const rowBadges = [
                allocationPct > 40 ? '<span class="holding-mini-label high">High weight</span>' : '',
                parseFloat(h.gain_pct || 0) < 0 ? '<span class="holding-mini-label review">Needs review</span>' : ''
            ].filter(Boolean).join('');
            const escapedName = escapeGoalText(h.name);
            const escapedSymbol = escapeGoalText(h.symbol);
            const ratingClass = String(fundamentals.rating || '').toLowerCase();

            return `<tr class="holding-row ${performanceClass}" data-symbol="${escapedSymbol}">
                <td><div class="tx-cell-name">
                    <div class="invest-avatar" style="background:${col.split(';')[0].replace('background:','')};color:${col.split('color:')[1]};border-radius:8px">${initials}</div>
                    <div>
                        <p class="tx-cell-title">${escapedName}</p>
                        <p class="tx-meta" style="font-size:11px">${escapedSymbol}
                            <span class="cat-badge" style="font-size:10px;padding:1px 6px">${h.type}</span>
                            ${rowBadges}
                        </p>
                    </div>
                </div></td>
                <td>${fmt(h.price)}</td>
                <td>${h.shares}</td>
                <td>${fmt(h.avg_cost)}</td>
                <td><strong>${fmt(h.total_value)}</strong></td>
                <td>
                    <span class="holding-gain ${gainClass}">${signedMoney(h.gain)}</span>
                    <span class="holding-gain-pct">${pctText(h.gain_pct)}</span>
                </td>
                <td>${fundamentals.dividendYield}</td>
                <td>${fundamentals.pe}</td>
                <td><span class="analyst-rating ${ratingClass}">${fundamentals.rating}</span></td>
                <td>${sparkline}</td>
            </tr>
            <tr class="holding-detail-row" data-detail-for="${escapedSymbol}" style="display:none">
                <td colspan="10">
                    <div class="holding-detail-drawer">
                        <div>
                            <p class="holding-detail-label">Position</p>
                            <strong>${escapedName}</strong>
                            <span>${escapedSymbol} · ${h.type}</span>
                        </div>
                        <div>
                            <p class="holding-detail-label">Cost Basis</p>
                            <strong>${fmt(parseFloat(h.avg_cost || 0) * parseFloat(h.shares || 0))}</strong>
                            <span>Avg. cost ${fmt(h.avg_cost)} per share</span>
                        </div>
                        <div>
                            <p class="holding-detail-label">Performance</p>
                            <strong class="${gainClass}">${signedMoney(h.gain)} (${pctText(h.gain_pct)})</strong>
                            <span>${performanceClass === 'beats-market' ? 'Beating market benchmark' : 'Under market benchmark'}</span>
                        </div>
                        <div>
                            <p class="holding-detail-label">Research Snapshot</p>
                            <strong>${fundamentals.rating}</strong>
                            <span>Dividend ${fundamentals.dividendYield} · P/E ${fundamentals.pe}</span>
                        </div>
                    </div>
                </td>
            </tr>`;
    }).join('');

    tbody.querySelectorAll('.holding-row').forEach(row => {
        row.addEventListener('click', () => {
            const symbol = row.dataset.symbol;
            const detail = Array.from(tbody.querySelectorAll('.holding-detail-row'))
                .find(item => item.dataset.detailFor === symbol);
            if (!detail) return;

            const isOpen = detail.style.display !== 'none';
            tbody.querySelectorAll('.holding-detail-row').forEach(item => item.style.display = 'none');
            tbody.querySelectorAll('.holding-row').forEach(item => item.classList.remove('expanded'));

            if (!isOpen) {
                detail.style.display = 'table-row';
                row.classList.add('expanded');
            }
        });
    });
}

function getHoldingFundamentals(symbol) {
    const fallback = { dividendYield: '—', pe: '—', rating: 'Hold' };
    const data = {
        AAPL: { dividendYield: '0.4%', pe: '35.8', rating: 'Buy' },
        MSFT: { dividendYield: '0.7%', pe: '31.4', rating: 'Buy' },
        VOO: { dividendYield: '1.2%', pe: '24.6', rating: 'Hold' },
        NVDA: { dividendYield: '0.0%', pe: '47.2', rating: 'Buy' },
        TSLA: { dividendYield: '0.0%', pe: '68.5', rating: 'Hold' },
        META: { dividendYield: '0.4%', pe: '26.1', rating: 'Buy' },
        GOOGL: { dividendYield: '0.5%', pe: '24.3', rating: 'Buy' },
        AMZN: { dividendYield: '0.0%', pe: '38.7', rating: 'Buy' }
    };

    return data[String(symbol || '').toUpperCase()] || fallback;
}

function parsePercentValue(value) {
    const parsed = parseFloat(String(value || '').replace('%', ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function getDividendSchedule(symbol) {
    const fallback = { months: [3, 6, 9, 12] };
    const data = {
        AAPL: { months: [2, 5, 8, 11] },
        MSFT: { months: [3, 6, 9, 12] },
        VOO: { months: [3, 6, 9, 12] },
        NVDA: { months: [3, 6, 9, 12] },
        META: { months: [3, 6, 9, 12] },
        GOOGL: { months: [3, 6, 9, 12] }
    };

    return data[String(symbol || '').toUpperCase()] || fallback;
}

function getNextDividendDate(monthNumber, fromDate = new Date()) {
    const currentYear = fromDate.getFullYear();
    const candidate = new Date(currentYear, monthNumber - 1, 15);
    candidate.setHours(0, 0, 0, 0);

    if (candidate < fromDate) {
        return new Date(currentYear + 1, monthNumber - 1, 15);
    }

    return candidate;
}

function getNextMonthStarts(count = 12, fromDate = new Date()) {
    const months = [];
    const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);

    for (let index = 0; index < count; index += 1) {
        months.push(new Date(start.getFullYear(), start.getMonth() + index, 1));
    }

    return months;
}

function formatDividendDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'No date';

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function buildDividendPayments(holdings) {
    const rows = Array.isArray(holdings) ? holdings : [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return rows.flatMap(holding => {
        const totalValue = parseFloat(holding.total_value || 0);
        const shares = parseFloat(holding.shares || 0);
        const yieldPct = parsePercentValue(getHoldingFundamentals(holding.symbol).dividendYield);
        const annualDividend = totalValue * (yieldPct / 100);
        const schedule = getDividendSchedule(holding.symbol);

        if (!annualDividend || !schedule.months.length || !shares) return [];

        const paymentAmount = annualDividend / schedule.months.length;

        return schedule.months.map(month => ({
            symbol: String(holding.symbol || '').toUpperCase(),
            name: holding.name || holding.symbol || 'Holding',
            shares,
            month,
            date: getNextDividendDate(month, today),
            amount: paymentAmount,
            perShare: shares > 0 ? paymentAmount / shares : 0,
            annualDividend,
            yieldPct
        }));
    }).sort((a, b) => a.date - b.date);
}

function setupDividendSimulator() {
    if (dividendTrackerReady) return;

    ['dividendReinvestYears', 'dividendGrowthRate', 'dividendMonthlyContribution'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', updateDividendReinvestmentSimulator);
        }
    });

    dividendTrackerReady = true;
}

function updateDividendReinvestmentSimulator() {
    const resultEl = document.getElementById('dividendReinvestResult');
    if (!resultEl) return;

    const years = Math.max(parseFloat(document.getElementById('dividendReinvestYears')?.value || 10), 1);
    const growthRate = Math.max(parseFloat(document.getElementById('dividendGrowthRate')?.value || 0), 0) / 100;
    const monthlyContribution = Math.max(parseFloat(document.getElementById('dividendMonthlyContribution')?.value || 0), 0);
    const annualTotal = dividendTrackerState.annualTotal;
    const portfolioYield = dividendTrackerState.portfolioYield / 100;
    const portfolioValue = dividendTrackerState.portfolioValue;

    if (!annualTotal || !portfolioYield) {
        resultEl.textContent = 'Add dividend-paying holdings to estimate reinvested income.';
        return;
    }

    const compoundRate = portfolioYield + growthRate;
    const futurePortfolioValue = portfolioValue +
        (monthlyContribution * years * 12) +
        (annualTotal * ((Math.pow(1 + compoundRate, years) - 1) / Math.max(compoundRate, 0.0001)));
    const projectedAnnualIncome = futurePortfolioValue * portfolioYield * Math.pow(1 + growthRate, years);
    const addedIncome = Math.max(projectedAnnualIncome - annualTotal, 0);

    resultEl.textContent =
        `With ${fmt(monthlyContribution)}/month added and dividends reinvested for ${years} years, annual income could grow from ${fmt(annualTotal)} to about ${fmt(projectedAnnualIncome)}. That is roughly ${fmt(addedIncome)} more per year.`;
}

function updateDividendTracker(holdings, totalValue) {
    const annualEl = document.getElementById('dividendAnnualTotal');
    const annualNoteEl = document.getElementById('dividendAnnualNote');
    const nextAmountEl = document.getElementById('dividendNextPayment');
    const nextDateEl = document.getElementById('dividendNextDate');
    const nextMathEl = document.getElementById('dividendNextMath');
    const receivedTotalEl = document.getElementById('dividendReceivedTotal');
    const receivedNoteEl = document.getElementById('dividendReceivedNote');
    const calendarEl = document.getElementById('dividendCalendarList');
    const calendarTotalEl = document.getElementById('dividendCalendarTotal');
    const badgeEl = document.getElementById('dividendTrackerBadge');

    if (!annualEl && !calendarEl) return;

    const rows = Array.isArray(holdings) ? holdings : [];
    const payments = buildDividendPayments(rows);
    const annualTotal = rows.reduce((sum, holding) => {
        const value = parseFloat(holding.total_value || 0);
        const yieldPct = parsePercentValue(getHoldingFundamentals(holding.symbol).dividendYield);
        return sum + (value * yieldPct / 100);
    }, 0);
    const portfolioYield = totalValue > 0 ? (annualTotal / totalValue) * 100 : 0;

    dividendTrackerState = { annualTotal, portfolioValue: totalValue, portfolioYield };
    setupDividendSimulator();

    if (annualEl) annualEl.textContent = fmt(annualTotal);
    if (annualNoteEl) {
        annualNoteEl.textContent = annualTotal
            ? `Estimated portfolio yield: ${portfolioYield.toFixed(2)}%`
            : 'No dividend income detected yet.';
    }

    if (badgeEl) {
        badgeEl.textContent = annualTotal > 0 ? 'Estimated' : 'No income yet';
        badgeEl.className = `portfolio-score-badge ${annualTotal > 0 ? 'strong' : 'balanced'}`;
    }

    const nextPayment = payments[0];
    if (nextAmountEl) nextAmountEl.textContent = fmt(nextPayment?.amount || 0);
    if (nextDateEl) {
        nextDateEl.textContent = nextPayment
            ? `${nextPayment.symbol} expected around ${formatDividendDate(nextPayment.date)}`
            : 'No upcoming payment found.';
    }
    if (nextMathEl) {
        nextMathEl.textContent = nextPayment
            ? `${fmt(nextPayment.perShare)} per share × ${nextPayment.shares.toLocaleString('en-US')} shares`
            : '';
    }

    if (receivedTotalEl) receivedTotalEl.textContent = fmt(annualTotal * 2.35);
    if (receivedNoteEl) {
        receivedNoteEl.textContent = annualTotal
            ? `Estimated from dividend income since Jan 2024, using current positions.`
            : 'Dividend history will appear once income is detected.';
    }

    if (calendarEl) {
        const monthTotals = new Map();
        payments.forEach(payment => {
            const key = payment.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            const current = monthTotals.get(key) || { amount: 0, symbols: new Set(), date: payment.date };
            current.amount += payment.amount;
            current.symbols.add(payment.symbol);
            monthTotals.set(key, current);
        });

        const nextTwelveMonths = getNextMonthStarts(12).map(date => {
            const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            return [key, monthTotals.get(key) || { amount: 0, symbols: new Set(), date }];
        });
        const nextTwelveMonthTotal = nextTwelveMonths.reduce((sum, [, item]) => sum + item.amount, 0);

        calendarEl.innerHTML = annualTotal
            ? nextTwelveMonths.map(([month, item]) => `
                <div class="dividend-calendar-row ${item.amount > 0 ? '' : 'empty'}">
                    <div>
                        <strong>${escapeGoalText(month)}</strong>
                        <span>${item.amount > 0 ? escapeGoalText(Array.from(item.symbols).join(', ')) : 'No dividends scheduled'}</span>
                    </div>
                    <p>${fmt(item.amount)}</p>
                </div>
            `).join('')
            : '<p class="investment-muted">Add dividend-paying holdings to see payments by month.</p>';

        if (calendarTotalEl) {
            calendarTotalEl.style.display = annualTotal ? 'flex' : 'none';
            calendarTotalEl.innerHTML = `
                <span>Total expected dividends next 12 months</span>
                <strong>${fmt(nextTwelveMonthTotal)}</strong>
            `;
        }
    }

    updateDividendReinvestmentSimulator();
}

function getFallbackPortfolioNews(holdings) {
    const rows = Array.isArray(holdings) ? holdings : [];
    const newsBySymbol = {
        AAPL: {
            title: 'Apple demand and services growth stay in focus',
            source: 'Portfolio Brief',
            summary: 'Relevant because AAPL is a major part of your portfolio and can move your daily returns.',
            impact: 'medium',
            sentiment: 'Bullish',
            published_at: new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString()
        },
        MSFT: {
            title: 'Microsoft earnings may hinge on cloud and AI spending',
            source: 'Earnings Desk',
            summary: 'This is a high-impact watch item because cloud growth can affect MSFT sentiment quickly.',
            impact: 'high',
            sentiment: 'Neutral',
            published_at: new Date(Date.now() - (4 * 60 * 60 * 1000)).toISOString()
        },
        VOO: {
            title: 'S&P 500 investors watch inflation and rate expectations',
            source: 'Index Brief',
            summary: 'Relevant because VOO reflects broad market moves across your portfolio.',
            impact: 'medium',
            sentiment: 'Neutral',
            published_at: new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString()
        }
    };

    return rows.slice(0, 5).map(holding => {
        const symbol = String(holding.symbol || '').toUpperCase();
        const item = newsBySymbol[symbol] || {
            title: `${symbol} portfolio update`,
            source: 'Portfolio Brief',
            summary: 'This update is included because you hold this asset.',
            impact: 'low'
        };

        return {
            symbol,
            name: holding.name || symbol,
            title: item.title,
            source: item.source,
            summary: item.summary,
            impact: item.impact,
            sentiment: item.sentiment,
            published_at: item.published_at,
            url: ''
        };
    });
}

function getFallbackEarnings(holdings) {
    const dates = {
        AAPL: '2026-05-02',
        MSFT: '2026-04-30',
        VOO: null
    };

    return (Array.isArray(holdings) ? holdings : [])
        .map(holding => ({
            symbol: String(holding.symbol || '').toUpperCase(),
            name: holding.name || holding.symbol,
            date: dates[String(holding.symbol || '').toUpperCase()],
            event: dates[String(holding.symbol || '').toUpperCase()] ? 'Earnings' : 'No earnings date'
        }));
}

function formatNewsDate(value) {
    if (!value) return '1d ago';

    const date = typeof value === 'number'
        ? new Date(value * 1000)
        : new Date(value);

    if (Number.isNaN(date.getTime())) return '1d ago';

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function inferPortfolioNewsSymbol(item, holdings) {
    const title = String(item.title || '').toLowerCase();
    const symbols = new Set((Array.isArray(holdings) ? holdings : []).map(h => String(h.symbol || '').toUpperCase()));

    if ((title.includes('microsoft') || title.includes('msft')) && symbols.has('MSFT')) return 'MSFT';
    if ((title.includes('apple') || title.includes('iphone') || title.includes('aapl')) && symbols.has('AAPL')) return 'AAPL';
    if ((title.includes('s&p') || title.includes('index') || title.includes('market')) && symbols.has('VOO')) return 'VOO';

    return String(item.symbol || '').toUpperCase();
}

function getNewsSentiment(item) {
    const explicit = String(item.sentiment || '').toLowerCase();
    if (['bullish', 'bearish', 'neutral'].includes(explicit)) {
        return explicit;
    }

    const title = String(item.title || '').toLowerCase();
    const bullishWords = ['breakout', 'growth', 'rally', 'beat', 'upside', 'strong', 'record'];
    const bearishWords = ['lawsuit', 'miss', 'cut', 'slump', 'drop', 'warning', 'risk', 'probe'];

    if (bullishWords.some(word => title.includes(word))) return 'bullish';
    if (bearishWords.some(word => title.includes(word))) return 'bearish';

    return 'neutral';
}

function renderPortfolioNews(data, holdings) {
    const newsList = document.getElementById('portfolioNewsList');
    const earningsList = document.getElementById('portfolioEarningsList');
    const countEl = document.getElementById('portfolioNewsCount');
    const badgeEl = document.getElementById('portfolioNewsBadge');
    const alertCard = document.getElementById('portfolioNewsAlert');
    const alertTitle = document.getElementById('portfolioNewsAlertTitle');
    const alertText = document.getElementById('portfolioNewsAlertText');

    const news = (Array.isArray(data?.news) && data.news.length ? data.news : getFallbackPortfolioNews(holdings))
        .map(item => ({
            ...item,
            symbol: inferPortfolioNewsSymbol(item, holdings),
            sentiment: getNewsSentiment(item)
        }));
    const earnings = Array.isArray(data?.earnings) && data.earnings.length ? data.earnings : getFallbackEarnings(holdings);
    const alerts = Array.isArray(data?.alerts) ? data.alerts : news.filter(item => item.impact === 'high');

    if (countEl) countEl.textContent = `${news.length} updates`;
    if (badgeEl) {
        badgeEl.textContent = alerts.length ? `${alerts.length} alert${alerts.length === 1 ? '' : 's'}` : 'Watching';
        badgeEl.className = `portfolio-score-badge ${alerts.length ? 'needs-attention' : 'balanced'}`;
    }

    if (alertCard) {
        const topAlert = alerts[0];
        alertCard.style.display = topAlert ? 'block' : 'none';
        if (topAlert && alertTitle && alertText) {
            alertTitle.textContent = topAlert.title || `${topAlert.symbol} needs review`;
            alertText.textContent = topAlert.message || `${topAlert.symbol} has a high-impact update to review.`;
        }
    }

    if (newsList) {
        newsList.innerHTML = news.length
            ? news.map(item => `
                <a class="portfolio-news-item ${item.impact === 'high' ? 'high-impact' : ''}" ${item.url ? `href="${escapeGoalText(item.url)}" target="_blank" rel="noreferrer"` : 'href="#"'}>
                    <div class="portfolio-news-symbol">${escapeGoalText(item.symbol)}</div>
                    <div>
                        <div class="portfolio-news-title-row">
                            <strong>${escapeGoalText(item.title)}</strong>
                            <span>${escapeGoalText(formatNewsDate(item.published_at))}</span>
                        </div>
                        <p>${escapeGoalText(item.summary || 'Relevant because this asset is in your portfolio.')}</p>
                        <div class="portfolio-news-meta">
                            <small>${escapeGoalText(item.source || 'Market source')} · ${escapeGoalText(item.impact || 'medium')} impact</small>
                            <em class="news-sentiment ${escapeGoalText(item.sentiment)}">${escapeGoalText(item.sentiment)}</em>
                        </div>
                    </div>
                </a>
            `).join('')
            : '<p class="investment-muted">Add holdings to see portfolio-specific news.</p>';
    }

    if (earningsList) {
        earningsList.innerHTML = earnings.length
            ? earnings.map(item => `
                <div class="portfolio-earnings-row">
                    <div>
                        <strong>${escapeGoalText(item.symbol)}</strong>
                        <span>${escapeGoalText(item.event || 'Earnings')}</span>
                    </div>
                    <p class="${item.date ? '' : 'muted'}">${item.date ? escapeGoalText(formatDividendDate(new Date(item.date))) : 'No date'}</p>
                </div>
            `).join('')
            : '<p class="investment-muted">No upcoming earnings dates for current ETF-only holdings.</p>';
    }
}

async function loadPortfolioNews(holdings) {
    try {
        const response = await fetch(API + '/investment-news');

        if (!response.ok) {
            throw new Error('Could not load investment news');
        }

        const data = await response.json();
        renderPortfolioNews(data, holdings);
    } catch (error) {
        console.error('Investment news fallback:', error);
        renderPortfolioNews({
            news: getFallbackPortfolioNews(holdings),
            earnings: getFallbackEarnings(holdings),
            alerts: getFallbackPortfolioNews(holdings).filter(item => item.impact === 'high')
        }, holdings);
    }
}

function getTargetAllocation(symbol) {
    return investmentTargetAllocations[String(symbol || '').toUpperCase()] || 0;
}

function updateRebalancingTool(holdings, totalValue) {
    const list = document.getElementById('rebalanceTargetList');
    const plan = document.getElementById('rebalancePlanCard');
    const rows = Array.isArray(holdings) ? holdings : [];

    if (!list) return;

    if (!rows.length || totalValue <= 0) {
        list.innerHTML = '<p class="investment-muted">Add holdings to compare target and current allocation.</p>';
        if (plan) plan.innerHTML = '<span>Suggested trades</span><p>No holdings available yet.</p>';
        return;
    }

    list.innerHTML = rows.map(holding => {
        const symbol = String(holding.symbol || '').toUpperCase();
        const currentPct = totalValue > 0 ? (parseFloat(holding.total_value || 0) / totalValue) * 100 : 0;
        const targetPct = getTargetAllocation(symbol);
        const gap = currentPct - targetPct;
        const gapClass = Math.abs(gap) < 1 ? 'balanced' : gap > 0 ? 'over' : 'under';

        return `
            <div class="rebalance-row">
                <div>
                    <strong>${escapeGoalText(symbol)}</strong>
                    <span>Current ${currentPct.toFixed(1)}%</span>
                </div>
                <label class="rebalance-target-input">
                    <small>Target</small>
                    <input type="number" min="0" max="100" step="1" value="${targetPct}" data-symbol="${escapeGoalText(symbol)}">
                    <small>%</small>
                </label>
                <div class="rebalance-bar">
                    <span style="width:${Math.min(currentPct, 100)}%"></span>
                </div>
                <em class="${gapClass}">${gap > 0 ? '+' : ''}${gap.toFixed(1)}%</em>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.rebalance-target-input input').forEach(input => {
        input.addEventListener('input', () => {
            const symbol = input.dataset.symbol;
            const value = Math.max(0, Math.min(100, parseFloat(input.value || 0)));
            investmentTargetAllocations[symbol] = value;
            updateRebalancingTool(allInvestmentHoldings, investmentCurrentTotalValue);
        });
    });

    renderRebalancePlan(rows, totalValue, false);
}

function renderRebalancePlan(holdings, totalValue, expanded = true) {
    const plan = document.getElementById('rebalancePlanCard');
    const rows = Array.isArray(holdings) ? holdings : allInvestmentHoldings;
    const value = totalValue || investmentCurrentTotalValue;

    if (!plan) return;

    if (!rows.length || value <= 0) {
        plan.innerHTML = '<span>Suggested trades</span><p>No holdings available yet.</p>';
        return;
    }

    const trades = rows.map(holding => {
        const symbol = String(holding.symbol || '').toUpperCase();
        const targetValue = value * (getTargetAllocation(symbol) / 100);
        const currentValue = parseFloat(holding.total_value || 0);
        const price = parseFloat(holding.price || 0);
        const dollarDiff = targetValue - currentValue;
        const shares = price > 0 ? Math.abs(dollarDiff / price) : 0;

        return {
            symbol,
            action: dollarDiff > 0 ? 'buy' : 'sell',
            amount: Math.abs(dollarDiff),
            shares
        };
    }).filter(item => item.amount >= 25 && item.shares >= 0.01);

    if (!trades.length) {
        plan.innerHTML = '<span>Suggested trades</span><p>Your portfolio is already close to the target allocation.</p>';
        return;
    }

    plan.innerHTML = `
        <span>${expanded ? 'Generated plan' : 'Suggested trades'}</span>
        <ul class="rebalance-trade-list">
            ${trades.map(item => `
                <li class="${item.action}">
                    <strong>${item.action === 'sell' ? 'Sell' : 'Buy'} ${item.shares.toFixed(2)} shares of ${escapeGoalText(item.symbol)}</strong>
                    <span>${item.action === 'sell' ? 'reduce by' : 'add'} ${fmt(item.amount)}</span>
                </li>
            `).join('')}
        </ul>
    `;
}

const generateRebalancePlanBtn = document.getElementById('generateRebalancePlanBtn');
if (generateRebalancePlanBtn) {
    generateRebalancePlanBtn.addEventListener('click', () => {
        renderRebalancePlan(allInvestmentHoldings, investmentCurrentTotalValue, true);
        showToast('Rebalancing plan generated');
    });
}

function getTaxLotInfo(symbol) {
    const data = {
        AAPL: { purchaseDate: '2025-01-15', shortRate: 0.24, longRate: 0.15 },
        MSFT: { purchaseDate: '2025-09-15', shortRate: 0.24, longRate: 0.15 },
        VOO: { purchaseDate: '2026-01-10', shortRate: 0.24, longRate: 0.15 }
    };

    return data[String(symbol || '').toUpperCase()] || { purchaseDate: '2026-01-01', shortRate: 0.24, longRate: 0.15 };
}

function getHoldingPeriodInfo(symbol) {
    const lot = getTaxLotInfo(symbol);
    const purchaseDate = new Date(lot.purchaseDate);
    const today = new Date();
    const longTermDate = new Date(purchaseDate);
    longTermDate.setFullYear(longTermDate.getFullYear() + 1);

    const isLongTerm = today > longTermDate;
    const daysUntilLongTerm = Math.max(0, Math.ceil((longTermDate - today) / (1000 * 60 * 60 * 24)));

    return { ...lot, purchaseDate, longTermDate, isLongTerm, daysUntilLongTerm };
}

function updateTaxInsights(holdings) {
    const shortEl = document.getElementById('taxShortTermGain');
    const longEl = document.getElementById('taxLongTermGain');
    const shortRateEl = document.getElementById('taxShortTermRate');
    const longRateEl = document.getElementById('taxLongTermRate');
    const list = document.getElementById('taxInsightList');
    const rows = Array.isArray(holdings) ? holdings : [];

    let shortGain = 0;
    let longGain = 0;

    const enriched = rows.map(holding => {
        const gain = parseFloat(holding.gain || 0);
        const taxInfo = getHoldingPeriodInfo(holding.symbol);

        if (taxInfo.isLongTerm) {
            longGain += gain;
        } else {
            shortGain += gain;
        }

        return { ...holding, gain, taxInfo };
    });

    if (shortEl) shortEl.textContent = fmt(shortGain);
    if (longEl) longEl.textContent = fmt(longGain);
    if (shortRateEl) shortRateEl.textContent = 'Taxed at ~24% ordinary income';
    if (longRateEl) longRateEl.textContent = 'Taxed at ~15% preferential rate';

    if (!list) return;

    if (!enriched.length) {
        list.innerHTML = '<p class="investment-muted">Add holdings to see tax insights.</p>';
        return;
    }

    const topGain = enriched.filter(item => item.gain > 0).sort((a, b) => b.gain - a.gain)[0];
    const topLoss = enriched.filter(item => item.gain < 0).sort((a, b) => a.gain - b.gain)[0];
    const waitCandidate = enriched
        .filter(item => !item.taxInfo.isLongTerm && item.gain > 0)
        .sort((a, b) => a.taxInfo.daysUntilLongTerm - b.taxInfo.daysUntilLongTerm)[0];
    const topTax = topGain
        ? topGain.gain * (topGain.taxInfo.isLongTerm ? topGain.taxInfo.longRate : topGain.taxInfo.shortRate)
        : 0;

    const insights = [];

    if (topGain) {
        insights.push(`
            <div class="tax-insight-row">
                <span>Sell today estimate</span>
                <strong>If you sell ${escapeGoalText(topGain.symbol)} today, estimated tax could be ${fmt(topTax)}.</strong>
                <p>Uses an assumed ${topGain.taxInfo.isLongTerm ? 'long-term' : 'short-term'} capital gains rate.</p>
            </div>
        `);
    }

    insights.push(`
            <div class="tax-insight-row">
                <span>Gain type</span>
                <strong>${fmt(shortGain)} short-term · ${fmt(longGain)} long-term</strong>
                <p>Short-term gains are generally taxed more heavily than long-term gains.</p>
            </div>
    `);

    if (topLoss && topGain) {
        insights.push(`
            <div class="tax-insight-row">
                <span>Tax loss harvesting</span>
                <strong>Selling ${escapeGoalText(topLoss.symbol)} could offset part of your ${escapeGoalText(topGain.symbol)} gains.</strong>
                <p>Check wash sale rules before acting.</p>
            </div>
        `);
    } else {
        insights.push(`
            <div class="tax-insight-row">
                <span>Tax loss harvesting</span>
                <strong>No loss-harvesting candidate found right now.</strong>
                <p>Your current demo holdings are showing unrealized gains.</p>
            </div>
        `);
    }

    if (waitCandidate) {
        insights.push(`
            <div class="tax-insight-row">
                <span>Best time to sell</span>
                <strong>Consider waiting until ${formatDividendDate(waitCandidate.taxInfo.longTermDate)} for ${escapeGoalText(waitCandidate.symbol)}.</strong>
                <p>That is when this estimated lot becomes long-term.</p>
            </div>
        `);
    } else {
        insights.push(`
            <div class="tax-insight-row">
                <span>Best time to sell</span>
                <strong>Your largest gain already appears long-term.</strong>
                <p>Still confirm exact lots before selling.</p>
            </div>
        `);
    }

    list.innerHTML = insights.join('');
}

function getMonthlyContributionShare(symbol) {
    const shares = {
        AAPL: 0.052,
        MSFT: -0.018,
        VOO: 0.026
    };

    return shares[String(symbol || '').toUpperCase()] || 0.02;
}

function updatePerformanceAttribution(holdings) {
    const list = document.getElementById('performanceAttributionList');
    const totalEl = document.getElementById('performanceAttributionTotal');
    const bestDayEl = document.getElementById('performanceBestDay');
    const worstDayEl = document.getElementById('performanceWorstDay');
    const bestMonthEl = document.getElementById('performanceBestMonth');
    const rows = Array.isArray(holdings) ? holdings : [];

    if (!list) return;

    if (!rows.length) {
        list.innerHTML = '<p class="investment-muted">Add holdings to see monthly performance attribution.</p>';
        return;
    }

    const attribution = rows.map(holding => {
        const value = parseFloat(holding.total_value || 0);
        const monthlyReturn = getMonthlyContributionShare(holding.symbol);
        const contribution = value * monthlyReturn;

        return {
            symbol: String(holding.symbol || '').toUpperCase(),
            name: holding.name || holding.symbol,
            contribution,
            monthlyReturn: monthlyReturn * 100
        };
    }).sort((a, b) => b.contribution - a.contribution);

    const totalContribution = attribution.reduce((sum, item) => sum + item.contribution, 0);
    const maxContribution = Math.max(...attribution.map(item => Math.abs(item.contribution)), 1);

    if (totalEl) {
        totalEl.classList.toggle('negative', totalContribution < 0);
        totalEl.innerHTML = `
            <span>Total this month</span>
            <strong>Your portfolio ${totalContribution >= 0 ? 'gained' : 'lost'} ${signedMoney(totalContribution)} this month</strong>
        `;
    }

    list.innerHTML = attribution.map(item => `
        <div class="attribution-row ${item.contribution >= 0 ? 'positive' : 'negative'}">
            <div>
                <strong>${escapeGoalText(item.symbol)} contributed ${signedMoney(item.contribution)}</strong>
                <span>${escapeGoalText(item.name)} · ${pctText(item.monthlyReturn)} this month</span>
            </div>
            <div class="attribution-bar">
                <span style="width:${Math.min((Math.abs(item.contribution) / maxContribution) * 100, 100)}%"></span>
            </div>
        </div>
    `).join('');

    if (bestDayEl) bestDayEl.textContent = `Apr 24 · ${signedMoney(totalContribution * 0.26)}`;
    if (worstDayEl) worstDayEl.textContent = `Apr 10 · ${signedMoney(-Math.abs(totalContribution * 0.14))}`;
    if (bestMonthEl) bestMonthEl.textContent = `April · ${signedMoney(totalContribution)}`;
}

function getBenchmarkReturns() {
    return [
        { label: '1M', portfolio: 2.7, benchmark: 1.4 },
        { label: '3M', portfolio: 9.4, benchmark: 5.5 },
        { label: '1Y', portfolio: 34.2, benchmark: 25.3 }
    ];
}

function updateBenchmarkComparison(holdings, totalValue, totalInvested) {
    const gapCard = document.getElementById('benchmarkGapCard');
    const rangeList = document.getElementById('benchmarkRangeList');
    const badge = document.getElementById('benchmarkStatusBadge');
    const rows = Array.isArray(holdings) ? holdings : [];

    if (!gapCard || !rangeList) return;

    if (!rows.length || totalInvested <= 0) {
        gapCard.innerHTML = '<span>S&P 500 gap</span><strong>No comparison yet.</strong><p>Add holdings to benchmark your portfolio.</p>';
        rangeList.innerHTML = '<p class="investment-muted">Add holdings to compare 1M, 3M, and 1Y performance.</p>';
        return;
    }

    const ranges = getBenchmarkReturns();
    const oneYear = ranges.find(item => item.label === '1Y') || ranges[ranges.length - 1];
    const dollarGap = totalInvested * ((oneYear.portfolio - oneYear.benchmark) / 100);
    const gapClass = dollarGap >= 0 ? 'positive' : 'negative';

    if (badge) {
        badge.textContent = dollarGap >= 0 ? 'Beating VOO' : 'Trailing VOO';
        badge.className = `portfolio-score-badge ${dollarGap >= 0 ? 'strong' : 'needs-attention'}`;
    }

    gapCard.className = `benchmark-gap-card ${gapClass}`;
    gapCard.innerHTML = `
        <span>S&P 500 gap</span>
        <strong>${dollarGap >= 0 ? 'You made' : 'You made'} ${fmt(dollarGap)} ${dollarGap >= 0 ? 'more' : 'less'} than if you just bought VOO</strong>
        <p>Based on the same ${oneYear.label} rolling comparison shown below.</p>
    `;

    rangeList.innerHTML = ranges.map(item => {
        const gap = item.portfolio - item.benchmark;
        const beat = gap >= 0;

        return `
            <div class="benchmark-range-row ${beat ? 'positive' : 'negative'}">
                <strong>${item.label}</strong>
                <span>Portfolio ${pctText(item.portfolio)}</span>
                <span>S&P 500 ${pctText(item.benchmark)}</span>
                <em>${beat ? '+' : ''}${gap.toFixed(1)}%</em>
            </div>
        `;
    }).join('');
}

function getInvestmentReportSnapshot() {
    const rows = Array.isArray(allInvestmentHoldings) ? allInvestmentHoldings : [];
    const totalValue = investmentCurrentTotalValue || rows.reduce((sum, holding) => sum + parseFloat(holding.total_value || 0), 0);
    const totalCost = rows.reduce((sum, holding) => {
        const shares = parseFloat(holding.shares || 0);
        const avgCost = parseFloat(holding.avg_cost || 0);
        return sum + (shares * avgCost);
    }, 0);
    const totalGain = rows.reduce((sum, holding) => sum + parseFloat(holding.gain || 0), 0);
    const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
    const best = rows.slice().sort((a, b) => parseFloat(b.gain_pct || 0) - parseFloat(a.gain_pct || 0))[0];
    const worst = rows.slice().sort((a, b) => parseFloat(a.gain_pct || 0) - parseFloat(b.gain_pct || 0))[0];
    const dividendAnnual = dividendTrackerState.annualTotal || rows.reduce((sum, holding) => {
        const yieldPct = parsePercentValue(getHoldingFundamentals(holding.symbol).dividendYield);
        return sum + (parseFloat(holding.total_value || 0) * yieldPct);
    }, 0);

    return { rows, totalValue, totalCost, totalGain, totalGainPct, best, worst, dividendAnnual };
}

function buildInvestmentReportHtml(type = 'monthly') {
    const snapshot = getInvestmentReportSnapshot();
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const title = type === 'annual' ? 'Annual Performance Summary' : 'Monthly Portfolio Report';
            const rows = snapshot.rows.map(holding => `
        <tr>
            <td>${escapeGoalText(holding.symbol)}</td>
            <td>${escapeGoalText(holding.name)}</td>
            <td>${fmt(holding.avg_cost)}</td>
            <td>${fmt(holding.total_value)}</td>
            <td>${signedMoney(holding.gain)}</td>
            <td>${pctText(holding.gain_pct)}</td>
            <td>${getHoldingFundamentals(holding.symbol).rating}</td>
        </tr>
    `).join('');

    return `
        <!doctype html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: Inter, Arial, sans-serif; color:#111827; margin:0; background:#f8fafc; }
                .page { padding:32px; }
                .brand-bar { height:8px; background:linear-gradient(90deg,#10b981,#14b8a6); }
                .report-header {
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:20px;
                    padding:24px 32px;
                    background:#ffffff;
                    border-bottom:1px solid #e5e7eb;
                }
                .brand {
                    display:flex;
                    align-items:center;
                    gap:12px;
                    color:#111827;
                    font-weight:900;
                    font-size:18px;
                }
                .brand-mark {
                    width:38px;
                    height:38px;
                    border-radius:12px;
                    display:inline-flex;
                    align-items:center;
                    justify-content:center;
                    background:linear-gradient(135deg,#10b981,#3b82f6);
                    color:#fff;
                    font-size:20px;
                    font-weight:900;
                }
                .report-date { color:#667085; font-size:12px; font-weight:800; }
                h1 { margin:0 0 6px; font-size:28px; }
                .muted { color:#667085; margin:0 0 24px; }
                .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin:24px 0; }
                .card { border:1px solid #e5e7eb; border-radius:16px; padding:16px; background:#fff; }
                .card span { display:block; color:#667085; font-size:12px; font-weight:700; }
                .card strong { display:block; margin-top:8px; font-size:22px; }
                table { width:100%; border-collapse:collapse; margin-top:18px; background:#fff; border-radius:16px; overflow:hidden; }
                th, td { padding:12px; border-bottom:1px solid #e5e7eb; text-align:left; font-size:13px; }
                th { color:#667085; font-size:11px; text-transform:uppercase; }
                .note { margin-top:24px; color:#667085; font-size:12px; line-height:1.5; }
                @media print { button { display:none; } body { background:#fff; } .page { padding:20px; } }
            </style>
        </head>
        <body>
            <div class="brand-bar"></div>
            <div class="report-header">
                <div class="brand"><span class="brand-mark">↗</span><span>FinTrack</span></div>
                <div class="report-date">${today}</div>
            </div>
            <main class="page">
                <h1>${title}</h1>
                <p class="muted">Professional portfolio summary generated by FinTrack.</p>
                <div class="grid">
                    <div class="card"><span>Portfolio value</span><strong>${fmt(snapshot.totalValue)}</strong></div>
                    <div class="card"><span>Total profit</span><strong>${signedMoney(snapshot.totalGain)}</strong></div>
                    <div class="card"><span>Total return</span><strong>${pctText(snapshot.totalGainPct)}</strong></div>
                    <div class="card"><span>Annual dividends</span><strong>${fmt(snapshot.dividendAnnual)}</strong></div>
                </div>
                <p><strong>Best holding:</strong> ${snapshot.best ? `${escapeGoalText(snapshot.best.symbol)} ${pctText(snapshot.best.gain_pct)}` : 'Not available'}</p>
                <p><strong>Watch item:</strong> ${snapshot.worst ? `${escapeGoalText(snapshot.worst.symbol)} ${pctText(snapshot.worst.gain_pct)}` : 'Not available'}</p>
                <table>
                    <thead><tr><th>Symbol</th><th>Name</th><th>Avg Cost</th><th>Value</th><th>Gain</th><th>Return</th><th>Rating</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="7">No holdings available.</td></tr>'}</tbody>
                </table>
                <p class="note">Educational summary only. Market data, tax estimates, and ratings should be verified before making financial decisions.</p>
            </main>
        </body>
        </html>
    `;
}

function openMonthlyPortfolioReport() {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
        showToast('Allow popups to preview the report');
        return;
    }

    reportWindow.document.write(buildInvestmentReportHtml('monthly'));
    reportWindow.document.close();
    reportWindow.focus();
    setTimeout(() => reportWindow.print(), 350);
}

function downloadAnnualPerformanceSummary() {
    const today = new Date().toISOString().split('T')[0];
    const html = buildInvestmentReportHtml('annual');
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fintrack-annual-performance-${today}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function exportInvestmentTaxCSV() {
    const rows = Array.isArray(allInvestmentHoldings) ? allInvestmentHoldings : [];
    if (!rows.length) {
        showToast('No holdings available to export');
        return;
    }

    const escapeCSV = value => {
        const str = String(value ?? '');
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const headers = [
        'Symbol',
        'Name',
        'Shares',
        'Avg Cost',
        'Current Price',
        'Cost Basis',
        'Market Value',
        'Unrealized Gain',
        'Gain Percent',
        'Purchase Date',
        'Gain Type',
        'Estimated Tax Rate',
        'Estimated Tax'
    ];
    const csvRows = rows.map(holding => {
        const shares = parseFloat(holding.shares || 0);
        const avgCost = parseFloat(holding.avg_cost || 0);
        const price = parseFloat(holding.price || 0);
        const costBasis = shares * avgCost;
        const marketValue = shares * price;
        const gain = parseFloat(holding.gain || (marketValue - costBasis));
        const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0;
        const taxInfo = getHoldingPeriodInfo(holding.symbol);
        const rate = taxInfo.isLongTerm ? taxInfo.longRate : taxInfo.shortRate;

        return [
            holding.symbol,
            holding.name,
            shares,
            avgCost.toFixed(2),
            price.toFixed(2),
            costBasis.toFixed(2),
            marketValue.toFixed(2),
            gain.toFixed(2),
            gainPct.toFixed(2),
            taxInfo.purchaseDate.toISOString().slice(0, 10),
            taxInfo.isLongTerm ? 'Long-term' : 'Short-term',
            `${(rate * 100).toFixed(0)}%`,
            Math.max(gain * rate, 0).toFixed(2)
        ].map(escapeCSV).join(',');
    });

    const today = new Date().toISOString().split('T')[0];
    downloadCSVFile(`fintrack-investment-tax-lots-${today}.csv`, [headers.join(','), ...csvRows].join('\n'));
    showToast('Tax CSV exported');
}

function exportPortfolioShareImage() {
    const snapshot = getInvestmentReportSnapshot();
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 675;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 1200, 675);
    gradient.addColorStop(0, '#ecfdf5');
    gradient.addColorStop(1, '#eff6ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.roundRect(70, 70, 1060, 535, 34);
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.font = '800 42px Inter, Arial';
    ctx.fillText('FinTrack Portfolio Wrapped', 110, 135);
    ctx.fillStyle = '#64748b';
    ctx.font = '700 22px Inter, Arial';
    ctx.fillText('Your investing snapshot', 110, 172);

    ctx.fillStyle = '#10b981';
    ctx.font = '900 74px Inter, Arial';
    ctx.fillText(fmt(snapshot.totalValue), 110, 285);
    ctx.fillStyle = '#111827';
    ctx.font = '800 28px Inter, Arial';
    ctx.fillText('Portfolio value', 115, 330);

    ctx.fillStyle = snapshot.totalGain >= 0 ? '#10b981' : '#ef4444';
    ctx.font = '900 42px Inter, Arial';
    ctx.fillText(`${signedMoney(snapshot.totalGain)} (${pctText(snapshot.totalGainPct)})`, 110, 410);
    ctx.fillStyle = '#64748b';
    ctx.font = '700 20px Inter, Arial';
    ctx.fillText('Total profit since purchase cost', 115, 444);

    ctx.fillStyle = '#111827';
    ctx.font = '800 28px Inter, Arial';
    ctx.fillText(`Best holding: ${snapshot.best ? `${snapshot.best.symbol} ${pctText(snapshot.best.gain_pct)}` : 'N/A'}`, 680, 255);
    ctx.fillText(`Annual dividends: ${fmt(snapshot.dividendAnnual)}`, 680, 315);
    ctx.fillText(`Holdings tracked: ${snapshot.rows.length}`, 680, 375);

    ctx.fillStyle = '#64748b';
    ctx.font = '700 18px Inter, Arial';
    ctx.fillText('Educational summary only. Generated in FinTrack.', 110, 555);

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `fintrack-portfolio-wrapped-${new Date().toISOString().split('T')[0]}.png`;
    link.click();
    showToast('Share image exported');
}

function setupInvestmentReportActions() {
    const actions = [
        ['monthlyPortfolioReportBtn', openMonthlyPortfolioReport],
        ['annualPerformanceReportBtn', downloadAnnualPerformanceSummary],
        ['taxDocumentExportBtn', exportInvestmentTaxCSV],
        ['portfolioShareImageBtn', exportPortfolioShareImage]
    ];

    actions.forEach(([id, handler]) => {
        const button = document.getElementById(id);
        if (!button || button.dataset.bound === 'true') return;
        button.dataset.bound = 'true';
        button.addEventListener('click', handler);
    });
}

function getInvestmentRedFlags(holdings, totalValue) {
    const rows = Array.isArray(holdings) ? holdings : [];
    const flags = [];

    rows.forEach(holding => {
        const symbol = String(holding.symbol || '').toUpperCase();
        const allocation = totalValue > 0 ? (parseFloat(holding.total_value || 0) / totalValue) * 100 : 0;
        const dayChange = parseFloat(holding.day_change_pct || 0);
        const target = getTargetAllocation(symbol);
        const drift = allocation - target;

        if (allocation > 40) {
            flags.push({
                tone: 'warning',
                title: `${symbol} concentration is high`,
                text: `${symbol} is ${allocation.toFixed(1)}% of your portfolio.`
            });
        }

        if (dayChange <= -3) {
            flags.push({
                tone: 'danger',
                title: `${symbol} dropped ${Math.abs(dayChange).toFixed(1)}% today`,
                text: 'Review news and earnings before adding more.'
            });
        }

        if (Math.abs(drift) > 5) {
            flags.push({
                tone: 'warning',
                title: `${symbol} drifted ${Math.abs(drift).toFixed(1)}% from target`,
                text: 'A rebalance reminder is active.'
            });
        }
    });

    return flags;
}

function getInvestmentAlerts(holdings, totalValue) {
    const rows = Array.isArray(holdings) ? holdings : [];
    const alerts = [];
    const totalDayChange = rows.reduce((sum, holding) => {
        const value = parseFloat(holding.total_value || 0);
        const pct = parseFloat(holding.day_change_pct || 0);
        return sum + (value * pct / 100);
    }, 0);
    const portfolioDropPct = totalValue > 0 ? (totalDayChange / totalValue) * 100 : 0;

    if (portfolioDropPct <= -3) {
        alerts.push({
            type: 'drop',
            title: 'Portfolio drop alert',
            text: `Your portfolio dropped ${Math.abs(portfolioDropPct).toFixed(1)}% today.`
        });
    }

    rows.forEach(holding => {
        const symbol = String(holding.symbol || '').toUpperCase();
        const price = parseFloat(holding.price || 0);
        const target = symbol === 'AAPL' ? 300 : symbol === 'MSFT' ? 450 : 700;
        const allocation = totalValue > 0 ? (parseFloat(holding.total_value || 0) / totalValue) * 100 : 0;
        const drift = Math.abs(allocation - getTargetAllocation(symbol));

        alerts.push({
            type: 'price',
            title: `${symbol} price alert`,
            text: price >= target
                ? `${symbol} hit ${fmt(target)}. Current price is ${fmt(price)}.`
                : `Notify when ${symbol} hits ${fmt(target)}. Current price is ${fmt(price)}.`
        });

        if (symbol === 'AAPL') {
            alerts.push({
                type: 'earnings',
                title: 'AAPL earnings reminder',
                text: 'AAPL reports earnings in 3 days.'
            });
        }

        if (drift > 5) {
            alerts.push({
                type: 'rebalance',
                title: `${symbol} rebalance reminder`,
                text: `${symbol} allocation drift is ${drift.toFixed(1)}%, above your 5% reminder threshold.`
            });
        }
    });

    return alerts.slice(0, 7);
}

function renderInvestmentAlerts() {
    const alertList = document.getElementById('investmentAlertList');
    const alertBadge = document.getElementById('investmentAlertBadge');
    if (!alertList) return;

    if (alertBadge) {
        alertBadge.textContent = `${investmentAlertsState.length} alert${investmentAlertsState.length === 1 ? '' : 's'}`;
        alertBadge.className = `portfolio-score-badge ${investmentAlertsState.length ? 'needs-attention' : 'strong'}`;
    }

    if (!investmentAlertsState.length) {
        alertList.innerHTML = '<p class="investment-muted">No alerts are active right now.</p>';
        return;
    }

    const visibleAlerts = investmentAlertsExpanded ? investmentAlertsState : investmentAlertsState.slice(0, 4);
    const hiddenCount = Math.max(investmentAlertsState.length - visibleAlerts.length, 0);

    alertList.innerHTML = `
        <div class="investment-alert-scroll ${investmentAlertsExpanded ? 'expanded' : ''}">
            ${visibleAlerts.map((alert, index) => `
                <div class="investment-alert-row ${escapeGoalText(alert.type)}">
                    <button
                        type="button"
                        class="investment-alert-dismiss"
                        data-alert-index="${index}"
                        aria-label="Dismiss alert"
                    >×</button>
                    <strong>${escapeGoalText(alert.title)}</strong>
                    <span>${escapeGoalText(alert.text)}</span>
                </div>
            `).join('')}
        </div>
        ${hiddenCount ? `
            <button type="button" class="investment-alert-view-all" id="investmentAlertViewAll">
                View all ${investmentAlertsState.length} alerts
            </button>
        ` : investmentAlertsExpanded && investmentAlertsState.length > 4 ? `
            <button type="button" class="investment-alert-view-all" id="investmentAlertViewAll">
                Show fewer alerts
            </button>
        ` : ''}
    `;
}

function updateInvestmentCopilotLayer(holdings, totalValue, totalReturn) {
    const reportEl = document.getElementById('weeklyPortfolioReport');
    const flagsEl = document.getElementById('investmentRedFlags');
    const alertList = document.getElementById('investmentAlertList');
    const alertBadge = document.getElementById('investmentAlertBadge');
    const rows = Array.isArray(holdings) ? holdings : [];

    if (!rows.length) return;

    const flags = getInvestmentRedFlags(rows, totalValue);
    const alerts = getInvestmentAlerts(rows, totalValue);
    investmentAlertsState = alerts;

    const largest = rows
        .map(holding => ({
            symbol: String(holding.symbol || '').toUpperCase(),
            value: parseFloat(holding.total_value || 0),
            pct: totalValue > 0 ? (parseFloat(holding.total_value || 0) / totalValue) * 100 : 0
        }))
        .sort((a, b) => b.pct - a.pct)[0];

    if (reportEl) {
        reportEl.textContent =
            `This week your portfolio is ${totalReturn >= 0 ? 'up overall' : 'down overall'}, led by ${largest.symbol} at ${largest.pct.toFixed(1)}% of total value. ${flags.length ? 'Main focus: review concentration and rebalance drift.' : 'No major red flags detected.'}`;
    }

    if (flagsEl) {
        flagsEl.classList.toggle('clean', flags.length === 0);
        flagsEl.innerHTML = flags.length
            ? `
                <span>Red flags detected</span>
                ${flags.slice(0, 3).map(flag => `<p><strong>${escapeGoalText(flag.title)}</strong> ${escapeGoalText(flag.text)}</p>`).join('')}
            `
            : '<span>No red flags</span><p>Your portfolio looks stable based on current demo checks.</p>';
    }

    if (alertList || alertBadge) renderInvestmentAlerts();
}

function formatInvestmentCopilotAnswer(answer) {
    if (!answer) return '';

    return answer
        .replace(/\* /g, '• ')
        .replace(/Short answer:/gi, '<h4>Short answer</h4><p>')
        .replace(/Why:/gi, '</p><h4>Why</h4><p>')
        .replace(/Next move:/gi, '</p><h4>Next move</h4><p>')
        .replace(/\n- /g, '<br>• ')
        .replace(/\n• /g, '<br>• ')
        .replace(/\n/g, '<br>') + '</p>';
}

const investmentCopilotAskBtn = document.getElementById('investmentCopilotAskBtn');
if (investmentCopilotAskBtn) {
    investmentCopilotAskBtn.addEventListener('click', async () => {
        const input = document.getElementById('investmentCopilotInput');
        const answerEl = document.getElementById('investmentCopilotAnswer');
        const question = input ? input.value.trim() : '';

        if (!question) {
            showToast('Ask the Copilot a portfolio question first');
            return;
        }

        investmentCopilotAskBtn.disabled = true;
        investmentCopilotAskBtn.textContent = 'Thinking...';

        try {
            const response = await fetch(API + '/investment-copilot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question,
                    holdings: allInvestmentHoldings,
                    goals: allGoals,
                    alerts: investmentAlertsState
                })
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Copilot failed');
            }

            if (answerEl) {
                answerEl.innerHTML = `<span>Copilot</span>${formatInvestmentCopilotAnswer(data.answer)}`;
            }
        } catch (error) {
            console.error('Investment Copilot error:', error);
            if (answerEl) {
                answerEl.innerHTML = `
                    <span>Copilot</span>
                    <h4>Short answer</h4>
                    <p>Review before acting.</p>
                    <h4>Why</h4>
                    <p>• The Copilot could not connect right now.<br>• Use allocation, risk, tax, and earnings context before selling.</p>
                    <h4>Next move</h4>
                    <p>Check MSFT concentration, tax impact, and upcoming earnings before trading.</p>
                `;
            }
        } finally {
            investmentCopilotAskBtn.disabled = false;
            investmentCopilotAskBtn.textContent = 'Ask';
        }
    });
}

document.querySelectorAll('.copilot-suggestion-btn').forEach(button => {
    button.addEventListener('click', () => {
        const input = document.getElementById('investmentCopilotInput');
        if (!input) return;

        input.value = button.textContent.trim();
        input.focus();
    });
});

document.addEventListener('click', event => {
    const dismissBtn = event.target.closest('.investment-alert-dismiss');
    if (dismissBtn) {
        const index = Number(dismissBtn.dataset.alertIndex);
        if (!Number.isNaN(index)) {
            investmentAlertsState.splice(index, 1);
            renderInvestmentAlerts();
            showToast('Alert dismissed');
        }
        return;
    }

    const viewAllBtn = event.target.closest('#investmentAlertViewAll');
    if (viewAllBtn) {
        investmentAlertsExpanded = !investmentAlertsExpanded;
        renderInvestmentAlerts();
    }
});

const addPriceAlertBtn = document.getElementById('addPriceAlertBtn');
if (addPriceAlertBtn) {
    addPriceAlertBtn.addEventListener('click', () => {
        const symbol = document.getElementById('priceAlertSymbol')?.value || 'AAPL';
        const target = parseFloat(document.getElementById('priceAlertTarget')?.value || 0);

        if (!target || target <= 0) {
            showToast('Enter a valid alert price');
            return;
        }

        investmentAlertsState.unshift({
            type: 'price',
            title: `${symbol} price alert`,
            text: `Notify when ${symbol} hits ${fmt(target)}.`
        });

        renderInvestmentAlerts();
        showToast(`${symbol} price alert added`);
    });
}

function getHoldingRiskMetrics(symbol) {
    const fallback = { beta: 1.0, volatility: 18, maxDrawdown: -12, sharpe: 0.8 };
    const data = {
        AAPL: { beta: 1.18, volatility: 23, maxDrawdown: -16, sharpe: 1.05 },
        MSFT: { beta: 0.92, volatility: 19, maxDrawdown: -13, sharpe: 1.12 },
        VOO: { beta: 1.00, volatility: 14, maxDrawdown: -9, sharpe: 0.94 },
        NVDA: { beta: 1.78, volatility: 38, maxDrawdown: -28, sharpe: 1.22 },
        TSLA: { beta: 2.05, volatility: 46, maxDrawdown: -35, sharpe: 0.62 },
        META: { beta: 1.24, volatility: 29, maxDrawdown: -21, sharpe: 1.02 },
        GOOGL: { beta: 1.05, volatility: 24, maxDrawdown: -18, sharpe: 0.96 },
        AMZN: { beta: 1.31, volatility: 30, maxDrawdown: -23, sharpe: 0.88 }
    };

    return data[String(symbol || '').toUpperCase()] || fallback;
}

function getHoldingSector(symbol) {
    const sectors = {
        AAPL: 'Technology',
        MSFT: 'Technology',
        NVDA: 'Technology',
        TSLA: 'Consumer',
        META: 'Communication',
        GOOGL: 'Communication',
        AMZN: 'Consumer',
        VOO: 'Broad Market'
    };

    return sectors[String(symbol || '').toUpperCase()] || 'Other';
}

function getSectorExposureForHolding(holding, value) {
    const symbol = String(holding.symbol || '').toUpperCase();

    if (symbol === 'VOO') {
        return {
            Technology: value * 0.29,
            Finance: value * 0.13,
            Healthcare: value * 0.12,
            Consumer: value * 0.10,
            Energy: value * 0.04,
            'Broad Market': value * 0.32
        };
    }

    return {
        [getHoldingSector(symbol)]: value
    };
}

function getSectorColor(sector) {
    const colors = {
        Technology: '#10b981',
        Finance: '#3b82f6',
        Healthcare: '#8b5cf6',
        Consumer: '#f97316',
        Communication: '#14b8a6',
        Industrials: '#64748b',
        Energy: '#f59e0b',
        'Broad Market': '#94a3b8',
        Other: '#cbd5e1'
    };

    return colors[sector] || colors.Other;
}

function updateSectorBreakdown(holdings, totalValue) {
    const canvas = document.getElementById('sectorBreakdownChart');
    const compareList = document.getElementById('sectorCompareList');
    const insightText = document.getElementById('sectorInsightText');
    const insightBadge = document.getElementById('sectorInsightBadge');
    const rows = Array.isArray(holdings) ? holdings : [];

    if (!canvas || !compareList || !insightText || !insightBadge) return;

    const benchmark = {
        Technology: 29,
        Finance: 13,
        Healthcare: 12,
        Consumer: 10,
        Communication: 8,
        Industrials: 8,
        Energy: 4,
        Other: 16
    };

    if (!rows.length || totalValue <= 0) {
        if (window.sectorChart) window.sectorChart.destroy();
        compareList.innerHTML = '';
        insightText.textContent = 'Add investments to see sector exposure.';
        insightBadge.textContent = 'No data';
        return;
    }

    const sectorTotals = {};
    rows.forEach(holding => {
        const value = parseFloat(holding.total_value || 0);
        const exposure = getSectorExposureForHolding(holding, value);

        Object.entries(exposure).forEach(([sector, sectorValue]) => {
            sectorTotals[sector] = (sectorTotals[sector] || 0) + sectorValue;
        });
    });

    const sectors = Object.entries(sectorTotals)
        .map(([sector, value]) => ({
            sector,
            pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
            benchmark: benchmark[sector] || benchmark.Other
        }))
        .sort((a, b) => b.pct - a.pct);

    const largestGap = sectors.reduce((top, item) => {
        const gap = item.pct - item.benchmark;
        return Math.abs(gap) > Math.abs(top.gap)
            ? { sector: item.sector, gap, pct: item.pct, benchmark: item.benchmark }
            : top;
    }, { sector: '', gap: 0, pct: 0, benchmark: 0 });

    const gapText = Math.abs(largestGap.gap).toFixed(1);
    const direction = largestGap.gap >= 0 ? 'overweight' : 'underweight';

    insightBadge.textContent = `${direction === 'overweight' ? 'Overweight' : 'Underweight'}`;
    insightBadge.className = `portfolio-score-badge ${Math.abs(largestGap.gap) > 20 ? 'needs-attention' : 'balanced'}`;
    const suggestion = largestGap.gap > 20
        ? 'Consider adding Healthcare or Consumer ETFs to balance your exposure.'
        : 'Your sector mix is close to the benchmark. Recheck before adding concentrated positions.';
    insightText.innerHTML = `
        <strong>You are ${gapText}% ${direction} in ${largestGap.sector} compared to the market.</strong>
        <span>${suggestion}</span>
    `;

    compareList.innerHTML = sectors.map(item => {
        const gap = item.pct - item.benchmark;
        const gapClass = gap >= 0 ? 'over' : 'under';
        return `
            <div class="sector-compare-row">
                <div>
                    <span class="sector-color-dot" style="background:${getSectorColor(item.sector)}"></span>
                    <strong>${item.sector}</strong>
                </div>
                <span>Your ${item.pct.toFixed(1)}%</span>
                <span>S&amp;P ${item.benchmark.toFixed(1)}%</span>
                <em class="${gapClass} ${Math.abs(gap) > 20 ? 'major' : ''}">
                    ${Math.abs(gap) > 20 ? '<b>!</b>' : ''}${gap >= 0 ? '+' : ''}${gap.toFixed(1)}%
                </em>
            </div>
        `;
    }).join('');

    if (window.sectorChart) window.sectorChart.destroy();

    window.sectorChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: sectors.map(item => item.sector),
            datasets: [{
                data: sectors.map(item => item.pct),
                backgroundColor: sectors.map(item => getSectorColor(item.sector)),
                borderWidth: 0,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.label}: ${Number(ctx.raw || 0).toFixed(1)}%`
                    }
                }
            }
        }
    });
}

function updateInvestmentRiskPanel(holdings, totalValue) {
    const metricsEl = document.getElementById('investmentRiskMetrics');
    const tableEl = document.getElementById('investmentRiskTable');
    const labelEl = document.getElementById('investmentRiskLabel');
    const rows = Array.isArray(holdings) ? holdings : [];

    if (!metricsEl || !tableEl || !labelEl) return;

    if (!rows.length || totalValue <= 0) {
        labelEl.textContent = 'No data';
        metricsEl.innerHTML = `
            <div class="risk-metric-card">
                <span>Risk Analysis</span>
                <strong>--</strong>
                <p>Add investments to see beta, volatility, drawdown, and Sharpe ratio.</p>
            </div>
        `;
        tableEl.innerHTML = '';
        return;
    }

    const enriched = rows.map(holding => {
        const weight = totalValue > 0 ? parseFloat(holding.total_value || 0) / totalValue : 0;
        return {
            symbol: holding.symbol || 'Asset',
            weight,
            ...getHoldingRiskMetrics(holding.symbol)
        };
    });

    const portfolioBeta = enriched.reduce((sum, item) => sum + item.beta * item.weight, 0);
    const portfolioVolatility = enriched.reduce((sum, item) => sum + item.volatility * item.weight, 0);
    const portfolioDrawdown = enriched.reduce((sum, item) => sum + item.maxDrawdown * item.weight, 0);
    const portfolioSharpe = enriched.reduce((sum, item) => sum + item.sharpe * item.weight, 0);
    const riskLabel =
        portfolioBeta > 1.3 || portfolioVolatility > 30 ? 'High risk' :
        portfolioBeta > 1.05 || portfolioVolatility > 20 ? 'Moderate risk' :
        'Lower risk';

    labelEl.textContent = riskLabel;
    labelEl.className = `portfolio-score-badge ${
        riskLabel === 'High risk' ? 'high-risk' :
        riskLabel === 'Moderate risk' ? 'needs-attention' :
        'strong'
    }`;

    metricsEl.innerHTML = `
        <div class="risk-metric-card">
            <span>Beta</span>
            <strong>${portfolioBeta.toFixed(2)}</strong>
            <p>${portfolioBeta > 1 ? 'Moves more than the market.' : 'Moves less than the market.'} A beta near 1 means market-like movement.</p>
        </div>
        <div class="risk-metric-card">
            <span>Volatility</span>
            <strong>${portfolioVolatility.toFixed(1)}%</strong>
            <p>Higher volatility means bigger ups and downs along the way.</p>
        </div>
        <div class="risk-metric-card">
            <span>Max Drawdown</span>
            <strong>${portfolioDrawdown.toFixed(1)}%</strong>
            <p>This estimates the kind of recent peak-to-low drop the portfolio could experience.</p>
        </div>
        <div class="risk-metric-card">
            <span>Sharpe Ratio</span>
            <strong>${portfolioSharpe.toFixed(2)}</strong>
            <p>Above 1 is generally healthier: more return for each unit of risk.</p>
        </div>
    `;

    tableEl.innerHTML = `
        <div class="risk-row risk-row-head">
            <span>Asset</span>
            <span>Beta</span>
            <span>Volatility</span>
            <span>Max Drawdown</span>
            <span>Sharpe</span>
        </div>
        ${enriched.map(item => `
            <div class="risk-row">
                <strong>${escapeGoalText(item.symbol)}</strong>
                <span>${item.beta.toFixed(2)}</span>
                <span>${item.volatility.toFixed(1)}%</span>
                <span>${item.maxDrawdown.toFixed(1)}%</span>
                <span>${item.sharpe.toFixed(2)}</span>
            </div>
        `).join('')}
    `;
}

function getHoldingSparkline(symbol, dayChangePct = 0) {
    const trends = {
        AAPL: [22, 24, 23, 28, 31, 34, 38, 41],
        VOO: [20, 21, 22, 24, 25, 27, 28, 30],
        MSFT: [34, 33, 31, 30, 29, 31, 32, 33]
    };
    const key = String(symbol || '').toUpperCase();

    if (trends[key]) return trends[key];

    return parseFloat(dayChangePct || 0) >= 0
        ? [20, 21, 22, 24, 23, 25, 27, 29]
        : [30, 29, 28, 27, 26, 27, 25, 24];
}

function renderSparkline(points, tone = 'positive') {
    const values = Array.isArray(points) && points.length ? points : [20, 22, 21, 24, 26];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const coords = values.map((value, index) => {
        const x = (index / (values.length - 1)) * 72;
        const y = 28 - ((value - min) / range) * 24;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return `
        <svg class="holding-sparkline ${tone}" viewBox="0 0 72 32" aria-hidden="true">
            <polyline points="${coords}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></polyline>
        </svg>
    `;
}

function getInvestmentAnalysis(holdings, totalValue, totalReturn = 0) {
    const rows = Array.isArray(holdings) ? holdings : [];
    const allocations = rows
        .map(holding => {
            const value = parseFloat(holding.total_value || 0);
            return {
                symbol: holding.symbol || holding.name || 'Asset',
                name: holding.name || holding.symbol || 'Asset',
                pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
                gainPct: parseFloat(holding.gain_pct),
                dayChangePct: parseFloat(holding.day_change_pct)
            };
        })
        .sort((a, b) => b.pct - a.pct);

    const techSymbols = new Set(['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'GOOGL', 'AMZN']);
    const techExposure = allocations.reduce((sum, item) => {
        return techSymbols.has(String(item.symbol || '').toUpperCase()) ? sum + item.pct : sum;
    }, 0);
    const hasNegativeHolding = allocations.some(item => {
        const gain = Number.isFinite(item.gainPct) ? item.gainPct : item.dayChangePct;
        return Number.isFinite(gain) && gain < 0;
    });
    const largest = allocations[0] || null;

    let score = 100;
    const reasons = [];

    if (largest && largest.pct > 50) {
        score -= 20;
        reasons.push(`${largest.symbol} is more than half of the portfolio`);
    } else if (largest && largest.pct > 40) {
        score -= 12;
        reasons.push(`${largest.symbol} is the largest position`);
    } else if (largest && largest.pct > 30) {
        score -= 8;
        reasons.push(`${largest.symbol} has elevated weight`);
    }

    if (techExposure > 70) {
        score -= 15;
        reasons.push('technology exposure is very high');
    } else if (techExposure > 60) {
        score -= 10;
        reasons.push('technology exposure is high');
    }

    if (rows.length < 3) {
        score -= 8;
        reasons.push('there are fewer than three holdings');
    }

    if (hasNegativeHolding) {
        score -= 5;
        reasons.push('one holding needs review');
    }

    if (parseFloat(totalReturn || 0) < 0) {
        score -= 5;
        reasons.push('total profit is negative');
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    const label =
        score >= 85 ? 'Strong' :
        score >= 70 ? 'Balanced' :
        score >= 50 ? 'Needs attention' :
        'High risk';

    return {
        allocations,
        largest,
        largestPct: largest ? largest.pct : 0,
        techExposure,
        hasNegativeHolding,
        score,
        label,
        reasons
    };
}

function updateInvestmentDecisionLayer(holdings, totalValue, totalReturn) {
    const analysis = getInvestmentAnalysis(holdings, totalValue, totalReturn);
    const scoreEl = document.getElementById('portfolioHealthScore');
    const labelEl = document.getElementById('portfolioHealthLabel');
    const reasonEl = document.getElementById('portfolioHealthReason');
    const aiEl = document.getElementById('investmentAiInsight');
    const actionList = document.getElementById('investmentActionList');

    if (scoreEl) scoreEl.textContent = `${analysis.score} / 100`;
    if (labelEl) {
        labelEl.textContent = analysis.label;
        labelEl.className = `portfolio-score-badge ${analysis.label.toLowerCase().replace(/\s+/g, '-')}`;
    }

    const largestText = analysis.largest
        ? `${analysis.largest.symbol} at ${analysis.largestPct.toFixed(1)}%`
        : 'your largest holding';
    const techText = `${analysis.techExposure.toFixed(1)}%`;

    if (reasonEl) {
        reasonEl.textContent = analysis.reasons.length
            ? `Watch ${analysis.reasons.slice(0, 2).join(' and ')}.`
            : 'Your portfolio looks well spread for the current holdings.';
    }

    if (aiEl) {
        if (!analysis.allocations.length) {
            aiEl.textContent = 'Add investments to unlock portfolio guidance and risk context.';
        } else if (analysis.techExposure > 60) {
            aiEl.textContent = `Your portfolio is growing, but technology exposure is high at ${techText}. Diversifying across sectors may reduce risk.`;
        } else if (analysis.largestPct > 40) {
            aiEl.textContent = `${largestText} is driving much of the portfolio. Consider balancing before adding more to the same asset.`;
        } else {
            aiEl.textContent = `Your portfolio looks reasonably balanced. Keep reviewing allocation before making new contributions.`;
        }
    }

    if (actionList) {
        const actions = [];

        if (analysis.largest && analysis.largestPct > 40) {
            actions.push(`Reduce ${escapeGoalText(analysis.largest.symbol)} concentration before adding more.`);
        }

        if (analysis.techExposure > 60) {
            actions.push('Consider adding non-tech assets to improve diversification.');
        }

        if (analysis.hasNegativeHolding) {
            actions.push('Review holdings with negative performance before increasing them.');
        }

        if (analysis.allocations.length < 3) {
            actions.push('Add another holding to reduce single-asset dependency.');
        }

        if (!actions.length) {
            actions.push('Your portfolio looks balanced. Continue regular contributions.');
            actions.push('Review allocation monthly before adding new money.');
        }

        actionList.innerHTML = actions.slice(0, 4).map(action => `<li>${action}</li>`).join('');
    }
}

function setupInvestmentSimulator() {
    if (investmentSimulatorReady) return;

    ['investmentSimMonthly', 'investmentSimYears', 'investmentSimReturn'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', () => updateInvestmentSimulator(investmentSimulatorPortfolioValue));
        }
    });

    investmentSimulatorReady = true;
}

function updateInvestmentSimulator(currentValue) {
    investmentSimulatorPortfolioValue = parseFloat(currentValue || 0);

    const monthlyInput = document.getElementById('investmentSimMonthly');
    const yearsInput = document.getElementById('investmentSimYears');
    const returnInput = document.getElementById('investmentSimReturn');
    const resultEl = document.getElementById('investmentSimResult');

    if (!monthlyInput || !yearsInput || !returnInput || !resultEl) return;

    const monthlyContribution = Math.max(0, parseFloat(monthlyInput.value || 0));
    const years = Math.max(0, parseFloat(yearsInput.value || 0));
    const annualReturn = Math.max(0, parseFloat(returnInput.value || 0)) / 100;
    const months = Math.round(years * 12);
    const monthlyRate = annualReturn / 12;

    let futureValue = investmentSimulatorPortfolioValue;

    if (months > 0) {
        if (monthlyRate === 0) {
            futureValue = investmentSimulatorPortfolioValue + (monthlyContribution * months);
        } else {
            futureValue =
                investmentSimulatorPortfolioValue * Math.pow(1 + monthlyRate, months) +
                monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
        }
    }

    const totalContributed = monthlyContribution * months;
    const estimatedGain = Math.max(futureValue - investmentSimulatorPortfolioValue - totalContributed, 0);

    resultEl.textContent = `If you invest ${fmt(monthlyContribution)}/month for ${years || 0} years, your portfolio could reach about ${fmt(futureValue)}. Estimated growth: ${fmt(estimatedGain)}.`;
}

function getGoalLinkedHoldings(goal, holdings) {
    const rows = Array.isArray(holdings) ? holdings : [];
    const goalText = `${goal.name || ''} ${goal.category || ''}`.toLowerCase();
    const category = String(goal.category || '').toLowerCase();

    const travelSymbols = ['AAPL', 'VOO', 'MSFT'];
    const emergencySymbols = ['VOO'];
    const homeSymbols = ['VOO', 'MSFT'];

    let symbols = [];

    if (goalText.includes('travel') || goalText.includes('trip') || goalText.includes('thailand') || category.includes('travel')) {
        symbols = travelSymbols;
    } else if (goalText.includes('emergency')) {
        symbols = emergencySymbols;
    } else if (goalText.includes('home') || goalText.includes('house')) {
        symbols = homeSymbols;
    } else {
        symbols = rows.slice(0, 2).map(holding => String(holding.symbol || '').toUpperCase());
    }

    return rows.filter(holding => symbols.includes(String(holding.symbol || '').toUpperCase()));
}

function estimateGoalInvestmentTiming(goal, linkedValue, linkedHoldings) {
    const target = parseFloat(goal.target_amount || 0);
    const saved = parseFloat(goal.effective_saved_amount ?? goal.saved_amount ?? 0);
    const remaining = Math.max(target - saved - linkedValue, 0);
    const deadline = goal.deadline ? new Date(goal.deadline) : null;
    const rows = Array.isArray(linkedHoldings) ? linkedHoldings : [];

    if (!deadline || Number.isNaN(deadline.getTime())) {
        return 'Add a target date to estimate timing.';
    }

    if (remaining <= 0) {
        return 'Your linked investments could cover this goal today.';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);

    const monthsToDeadline = Math.max(1, Math.ceil((deadline - today) / (1000 * 60 * 60 * 24 * 30)));
    const weightedGrowth = rows.reduce((sum, holding) => {
        const value = parseFloat(holding.total_value || 0);
        const gainPct = parseFloat(holding.gain_pct || 0) / 100;
        return sum + (value * Math.max(gainPct, 0));
    }, 0);
    const growthRate = linkedValue > 0 ? Math.max(weightedGrowth / linkedValue, 0.04) : 0.06;
    const monthlyGrowth = Math.pow(1 + growthRate, 1 / 12) - 1;

    if (linkedValue <= 0 || monthlyGrowth <= 0) {
        return `Add linked investments to see if you can reach this goal before ${deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`;
    }

    const projectedAtDeadline = linkedValue * Math.pow(1 + monthlyGrowth, monthsToDeadline);
    const gapAtDeadline = remaining - (projectedAtDeadline - linkedValue);

    if (gapAtDeadline <= 0) {
        const monthsNeeded = Math.max(1, Math.ceil(Math.log((linkedValue + remaining) / linkedValue) / Math.log(1 + monthlyGrowth)));
        const monthsEarly = Math.max(monthsToDeadline - monthsNeeded, 0);
        return monthsEarly >= 1
            ? `At current growth, you could hit this goal about ${monthsEarly} ${monthsEarly === 1 ? 'month' : 'months'} early.`
            : 'At current growth, you are tracking close to the target date.';
    }

    return `At current growth, you may need about ${fmt(gapAtDeadline)} more by the target date.`;
}

async function loadInvestmentGoalsCoverage(portfolioValue, holdings = allInvestmentHoldings) {
    const container = document.getElementById('investmentGoalsCoverage');
    if (!container) return;

    try {
        let goals = Array.isArray(allGoals) && allGoals.length ? allGoals : [];

        if (!goals.length) {
            const response = await fetch(API + '/goals');
            if (!response.ok) throw new Error('Goals unavailable');
            goals = await response.json();
            if (Array.isArray(goals)) allGoals = goals;
        }

        if (!Array.isArray(goals) || !goals.length) {
            container.innerHTML = `<p class="investment-muted">Create goals to see how investments support your plans.</p>`;
            return;
        }

        container.innerHTML = goals.slice(0, 3).map(goal => {
            const target = parseFloat(goal.target_amount || 0);
            const linkedHoldings = getGoalLinkedHoldings(goal, holdings);
            const linkedValue = linkedHoldings.reduce((sum, holding) => sum + parseFloat(holding.total_value || 0), 0);
            const fallbackValue = linkedValue || portfolioValue;
            const coverage = target > 0 ? Math.min((fallbackValue / target) * 100, 999) : 0;
            const coverageText = coverage >= 100 ? '100%+' : `${coverage.toFixed(0)}%`;
            const name = escapeGoalText(goal.name || 'Goal');
            const symbols = linkedHoldings.map(holding => escapeGoalText(holding.symbol)).join(', ') || 'portfolio';
            const timing = estimateGoalInvestmentTiming(goal, linkedValue, linkedHoldings);
            const fundingLine = linkedHoldings.length
                ? `These ${linkedHoldings.length} ${linkedHoldings.length === 1 ? 'holding is' : 'holdings are'} funding this goal: ${symbols}.`
                : 'Your full portfolio can be compared against this goal.';

            return `
                <div class="investment-goal-row upgraded">
                    <div class="investment-goal-main">
                        <span>${name}</span>
                        <strong>${coverageText} covered</strong>
                    </div>
                    <div class="investment-goal-progress">
                        <span style="width:${Math.min(coverage, 100)}%"></span>
                    </div>
                    <p>${fundingLine}</p>
                    <em>${escapeGoalText(timing)}</em>
                </div>
            `;
        }).join('');
    } catch (error) {
        container.innerHTML = `<p class="investment-muted">Connect goals to see how investments support your plans.</p>`;
    }
}

function updateHoldingsInsightStrip(holdings) {
    const strip = document.getElementById('holdingsInsightStrip');
    if (!strip) return;

    const rows = Array.isArray(holdings)
        ? holdings
            .map(holding => ({
                symbol: holding.symbol || holding.name || 'Asset',
                score: Number.isFinite(parseFloat(holding.gain_pct))
                    ? parseFloat(holding.gain_pct)
                    : parseFloat(holding.day_change_pct)
            }))
            .filter(holding => Number.isFinite(holding.score))
        : [];

    if (!rows.length) {
        strip.style.display = 'none';
        strip.innerHTML = '';
        return;
    }

    const best = rows.reduce((top, item) => item.score > top.score ? item : top, rows[0]);
    const worst = rows.reduce((low, item) => item.score < low.score ? item : low, rows[0]);

    strip.style.display = 'flex';
    strip.innerHTML = `
        <div class="holding-summary-chip best">
            <span>Best</span>
            <strong>${escapeGoalText(best.symbol)} ${pctText(best.score)}</strong>
        </div>
        <div class="holding-summary-chip worst">
            <span>Worst</span>
            <strong>${escapeGoalText(worst.symbol)} ${pctText(worst.score)}</strong>
        </div>
    `;
}

function updateAllocationCard(holdings) {
    const allocationList = document.getElementById('allocationList');
    const allocationInsight = document.getElementById('allocationInsight');

    if (!allocationList || !allocationInsight) return;

    const rows = Array.isArray(holdings) ? holdings : [];
    const totalValue = rows.reduce((sum, holding) => {
        return sum + parseFloat(holding.total_value || 0);
    }, 0);

    if (!rows.length || totalValue <= 0) {
        allocationList.innerHTML = `
            <div class="allocation-empty">No allocation data yet.</div>
        `;
        allocationInsight.className = 'allocation-insight neutral';
        allocationInsight.innerHTML = `
            <div class="allocation-insight-icon">i</div>
            <div>
                <p class="allocation-insight-label">Allocation insight</p>
                <p class="allocation-insight-text">Add investments to see allocation insights.</p>
            </div>
        `;
        return;
    }

    const allocations = rows
        .map(holding => {
            const value = parseFloat(holding.total_value || 0);
            return {
                symbol: holding.symbol || holding.name || 'Asset',
                pct: totalValue > 0 ? (value / totalValue) * 100 : 0
            };
        })
        .sort((a, b) => b.pct - a.pct);

    allocationList.innerHTML = allocations.map(item => {
        const pct = Number.isFinite(item.pct) ? item.pct : 0;
        const pctText = pct % 1 === 0 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;

        return `
            <div class="alloc-item">
                <div>
                    <p class="alloc-name">${escapeGoalText(item.symbol)}</p>
                    <div class="progress-bar" style="margin-top:6px">
                        <div class="progress-fill ok" style="width:${Math.min(pct, 100).toFixed(1)}%"></div>
                    </div>
                </div>
                <span class="alloc-pct">${pctText}</span>
            </div>
        `;
    }).join('');

    const top = allocations[0];
    const topPct = Number.isFinite(top.pct) ? top.pct : 0;
    const topPctText = topPct % 1 === 0 ? `${topPct.toFixed(0)}%` : `${topPct.toFixed(1)}%`;
    const isConcentrated = topPct > 40;
    const isBalanced = topPct >= 25;
    const techSymbols = new Set(['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'GOOGL', 'AMZN']);
    const techExposure = allocations.reduce((sum, item) => {
        return techSymbols.has(String(item.symbol || '').toUpperCase()) ? sum + item.pct : sum;
    }, 0);
    const techExposureText = techExposure % 1 === 0 ? `${techExposure.toFixed(0)}%` : `${techExposure.toFixed(1)}%`;
    const techInsight = techExposure > 60
        ? `<p class="allocation-insight-text">You are heavily exposed to technology stocks at ${techExposureText}. Consider diversifying across sectors.</p>`
        : '';

    allocationInsight.className = `allocation-insight ${isConcentrated ? 'warning' : 'neutral'}`;
    allocationInsight.innerHTML = `
        <div class="allocation-insight-icon">${isConcentrated ? '!' : 'i'}</div>
        <div>
            <p class="allocation-insight-label">Allocation insight</p>
            <p class="allocation-insight-text">${
                isConcentrated
                    ? `${escapeGoalText(top.symbol)} makes up ${topPctText} of your portfolio. This may increase concentration risk.`
                    : isBalanced
                        ? `Your largest holding is ${escapeGoalText(top.symbol)} at ${topPctText}. Allocation looks reasonably balanced.`
                        : `Your holdings are broadly spread. The largest position is ${escapeGoalText(top.symbol)} at ${topPctText}.`
            }</p>
            ${techInsight}
        </div>
    `;
}

// ── CHARTS ──
window.incomeChart   = null;
window.spendingChart = null;
window.portfolioChart = null;
window.sectorChart = null;

function buildIncomeChart() {
    const canvas = document.getElementById('incomeExpenseChart');
    if (!canvas) return;
    const dark = html.getAttribute('data-theme') === 'dark';
    const grid = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const tick = dark ? '#6b7280' : '#9ca3af';
    const tbg  = dark ? '#1f2937' : '#ffffff';
    const tfg  = dark ? '#f9fafb' : '#111827';
    if (window.incomeChart) window.incomeChart.destroy();
    window.incomeChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'],
            datasets: [
                { label:'Income',   data:[6200,6800,7100,6900,7400,8200,7800,8500], borderColor:'#10b981', backgroundColor:'rgba(16,185,129,0.08)', borderWidth:2.5, pointRadius:0, pointHoverRadius:5, fill:true, tension:0.4 },
                { label:'Expenses', data:[2800,3100,2900,3200,2700,3100,2900,3400], borderColor:'#8b5cf6', backgroundColor:'rgba(139,92,246,0.06)',  borderWidth:2.5, pointRadius:0, pointHoverRadius:5, fill:true, tension:0.4 }
            ]
        },
        options: {
            responsive:true, maintainAspectRatio:false,
            interaction:{mode:'index',intersect:false},
            plugins:{legend:{display:false},tooltip:{backgroundColor:tbg,titleColor:tfg,bodyColor:tfg,borderColor:'rgba(0,0,0,0.1)',borderWidth:1,padding:12,cornerRadius:8,callbacks:{label:c=>` ${c.dataset.label}: $${c.parsed.y.toLocaleString()}`}}},
            scales:{x:{grid:{color:grid},ticks:{color:tick,font:{size:11}},border:{display:false}},y:{grid:{color:grid},ticks:{color:tick,font:{size:11},callback:v=>'$'+(v/1000).toFixed(0)+'k'},border:{display:false}}}
        }
    });
}

function buildSpendingChart() {
    const canvas = document.getElementById('spendingChart');
    if (!canvas) return;
    if (window.spendingChart) window.spendingChart.destroy();
    window.spendingChart = new Chart(canvas.getContext('2d'), {
        type:'doughnut',
        data:{labels:['Housing','Groceries','Dining','Transport','Entertainment','Other'],datasets:[{data:[1800,420,280,150,95,197],backgroundColor:['#10b981','#8b5cf6','#f59e0b','#ec4899','#3b82f6','#9ca3af'],borderWidth:0,hoverOffset:6}]},
        options:{responsive:true,maintainAspectRatio:true,cutout:'72%',plugins:{legend:{display:false}}}
    });
}

function buildPortfolioChart() {
    const canvas = document.getElementById('portfolioChart');
    if (!canvas) return;
    const activeRange = document.querySelector('.investment-chart-card .chart-tab.active')?.textContent.trim() || 'YTD';
    const chartRanges = {
        '1M': {
            labels: ['Week 1','Week 2','Week 3','Week 4'],
            portfolio: [14120,14280,14370,14499],
            sp500: [14120,14190,14260,14310],
            nasdaq: [14120,14220,14320,14420],
            whatIf: [15120,15310,15440,15610],
            buys: [{ x: 'Week 2', y: 14280, label: 'Added AAPL' }],
            events: [{ x: 'Week 3', y: 14540, label: 'Earnings week' }]
        },
        '3M': {
            labels: ['Feb','Mar','Apr'],
            portfolio: [13250,13920,14499],
            sp500: [13250,13610,13980],
            nasdaq: [13250,13780,14340],
            whatIf: [14250,15080,15840],
            buys: [{ x: 'Feb', y: 13250, label: 'Bought VOO' }, { x: 'Apr', y: 14499, label: 'Bought MSFT' }],
            events: [{ x: 'Mar', y: 14150, label: 'Fed decision' }]
        },
        'YTD': {
            labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'],
            portfolio: [8500,8800,9100,8900,9300,9600,9800,10200],
            sp500: [8500,8685,8780,8660,8990,9220,9410,9660],
            nasdaq: [8500,8720,9050,8825,9360,9700,10030,10620],
            whatIf: [9500,9825,10210,9990,10520,10910,11280,11820],
            buys: [{ x: 'Jan', y: 8500, label: 'Bought AAPL' }, { x: 'Feb', y: 8800, label: 'Bought VOO' }, { x: 'Apr', y: 8900, label: 'Bought MSFT' }],
            events: [{ x: 'Mar', y: 9300, label: 'Fed decision' }, { x: 'May', y: 9550, label: 'Big tech earnings' }, { x: 'Jul', y: 10150, label: 'Market rally' }]
        },
        '1Y': {
            labels: ['Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'],
            portfolio: [7600,7820,8050,8290,8500,8800,9100,8900,9300,9600,9800,10200],
            sp500: [7600,7740,7920,8120,8320,8500,8660,8540,8860,9080,9280,9520],
            nasdaq: [7600,7810,8060,8310,8580,8840,9180,8960,9520,9840,10180,10780],
            whatIf: [8600,8900,9220,9530,9810,10180,10580,10320,10890,11320,11740,12280],
            buys: [{ x: 'Jan', y: 8500, label: 'Bought AAPL' }, { x: 'Feb', y: 8800, label: 'Bought VOO' }, { x: 'Apr', y: 8900, label: 'Bought MSFT' }],
            events: [{ x: 'Dec', y: 8500, label: 'Year-end rally' }, { x: 'Mar', y: 9300, label: 'Fed decision' }, { x: 'May', y: 9550, label: 'Big tech earnings' }]
        }
    };
    const selected = chartRanges[activeRange] || chartRanges.YTD;
    const labels = selected.labels;
    const portfolio = selected.portfolio;
    const sp500 = selected.sp500;
    const nasdaq = selected.nasdaq;
    const whatIf = selected.whatIf;
    const showWhatIf = document.getElementById('portfolioWhatIfToggle')?.checked;
    const buyMarkers = selected.buys;
    const eventMarkers = selected.events;
    const firstPortfolio = portfolio[0] || 0;
    const lastPortfolio = portfolio[portfolio.length - 1] || 0;
    const firstSp500 = sp500[0] || 0;
    const lastSp500 = sp500[sp500.length - 1] || 0;
    const portfolioReturn = firstPortfolio > 0 ? ((lastPortfolio - firstPortfolio) / firstPortfolio) * 100 : 0;
    const sp500Return = firstSp500 > 0 ? ((lastSp500 - firstSp500) / firstSp500) * 100 : 0;
    const outperformance = portfolioReturn - sp500Return;
    const summaryEl = document.getElementById('portfolioChartSummary');

    if (summaryEl) {
        const rangeLabel = activeRange === 'YTD' ? 'YTD' : `over ${activeRange}`;
        const direction = outperformance >= 0 ? 'outperforming' : 'trailing';
        summaryEl.textContent = `Your portfolio is ${direction} S&P 500 by ${pctText(Math.abs(outperformance))} ${rangeLabel}.`;
        summaryEl.classList.toggle('negative', outperformance < 0);
    }

    if (window.portfolioChart) window.portfolioChart.destroy();

    window.portfolioChart = new Chart(canvas.getContext('2d'), {
        type:'line',
        data:{
            labels,
            datasets:[
                {label:'Portfolio',data:portfolio,borderColor:'#10b981',backgroundColor:'rgba(16,185,129,0.05)',borderWidth:2.4,pointRadius:0,pointHoverRadius:4,fill:true,tension:0.4},
                {label:'S&P 500',data:sp500,borderColor:'#3b82f6',backgroundColor:'transparent',borderWidth:1.7,pointRadius:0,borderDash:[5,4],tension:0.4},
                {label:'NASDAQ',data:nasdaq,borderColor:'#7c3aed',backgroundColor:'transparent',borderWidth:2,pointRadius:0,borderDash:[7,4],tension:0.4},
                ...(showWhatIf ? [{label:'What-if: +$1,000 AAPL',data:whatIf,borderColor:'#f97316',backgroundColor:'transparent',borderWidth:1.5,pointRadius:0,borderDash:[7,6],tension:0.4}] : []),
                {label:'Buy markers',data:buyMarkers,borderColor:'#10b981',backgroundColor:'#ffffff',showLine:false,pointRadius:3.5,pointHoverRadius:5.5,pointBorderWidth:2,pointStyle:'circle'},
                {label:'Market events',data:eventMarkers,borderColor:'#f97316',backgroundColor:'#fff7ed',showLine:false,pointRadius:3.5,pointHoverRadius:5,pointBorderWidth:2,pointStyle:'rectRot'}
            ]
        },
        options:{
            responsive:true,
            maintainAspectRatio:false,
            interaction:{mode:'nearest',intersect:false},
            plugins:{
                legend:{display:false},
                tooltip:{
                    callbacks:{
                        title:items=>{
                            const item = items && items[0];
                            return item ? `Date: ${item.label}` : '';
                        },
                        label:ctx=>{
                            const raw = ctx.raw || {};
                            const value = typeof raw.y === 'number' ? raw.y : ctx.parsed.y;

                            if (ctx.dataset.label === 'Buy markers' || ctx.dataset.label === 'Market events') {
                                return [
                                    `Portfolio value: $${Number(value || 0).toLocaleString()}`,
                                    `Event: ${raw.label || ctx.dataset.label}`
                                ];
                            }
                            return `${ctx.dataset.label}: $${Number(value || 0).toLocaleString()}`;
                        }
                    }
                }
            },
            scales:{
                x:{grid:{color:'rgba(0,0,0,0.03)'},ticks:{color:'#9ca3af',font:{size:11}},border:{display:false}},
                y:{
                    min: Math.floor(Math.min(...portfolio, ...sp500, ...nasdaq, ...(showWhatIf ? whatIf : [])) / 500) * 500,
                    max: Math.ceil(Math.max(...portfolio, ...sp500, ...nasdaq, ...(showWhatIf ? whatIf : [])) / 500) * 500,
                    grid:{color:'rgba(0,0,0,0.03)'},
                    ticks:{
                        color:'#9ca3af',
                        font:{size:11},
                        stepSize:500,
                        callback:v=>'$'+(v/1000).toFixed(1)+'k'
                    },
                    border:{display:false}
                }
            }
        }
    });
}

const portfolioWhatIfToggle = document.getElementById('portfolioWhatIfToggle');
if (portfolioWhatIfToggle) {
    portfolioWhatIfToggle.addEventListener('change', buildPortfolioChart);
}

// ── DEMO DATA (fallback if backend is off) ──
const DEMO_TRANSACTIONS = [
    { id:1,  name:'Salary Deposit',       category:'Income',        account:'Main Checking',  date:'2026-04-21', amount:+4210.00 },
    { id:2,  name:'Whole Foods Market',   category:'Groceries',     account:'Rewards Card',   date:'2026-04-21', amount:-156.42  },
    { id:3,  name:'Netflix Subscription', category:'Entertainment', account:'Rewards Card',   date:'2026-04-20', amount:-15.99   },
    { id:4,  name:'Uber Ride',            category:'Transport',     account:'Main Checking',  date:'2026-04-20', amount:-24.50   },
    { id:5,  name:'Electric Bill',        category:'Utilities',     account:'Main Checking',  date:'2026-04-19', amount:-145.00  },
    { id:6,  name:'Rent Payment',         category:'Housing',       account:'Main Checking',  date:'2026-04-18', amount:-1800.00 },
    { id:7,  name:'Starbucks',            category:'Dining',        account:'Rewards Card',   date:'2026-04-18', amount:-7.50    },
    { id:8,  name:'Gym Membership',       category:'Health',        account:'Main Checking',  date:'2026-04-17', amount:-49.99   },
    { id:9,  name:'Amazon Purchase',      category:'Shopping',      account:'Rewards Card',   date:'2026-04-17', amount:-89.99   },
    { id:10, name:'Freelance Payment',    category:'Income',        account:'Main Checking',  date:'2026-04-16', amount:+850.00  },
    { id:11, name:"McDonald's",           category:'Dining',        account:'Rewards Card',   date:'2026-04-16', amount:-12.30   },
    { id:12, name:'Spotify',              category:'Entertainment', account:'Rewards Card',   date:'2026-04-15', amount:-9.99    },
];

function updateRecurringDueThisWeek() {
    const rows = document.querySelectorAll('#page-recurring tbody tr');

    let totalDue = 0;
    let countDue = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    rows.forEach(row => {
        const amountCell = row.querySelector('td:nth-child(4)');
        const dateCell = row.querySelector('td:nth-child(3)');

        if (!amountCell || !dateCell) return;

        const amountText = amountCell.textContent.replace(/[^0-9.-]/g, '');
        const rawAmount = parseFloat(amountText) || 0;
        const amount = Math.abs(rawAmount);

        const dateText = dateCell.querySelector(".recurring-date-value")
            ? dateCell.querySelector(".recurring-date-value").textContent.trim()
            : dateCell.textContent.replace('📅', '').trim();

        const dueDate = new Date(dateText);

        if (
            !Number.isNaN(dueDate.getTime()) &&
            dueDate >= today &&
            dueDate <= sevenDaysFromNow &&
            rawAmount < 0
        ) {
            totalDue += amount;
            countDue += 1;
        }
    });

    const dueAmountEl = document.getElementById('recurring-due-week');
    const dueCountEl = document.getElementById('recurring-due-week-count');

    if (dueAmountEl) dueAmountEl.textContent = fmt(totalDue);
    if (dueCountEl) {
        dueCountEl.textContent =
            countDue === 1 ? '1 payment due' : `${countDue} payments due`;
    }
}

function recurringDueLabel(dateStr) {
    const today = new Date();
    today.setHours(0,0,0,0);

    const due = new Date(dateStr);
    due.setHours(0,0,0,0);

    const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));

    if (diff < 0) return '<span class="due-badge overdue">Overdue</span>';
    if (diff === 0) return '<span class="due-badge today">Today</span>';
    if (diff === 1) return '<span class="due-badge soon">Tomorrow</span>';
    if (diff <= 7) return `<span class="due-badge soon">${diff} days left</span>`;

    return `<span class="due-badge normal">${diff} days left</span>`;
}

function isRecurringDueSoon(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(dateStr);
    due.setHours(0, 0, 0, 0);

    const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));

    return diff <= 7;
}

function formatDate(dateStr) {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return String(dateStr);

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatFrequencyLabel(frequency) {
    const labels = {
        weekly: 'Weekly',
        biweekly: 'Biweekly',
        monthly: 'Monthly',
        yearly: 'Yearly'
    };

    return labels[String(frequency || '').toLowerCase()] || String(frequency || 'Monthly');
}

function dateInputValue(dateValue) {
    if (!dateValue) return '';

    const asString = String(dateValue);
    const directMatch = asString.match(/\d{4}-\d{2}-\d{2}/);
    if (directMatch) return directMatch[0];

    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return '';

    return parsed.toISOString().split('T')[0];
}

function enhanceRecurringDateCells() {
    const rows = document.querySelectorAll('#page-recurring tbody tr');

    rows.forEach(row => {
        const dateCell = row.querySelector('td:nth-child(3)');
        if (!dateCell) return;

        const dateText = dateCell.textContent.replace('📅', '').trim();
        if (!dateText) return;

        dateCell.innerHTML = `
            <div class="recurring-date-value">${dateText}</div>
            ${recurringDueLabel(dateText)}
        `;
    });
}

function updateRecurringStats(items) {
    const recurringPage = document.getElementById('page-recurring');
    if (!recurringPage) return;

    const statValues = recurringPage.querySelectorAll('.stats-row .stat-value');
    if (statValues.length < 3) return;

    const recurringItems = Array.isArray(items) ? items : [];

    const monthlyIncome = recurringItems.reduce((sum, item) => {
        const amount = parseFloat(item.amount || 0);
        return amount > 0 ? sum + amount : sum;
    }, 0);

    const monthlyExpenses = recurringItems.reduce((sum, item) => {
        const amount = parseFloat(item.amount || 0);
        return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);

    statValues[0].textContent = fmt(monthlyIncome);
    statValues[1].textContent = fmt(monthlyExpenses);
    statValues[2].textContent = fmt(monthlyIncome - monthlyExpenses);
}

function getRecurringStatusText(item, isIncome) {
    if (item.completed_this_cycle) {
        return isIncome ? "Received" : "Paid";
    }

    return "Pending";
}

function getRecurringStatusClass(item) {
    if (item.completed_this_cycle) {
        return "done";
    }

    return "pending";
}

function renderRecurringPayments(items) {
    const tbody = document.querySelector("#page-recurring tbody");
    if (!tbody) return;

    if (!items || items.length === 0) {
        const dueAmountEl = document.getElementById('recurring-due-week');
        const dueCountEl = document.getElementById('recurring-due-week-count');

        if (dueAmountEl) dueAmountEl.textContent = fmt(0);
        if (dueCountEl) dueCountEl.textContent = '0 payments due';

        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="premium-empty-state">
                        <div class="premium-empty-state-icon">🔁</div>
                        <h3 class="premium-empty-state-title">No recurring payments yet</h3>
                        <p class="premium-empty-state-text">
                            Add rent, salary, subscriptions, or any payment that repeats.
                        </p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = items.map(item => {
        const amount = parseFloat(item.amount || 0);
        const isIncome = amount > 0;
        item.completed_this_cycle = item.completed_this_cycle || false;

        return `
            <tr>
                <td>
                    <div class="tx-cell-name">
                        <div class="tx-cell-icon ${isIncome ? 'green-icon' : 'gray-icon'}">
                            ${isIncome ? '💰' : '💳'}
                        </div>
                        <p class="tx-cell-title">${item.name}</p>
                    </div>
                </td>

                <td><span class="freq-badge">${formatFrequencyLabel(item.frequency)}</span></td>

                <td class="tx-date-cell">
                    <div class="recurring-date-value">${formatDate(item.next_date)}</div>
                    ${recurringDueLabel(item.next_date)}
                </td>

                <td class="tx-amount-cell ${isIncome ? 'positive' : 'negative'}">
                    ${isIncome ? '+' : ''}${fmt(amount)}
                </td>

                <td>
                    <span class="recurring-status-badge ${getRecurringStatusClass(item)}">
                        ${getRecurringStatusText(item, isIncome)}
                    </span>
                </td>

                <td>
                    <button
                        class="recurring-action-btn ${isIncome ? 'received' : 'paid'}"
                        data-id="${item.id}"
                        ${isRecurringDueSoon(item.next_date) ? '' : 'disabled'}
                    >
                        ${
                            isRecurringDueSoon(item.next_date)
                                ? (isIncome ? 'Mark Received' : 'Mark Paid')
                                : 'Not Due Yet'
                        }
                    </button>
                </td>

                <td>
                    <div class="recurring-row-actions">
                        <button
                            class="dots-btn edit-recurring-btn"
                            data-id="${item.id}"
                            title="Edit recurring payment"
                        >✎</button>
                        <button
                            class="dots-btn delete-recurring-btn"
                            data-id="${item.id}"
                            title="Delete recurring payment"
                        >✕</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    updateRecurringDueThisWeek();

    tbody.querySelectorAll(".recurring-action-btn").forEach(button => {
        button.addEventListener("click", async () => {
            const id = button.dataset.id;
            if (!id) return;

            button.disabled = true;
            button.textContent = "Saving...";

            try {
                const res = await fetch(API + `/recurring/${id}/mark-paid`, {
                    method: "POST"
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(errorText || "Failed to update recurring payment");
                }

                await loadRecurringPayments();
                await loadTransactions();
                await loadDashboard();

                showToast("Recurring payment recorded");
            } catch (error) {
                console.error("Recurring payment error:", error);
                showToast("Could not record recurring payment");
                button.disabled = false;
                button.textContent = "Try again";
            }
        });
    });

    tbody.querySelectorAll(".edit-recurring-btn").forEach(button => {
        button.addEventListener("click", () => {
            const id = button.dataset.id;
            const item = allRecurringPayments.find(row => String(row.id) === String(id));

            if (item) {
                openRecurringModal(item);
            }
        });
    });

    tbody.querySelectorAll(".delete-recurring-btn").forEach(button => {
        button.addEventListener("click", () => {
            openDeleteRecurringModal(button.dataset.id);
        });
    });
}

async function loadRecurringPayments() {
    try {
        const res = await fetch(API + "/recurring");
        const items = await res.json();

        allRecurringPayments = Array.isArray(items) ? items : [];
        renderRecurringPayments(items);
        updateRecurringStats(items);
    } catch (error) {
        console.error("Error loading recurring payments:", error);
    }
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
    buildIncomeChart();
    buildSpendingChart();
    buildPortfolioChart();
    filtered = [...DEMO_TRANSACTIONS];
    renderTable();
    enhanceRecurringDateCells();
    updateRecurringDueThisWeek();
    loadRecurringPayments();
    setTransactionCategoryFilter('', '🏷️');
    loadCategories();
    loadDashboard();
    loadBudgets();

    const initialTopSearch =
        document.querySelector('.topbar-search') ||
        document.querySelector('.header-search') ||
        document.querySelector('.navbar-search') ||
        document.querySelector('.search-bar');

    if (initialTopSearch) {
        initialTopSearch.style.display = '';
    }

    updateTransactionActionStates();
});

// ==============================
// ADD TRANSACTION MODAL
// ==============================
const transactionModal = document.getElementById("transactionModal");
const addNewBtn = document.getElementById("addNewBtn");
const addTransactionBtn = document.getElementById("addTransactionBtn");
const transactionModalClose = document.getElementById("transactionModalClose");
const transactionModalCancel = document.getElementById("transactionModalCancel");
const transactionForm = document.getElementById("transactionForm");
const transactionTypeInput = document.getElementById("transactionType");
const transactionTypeExpenseBtn = document.getElementById("transactionTypeExpenseBtn");
const transactionTypeIncomeBtn = document.getElementById("transactionTypeIncomeBtn");
const deleteTransactionModal = document.getElementById("deleteTransactionModal");
const deleteTransactionModalClose = document.getElementById("deleteTransactionModalClose");
const deleteTransactionCancel = document.getElementById("deleteTransactionCancel");
const deleteTransactionConfirm = document.getElementById("deleteTransactionConfirm");
const deleteTransactionIdInput = document.getElementById("deleteTransactionId");
const deleteAllTransactionsModal = document.getElementById("deleteAllTransactionsModal");
const deleteAllTransactionsModalClose = document.getElementById("deleteAllTransactionsModalClose");
const deleteAllTransactionsCancel = document.getElementById("deleteAllTransactionsCancel");
const deleteAllTransactionsConfirm = document.getElementById("deleteAllTransactionsConfirm");

function openTransactionModal() {
    if (!transactionModal) return;
    transactionModal.style.display = "flex";

    const transactionDateInput = document.getElementById("transactionDate");
    if (transactionDateInput && !transactionDateInput.value) {
        transactionDateInput.value = new Date().toISOString().split("T")[0];
    }
}

function setTransactionType(type = "expense") {
    const normalized = type === "income" ? "income" : "expense";

    if (transactionTypeInput) {
        transactionTypeInput.value = normalized;
    }

    if (transactionTypeExpenseBtn) {
        transactionTypeExpenseBtn.classList.toggle("active", normalized === "expense");
    }

    if (transactionTypeIncomeBtn) {
        transactionTypeIncomeBtn.classList.toggle("active", normalized === "income");
    }
}

function openTransactionModal(transaction = null) {
    if (!transactionModal) return;

    const transactionIdInput = document.getElementById("transactionId");
    const transactionModalTitle = document.getElementById("transactionModalTitle");
    const modalDesc = transactionModal.querySelector('.modal-desc');
    const transactionSubmitBtn = document.getElementById("transactionSubmitBtn");
    const transactionNameInput = document.getElementById("transactionName");
    const transactionAmountInput = document.getElementById("transactionAmount");
    const transactionCategoryInput = document.getElementById("transactionCategory");
    const transactionAccountInput = document.getElementById("transactionAccount");
    const transactionDateInput = document.getElementById("transactionDate");

    if (transactionForm) {
        transactionForm.reset();
    }

    if (modalDesc) {
        modalDesc.textContent = transaction
            ? 'Update this transaction details.'
            : 'Add a new income or expense manually.';
    }

    if (transaction) {
        if (transactionIdInput) transactionIdInput.value = transaction.id || "";
        if (transactionModalTitle) transactionModalTitle.textContent = "Edit Transaction";
        if (transactionSubmitBtn) transactionSubmitBtn.textContent = "Save Changes";
        if (transactionNameInput) transactionNameInput.value = transaction.name || "";
        if (transactionAmountInput) transactionAmountInput.value = Math.abs(parseFloat(transaction.amount) || 0);

        setTransactionType((parseFloat(transaction.amount) || 0) >= 0 ? "income" : "expense");

        if (transactionCategoryInput) {
            const categoryName = transaction.category || "Other";
            const categoryIcon = getCategoryIcon(categoryName);
            addCategoryToSelect(categoryName, false, categoryIcon);
            setSelectedTransactionCategory(categoryName, categoryIcon);
        }

        if (transactionAccountInput) {
            const accountValue = transaction.account || "";
            const existingAccount = Array.from(transactionAccountInput.options).some(
                option => option.value === accountValue
            );
            transactionAccountInput.value = existingAccount ? accountValue : "";
        }

        if (transactionDateInput) {
            let rawDate = "";
            if (transaction.date) {
                const parsedDate = new Date(transaction.date);
                if (!Number.isNaN(parsedDate.getTime())) {
                    rawDate = parsedDate.toISOString().split("T")[0];
                }
            }
            transactionDateInput.value = rawDate;
        }
    } else {
        if (transactionIdInput) transactionIdInput.value = "";
        if (transactionModalTitle) transactionModalTitle.textContent = "Add Transaction";
        if (transactionSubmitBtn) transactionSubmitBtn.textContent = "Save Transaction";
        setTransactionType("expense");
        setSelectedTransactionCategory("", "🏷️");
        if (transactionAccountInput) transactionAccountInput.value = "";
        if (transactionDateInput) {
            transactionDateInput.value = new Date().toISOString().split("T")[0];
        }
    }

    transactionModal.style.display = "flex";
}

function closeTransactionModal() {
    if (!transactionModal) return;

    const transactionIdInput = document.getElementById("transactionId");
    const transactionModalTitle = document.getElementById("transactionModalTitle");
    const transactionSubmitBtn = document.getElementById("transactionSubmitBtn");
    const transactionAccountInput = document.getElementById("transactionAccount");

    transactionModal.style.display = "none";

    if (transactionForm) {
        transactionForm.reset();
    }

    if (transactionIdInput) transactionIdInput.value = "";
    if (transactionModalTitle) transactionModalTitle.textContent = "Add Transaction";
    if (transactionSubmitBtn) transactionSubmitBtn.textContent = "Save Transaction";
    setTransactionType("expense");
    setSelectedTransactionCategory("", "🏷️");
    if (transactionAccountInput) transactionAccountInput.value = "";
}

function openDeleteTransactionModal(txId) {
    if (!deleteTransactionModal || !deleteTransactionIdInput) return;
    deleteTransactionIdInput.value = txId;
    deleteTransactionModal.style.display = "flex";
}

function closeDeleteTransactionModal() {
    if (!deleteTransactionModal || !deleteTransactionIdInput) return;
    deleteTransactionModal.style.display = "none";
    deleteTransactionIdInput.value = "";
}

function openDeleteAllTransactionsModal() {
    if (!deleteAllTransactionsModal) return;
    deleteAllTransactionsModal.style.display = "flex";
}

function closeDeleteAllTransactionsModal() {
    if (!deleteAllTransactionsModal) return;
    deleteAllTransactionsModal.style.display = "none";
}

if (addNewBtn) {
    addNewBtn.addEventListener("click", () => {
        if (document.body.dataset.activePage === "recurring") {
            openRecurringModal();
            return;
        }

        if (document.body.dataset.activePage === "goals") {
            openGoalModal();
            return;
        }

        openTransactionModal();
    });
}

if (addTransactionBtn) {
    addTransactionBtn.addEventListener("click", openTransactionModal);
}

if (transactionModalClose) {
    transactionModalClose.addEventListener("click", closeTransactionModal);
}

if (transactionModalCancel) {
    transactionModalCancel.addEventListener("click", closeTransactionModal);
}

if (transactionModal) {
    transactionModal.addEventListener("click", (e) => {
        if (e.target === transactionModal) {
            closeTransactionModal();
        }
    });
}

if (transactionTypeExpenseBtn) {
    transactionTypeExpenseBtn.addEventListener("click", () => setTransactionType("expense"));
}

if (transactionTypeIncomeBtn) {
    transactionTypeIncomeBtn.addEventListener("click", () => setTransactionType("income"));
}

if (deleteTransactionModalClose) {
    deleteTransactionModalClose.addEventListener("click", closeDeleteTransactionModal);
}

if (deleteTransactionCancel) {
    deleteTransactionCancel.addEventListener("click", closeDeleteTransactionModal);
}

if (deleteTransactionModal) {
    deleteTransactionModal.addEventListener("click", (e) => {
        if (e.target === deleteTransactionModal) {
            closeDeleteTransactionModal();
        }
    });
}

if (deleteAllTransactionsBtn) {
    deleteAllTransactionsBtn.addEventListener("click", () => {
        const currentData = transactionsLoadedFromBackend
            ? allTransactions
            : DEMO_TRANSACTIONS;

        if (!currentData || currentData.length === 0) {
            showToast('No transactions to delete');
            return;
        }

        openDeleteAllTransactionsModal();
    });
}

if (deleteAllTransactionsModalClose) {
    deleteAllTransactionsModalClose.addEventListener("click", closeDeleteAllTransactionsModal);
}

if (deleteAllTransactionsCancel) {
    deleteAllTransactionsCancel.addEventListener("click", closeDeleteAllTransactionsModal);
}

if (deleteAllTransactionsModal) {
    deleteAllTransactionsModal.addEventListener("click", (e) => {
        if (e.target === deleteAllTransactionsModal) {
            closeDeleteAllTransactionsModal();
        }
    });
}

if (transactionForm) {
    transactionForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const transactionId = document.getElementById("transactionId").value.trim();
        const name = document.getElementById("transactionName").value.trim();
        const amount = parseFloat(document.getElementById("transactionAmount").value);
        const type = document.getElementById("transactionType").value;
        const category = document.getElementById("transactionCategory").value;
        const account = document.getElementById("transactionAccount").value;
        const date = document.getElementById("transactionDate").value;  

        if (!name || !category || !account || !date || Number.isNaN(amount)) {
            alert("Please fill in all fields correctly.");
            return;
        }

        const finalAmount = type === "income" ? Math.abs(amount) : -Math.abs(amount);

        try {
            const isEditing = !!transactionId;

const response = await fetch(
    isEditing
        ? `http://127.0.0.1:5000/api/transactions/${transactionId}`
        : "http://127.0.0.1:5000/api/transactions",
    {
        method: isEditing ? "PUT" : "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name,
            amount: finalAmount,
            category,
            account,
            date,
            source: "manual"
        })
    }
);

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Server response:", errorText);
                throw new Error(errorText || "Failed to save transaction");
            }

            closeTransactionModal();

            if (typeof loadTransactions === "function") {
                await loadTransactions();
            }

            if (typeof loadDashboard === "function") {
                await loadDashboard();
            }

            showToast(transactionId ? "Transaction updated" : "Transaction added");
        } catch (error) {
            console.error("Error adding transaction:", error);
            alert("Could not add transaction: " + error.message);
        }
    });
}

// ==============================
// ADD GOAL MODAL
// ==============================
const goalModal = document.getElementById("goalModal");
const addGoalBtn = document.getElementById("addGoalBtn");
const goalModalClose = document.getElementById("goalModalClose");
const goalModalCancel = document.getElementById("goalModalCancel");
const goalForm = document.getElementById("goalForm");
const deleteGoalModal = document.getElementById("deleteGoalModal");
const deleteGoalModalClose = document.getElementById("deleteGoalModalClose");
const deleteGoalCancel = document.getElementById("deleteGoalCancel");
const deleteGoalConfirm = document.getElementById("deleteGoalConfirm");
const deleteGoalIdInput = document.getElementById("deleteGoalId");
const goalContributionModal = document.getElementById("goalContributionModal");
const goalContributionModalClose = document.getElementById("goalContributionModalClose");
const goalContributionCancel = document.getElementById("goalContributionCancel");
const goalContributionForm = document.getElementById("goalContributionForm");
const goalContributionIdInput = document.getElementById("goalContributionId");
const goalContributionDesc = document.getElementById("goalContributionDesc");
const goalContributionAmountInput = document.getElementById("goalContributionAmount");
const goalContributionDateInput = document.getElementById("goalContributionDate");
const goalContributionNoteInput = document.getElementById("goalContributionNote");
const goalContributionSubmitBtn = document.getElementById("goalContributionSubmit");

async function updateGoalAutoLink(goal, enabled) {
    const manualSaved = goal.manual_saved_amount !== undefined ? goal.manual_saved_amount : goal.saved_amount;
    const category = goal.category || "Savings";

    const response = await fetch(API + `/goals/${goal.id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: goal.name,
            target_amount: goal.target_amount,
            saved_amount: manualSaved || 0,
            deadline: dateInputValue(goal.deadline),
            icon: goal.icon || getCategoryIcon(category) || "🎯",
            category,
            auto_link_savings: enabled
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to update auto-link");
    }

    await loadGoals();
}

function updateGoalAutoLinkHint() {
    const goalAutoLinkInput = document.getElementById("goalAutoLinkSavings");
    const goalAutoLinkHint = document.getElementById("goalAutoLinkHint");

    if (goalAutoLinkHint) {
        goalAutoLinkHint.style.display = goalAutoLinkInput && goalAutoLinkInput.checked ? "block" : "none";
    }
}

function openGoalModal(goal = null) {
    if (!goalModal) return;

    const goalIdInput = document.getElementById("goalId");
    const goalModalTitle = document.getElementById("goalModalTitle");
    const goalModalDesc = document.getElementById("goalModalDesc");
    const goalSubmitBtn = document.getElementById("goalSubmitBtn");
    const goalNameInput = document.getElementById("goalName");
    const goalCategoryInput = document.getElementById("goalCategory");
    const goalTargetInput = document.getElementById("goalTargetAmount");
    const goalSavedInput = document.getElementById("goalSavedAmount");
    const goalDeadlineInput = document.getElementById("goalDeadline");
    const goalAutoLinkInput = document.getElementById("goalAutoLinkSavings");

    if (goalForm) {
        goalForm.reset();
    }

    if (goal) {
        if (goalIdInput) goalIdInput.value = goal.id || "";
        if (goalModalTitle) goalModalTitle.textContent = "Edit Goal";
        if (goalModalDesc) goalModalDesc.textContent = "Update this goal and keep your savings plan accurate.";
        if (goalSubmitBtn) goalSubmitBtn.textContent = "Save Changes";
        if (goalNameInput) goalNameInput.value = goal.name || "";
        if (goalCategoryInput) {
            const categoryName = goal.category || "Savings";
            const categoryIcon = getCategoryIcon(categoryName);
            setSelectedGoalCategory(categoryName, categoryIcon);
        }
        if (goalTargetInput) goalTargetInput.value = goal.target_amount || "";
        if (goalSavedInput) {
            const manualSaved = goal.manual_saved_amount !== undefined ? goal.manual_saved_amount : goal.saved_amount;
            goalSavedInput.value = manualSaved || 0;
        }
        if (goalDeadlineInput) goalDeadlineInput.value = dateInputValue(goal.deadline);
        if (goalAutoLinkInput) goalAutoLinkInput.checked = !!goal.auto_link_savings;
    } else {
        if (goalIdInput) goalIdInput.value = "";
        if (goalModalTitle) goalModalTitle.textContent = "Create Goal";
        if (goalModalDesc) goalModalDesc.textContent = "Create a new savings goal and track your progress.";
        if (goalSubmitBtn) goalSubmitBtn.textContent = "Save Goal";
        setSelectedGoalCategory("", "🏷️");
        if (goalSavedInput) goalSavedInput.value = "0";
        if (goalAutoLinkInput) goalAutoLinkInput.checked = true;
    }

    updateGoalAutoLinkHint();
    goalModal.style.display = "flex";
}

function closeGoalModal() {
    if (!goalModal) return;
    goalModal.style.display = "none";

    if (goalForm) {
        goalForm.reset();
    }

    const goalIdInput = document.getElementById("goalId");
    const goalModalTitle = document.getElementById("goalModalTitle");
    const goalModalDesc = document.getElementById("goalModalDesc");
    const goalSubmitBtn = document.getElementById("goalSubmitBtn");

    if (goalIdInput) goalIdInput.value = "";
    if (goalModalTitle) goalModalTitle.textContent = "Create Goal";
    if (goalModalDesc) goalModalDesc.textContent = "Create a new savings goal and track your progress.";
    if (goalSubmitBtn) goalSubmitBtn.textContent = "Save Goal";
    setSelectedGoalCategory("", "🏷️");
}

function openGoalContributionModal(goal) {
    if (!goalContributionModal || !goalContributionIdInput) return;

    if (goalContributionForm) {
        goalContributionForm.reset();
    }

    goalContributionIdInput.value = goal.id || "";

    if (goalContributionDesc) {
        goalContributionDesc.textContent = `Add savings toward ${goal.name || "this goal"}.`;
    }

    if (goalContributionDateInput) {
        goalContributionDateInput.value = new Date().toISOString().split("T")[0];
    }

    if (goalContributionAmountInput) {
        goalContributionAmountInput.focus();
    }

    goalContributionModal.style.display = "flex";

    setTimeout(() => {
        if (goalContributionAmountInput) goalContributionAmountInput.focus();
    }, 50);
}

function closeGoalContributionModal() {
    if (!goalContributionModal) return;
    goalContributionModal.style.display = "none";

    if (goalContributionForm) {
        goalContributionForm.reset();
    }

    if (goalContributionIdInput) {
        goalContributionIdInput.value = "";
    }
}

function openDeleteGoalModal(goalId) {
    if (!deleteGoalModal || !deleteGoalIdInput) return;
    deleteGoalIdInput.value = goalId || "";
    deleteGoalModal.style.display = "flex";
}

function closeDeleteGoalModal() {
    if (!deleteGoalModal || !deleteGoalIdInput) return;
    deleteGoalModal.style.display = "none";
    deleteGoalIdInput.value = "";
}

if (addGoalBtn) {
    addGoalBtn.addEventListener("click", openGoalModal);
}

if (goalModalClose) {
    goalModalClose.addEventListener("click", closeGoalModal);
}

if (goalModalCancel) {
    goalModalCancel.addEventListener("click", closeGoalModal);
}

if (goalModal) {
    goalModal.addEventListener("click", (e) => {
        if (e.target === goalModal) {
            closeGoalModal();
        }
    });
}

document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "goalAutoLinkSavings") {
        updateGoalAutoLinkHint();
    }
});

if (deleteGoalModalClose) {
    deleteGoalModalClose.addEventListener("click", closeDeleteGoalModal);
}

if (deleteGoalCancel) {
    deleteGoalCancel.addEventListener("click", closeDeleteGoalModal);
}

if (deleteGoalModal) {
    deleteGoalModal.addEventListener("click", (e) => {
        if (e.target === deleteGoalModal) {
            closeDeleteGoalModal();
        }
    });
}

if (goalContributionModalClose) {
    goalContributionModalClose.addEventListener("click", closeGoalContributionModal);
}

if (goalContributionCancel) {
    goalContributionCancel.addEventListener("click", closeGoalContributionModal);
}

if (goalContributionModal) {
    goalContributionModal.addEventListener("click", (e) => {
        if (e.target === goalContributionModal) {
            closeGoalContributionModal();
        }
    });
}

if (deleteGoalConfirm) {
    deleteGoalConfirm.addEventListener("click", async () => {
        const goalId = deleteGoalIdInput ? deleteGoalIdInput.value : "";
        if (!goalId) return;

        try {
            const response = await fetch(API + `/goals/${goalId}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || "Failed to delete goal");
            }

            closeDeleteGoalModal();
            await loadGoals();
            showToast("Goal deleted");
        } catch (error) {
            console.error("Error deleting goal:", error);
            showToast("Could not delete goal");
        }
    });
}

if (goalForm) {
    goalForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const goalId = document.getElementById("goalId").value.trim();
        const name = document.getElementById("goalName").value.trim();
        const category = document.getElementById("goalCategory").value.trim();
        const icon = getCategoryIcon(category) || "🎯";
        const target_amount = parseFloat(document.getElementById("goalTargetAmount").value);
        const saved_amount = parseFloat(document.getElementById("goalSavedAmount").value);
        const deadline = document.getElementById("goalDeadline").value;
        const auto_link_savings = document.getElementById("goalAutoLinkSavings")?.checked || false;

        if (!name || !category || !deadline || Number.isNaN(target_amount) || Number.isNaN(saved_amount)) {
            alert("Please fill in all goal fields correctly.");
            return;
        }

        try {
            const isEditing = !!goalId;

            const response = await fetch(isEditing ? API + `/goals/${goalId}` : API + "/goals", {
                method: isEditing ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    target_amount,
                    saved_amount,
                    deadline,
                    icon,
                    category,
                    auto_link_savings
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Goal server response:", errorText);
                throw new Error(errorText || "Failed to save goal");
            }

            closeGoalModal();

            if (typeof loadGoals === "function") {
                await loadGoals();
            }

            showToast(goalId ? "Goal updated" : "Goal added");
        } catch (error) {
            console.error("Error adding goal:", error);
            showToast("Could not save goal");
        }
    });
}

if (goalContributionForm) {
    goalContributionForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const goalId = goalContributionIdInput ? goalContributionIdInput.value : "";
        const amount = parseFloat(goalContributionAmountInput ? goalContributionAmountInput.value : "");
        const date = goalContributionDateInput ? goalContributionDateInput.value : "";
        const note = goalContributionNoteInput ? goalContributionNoteInput.value.trim() : "";

        if (!goalId || Number.isNaN(amount) || amount <= 0 || !date) {
            showToast("Enter a valid contribution amount");
            return;
        }

        try {
            if (goalContributionSubmitBtn) {
                goalContributionSubmitBtn.disabled = true;
                goalContributionSubmitBtn.textContent = "Adding...";
            }

            const response = await fetch(API + `/goals/${goalId}/contribute`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    amount,
                    date,
                    note
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || "Failed to add contribution");
            }

            closeGoalContributionModal();
            recentGoalSavingsAnimation = {
                goalId,
                amount
            };
            await loadGoals();
            showToast("Savings added");
        } catch (error) {
            console.error("Error adding contribution:", error);
            showToast("Could not add contribution");
        } finally {
            if (goalContributionSubmitBtn) {
                goalContributionSubmitBtn.disabled = false;
                goalContributionSubmitBtn.textContent = "Add Savings";
            }
        }
    });
}
// ==============================
// ADD BUDGET MODAL
// ==============================
const budgetModal = document.getElementById("budgetModal");
const addBudgetBtn = document.getElementById("addBudgetBtn");
const budgetModalClose = document.getElementById("budgetModalClose");
const budgetModalCancel = document.getElementById("budgetModalCancel");
const budgetForm = document.getElementById("budgetForm");
const deleteBudgetBtn = document.getElementById("deleteBudgetBtn");
const viewBudgetTransactionsBtn = document.getElementById("viewBudgetTransactionsBtn");
const budgetRuleCategoryBtn = document.getElementById("budgetRuleCategoryBtn");
const budgetRuleKeywordBtn = document.getElementById("budgetRuleKeywordBtn");
const budgetTrackingRuleInput = document.getElementById("budgetTrackingRule");
const budgetKeywordRow = document.getElementById("budgetKeywordRow");
const budgetMatchKeywordInput = document.getElementById("budgetMatchKeyword");
const deleteBudgetModal = document.getElementById("deleteBudgetModal");
const deleteBudgetModalClose = document.getElementById("deleteBudgetModalClose");
const deleteBudgetCancel = document.getElementById("deleteBudgetCancel");
const deleteBudgetConfirm = document.getElementById("deleteBudgetConfirm");
const deleteBudgetIdInput = document.getElementById("deleteBudgetId");

function setBudgetTrackingRule(rule = "category", keyword = "") {
    const normalized = rule === "keyword" ? "keyword" : "category";

    if (budgetTrackingRuleInput) {
        budgetTrackingRuleInput.value = normalized;
    }

    if (budgetRuleCategoryBtn) {
        budgetRuleCategoryBtn.classList.toggle("active", normalized === "category");
    }

    if (budgetRuleKeywordBtn) {
        budgetRuleKeywordBtn.classList.toggle("active", normalized === "keyword");
    }

    if (budgetKeywordRow) {
        budgetKeywordRow.style.display = normalized === "keyword" ? "flex" : "none";
    }

    if (budgetMatchKeywordInput) {
        budgetMatchKeywordInput.value = normalized === "keyword" ? keyword : "";
    }
}

function openBudgetModal(budget = null) {
    if (!budgetModal) return;

    const budgetIdInput = document.getElementById("budgetId");
    const budgetModalTitle = document.getElementById("budgetModalTitle");
    const budgetSubmitBtn = document.getElementById("budgetSubmitBtn");
    const budgetCategoryInput = document.getElementById("budgetCategory");
    const budgetAmountInput = document.getElementById("budgetAmount");
    const budgetStartDateInput = document.getElementById("budgetStartDate");
    const budgetDaysInput = document.getElementById("budgetDays");

    if (budgetForm) {
        budgetForm.reset();
    }

    document.querySelectorAll(".budget-duration-btn").forEach(btn => {
        btn.classList.remove("active");
    });

    if (budget) {
        if (deleteBudgetBtn) {
            deleteBudgetBtn.style.display = "inline-flex";
        }

        if (viewBudgetTransactionsBtn) {
            viewBudgetTransactionsBtn.style.display = "inline-flex";
            viewBudgetTransactionsBtn.dataset.category = budget.category || "";
            viewBudgetTransactionsBtn.dataset.keyword = budget.match_keyword || "";
            viewBudgetTransactionsBtn.dataset.startDate = budget.start_date || budget.period_start || "";
            viewBudgetTransactionsBtn.dataset.endDate = budget.end_date || "";
        }

        setBudgetTrackingRule(
            budget.match_keyword ? "keyword" : "category",
            budget.match_keyword || ""
        );

        const categoryName = budget.category || "";
        const categoryIcon = getCategoryIcon(categoryName);

        if (budgetIdInput) budgetIdInput.value = budget.id || "";
        if (budgetModalTitle) budgetModalTitle.textContent = "Edit Budget";
        if (budgetSubmitBtn) budgetSubmitBtn.textContent = "Save Changes";
        if (budgetAmountInput) budgetAmountInput.value = budget.amount || "";

        setSelectedBudgetCategory(categoryName, categoryIcon);

        if (budgetStartDateInput) {
            let rawDate = "";
            if (budget.start_date) {
                const parsedDate = new Date(budget.start_date);
                if (!Number.isNaN(parsedDate.getTime())) {
                    rawDate = parsedDate.toISOString().split("T")[0];
                }
            }
            budgetStartDateInput.value = rawDate || new Date().toISOString().split("T")[0];
        }

        if (budgetDaysInput) {
            budgetDaysInput.value = budget.days || 30;
        }

        document.querySelectorAll(".budget-duration-btn").forEach(btn => {
            btn.classList.toggle("active", String(btn.dataset.days) === String(budget.days || 30));
        });
    } else {
        if (deleteBudgetBtn) {
            deleteBudgetBtn.style.display = "none";
        }

        if (viewBudgetTransactionsBtn) {
            viewBudgetTransactionsBtn.style.display = "none";
            viewBudgetTransactionsBtn.dataset.category = "";
            viewBudgetTransactionsBtn.dataset.keyword = "";
            viewBudgetTransactionsBtn.dataset.startDate = "";
            viewBudgetTransactionsBtn.dataset.endDate = "";
        }

        setBudgetTrackingRule("category", "");

        const now = new Date();

        if (budgetIdInput) budgetIdInput.value = "";
        if (budgetModalTitle) budgetModalTitle.textContent = "Create Budget";
        if (budgetSubmitBtn) budgetSubmitBtn.textContent = "Save Budget";
        setSelectedBudgetCategory("", "🏷️");

        if (budgetStartDateInput) {
            budgetStartDateInput.value = now.toISOString().split("T")[0];
        }

        if (budgetDaysInput) {
            budgetDaysInput.value = "30";
        }

        document.querySelectorAll(".budget-duration-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.days === "30");
        });
    }

    budgetModal.style.display = "flex";
}

function closeBudgetModal() {
    if (!budgetModal) return;
    budgetModal.style.display = "none";

    if (budgetForm) {
        budgetForm.reset();
    }
}

function openDeleteBudgetModal(budgetId) {
    if (!deleteBudgetModal || !deleteBudgetIdInput) return;
    deleteBudgetIdInput.value = budgetId;
    deleteBudgetModal.style.display = "flex";
}

function closeDeleteBudgetModal() {
    if (!deleteBudgetModal || !deleteBudgetIdInput) return;
    deleteBudgetModal.style.display = "none";
    deleteBudgetIdInput.value = "";
}

if (addBudgetBtn) {
    addBudgetBtn.addEventListener("click", openBudgetModal);
}

if (budgetModalClose) {
    budgetModalClose.addEventListener("click", closeBudgetModal);
}

if (budgetModalCancel) {
    budgetModalCancel.addEventListener("click", closeBudgetModal);
}

if (budgetRuleCategoryBtn) {
    budgetRuleCategoryBtn.addEventListener("click", () => {
        setBudgetTrackingRule("category", "");
    });
}

if (budgetRuleKeywordBtn) {
    budgetRuleKeywordBtn.addEventListener("click", () => {
        setBudgetTrackingRule("keyword", budgetMatchKeywordInput ? budgetMatchKeywordInput.value : "");
    });
}

if (deleteBudgetBtn) {
    deleteBudgetBtn.addEventListener("click", () => {
        const budgetId = document.getElementById("budgetId").value.trim();
        if (!budgetId) return;

        openDeleteBudgetModal(budgetId);
    });
}

if (viewBudgetTransactionsBtn) {
    viewBudgetTransactionsBtn.addEventListener("click", async () => {
        const category = viewBudgetTransactionsBtn.dataset.category || "";
        const keyword = viewBudgetTransactionsBtn.dataset.keyword || "";
        const startDate = viewBudgetTransactionsBtn.dataset.startDate || "";
        const endDate = viewBudgetTransactionsBtn.dataset.endDate || "";

        console.log("Budget related filter:", { category, keyword, startDate, endDate });

        closeBudgetModal();

        document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
        document.querySelector('.nav-item[data-page="transactions"]')?.classList.add('active');

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-transactions')?.classList.add('active');

        if (pageMeta.transactions) {
            document.querySelector('.page-title').textContent = pageMeta.transactions.title;
            document.querySelector('.page-subtitle').textContent = pageMeta.transactions.sub;
        }

        const txSearch = document.getElementById('txSearch');
        const txTypeFilter = document.getElementById('txTypeFilter');
        const txAccountFilter = document.getElementById('txAccountFilter');
        const txSortFilter = document.getElementById('txSortFilter');
        const fromInput = document.getElementById('txDateFromFilter');
        const toInput = document.getElementById('txDateToFilter');

        if (txSearch) {
            txSearch.value = keyword
                ? `${category} / ${keyword}`
                : category;
        }

        if (txTypeFilter) txTypeFilter.value = "expense";
        if (txAccountFilter) txAccountFilter.value = "";
        if (txSortFilter) txSortFilter.value = "date_desc";

        setTransactionCategoryFilter('', '🏷️');

        if (fromInput && startDate) {
            fromInput.value = String(startDate).slice(0, 10);
        }

        if (toInput && endDate) {
            toInput.value = String(endDate).slice(0, 10);
        }

        let source = transactionsLoadedFromBackend ? allTransactions : DEMO_TRANSACTIONS;

        try {
            const response = await fetch(API + '/transactions');
            const data = await response.json();

            if (response.ok && Array.isArray(data)) {
                transactionsLoadedFromBackend = true;
                allTransactions = data;
                source = allTransactions;
                refreshTransactionCategoryOptions();
                refreshTransactionAccountOptions();
            }
        } catch (error) {
            console.warn("Could not refresh transactions before matching budget:", error);
        }

        const normalizeDate = (value) => {
            if (!value) return "";
            const asString = String(value);
            const directMatch = asString.match(/\d{4}-\d{2}-\d{2}/);
            if (directMatch) return directMatch[0];

            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return "";

            const year = parsed.getFullYear();
            const month = String(parsed.getMonth() + 1).padStart(2, "0");
            const day = String(parsed.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };

        const cleanCategory = category.toLowerCase().trim();
        const cleanKeyword = keyword.toLowerCase().trim();
        const cleanStartDate = normalizeDate(startDate);
        const cleanEndDate = normalizeDate(endDate);

        filtered = source.filter(tx => {
            const txName = String(tx.name || "").toLowerCase();
            const txCategory = String(tx.category || "").toLowerCase();
            const txAmount = parseFloat(tx.amount || 0);
            const txDateOnly = normalizeDate(tx.date);

            const categoryMatch =
                cleanCategory && txCategory === cleanCategory;

            const keywordMatch =
                cleanKeyword &&
                (
                    txName.includes(cleanKeyword) ||
                    txCategory.includes(cleanKeyword)
                );

            const matchesDate =
                (!cleanStartDate || txDateOnly >= cleanStartDate) &&
                (!cleanEndDate || txDateOnly <= cleanEndDate);

            return txAmount < 0 && matchesDate && (categoryMatch || keywordMatch);
        });

        filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        currentPage = 1;
        renderTable();
        showToast("Showing matched transactions for this budget");
    });
}

if (budgetModal) {
    budgetModal.addEventListener("click", (e) => {
        if (e.target === budgetModal) {
            closeBudgetModal();
        }
    });
}

if (deleteBudgetModalClose) {
    deleteBudgetModalClose.addEventListener("click", closeDeleteBudgetModal);
}

if (deleteBudgetCancel) {
    deleteBudgetCancel.addEventListener("click", closeDeleteBudgetModal);
}

if (deleteBudgetModal) {
    deleteBudgetModal.addEventListener("click", (e) => {
        if (e.target === deleteBudgetModal) {
            closeDeleteBudgetModal();
        }
    });
}

if (deleteBudgetConfirm) {
    deleteBudgetConfirm.addEventListener("click", async () => {
        const budgetId = deleteBudgetIdInput ? deleteBudgetIdInput.value : "";
        if (!budgetId) return;

        try {
            const response = await fetch(API + "/budgets/" + budgetId, {
                method: "DELETE"
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || "Failed to delete budget");
            }

            closeDeleteBudgetModal();
            closeBudgetModal();
            await loadBudgets();
            showToast("Budget deleted");
        } catch (error) {
            console.error("Error deleting budget:", error);
            alert("Could not delete budget: " + error.message);
        }
    });
}

if (budgetForm) {
    budgetForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const budgetId = document.getElementById("budgetId").value.trim();
        const category = document.getElementById("budgetCategory").value;
        const amount = parseFloat(document.getElementById("budgetAmount").value);
        const start_date = document.getElementById("budgetStartDate").value;
        const days = parseInt(document.getElementById("budgetDays").value, 10);
        const tracking_rule = document.getElementById("budgetTrackingRule").value;
        const match_keyword = document.getElementById("budgetMatchKeyword").value.trim();

        if (!category || Number.isNaN(amount) || !start_date || Number.isNaN(days) || days < 1) {
            showToast("Please fill in all budget fields correctly");
            return;
        }

        try {
            const isEditing = !!budgetId;

            const response = await fetch(
                isEditing
                    ? `http://127.0.0.1:5000/api/budgets/${budgetId}`
                    : "http://127.0.0.1:5000/api/budgets",
                {
                method: isEditing ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    category,
                    amount,
                    start_date,
                    days,
                    tracking_rule,
                    match_keyword: tracking_rule === "keyword" ? match_keyword : ""
                })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Budget server response:", errorText);
                throw new Error(errorText || "Failed to save budget");
            }

            closeBudgetModal();

            if (typeof loadBudgets === "function") {
                await loadBudgets();
            }

            showToast(budgetId ? "Budget updated" : "Budget added");
        } catch (error) {
            console.error("Error adding budget:", error);
            alert("Could not add budget: " + error.message);
        }
    });
}

// ==============================
// EXPORT TRANSACTIONS TO CSV
// ==============================
function convertTransactionsToCSV(rows) {
    const headers = ["ID", "Name", "Category", "Account", "Date", "Amount"];

    const escapeCSV = (value) => {
        const str = String(value ?? "");
        if (str.includes('"') || str.includes(",") || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const csvRows = [
        headers.join(","),
        ...rows.map(tx => [
            escapeCSV(tx.id),
            escapeCSV(tx.name),
            escapeCSV(tx.category),
            escapeCSV(tx.account),
            escapeCSV(tx.date),
            escapeCSV(tx.amount)
        ].join(","))
    ];

    return csvRows.join("\n");
}

function downloadCSVFile(filename, csvContent) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

async function exportTransactionsToCSV() {
    try {
        let rows = [];

        if (Array.isArray(allTransactions) && allTransactions.length > 0) {
            rows = allTransactions;
        } else {
            const response = await fetch(API + "/transactions");
            if (!response.ok) {
                throw new Error("Failed to load transactions for export");
            }
            rows = await response.json();
        }

        if (!Array.isArray(rows) || rows.length === 0) {
            alert("No transactions available to export.");
            return;
        }

        const csvContent = convertTransactionsToCSV(rows);
        const today = new Date().toISOString().split("T")[0];
        downloadCSVFile(`fintrack-transactions-${today}.csv`, csvContent);
    } catch (error) {
        console.error("Error exporting transactions:", error);
        alert("Could not export transactions: " + error.message);
    }
}

if (exportTransactionsBtn) {
    exportTransactionsBtn.addEventListener("click", () => {
        if (exportTransactionsBtn.disabled) return;
        exportTransactionsToCSV();
    });
}

// ==============================
// TOAST NOTIFICATIONS
// ==============================
function showToast(message) {
    let toast = document.getElementById('fintrack-toast');

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'fintrack-toast';
        toast.style.position = 'fixed';
        toast.style.right = '20px';
        toast.style.bottom = '20px';
        toast.style.padding = '12px 16px';
        toast.style.borderRadius = '12px';
        toast.style.background = 'rgba(17, 24, 39, 0.96)';
        toast.style.color = '#ffffff';
        toast.style.fontSize = '14px';
        toast.style.fontWeight = '600';
        toast.style.boxShadow = '0 12px 30px rgba(0,0,0,0.18)';
        toast.style.zIndex = '99999';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
        toast.style.pointerEvents = 'none';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(window.fintrackToastTimer);
    window.fintrackToastTimer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
    }, 1800);
}
// ==============================
// PREMIUM QUICK ADD CATEGORY
// ==============================
const quickAddCategoryBtn = document.getElementById("quickAddCategoryBtn");
const categoryQuickModal = document.getElementById("categoryQuickModal");
const categoryQuickModalClose = document.getElementById("categoryQuickModalClose");
const categoryQuickModalCancel = document.getElementById("categoryQuickModalCancel");
const categoryQuickForm = document.getElementById("categoryQuickForm");
const quickCategoryName = document.getElementById("quickCategoryName");
const transactionCategorySelect = document.getElementById("transactionCategory");
const quickAddRecurringCategoryBtn = document.getElementById("quickAddRecurringCategoryBtn");
const quickAddGoalCategoryBtn = document.getElementById("quickAddGoalCategoryBtn");

function openCategoryQuickModal() {
    if (!categoryQuickModal) return;
    categoryQuickModal.style.display = "flex";
    if (quickCategoryName) {
        quickCategoryName.value = "";
        setQuickCategoryIcon('🏷️', 'Choose icon');
        setTimeout(() => quickCategoryName.focus(), 50);
    }
}

function closeCategoryQuickModal() {
    if (!categoryQuickModal) return;
    categoryQuickModal.style.display = "none";
    if (categoryQuickForm) {
        categoryQuickForm.reset();
    }
}

function addCategoryToSelect(categoryName, shouldSelect = true, categoryIcon = '🏷️') {
    const cleanName = String(categoryName || '').trim();
    if (!cleanName) return;

    const normalized = cleanName.toLowerCase();

    const existingCategory = allCategories.find(
        cat => String(cat.name || '').trim().toLowerCase() === normalized
    );

    if (!existingCategory) {
        allCategories.push({
            name: cleanName,
            icon: categoryIcon || '🏷️'
        });

        allCategories.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }

    refreshTransactionCategoryOptions();

    if (shouldSelect) {
        setSelectedTransactionCategory(cleanName, categoryIcon || getCategoryIcon(cleanName));
    }

    return cleanName;
}

if (quickAddCategoryBtn) {
    quickAddCategoryBtn.addEventListener("click", () => {
        categoryPickerTarget = "transaction";
        openCategoryQuickModal();
    });
}

if (quickAddRecurringCategoryBtn) {
    quickAddRecurringCategoryBtn.addEventListener("click", () => {
        categoryPickerTarget = "recurring";
        openCategoryQuickModal();
    });
}

if (quickAddGoalCategoryBtn) {
    quickAddGoalCategoryBtn.addEventListener("click", () => {
        categoryPickerTarget = "goal";
        openCategoryQuickModal();
    });
}

if (categoryQuickModalClose) {
    categoryQuickModalClose.addEventListener("click", closeCategoryQuickModal);
}

if (categoryQuickModalCancel) {
    categoryQuickModalCancel.addEventListener("click", closeCategoryQuickModal);
}

if (categoryQuickModal) {
    categoryQuickModal.addEventListener("click", (e) => {
        if (e.target === categoryQuickModal) {
            closeCategoryQuickModal();
        }
    });
}

if (categoryQuickForm) {
    categoryQuickForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const newCategoryName = quickCategoryName.value.trim();

        if (!newCategoryName) {
            alert("Please enter a category name.");
            return;
        }

        try {
            const response = await fetch(API + '/categories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: newCategoryName,
                    icon: quickCategoryIconInput ? quickCategoryIconInput.value : '🏷️'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to save category');
            }

            const savedCategory = await response.json();
            const savedName = savedCategory.name || newCategoryName;
            const savedIcon = savedCategory.icon || '🏷️';

            addCategoryToSelect(savedName, categoryPickerTarget === "transaction", savedIcon);

            if (categoryPickerTarget === "budget") {
                setSelectedBudgetCategory(savedName, savedIcon);
            }

            if (categoryPickerTarget === "recurring") {
                setSelectedRecurringCategory(savedName, savedIcon);
            }

            if (categoryPickerTarget === "goal") {
                setSelectedGoalCategory(savedName, savedIcon);
            }

            closeCategoryQuickModal();
            renderCategoryPickerGrid('');
            showToast(`Category "${savedName}" added`);
        } catch (error) {
            console.error('Error adding category:', error);
            alert('Could not add category: ' + error.message);
        }
    });
}

if (deleteTransactionConfirm) {
    deleteTransactionConfirm.addEventListener("click", async () => {
        const txId = deleteTransactionIdInput ? deleteTransactionIdInput.value : "";

        if (!txId) return;

        try {
            const response = await fetch(API + '/transactions/' + txId, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to delete transaction');
            }

            closeDeleteTransactionModal();
            await loadTransactions();
            await loadDashboard();
            showToast('Transaction deleted');
        } catch (error) {
            console.error('Error deleting transaction:', error);
            alert('Could not delete transaction: ' + error.message);
        }
    });
}

if (deleteAllTransactionsConfirm) {
    deleteAllTransactionsConfirm.addEventListener("click", async () => {
        try {
            const response = await fetch(API + '/transactions', {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to delete all transactions');
            }

            closeDeleteAllTransactionsModal();
            await loadTransactions();
            await loadDashboard();
            showToast('All transactions deleted');
        } catch (error) {
            console.error('Error deleting all transactions:', error);
            alert('Could not delete all transactions: ' + error.message);
        }
    });
}
// ==============================
// PREMIUM CATEGORY PICKER
// ==============================
const openCategoryPickerBtn = document.getElementById("openCategoryPickerBtn");
const openRecurringCategoryPickerBtn = document.getElementById("openRecurringCategoryPickerBtn");
const openGoalCategoryPickerBtn = document.getElementById("openGoalCategoryPickerBtn");
const categoryPickerModal = document.getElementById("categoryPickerModal");
const categoryPickerModalClose = document.getElementById("categoryPickerModalClose");
const categoryPickerSearch = document.getElementById("categoryPickerSearch");
const categoryPickerGrid = document.getElementById("categoryPickerGrid");
const categoryPickerTitle = document.getElementById("categoryPickerTitle");
const categoryPickerDesc = document.getElementById("categoryPickerDesc");
const transactionCategoryHidden = document.getElementById("transactionCategory");
const transactionCategoryDisplay = document.getElementById("transactionCategoryDisplay");
const transactionCategoryIcon = document.getElementById("transactionCategoryIcon");
const recurringCategoryHidden = document.getElementById("recurringCategory");
const recurringCategoryDisplay = document.getElementById("recurringCategoryDisplay");
const recurringCategoryIcon = document.getElementById("recurringCategoryIcon");
const goalCategoryHidden = document.getElementById("goalCategory");
const goalCategoryDisplay = document.getElementById("goalCategoryDisplay");
const goalCategoryIcon = document.getElementById("goalCategoryIcon");

function setSelectedTransactionCategory(name, icon = '🏷️') {
    const cleanName = String(name || '').trim();

    if (transactionCategoryHidden) {
        transactionCategoryHidden.value = cleanName;
    }

    if (transactionCategoryDisplay) {
        transactionCategoryDisplay.textContent = cleanName || 'Select category';
    }

    if (transactionCategoryIcon) {
        transactionCategoryIcon.textContent = icon || '🏷️';
    }
}

function setSelectedRecurringCategory(name, icon = "🏷️") {
    const cleanName = String(name || "").trim();

    if (recurringCategoryHidden) recurringCategoryHidden.value = cleanName;
    if (recurringCategoryDisplay) recurringCategoryDisplay.textContent = cleanName || "Select category";
    if (recurringCategoryIcon) recurringCategoryIcon.textContent = icon || "🏷️";
}

function setSelectedGoalCategory(name, icon = "🏷️") {
    const cleanName = String(name || "").trim();

    if (goalCategoryHidden) goalCategoryHidden.value = cleanName;
    if (goalCategoryDisplay) goalCategoryDisplay.textContent = cleanName || "Select category";
    if (goalCategoryIcon) goalCategoryIcon.textContent = icon || "🏷️";
}

function renderCategoryPickerGrid(searchTerm = '') {
    if (!categoryPickerGrid) return;

    const term = String(searchTerm || '').trim().toLowerCase();
    const categories = (allCategories.length > 0 ? allCategories : [
        { name: 'Income', icon: '💰' },
        { name: 'Groceries', icon: '🛒' },
        { name: 'Entertainment', icon: '🎬' },
        { name: 'Transport', icon: '🚗' },
        { name: 'Utilities', icon: '⚡' },
        { name: 'Housing', icon: '🏠' },
        { name: 'Dining', icon: '🍽️' },
        { name: 'Health', icon: '💊' },
        { name: 'Shopping', icon: '🛍️' },
        { name: 'Other', icon: '🏷️' }
    ]).filter(cat => {
        const name = String(cat.name || '').toLowerCase();
        const icon = String(cat.icon || '').toLowerCase();
        return !term || name.includes(term) || icon.includes(term);
    });

    if (categories.length === 0) {
        categoryPickerGrid.innerHTML = `
            <div class="category-picker-empty">
                No categories found.
            </div>
        `;
        return;
    }

    const selectedValue =
        categoryPickerTarget === "budget"
            ? (budgetCategoryHidden ? budgetCategoryHidden.value : '')
            : categoryPickerTarget === "recurring"
                ? (recurringCategoryHidden ? recurringCategoryHidden.value : '')
                : categoryPickerTarget === "goal"
                    ? (goalCategoryHidden ? goalCategoryHidden.value : '')
                    : (transactionCategoryHidden ? transactionCategoryHidden.value : '');

    categoryPickerGrid.innerHTML = categories.map(cat => {
        const name = cat.name || 'Other';
        const icon = cat.icon || '🏷️';
        const activeClass = String(selectedValue) === String(name) ? 'active' : '';

        return `
            <button
                type="button"
                class="category-picker-card ${activeClass}"
                data-name="${name}"
                data-icon="${icon}"
            >
                <span class="category-picker-card-icon">${icon}</span>
                <span class="category-picker-card-name">${name}</span>
            </button>
        `;
    }).join('');

    categoryPickerGrid.querySelectorAll('.category-picker-card').forEach(card => {
        card.addEventListener('click', () => {
            const name = card.dataset.name || 'Other';
            const icon = card.dataset.icon || '🏷️';

            if (categoryPickerTarget === "budget") {
                setSelectedBudgetCategory(name, icon);
            } else if (categoryPickerTarget === "recurring") {
                setSelectedRecurringCategory(name, icon);
            } else if (categoryPickerTarget === "goal") {
                setSelectedGoalCategory(name, icon);
            } else {
                setSelectedTransactionCategory(name, icon);
            }

            closeCategoryPickerModal();
        });
    });
}

function openCategoryPickerModal() {
    if (!categoryPickerModal) return;

    const contextLabels = {
        transaction: 'this transaction',
        budget: 'this budget',
        recurring: 'this recurring payment',
        goal: 'this goal'
    };
    const contextLabel = contextLabels[categoryPickerTarget] || 'this item';

    if (categoryPickerTitle) {
        categoryPickerTitle.textContent = 'Choose Category';
    }

    if (categoryPickerDesc) {
        categoryPickerDesc.textContent = `Select a category for ${contextLabel}.`;
    }

    categoryPickerModal.style.display = 'flex';
    renderCategoryPickerGrid(categoryPickerSearch ? categoryPickerSearch.value : '');

    if (categoryPickerSearch) {
        categoryPickerSearch.value = '';
        setTimeout(() => categoryPickerSearch.focus(), 50);
    }
}

function closeCategoryPickerModal() {
    if (!categoryPickerModal) return;
    categoryPickerModal.style.display = 'none';

    if (categoryPickerSearch) {
        categoryPickerSearch.value = '';
    }
}

if (openCategoryPickerBtn) {
    openCategoryPickerBtn.addEventListener('click', () => {
        categoryPickerTarget = "transaction";
        openCategoryPickerModal();
    });
}

if (openRecurringCategoryPickerBtn) {
    openRecurringCategoryPickerBtn.addEventListener("click", () => {
        categoryPickerTarget = "recurring";
        openCategoryPickerModal();
    });
}

if (openGoalCategoryPickerBtn) {
    openGoalCategoryPickerBtn.addEventListener("click", () => {
        categoryPickerTarget = "goal";
        openCategoryPickerModal();
    });
}

if (categoryPickerModalClose) {
    categoryPickerModalClose.addEventListener('click', closeCategoryPickerModal);
}

if (categoryPickerModal) {
    categoryPickerModal.addEventListener('click', (e) => {
        if (e.target === categoryPickerModal) {
            closeCategoryPickerModal();
        }
    });
}

if (categoryPickerSearch) {
    categoryPickerSearch.addEventListener('input', (e) => {
        renderCategoryPickerGrid(e.target.value);
    });
}
// ==============================
// CATEGORY ICON PICKER
// ==============================
const openCategoryIconPickerBtn = document.getElementById("openCategoryIconPickerBtn");
const categoryIconPickerModal = document.getElementById("categoryIconPickerModal");
const categoryIconPickerModalClose = document.getElementById("categoryIconPickerModalClose");
const categoryIconPickerSearch = document.getElementById("categoryIconPickerSearch");
const categoryIconPickerGrid = document.getElementById("categoryIconPickerGrid");
const categoryIconPickerPopularGrid = document.getElementById("categoryIconPickerPopularGrid");
const quickCategoryIconPreviewLarge = document.getElementById("quickCategoryIconPreviewLarge");
const quickCategoryIconPreviewName = document.getElementById("quickCategoryIconPreviewName");
const customCategoryEmoji = document.getElementById("customCategoryEmoji");
const applyCustomEmojiBtn = document.getElementById("applyCustomEmojiBtn");
const quickCategoryIconInput = document.getElementById("quickCategoryIcon");
const quickCategoryIconPreview = document.getElementById("quickCategoryIconPreview");
const quickCategoryIconLabel = document.getElementById("quickCategoryIconLabel");

const CATEGORY_ICON_SET = [
    { icon: '🏷️', label: 'Tag' },
    { icon: '💰', label: 'Income' },
    { icon: '💵', label: 'Cash' },
    { icon: '🏦', label: 'Bank' },
    { icon: '📈', label: 'Investment' },
    { icon: '📉', label: 'Loss' },
    { icon: '💳', label: 'Card' },
    { icon: '🧾', label: 'Bills' },
    { icon: '🛒', label: 'Groceries' },
    { icon: '🛍️', label: 'Shopping' },
    { icon: '🍽️', label: 'Dining' },
    { icon: '☕', label: 'Coffee' },
    { icon: '🍔', label: 'Food' },
    { icon: '🍕', label: 'Pizza' },
    { icon: '🧋', label: 'Bubble Tea' },
    { icon: '🍜', label: 'Noodles' },
    { icon: '🚗', label: 'Car' },
    { icon: '⛽', label: 'Fuel' },
    { icon: '🚌', label: 'Bus' },
    { icon: '🚕', label: 'Taxi' },
    { icon: '🚆', label: 'Train' },
    { icon: '✈️', label: 'Travel' },
    { icon: '🏠', label: 'Housing' },
    { icon: '🛏️', label: 'Rent' },
    { icon: '⚡', label: 'Electricity' },
    { icon: '💧', label: 'Water' },
    { icon: '📶', label: 'Internet' },
    { icon: '📱', label: 'Phone' },
    { icon: '💊', label: 'Health' },
    { icon: '🏥', label: 'Medical' },
    { icon: '💪', label: 'Fitness' },
    { icon: '🧠', label: 'Therapy' },
    { icon: '🎬', label: 'Movies' },
    { icon: '🎵', label: 'Music' },
    { icon: '🎮', label: 'Games' },
    { icon: '🎁', label: 'Gifts' },
    { icon: '📚', label: 'Education' },
    { icon: '💼', label: 'Work' },
    { icon: '🎨', label: 'Art' },
    { icon: '🐶', label: 'Pets' },
    { icon: '🐱', label: 'Cat' },
    { icon: '👶', label: 'Kids' },
    { icon: '🧸', label: 'Baby' },
    { icon: '📦', label: 'Packages' },
    { icon: '🧹', label: 'Home Care' },
    { icon: '🌿', label: 'Garden' }
];

const CATEGORY_ICON_POPULAR = [
    { icon: '💰', label: 'Income' },
    { icon: '🛒', label: 'Groceries' },
    { icon: '🍽️', label: 'Dining' },
    { icon: '🚗', label: 'Transport' },
    { icon: '🏠', label: 'Housing' },
    { icon: '⚡', label: 'Bills' },
    { icon: '💊', label: 'Health' },
    { icon: '🛍️', label: 'Shopping' },
    { icon: '🎬', label: 'Entertainment' },
    { icon: '✈️', label: 'Travel' }
];

function setQuickCategoryIcon(icon, label = 'Choose icon') {
    const finalIcon = icon || '🏷️';
    const finalLabel = label || 'Choose icon';

    if (quickCategoryIconInput) quickCategoryIconInput.value = finalIcon;
    if (quickCategoryIconPreview) quickCategoryIconPreview.textContent = finalIcon;
    if (quickCategoryIconLabel) quickCategoryIconLabel.textContent = finalLabel;
    if (quickCategoryIconPreviewLarge) quickCategoryIconPreviewLarge.textContent = finalIcon;
    if (quickCategoryIconPreviewName) quickCategoryIconPreviewName.textContent = finalLabel;
}

function renderCategoryIconPickerGrid(searchTerm = '') {
    const term = String(searchTerm || '').trim().toLowerCase();
    const selectedIcon = quickCategoryIconInput ? quickCategoryIconInput.value : '🏷️';

    const allIcons = CATEGORY_ICON_SET.filter(item => {
        const icon = String(item.icon || '').toLowerCase();
        const label = String(item.label || '').toLowerCase();
        return !term || icon.includes(term) || label.includes(term);
    });

    const popularIcons = CATEGORY_ICON_POPULAR.filter(item => {
        const icon = String(item.icon || '').toLowerCase();
        const label = String(item.label || '').toLowerCase();
        return !term || icon.includes(term) || label.includes(term);
    });

    if (categoryIconPickerPopularGrid) {
        categoryIconPickerPopularGrid.innerHTML = popularIcons.map(item => `
            <button
                type="button"
                class="category-picker-card ${selectedIcon === item.icon ? 'active' : ''}"
                data-icon="${item.icon}"
                data-label="${item.label}"
            >
                <span class="category-picker-card-icon">${item.icon}</span>
                <span class="category-picker-card-name">${item.label}</span>
            </button>
        `).join('');
    }

    if (categoryIconPickerGrid) {
        if (allIcons.length === 0) {
            categoryIconPickerGrid.innerHTML = `
                <div class="category-picker-empty">
                    No icons found.
                </div>
            `;
        } else {
            categoryIconPickerGrid.innerHTML = allIcons.map(item => `
                <button
                    type="button"
                    class="category-picker-card ${selectedIcon === item.icon ? 'active' : ''}"
                    data-icon="${item.icon}"
                    data-label="${item.label}"
                >
                    <span class="category-picker-card-icon">${item.icon}</span>
                    <span class="category-picker-card-name">${item.label}</span>
                </button>
            `).join('');
        }
    }

    document.querySelectorAll('#categoryIconPickerPopularGrid .category-picker-card, #categoryIconPickerGrid .category-picker-card')
        .forEach(card => {
            card.addEventListener('click', () => {
                const icon = card.dataset.icon || '🏷️';
                const label = card.dataset.label || 'Choose icon';
                setQuickCategoryIcon(icon, label);
                closeCategoryIconPickerModal();
            });
        });
}

function openCategoryIconPickerModal() {
    if (!categoryIconPickerModal) return;

    categoryIconPickerModal.style.display = 'flex';

    if (categoryIconPickerSearch) {
        categoryIconPickerSearch.value = '';
    }

    if (customCategoryEmoji) {
        customCategoryEmoji.value = '';
    }

    renderCategoryIconPickerGrid('');
    setTimeout(() => {
        if (categoryIconPickerSearch) categoryIconPickerSearch.focus();
    }, 50);
}

function closeCategoryIconPickerModal() {
    if (!categoryIconPickerModal) return;
    categoryIconPickerModal.style.display = 'none';
    if (categoryIconPickerSearch) categoryIconPickerSearch.value = '';
}

if (openCategoryIconPickerBtn) {
    openCategoryIconPickerBtn.addEventListener('click', openCategoryIconPickerModal);
}

if (categoryIconPickerModalClose) {
    categoryIconPickerModalClose.addEventListener('click', closeCategoryIconPickerModal);
}

if (categoryIconPickerModal) {
    categoryIconPickerModal.addEventListener('click', (e) => {
        if (e.target === categoryIconPickerModal) {
            closeCategoryIconPickerModal();
        }
    });
}

if (categoryIconPickerSearch) {
    categoryIconPickerSearch.addEventListener('input', (e) => {
        renderCategoryIconPickerGrid(e.target.value);
    });
}

if (applyCustomEmojiBtn) {
    applyCustomEmojiBtn.addEventListener('click', () => {
        const emoji = customCategoryEmoji ? customCategoryEmoji.value.trim() : '';

        if (!emoji) {
            alert('Please paste an emoji first.');
            return;
        }

        setQuickCategoryIcon(emoji, 'Custom emoji');
        closeCategoryIconPickerModal();
    });
}

// ==============================
// PREMIUM TRANSACTIONS CATEGORY FILTER
// ==============================
const txCategoryFilterModal = document.getElementById("txCategoryFilterModal");
const txCategoryFilterModalClose = document.getElementById("txCategoryFilterModalClose");
const txCategoryFilterSearch = document.getElementById("txCategoryFilterSearch");
const txCategoryFilterGrid = document.getElementById("txCategoryFilterGrid");
const txCategoryFilterHidden = document.getElementById("txCategoryFilter");
const txCategoryFilterDisplay = document.getElementById("txCategoryFilterDisplay");
const txCategoryFilterIcon = document.getElementById("txCategoryFilterIcon");

function setTransactionCategoryFilter(name = "", icon = "🏷️") {
    if (txCategoryFilterHidden) {
        txCategoryFilterHidden.value = name;
    }

    if (txCategoryFilterDisplay) {
        txCategoryFilterDisplay.textContent = name || "All Categories";
    }

    if (txCategoryFilterIcon) {
        txCategoryFilterIcon.textContent = name ? (icon || "🏷️") : "🏷️";
    }
}

function getFilterCategories() {
    const backendCategories = allCategories.map(cat => ({
        name: cat.name,
        icon: cat.icon || "🏷️"
    }));

    const txOnlyCategories = (transactionsLoadedFromBackend ? allTransactions : DEMO_TRANSACTIONS)
        .map(tx => String(tx.category || "").trim())
        .filter(Boolean)
        .filter(name => !backendCategories.some(cat => String(cat.name).toLowerCase() === name.toLowerCase()))
        .map(name => ({
            name,
            icon: getCategoryIcon(name)
        }));

    return [
        { name: "", icon: "🏷️", label: "All Categories" },
        ...backendCategories,
        ...txOnlyCategories
    ].sort((a, b) => {
        if (!a.name) return -1;
        if (!b.name) return 1;
        return String(a.name).localeCompare(String(b.name));
    });
}

function renderTxCategoryFilterGrid(searchTerm = "") {
    if (!txCategoryFilterGrid) return;

    const term = String(searchTerm || "").trim().toLowerCase();
    const selectedValue = txCategoryFilterHidden ? txCategoryFilterHidden.value : "";
    const categories = getFilterCategories().filter(cat => {
        const name = String(cat.name || cat.label || "").toLowerCase();
        const icon = String(cat.icon || "").toLowerCase();
        return !term || name.includes(term) || icon.includes(term);
    });

    if (categories.length === 0) {
        txCategoryFilterGrid.innerHTML = `
            <div class="category-picker-empty">
                No categories found.
            </div>
        `;
        return;
    }

    txCategoryFilterGrid.innerHTML = categories.map(cat => {
        const displayName = cat.name || cat.label || "All Categories";
        const activeClass = String(selectedValue) === String(cat.name) ? "active" : "";

        return `
            <button
                type="button"
                class="category-picker-card ${activeClass}"
                data-name="${cat.name}"
                data-icon="${cat.icon || '🏷️'}"
            >
                <span class="category-picker-card-icon">${cat.icon || "🏷️"}</span>
                <span class="category-picker-card-name">${displayName}</span>
            </button>
        `;
    }).join("");

    txCategoryFilterGrid.querySelectorAll(".category-picker-card").forEach(card => {
        card.addEventListener("click", () => {
            const name = card.dataset.name || "";
            const icon = card.dataset.icon || "🏷️";

            setTransactionCategoryFilter(name, icon);
            closeTxCategoryFilterModal();
            applyFilters();
        });
    });
}

function openTxCategoryFilterModal() {
    if (!txCategoryFilterModal) return;

    txCategoryFilterModal.style.display = "flex";

    if (txCategoryFilterSearch) {
        txCategoryFilterSearch.value = "";
    }

    renderTxCategoryFilterGrid("");

    setTimeout(() => {
        if (txCategoryFilterSearch) txCategoryFilterSearch.focus();
    }, 50);
}

function closeTxCategoryFilterModal() {
    if (!txCategoryFilterModal) return;

    txCategoryFilterModal.style.display = "none";

    if (txCategoryFilterSearch) {
        txCategoryFilterSearch.value = "";
    }
}

if (openTxCategoryFilterBtn) {
    openTxCategoryFilterBtn.addEventListener("click", openTxCategoryFilterModal);
}

if (txCategoryFilterModalClose) {
    txCategoryFilterModalClose.addEventListener("click", closeTxCategoryFilterModal);
}

if (txCategoryFilterModal) {
    txCategoryFilterModal.addEventListener("click", (e) => {
        if (e.target === txCategoryFilterModal) {
            closeTxCategoryFilterModal();
        }
    });
}

if (txCategoryFilterSearch) {
    txCategoryFilterSearch.addEventListener("input", (e) => {
        renderTxCategoryFilterGrid(e.target.value);
    });
}

// ==============================
// BUDGET CATEGORY PICKER
// ==============================
const openBudgetCategoryPickerBtn = document.getElementById("openBudgetCategoryPickerBtn");
const quickAddBudgetCategoryBtn = document.getElementById("quickAddBudgetCategoryBtn");
const budgetCategoryHidden = document.getElementById("budgetCategory");
const budgetCategoryDisplay = document.getElementById("budgetCategoryDisplay");
const budgetCategoryIcon = document.getElementById("budgetCategoryIcon");

let categoryPickerTarget = "transaction";

function setSelectedBudgetCategory(name, icon = "🏷️") {
    const cleanName = String(name || "").trim();

    if (budgetCategoryHidden) budgetCategoryHidden.value = cleanName;
    if (budgetCategoryDisplay) budgetCategoryDisplay.textContent = cleanName || "Select category";
    if (budgetCategoryIcon) budgetCategoryIcon.textContent = icon || "🏷️";
}

if (openBudgetCategoryPickerBtn) {
    openBudgetCategoryPickerBtn.addEventListener("click", () => {
        categoryPickerTarget = "budget";
        openCategoryPickerModal();
    });
}

if (quickAddBudgetCategoryBtn) {
    quickAddBudgetCategoryBtn.addEventListener("click", () => {
        categoryPickerTarget = "budget";
        openCategoryQuickModal();
    });
}

// ==============================
// BUDGET DURATION PRESETS
// ==============================
document.querySelectorAll(".budget-duration-btn").forEach(button => {
    button.addEventListener("click", () => {
        const days = button.dataset.days;
        const budgetDaysInput = document.getElementById("budgetDays");

        if (budgetDaysInput) {
            budgetDaysInput.value = days;
        }

        document.querySelectorAll(".budget-duration-btn").forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");
    });
});

// ==============================
// MONEY COACH UI
// ==============================
function formatMoneyCoachAnswer(answer) {
    if (!answer) return "";

    return answer
        .replace(/\* /g, '• ')
        .replace(/Short answer:/gi, '<div class="coach-answer-section coach-answer-main"><h4>Short answer</h4><p>')
        .replace(/Why:/gi, '</p></div><div class="coach-answer-section"><h4>Why</h4><p>')
        .replace(/Smart next move:/gi, '</p></div><div class="coach-answer-section"><h4>Smart next move</h4><p>')
        .replace(/\n- /g, '<br>• ')
        .replace(/\n• /g, '<br>• ')
        .replace(/\n/g, '<br>')
        + '</p></div>';
}

document.addEventListener("DOMContentLoaded", () => {
    const moneyCoachInput = document.getElementById("moneyCoachInput");
    const moneyCoachAskBtn = document.getElementById("moneyCoachAskBtn");
    const moneyCoachResponseCard = document.getElementById("moneyCoachResponseCard");
    const moneyCoachResponseText = document.getElementById("moneyCoachResponseText");

    document.querySelectorAll(".coach-starter-card").forEach(card => {
        card.addEventListener("click", () => {
            if (moneyCoachInput) {
                moneyCoachInput.value = card.textContent.trim();
                moneyCoachInput.dispatchEvent(new Event("input"));
                moneyCoachInput.focus();
            }
        });
    });

    if (moneyCoachAskBtn) {
        moneyCoachAskBtn.addEventListener("click", async () => {
            const question = moneyCoachInput ? moneyCoachInput.value.trim() : "";

            if (!question) {
                showToast("Ask Money Coach a question first");
                return;
            }

            if (moneyCoachAskBtn) {
                moneyCoachAskBtn.disabled = true;
                moneyCoachAskBtn.textContent = "Thinking...";
            }

            try {
                const response = await fetch(API + "/money-coach", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ question })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Money Coach failed");
                }

                if (moneyCoachResponseCard) {
                    moneyCoachResponseCard.style.display = "block";
                }

                if (moneyCoachResponseText) {
                    moneyCoachResponseText.innerHTML = formatMoneyCoachAnswer(data.answer);
                }
            } catch (error) {
                console.error("Money Coach error:", error);
                showToast("Money Coach could not answer right now");
            } finally {
                moneyCoachAskBtn.disabled = false;
                moneyCoachAskBtn.textContent = "Ask Money Coach";
            }
        });
    }
});

// ==============================
// ADD RECURRING PAYMENT MODAL
// ==============================
const recurringModal = document.getElementById("recurringModal");
const addRecurringBtn = document.getElementById("addRecurringBtn");
const recurringModalClose = document.getElementById("recurringModalClose");
const recurringModalCancel = document.getElementById("recurringModalCancel");
const recurringForm = document.getElementById("recurringForm");
const deleteRecurringModal = document.getElementById("deleteRecurringModal");
const deleteRecurringModalClose = document.getElementById("deleteRecurringModalClose");
const deleteRecurringCancel = document.getElementById("deleteRecurringCancel");
const deleteRecurringConfirm = document.getElementById("deleteRecurringConfirm");
const deleteRecurringIdInput = document.getElementById("deleteRecurringId");

const recurringTypeInput = document.getElementById("recurringType");
const recurringTypeExpenseBtn = document.getElementById("recurringTypeExpenseBtn");
const recurringTypeIncomeBtn = document.getElementById("recurringTypeIncomeBtn");
let recurringSaveInProgress = false;

function setRecurringType(type = "expense") {
    const normalized = type === "income" ? "income" : "expense";

    if (recurringTypeInput) recurringTypeInput.value = normalized;

    if (recurringTypeExpenseBtn) {
        recurringTypeExpenseBtn.classList.toggle("active", normalized === "expense");
    }

    if (recurringTypeIncomeBtn) {
        recurringTypeIncomeBtn.classList.toggle("active", normalized === "income");
    }
}

function getRecurringModalRefs() {
    return {
        modal: document.getElementById("recurringModal"),
        form: document.getElementById("recurringForm"),
        idInput: document.getElementById("recurringId"),
        title: document.getElementById("recurringModalTitle"),
        desc: document.getElementById("recurringModalDesc"),
        submitBtn: document.getElementById("recurringSubmitBtn"),
        nextDateInput: document.getElementById("recurringNextDate")
    };
}

function openRecurringModal(recurring = null) {
    const { modal, form, idInput, title, desc, submitBtn, nextDateInput } = getRecurringModalRefs();
    if (!modal) return;

    if (form) form.reset();

    const nameInput = document.getElementById("recurringName");
    const amountInput = document.getElementById("recurringAmount");
    const accountInput = document.getElementById("recurringAccount");
    const frequencyInput = document.getElementById("recurringFrequency");

    if (recurring) {
        const amount = parseFloat(recurring.amount || 0);
        const categoryName = recurring.category || "";
        const categoryIcon = getCategoryIcon(categoryName);

        if (idInput) idInput.value = recurring.id || "";
        if (title) title.textContent = "Edit Recurring Payment";
        if (desc) desc.textContent = "Update this recurring payment and keep your forecast accurate.";
        if (submitBtn) submitBtn.textContent = "Save Changes";
        if (nameInput) nameInput.value = recurring.name || "";
        if (amountInput) amountInput.value = Math.abs(amount) || "";
        if (accountInput) accountInput.value = recurring.account || "Recurring";
        if (frequencyInput) frequencyInput.value = recurring.frequency || "monthly";
        if (nextDateInput) nextDateInput.value = dateInputValue(recurring.next_date) || new Date().toISOString().split("T")[0];

        setRecurringType(amount > 0 ? "income" : "expense");
        setSelectedRecurringCategory(categoryName, categoryIcon);
    } else {
        if (idInput) idInput.value = "";
        if (title) title.textContent = "Add Recurring Payment";
        if (desc) desc.textContent = "Add a new recurring income or bill to your forecast.";
        if (submitBtn) submitBtn.textContent = "Save Recurring";
        if (accountInput) accountInput.value = "Recurring";

        setRecurringType("expense");
        setSelectedRecurringCategory("", "🏷️");

        if (nextDateInput) {
            nextDateInput.value = new Date().toISOString().split("T")[0];
        }
    }

    modal.style.display = "flex";
}

function closeRecurringModal() {
    const { modal, form, idInput, title, desc, submitBtn } = getRecurringModalRefs();
    if (!modal) return;
    modal.style.display = "none";

    if (form) form.reset();
    if (idInput) idInput.value = "";
    if (title) title.textContent = "Add Recurring Payment";
    if (desc) desc.textContent = "Add a new recurring income or bill to your forecast.";
    if (submitBtn) submitBtn.textContent = "Save Recurring";
    setRecurringType("expense");
    setSelectedRecurringCategory("", "🏷️");
}

function openDeleteRecurringModal(recurringId) {
    if (!deleteRecurringModal || !deleteRecurringIdInput) return;
    deleteRecurringIdInput.value = recurringId || "";
    deleteRecurringModal.style.display = "flex";
}

function closeDeleteRecurringModal() {
    if (!deleteRecurringModal || !deleteRecurringIdInput) return;
    deleteRecurringModal.style.display = "none";
    deleteRecurringIdInput.value = "";
}

window.openRecurringModal = openRecurringModal;
window.closeRecurringModal = closeRecurringModal;

document.addEventListener("click", (e) => {
    if (!(e.target instanceof Element)) return;

    const addBtn = e.target.closest("#addRecurringBtn");
    const closeBtn = e.target.closest("#recurringModalClose");
    const cancelBtn = e.target.closest("#recurringModalCancel");
    const modalBackdrop = e.target.id === "recurringModal" ? e.target : null;
    const deleteModalBackdrop = e.target.id === "deleteRecurringModal" ? e.target : null;

    if (addBtn) {
        e.preventDefault();
        openRecurringModal();
        return;
    }

    if (closeBtn || cancelBtn || modalBackdrop) {
        e.preventDefault();
        closeRecurringModal();
        return;
    }

    if (deleteModalBackdrop) {
        e.preventDefault();
        closeDeleteRecurringModal();
    }
});

if (addRecurringBtn) {
    addRecurringBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openRecurringModal();
    });
}

if (recurringTypeExpenseBtn) {
    recurringTypeExpenseBtn.addEventListener("click", () => setRecurringType("expense"));
}

if (recurringTypeIncomeBtn) {
    recurringTypeIncomeBtn.addEventListener("click", () => setRecurringType("income"));
}

if (deleteRecurringModalClose) {
    deleteRecurringModalClose.addEventListener("click", closeDeleteRecurringModal);
}

if (deleteRecurringCancel) {
    deleteRecurringCancel.addEventListener("click", closeDeleteRecurringModal);
}

if (deleteRecurringConfirm) {
    deleteRecurringConfirm.addEventListener("click", async () => {
        const recurringId = deleteRecurringIdInput ? deleteRecurringIdInput.value : "";
        if (!recurringId) return;

        try {
            const response = await fetch(API + `/recurring/${recurringId}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || "Failed to delete recurring payment");
            }

            closeDeleteRecurringModal();
            await loadRecurringPayments();
            showToast("Recurring payment deleted");
        } catch (error) {
            console.error("Recurring delete error:", error);
            showToast("Could not delete recurring payment");
        }
    });
}

if (recurringForm) {
    recurringForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (recurringSaveInProgress) return;

        const recurringId = document.getElementById("recurringId").value.trim();
        const name = document.getElementById("recurringName").value.trim();
        const rawAmount = parseFloat(document.getElementById("recurringAmount").value);
        const type = document.getElementById("recurringType").value;
        const category = document.getElementById("recurringCategory").value.trim();
        const account = document.getElementById("recurringAccount").value.trim() || "Recurring";
        const frequency = document.getElementById("recurringFrequency").value;
        const next_date = document.getElementById("recurringNextDate").value;

        if (!name || Number.isNaN(rawAmount) || rawAmount <= 0 || !category || !next_date) {
            showToast("Please fill in all recurring fields correctly");
            return;
        }

        const amount = type === "income" ? Math.abs(rawAmount) : -Math.abs(rawAmount);
        const submitBtn = recurringForm.querySelector('button[type="submit"]');
        const isEditing = !!recurringId;

        try {
            recurringSaveInProgress = true;

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Saving...";
            }

            const response = await fetch(isEditing ? API + `/recurring/${recurringId}` : API + "/recurring", {
                method: isEditing ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    amount,
                    type,
                    category,
                    account,
                    frequency,
                    next_date
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || "Failed to save recurring payment");
            }

            closeRecurringModal();
            await loadRecurringPayments();
            showToast(
                isEditing
                    ? "Recurring payment updated"
                    : response.status === 200
                        ? "Recurring payment already exists"
                        : "Recurring payment added"
            );
        } catch (error) {
            console.error("Error adding recurring payment:", error);
            showToast(isEditing ? "Could not update recurring payment" : "Could not add recurring payment");
        } finally {
            recurringSaveInProgress = false;

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Save Recurring";
            }
        }
    });
}
