/**
 * Personal Edition - The Landscape
 * Your portfolio mapped against market performance
 */

// ===== Configuration =====
const CONFIG = {
    maxCoinsFree: 5,
    maxCoinsPro: 10,
    isPro: false, // TODO: integrate with auth
    storageKey: 'litmus_personal_coins',
    coingeckoApi: 'https://api.coingecko.com/api/v3'
};

// ===== Segments =====
const SEGMENTS = {
    store_of_value: { label: 'Store of Value', row: 0 },
    infrastructure: { label: 'Infrastructure', row: 1 },
    defi: { label: 'DeFi', row: 2 },
    real_world: { label: 'Real World Use', row: 3 },
    ai_compute: { label: 'AI & Compute', row: 4 },
    payments: { label: 'Payments', row: 5 }
};

// ===== Weight sizes =====
const WEIGHTS = {
    core: { label: 'Core', size: 40, priority: 1 },
    significant: { label: 'Significant', size: 30, priority: 2 },
    moderate: { label: 'Moderate', size: 22, priority: 3 },
    small: { label: 'Small', size: 14, priority: 4 },
    watching: { label: 'Watching', size: 0, priority: 5 }
};

// ===== Default segment assignments =====
const DEFAULT_SEGMENTS = {
    'bitcoin': 'store_of_value',
    'ethereum': 'infrastructure',
    'solana': 'infrastructure',
    'cardano': 'infrastructure',
    'avalanche-2': 'infrastructure',
    'polkadot': 'infrastructure',
    'near': 'infrastructure',
    'cosmos': 'infrastructure',
    'chainlink': 'real_world',
    'the-graph': 'real_world',
    'filecoin': 'real_world',
    'render-token': 'ai_compute',
    'fetch-ai': 'ai_compute',
    'bittensor': 'ai_compute',
    'uniswap': 'defi',
    'aave': 'defi',
    'maker': 'defi',
    'lido-dao': 'defi',
    'curve-dao-token': 'defi',
    'ripple': 'payments',
    'litecoin': 'payments',
    'stellar': 'payments',
    'tether': 'payments',
    'usd-coin': 'payments'
};

// ===== State =====
let state = {
    userCoins: [], // { id, symbol, name, weight, segment }
    coinData: {}, // { id: { price, change30d, change7d, marketCap } }
    marketChange: 0, // Overall market 30d change
    availableCoins: [], // Top 100 from CoinGecko
    period: 30, // 30 or 7 days
    editingCoin: null
};

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    loadUserCoins();
    loadAvailableCoins();
    setupEventListeners();
    render();
});

// ===== LocalStorage =====
function loadUserCoins() {
    try {
        const saved = localStorage.getItem(CONFIG.storageKey);
        if (saved) {
            state.userCoins = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load saved coins:', e);
    }
}

function saveUserCoins() {
    try {
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.userCoins));
    } catch (e) {
        console.error('Failed to save coins:', e);
    }
}

// ===== API =====
async function loadAvailableCoins() {
    try {
        const response = await fetch(
            `${CONFIG.coingeckoApi}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=30d,7d`
        );
        
        if (!response.ok) throw new Error('API request failed');
        
        const coins = await response.json();
        state.availableCoins = coins.map(c => ({
            id: c.id,
            symbol: c.symbol.toUpperCase(),
            name: c.name,
            image: c.image,
            marketCap: c.market_cap,
            price: c.current_price,
            change30d: c.price_change_percentage_30d_in_currency || 0,
            change7d: c.price_change_percentage_7d_in_currency || 0
        }));
        
        // Calculate market average (top 10 weighted)
        const top10 = state.availableCoins.slice(0, 10);
        const totalMcap = top10.reduce((sum, c) => sum + c.marketCap, 0);
        state.marketChange = top10.reduce((sum, c) => {
            const weight = c.marketCap / totalMcap;
            return sum + (c.change30d * weight);
        }, 0);
        
        // Store coin data for quick lookup
        state.availableCoins.forEach(c => {
            state.coinData[c.id] = c;
        });
        
        renderAvailableCoins();
        render();
        
    } catch (e) {
        console.error('Failed to load coins:', e);
        // Use fallback data
        useFallbackData();
    }
}

