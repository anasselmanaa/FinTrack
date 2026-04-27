// FinTrack — app.js (Connected to Flask Backend)

const API = 'http://127.0.0.1:5000/api';
let allCategories = [];
let transactionsLoadedFromBackend = false;

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
        if (data.length === 0) return;
        renderGoals(data);
    } catch (err) {
        console.log('Using demo goals');
    }
}

function renderGoals(goals) {
    const grid = document.querySelector('.goals-page-grid');
    if (!grid) return;
    const colors = ['#10b981','#3b82f6','#f97316','#8b5cf6'];
    grid.innerHTML = goals.map((g, i) => {
        const pct    = Math.min(Math.round((g.saved_amount / g.target_amount) * 100), 100);
        const left   = parseFloat(g.target_amount) - parseFloat(g.saved_amount);
        const color  = colors[i % colors.length];
        const date   = g.deadline ? new Date(g.deadline).toLocaleDateString('en-US', { month:'short', year:'numeric' }) : '';
        return `
        <div class="goal-page-card">
            <div class="gpc-color-bar" style="background:${color}"></div>
            <div class="gpc-body">
                <div class="gpc-top">
                    <div style="display:flex;align-items:center;gap:10px">
                        <div class="goal-icon-wrap" style="background:${color}22;width:42px;height:42px;font-size:20px">${g.icon || '🎯'}</div>
                        <div><p class="gpc-name">${g.name}</p><p class="gpc-date">📅 ${date}</p></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px">
                        <span class="status-badge ${pct >= 100 ? 'achieved' : pct >= 50 ? 'on-track' : 'behind'}">${pct >= 100 ? 'Done!' : pct >= 50 ? 'On Track' : 'Behind'}</span>
                        <button class="dots-btn">···</button>
                    </div>
                </div>
                <div class="gpc-amounts"><span class="gpc-saved">${fmt(g.saved_amount)}</span><span class="gpc-target"> of ${fmt(g.target_amount)}</span></div>
                <div class="progress-bar" style="margin:10px 0;height:8px"><div class="progress-fill ok" style="width:${pct}%;background:${color}"></div></div>
                <div class="gpc-footer"><span>${pct}% complete · ${fmt(left)} to go</span></div>
            </div>
        </div>`;
    }).join('');
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
    });
});

// ══════════════════════════════════════
//  INVESTMENTS — Real stock prices
// ══════════════════════════════════════
async function loadInvestments() {
    try {
        const res  = await fetch(API + '/investments');
        const data = await res.json();

        // Update stat cards
        document.querySelector('#inv-total-value').textContent   = fmt(data.total_value);
        document.querySelector('#inv-today-change').textContent  = '+' + fmt(data.today_change);
        document.querySelector('#inv-total-return').textContent  = '+' + fmt(data.total_return);
        document.querySelector('#inv-total-invested').textContent = fmt(data.total_invested);

        // Update holdings table
        const tbody = document.querySelector('#holdingsTableBody');
        if (!tbody) return;

        tbody.innerHTML = data.holdings.map(h => {
            const changeClass = h.day_change_pct >= 0 ? 'positive' : 'negative';
            const changeArrow = h.day_change_pct >= 0 ? '↗' : '↘';
            const gainClass   = h.gain >= 0 ? 'positive' : 'negative';
            const initials    = h.symbol.slice(0, 2);
            const colors      = { AAPL:'#dcfce7;color:#16a34a', VOO:'#dbeafe;color:#1d4ed8', MSFT:'#f3e8ff;color:#7c3aed' };
            const col         = colors[h.symbol] || '#f3f4f6;color:#374151';

            return `<tr>
                <td><div class="tx-cell-name">
                    <div class="invest-avatar" style="background:${col.split(';')[0].replace('background:','')};color:${col.split('color:')[1]};border-radius:8px">${initials}</div>
                    <div>
                        <p class="tx-cell-title">${h.name}</p>
                        <p class="tx-meta" style="font-size:11px">${h.symbol}
                            <span class="cat-badge" style="font-size:10px;padding:1px 6px">${h.type}</span>
                        </p>
                    </div>
                </div></td>
                <td>$${h.price.toFixed(2)}</td>
                <td>${h.shares}</td>
                <td>$${h.avg_cost.toFixed(2)}</td>
                <td><strong>$${h.total_value.toLocaleString()}</strong></td>
                <td><span class="change-badge ${changeClass}">${changeArrow} ${h.day_change_pct > 0 ? '+' : ''}${h.day_change_pct}%</span></td>
            </tr>`;
        }).join('');

    } catch(err) {
        console.log('Using demo investment data');
    }
}

