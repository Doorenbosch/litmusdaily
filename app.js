// The Litmus - News Publication App Logic

// Configuration
const CONFIG = {
    contentPath: './content',
    defaultRegion: 'americas',
    refreshInterval: 300000 // 5 minutes
};

// State
let currentRegion = CONFIG.defaultRegion;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initRegionSelector();
    initSidebarTabs();
    initArticleCards();
    loadContent(currentRegion);
    startAutoRefresh();
});

// Region Selector
function initRegionSelector() {
    const buttons = document.querySelectorAll('.region-btn');
    
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const region = btn.dataset.region;
            
            // Update active state
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Load new content
            currentRegion = region;
            loadContent(region);
        });
    });
}

// Sidebar Tab Switching
function initSidebarTabs() {
    const tabs = document.querySelectorAll('.sidebar-tab');
    const weekContent = document.getElementById('week-ahead-content');
    const audioContent = document.getElementById('audio-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            if (tab.textContent.includes('WEEK')) {
                weekContent?.classList.remove('hidden');
                audioContent?.classList.add('hidden');
            } else {
                weekContent?.classList.add('hidden');
                audioContent?.classList.remove('hidden');
            }
        });
    });
}

// Article Card Click Handlers
function initArticleCards() {
    const cards = document.querySelectorAll('.article-card');
    
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const section = card.dataset.section;
            // Scroll to main story or expand article
            // For now, just scroll to main story
            document.querySelector('.main-story')?.scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
        });
    });
}

// Load Content
async function loadContent(region) {
    const mainStory = document.querySelector('.main-story');
    
    // Add loading state
    mainStory?.classList.add('loading');
    
    try {
        // Load morning brief
        const morningData = await fetchJSON(`${CONFIG.contentPath}/${region}/morning.json`);
        if (morningData) {
            renderMorningBrief(morningData);
        }
        
        // Load week ahead
        try {
            const weekData = await fetchJSON(`${CONFIG.contentPath}/${region}/week-ahead.json`);
            if (weekData) {
                renderWeekAhead(weekData);
            }
        } catch (e) {
            console.log('Week ahead data not available');
        }
        
    } catch (error) {
        console.error('Error loading content:', error);
    } finally {
        mainStory?.classList.remove('loading');
    }
}

// Fetch JSON helper
async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// Render Morning Brief
function renderMorningBrief(data) {
    // Update main headline
    updateElement('brief-headline', data.headline);
    
    // Update lead (use first section as lead if no dedicated lead)
    if (data.sections) {
        // For the lead, create a compelling opening from the_lead or overnight
        const lead = data.sections.the_lead || data.sections.overnight;
        updateElement('brief-lead', lead);
        
        // Update main story sections
        updateElement('section-mechanism', data.sections.the_mechanism || data.sections.overnight);
        updateElement('section-complication', data.sections.the_complication || data.sections.the_setup);
        updateElement('section-behavioral', data.sections.the_behavioral_layer || data.sections.what_matters);
        updateElement('section-forward', data.sections.the_forward_view || '');
        updateElement('section-closing', data.sections.the_closing_line || data.sections.the_take);
        
        // Update left sidebar cards
        updateElement('card-overnight-excerpt', truncate(data.sections.overnight || data.sections.the_mechanism, 120));
        updateElement('card-setup-excerpt', truncate(data.sections.the_setup || data.sections.the_complication, 120));
        updateElement('card-matters-excerpt', truncate(data.sections.what_matters || data.sections.the_behavioral_layer, 120));
    }
    
    // Update timestamp
    if (data.generated_at) {
        updateElement('brief-timestamp', formatTime(data.generated_at));
        updateElement('brief-date', formatDate(data.generated_at));
    }
    
    // Update market data
    if (data.btc_price) {
        updateElement('btc-price', formatPrice(data.btc_price));
    }
    
    if (data.total_market_cap) {
        updateElement('total-market', formatMarketCap(data.total_market_cap));
    }
}

// Render Week Ahead
function renderWeekAhead(data) {
    if (data.sections) {
        // Update trending items
        updateElement('week-fulcrum-excerpt', truncate(data.sections.fulcrum, 80));
        updateElement('week-levels-excerpt', truncate(data.sections.levels, 80));
        updateElement('week-unpriced-excerpt', truncate(data.sections.unpriced, 80));
        updateElement('week-wildcard-excerpt', truncate(data.sections.wildcard, 80));
    }
}

// Update element helper
function updateElement(id, content) {
    const element = document.getElementById(id);
    if (element && content) {
        element.textContent = content;
    }
}

// Truncate text
function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
}

// Format helpers
function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
    });
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

function formatMarketCap(cap) {
    if (cap >= 1e12) {
        return `$${(cap / 1e12).toFixed(1)}T`;
    }
    if (cap >= 1e9) {
        return `$${(cap / 1e9).toFixed(0)}B`;
    }
    return `$${cap}`;
}

// Auto-refresh
function startAutoRefresh() {
    setInterval(() => {
        loadContent(currentRegion);
    }, CONFIG.refreshInterval);
}