function useFallbackData() {
    // Minimal fallback if API fails
    state.availableCoins = [
        { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', change30d: 8, change7d: 2 },
        { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', change30d: 12, change7d: 4 },
        { id: 'solana', symbol: 'SOL', name: 'Solana', change30d: 25, change7d: 8 }
    ];
    state.marketChange = 10;
    state.availableCoins.forEach(c => {
        state.coinData[c.id] = c;
    });
}

// ===== Rendering =====
function render() {
    const hasCoins = state.userCoins.length > 0;
    
    document.getElementById('empty-state').style.display = hasCoins ? 'none' : 'block';
    document.getElementById('landscape-chart').style.display = hasCoins ? 'block' : 'none';
    document.getElementById('portfolio-read').style.display = hasCoins ? 'block' : 'none';
    document.getElementById('coins-section').style.display = hasCoins ? 'block' : 'none';
    
    if (hasCoins) {
        renderChart();
        renderPortfolioRead();
        renderCoinsList();
    }
    
    updateCoinCount();
}

function renderChart() {
    const chartArea = document.getElementById('chart-area');
    const marketLine = document.getElementById('market-line');
    
    // Clear existing coins
    chartArea.querySelectorAll('.coin-dot, .coin-watching').forEach(el => el.remove());
    
    // Position market line
    const marketX = percentToX(state.period === 30 ? state.marketChange : state.marketChange / 4);
    marketLine.style.left = `${marketX}%`;
    
    // Render each coin
    state.userCoins.forEach(coin => {
        const data = state.coinData[coin.id];
        if (!data) return;
        
        const change = state.period === 30 ? data.change30d : data.change7d;
        const segment = SEGMENTS[coin.segment];
        if (!segment) return;
        
        const x = percentToX(change);
        const y = segmentToY(segment.row);
        
        if (coin.weight === 'watching') {
            // Text only for watching
            const el = document.createElement('div');
            el.className = 'coin-watching';
            el.textContent = coin.symbol;
            el.style.left = `${x}%`;
            el.style.top = `${y}%`;
            el.onclick = () => openEditCoinModal(coin);
            chartArea.appendChild(el);
        } else {
            // Dot for holdings
            const el = document.createElement('div');
            const isOutperforming = change > (state.period === 30 ? state.marketChange : state.marketChange / 4);
            el.className = `coin-dot ${coin.weight} ${isOutperforming ? 'outperforming' : 'underperforming'}`;
            el.style.left = `${x}%`;
            el.style.top = `${y}%`;
            el.innerHTML = `<span class="coin-symbol">${coin.symbol}</span>`;
            el.title = `${coin.name}: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
            el.onclick = () => openEditCoinModal(coin);
            chartArea.appendChild(el);
        }
    });
}

function percentToX(pct) {
    // Map -20% to +40% onto 0-100% of chart width
    // -20 = 0%, 0 = 33%, +20 = 66%, +40 = 100%
    const min = -20;
    const max = 40;
    const x = ((pct - min) / (max - min)) * 100;
    return Math.max(2, Math.min(98, x));
}

function segmentToY(row) {
    // 6 rows, evenly distributed
    const rowHeight = 100 / 6;
    return (row * rowHeight) + (rowHeight / 2);
}

function renderPortfolioRead() {
    const container = document.getElementById('portfolio-read-content');
    const analysis = generatePortfolioAnalysis();
    container.innerHTML = `<p>${analysis}</p>`;
}

function generatePortfolioAnalysis() {
    if (state.userCoins.length === 0) return '';
    
    const holdings = state.userCoins.filter(c => c.weight !== 'watching');
    const watching = state.userCoins.filter(c => c.weight === 'watching');
    
    if (holdings.length === 0) {
        return `You're watching ${watching.length} coin${watching.length > 1 ? 's' : ''} but haven't added any holdings yet. Add your positions to see personalized portfolio insights.`;
    }
    
    // Segment breakdown
    const segmentCounts = {};
    holdings.forEach(c => {
        segmentCounts[c.segment] = (segmentCounts[c.segment] || 0) + 1;
    });
    
    const topSegment = Object.entries(segmentCounts).sort((a, b) => b[1] - a[1])[0];
    const topSegmentLabel = SEGMENTS[topSegment[0]]?.label || topSegment[0];
    
    // Performance analysis
    const marketRef = state.period === 30 ? state.marketChange : state.marketChange / 4;
    let outperformers = 0;
    let underperformers = 0;
    
    holdings.forEach(coin => {
        const data = state.coinData[coin.id];
        if (!data) return;
        const change = state.period === 30 ? data.change30d : data.change7d;
        if (change > marketRef) outperformers++;
        else underperformers++;
    });
    
    // Core holdings
    const coreCoins = holdings.filter(c => c.weight === 'core');
    let coreText = '';
    if (coreCoins.length > 0) {
        const coreNames = coreCoins.map(c => c.symbol).join(', ');
        const corePerf = coreCoins.map(c => {
            const data = state.coinData[c.id];
            return data ? (state.period === 30 ? data.change30d : data.change7d) : 0;
        });
        const avgCorePerf = corePerf.reduce((a, b) => a + b, 0) / corePerf.length;
        const coreVsMarket = avgCorePerf > marketRef ? 'outperforming' : 'underperforming';
        coreText = `Your core position${coreCoins.length > 1 ? 's' : ''} (${coreNames}) ${coreCoins.length > 1 ? 'are' : 'is'} ${coreVsMarket} the market. `;
    }
    
    // Build narrative
    let analysis = '';
    
    if (holdings.length === 1) {
        const coin = holdings[0];
        const data = state.coinData[coin.id];
        const change = data ? (state.period === 30 ? data.change30d : data.change7d) : 0;
        const vsMarket = change > marketRef ? 'outperforming' : 'underperforming';
        analysis = `Your ${WEIGHTS[coin.weight].label.toLowerCase()} position in ${coin.name} is ${vsMarket} the market (${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs market ${marketRef >= 0 ? '+' : ''}${marketRef.toFixed(1)}%).`;
    } else {
        analysis = `Your portfolio is weighted toward ${topSegmentLabel} (${topSegment[1]} of ${holdings.length} holdings). ${coreText}`;
        
        if (outperformers > underperformers) {
            analysis += `Overall, ${outperformers} of ${holdings.length} positions are beating the market this ${state.period === 30 ? 'month' : 'week'}.`;
        } else if (underperformers > outperformers) {
            analysis += `${underperformers} of ${holdings.length} positions are trailing the market — worth reviewing your thesis on underperformers.`;
        } else {
            analysis += `Your holdings are split evenly between outperformers and underperformers relative to market.`;
        }
    }
    
    if (watching.length > 0) {
        const watchNames = watching.slice(0, 3).map(c => c.symbol).join(', ');
        analysis += ` You're also watching ${watchNames}${watching.length > 3 ? ` and ${watching.length - 3} more` : ''}.`;
    }
    
    return analysis;
}

function renderCoinsList() {
    const container = document.getElementById('coins-list');
    const marketRef = state.period === 30 ? state.marketChange : state.marketChange / 4;
    
    // Sort: Core first, then by market cap
    const sorted = [...state.userCoins].sort((a, b) => {
        const pa = WEIGHTS[a.weight]?.priority || 5;
        const pb = WEIGHTS[b.weight]?.priority || 5;
        if (pa !== pb) return pa - pb;
        
        const mcA = state.coinData[a.id]?.marketCap || 0;
        const mcB = state.coinData[b.id]?.marketCap || 0;
        return mcB - mcA;
    });
    
    container.innerHTML = sorted.map(coin => {
        const data = state.coinData[coin.id];
        const change = data ? (state.period === 30 ? data.change30d : data.change7d) : 0;
        const vsMarket = change - marketRef;
        const changeClass = change >= 0 ? 'positive' : 'negative';
        const weightLabel = WEIGHTS[coin.weight]?.label || coin.weight;
        const segmentLabel = SEGMENTS[coin.segment]?.label || coin.segment;
        
        return `
            <div class="coin-card" data-coin-id="${coin.id}">
                <div class="coin-icon">
                    ${data?.image ? `<img src="${data.image}" alt="${coin.symbol}">` : ''}
                </div>
                <div class="coin-info">
                    <span class="coin-name">${coin.symbol} · ${coin.name}</span>
                    <span class="coin-meta">${weightLabel} · ${segmentLabel}</span>
                </div>
                <div class="coin-performance">
                    <span class="coin-change ${changeClass}">${change >= 0 ? '+' : ''}${change.toFixed(1)}%</span>
                    <span class="coin-vs-market">${vsMarket >= 0 ? '+' : ''}${vsMarket.toFixed(1)}% vs market</span>
                </div>
            </div>
        `;
    }).join('');
    
    // Click handlers
    container.querySelectorAll('.coin-card').forEach(card => {
        card.onclick = () => {
            const coinId = card.dataset.coinId;
            const coin = state.userCoins.find(c => c.id === coinId);
            if (coin) openEditCoinModal(coin);
        };
    });
}

function updateCoinCount() {
    const max = CONFIG.isPro ? CONFIG.maxCoinsPro : CONFIG.maxCoinsFree;
    document.getElementById('coin-count').textContent = `${state.userCoins.length} / ${max}`;
    document.getElementById('selected-count').textContent = `(${state.userCoins.length}/${max})`;
}

// ===== Settings Modal =====
function renderAvailableCoins(filter = '') {
    const container = document.getElementById('available-coins');
    const max = CONFIG.isPro ? CONFIG.maxCoinsPro : CONFIG.maxCoinsFree;
    const atLimit = state.userCoins.length >= max;
    
    const filtered = filter 
        ? state.availableCoins.filter(c => 
            c.name.toLowerCase().includes(filter.toLowerCase()) ||
            c.symbol.toLowerCase().includes(filter.toLowerCase())
          )
        : state.availableCoins;
    
    container.innerHTML = filtered.map(coin => {
        const isSelected = state.userCoins.some(c => c.id === coin.id);
        const disabled = !isSelected && atLimit;
        
        return `
            <button class="coin-option ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}" 
                    data-coin-id="${coin.id}"
                    ${disabled ? 'disabled' : ''}>
                ${coin.symbol}
            </button>
        `;
    }).join('');
    
    // Click handlers
    container.querySelectorAll('.coin-option:not(.disabled)').forEach(btn => {
        btn.onclick = () => toggleCoinSelection(btn.dataset.coinId);
    });
}

function renderSelectedCoins() {
    const container = document.getElementById('selected-list');
    
    if (state.userCoins.length === 0) {
        container.innerHTML = '<p class="empty-selected">No coins selected</p>';
        return;
    }
    
    container.innerHTML = state.userCoins.map(coin => `
        <span class="selected-chip" data-coin-id="${coin.id}">
            ${coin.symbol}
            <span class="remove">&times;</span>
        </span>
    `).join('');
    
    // Click to remove
    container.querySelectorAll('.selected-chip').forEach(chip => {
        chip.onclick = () => {
            removeCoin(chip.dataset.coinId);
            renderSelectedCoins();
            renderAvailableCoins(document.getElementById('coin-search').value);
            updateCoinCount();
        };
    });
}

function toggleCoinSelection(coinId) {
    const existing = state.userCoins.findIndex(c => c.id === coinId);
    
    if (existing >= 0) {
        // Remove
        state.userCoins.splice(existing, 1);
    } else {
        // Add with defaults
        const coinData = state.availableCoins.find(c => c.id === coinId);
        if (!coinData) return;
        
        const defaultSegment = DEFAULT_SEGMENTS[coinId] || 'infrastructure';
        
        state.userCoins.push({
            id: coinId,
            symbol: coinData.symbol,
            name: coinData.name,
            weight: 'moderate',
            segment: defaultSegment
        });
    }
    
    renderSelectedCoins();
    renderAvailableCoins(document.getElementById('coin-search').value);
    updateCoinCount();
}

function removeCoin(coinId) {
    const idx = state.userCoins.findIndex(c => c.id === coinId);
    if (idx >= 0) {
        state.userCoins.splice(idx, 1);
    }
}

// ===== Edit Coin Modal =====
function openEditCoinModal(coin) {
    state.editingCoin = coin;
    
    document.getElementById('edit-coin-name').textContent = `${coin.symbol} · ${coin.name}`;
    
    // Set active weight
    document.querySelectorAll('#weight-options .weight-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.weight === coin.weight);
    });
    
    // Set active segment
    document.querySelectorAll('#segment-options .segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.segment === coin.segment);
    });
    
    document.getElementById('edit-coin-modal').classList.add('active');
}

function closeEditCoinModal() {
    state.editingCoin = null;
    document.getElementById('edit-coin-modal').classList.remove('active');
}

function saveEditCoin() {
    if (!state.editingCoin) return;
    
    const weight = document.querySelector('#weight-options .weight-btn.active')?.dataset.weight;
    const segment = document.querySelector('#segment-options .segment-btn.active')?.dataset.segment;
    
    if (weight) state.editingCoin.weight = weight;
    if (segment) state.editingCoin.segment = segment;
    
    saveUserCoins();
    closeEditCoinModal();
    render();
}

function removeEditCoin() {
    if (!state.editingCoin) return;
    
    removeCoin(state.editingCoin.id);
    saveUserCoins();
    closeEditCoinModal();
    render();
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Open settings
    document.getElementById('open-settings').onclick = () => {
        renderSelectedCoins();
        renderAvailableCoins();
        document.getElementById('settings-modal').classList.add('active');
    };
    
    document.getElementById('empty-add-coins').onclick = () => {
        renderSelectedCoins();
        renderAvailableCoins();
        document.getElementById('settings-modal').classList.add('active');
    };
    
    // Close settings
    document.getElementById('close-settings').onclick = () => {
        document.getElementById('settings-modal').classList.remove('active');
    };
    
    document.getElementById('cancel-settings').onclick = () => {
        // Reload from storage (discard changes)
        loadUserCoins();
        document.getElementById('settings-modal').classList.remove('active');
    };
    
    // Save settings
    document.getElementById('save-settings').onclick = () => {
        saveUserCoins();
        document.getElementById('settings-modal').classList.remove('active');
        render();
    };
    
    // Search
    document.getElementById('coin-search').oninput = (e) => {
        renderAvailableCoins(e.target.value);
    };
    
    // Edit coin modal
    document.getElementById('close-edit-coin').onclick = closeEditCoinModal;
    document.getElementById('save-coin-edit').onclick = saveEditCoin;
    document.getElementById('remove-coin').onclick = removeEditCoin;
    
    // Weight buttons
    document.querySelectorAll('#weight-options .weight-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#weight-options .weight-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });
    
    // Segment buttons
    document.querySelectorAll('#segment-options .segment-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#segment-options .segment-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });
    
    // Period selector
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.period = parseInt(btn.dataset.period);
            render();
        };
    });
    
    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        };
    });
}