// ── CHARTS ──
window.incomeChart   = null;
window.spendingChart = null;

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
    new Chart(canvas.getContext('2d'), {
        type:'line',
        data:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'],datasets:[{data:[8500,8800,9100,8900,9300,9600,9800,10200],borderColor:'#10b981',backgroundColor:'rgba(16,185,129,0.08)',borderWidth:2.5,pointRadius:0,fill:true,tension:0.4}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{color:'#9ca3af',font:{size:11}},border:{display:false}},y:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{color:'#9ca3af',font:{size:11},callback:v=>'$'+(v/1000).toFixed(0)+'k'},border:{display:false}}}}
    });
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

                <td><span class="freq-badge">${item.frequency}</span></td>

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

                <td><button class="dots-btn">···</button></td>
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
}

async function loadRecurringPayments() {
    try {
        const res = await fetch(API + "/recurring");
        const items = await res.json();

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
    addNewBtn.addEventListener("click", openTransactionModal);
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

function openGoalModal() {
    if (!goalModal) return;
    goalModal.style.display = "flex";
}

function closeGoalModal() {
    if (!goalModal) return;
    goalModal.style.display = "none";

    if (goalForm) {
        goalForm.reset();
    }
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

if (goalForm) {
    goalForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("goalName").value.trim();
        const icon = document.getElementById("goalIcon").value.trim() || "🎯";
        const target_amount = parseFloat(document.getElementById("goalTargetAmount").value);
        const saved_amount = parseFloat(document.getElementById("goalSavedAmount").value);
        const deadline = document.getElementById("goalDeadline").value;

        if (!name || !deadline || Number.isNaN(target_amount) || Number.isNaN(saved_amount)) {
            alert("Please fill in all goal fields correctly.");
            return;
        }

        try {
            const response = await fetch("http://127.0.0.1:5000/api/goals", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    target_amount,
                    saved_amount,
                    deadline,
                    icon
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

            showToast("Goal added");
        } catch (error) {
            console.error("Error adding goal:", error);
            alert("Could not add goal: " + error.message);
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

            addCategoryToSelect(savedName, categoryPickerTarget !== "budget", savedIcon);

            if (categoryPickerTarget === "budget") {
                setSelectedBudgetCategory(savedName, savedIcon);
            }

            if (categoryPickerTarget === "recurring") {
                setSelectedRecurringCategory(savedName, savedIcon);
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
const categoryPickerModal = document.getElementById("categoryPickerModal");
const categoryPickerModalClose = document.getElementById("categoryPickerModalClose");
const categoryPickerSearch = document.getElementById("categoryPickerSearch");
const categoryPickerGrid = document.getElementById("categoryPickerGrid");
const transactionCategoryHidden = document.getElementById("transactionCategory");
const transactionCategoryDisplay = document.getElementById("transactionCategoryDisplay");
const transactionCategoryIcon = document.getElementById("transactionCategoryIcon");
const quickAddRecurringCategoryBtn = document.getElementById("quickAddRecurringCategoryBtn");
const recurringCategoryHidden = document.getElementById("recurringCategory");
const recurringCategoryDisplay = document.getElementById("recurringCategoryDisplay");
const recurringCategoryIcon = document.getElementById("recurringCategoryIcon");

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
            } else {
                setSelectedTransactionCategory(name, icon);
            }

            closeCategoryPickerModal();
        });
    });
}

function openCategoryPickerModal() {
    if (!categoryPickerModal) return;

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

const recurringTypeInput = document.getElementById("recurringType");
const recurringTypeExpenseBtn = document.getElementById("recurringTypeExpenseBtn");
const recurringTypeIncomeBtn = document.getElementById("recurringTypeIncomeBtn");

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

function openRecurringModal() {
    if (!recurringModal) return;

    if (recurringForm) recurringForm.reset();

    setRecurringType("expense");
    setSelectedRecurringCategory("", "🏷️");

    const nextDateInput = document.getElementById("recurringNextDate");
    if (nextDateInput) {
        nextDateInput.value = new Date().toISOString().split("T")[0];
    }

    recurringModal.style.display = "flex";
}

function closeRecurringModal() {
    if (!recurringModal) return;
    recurringModal.style.display = "none";
}

if (addRecurringBtn) {
    addRecurringBtn.addEventListener("click", openRecurringModal);
}

if (recurringModalClose) {
    recurringModalClose.addEventListener("click", closeRecurringModal);
}

if (recurringModalCancel) {
    recurringModalCancel.addEventListener("click", closeRecurringModal);
}

if (recurringTypeExpenseBtn) {
    recurringTypeExpenseBtn.addEventListener("click", () => setRecurringType("expense"));
}

if (recurringTypeIncomeBtn) {
    recurringTypeIncomeBtn.addEventListener("click", () => setRecurringType("income"));
}

if (recurringForm) {
    recurringForm.addEventListener("submit", async (e) => {
        e.preventDefault();

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

        try {
            const response = await fetch(API + "/recurring", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    amount,
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
            showToast("Recurring payment added");
        } catch (error) {
            console.error("Error adding recurring payment:", error);
            showToast("Could not add recurring payment");
        }
    });
}
