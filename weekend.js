/**
 * Weekend Magazine - The Litmus
 * Loads and renders weekend magazine content including The Mechanism
 */

document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    console.log('[Weekend] Initializing magazine...');
    
    // Set publication date
    setPublicationDate();
    
    // Load magazine content
    await loadMagazineContent();
    
    // Setup navigation highlighting
    setupNavigation();
}

function setPublicationDate() {
    const dateEl = document.getElementById('pub-date');
    const heroDateEl = document.getElementById('hero-date');
    
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formatted = now.toLocaleDateString('en-US', options);
    
    if (dateEl) dateEl.textContent = formatted;
    if (heroDateEl) heroDateEl.textContent = formatted;
}

async function loadMagazineContent() {
    try {
        const response = await fetch('content/weekend/magazine.json');
        
        if (!response.ok) {
            console.warn('[Weekend] Magazine not found, using placeholder');
            loadPlaceholderContent();
            return;
        }
        
        const data = await response.json();
        console.log('[Weekend] Magazine loaded:', data);
        
        renderMagazine(data);
        
    } catch (error) {
        console.error('[Weekend] Error loading magazine:', error);
        loadPlaceholderContent();
    }
}

function renderMagazine(data) {
    // Hero
    if (data.hero) {
        setText('hero-headline', data.hero.headline);
        setText('hero-subtitle', data.hero.subtitle);
        setText('hero-author', data.hero.author || 'The Litmus Editorial');
    }
    
    // Main sections
    renderSection('week-review-content', data.week_in_review);
    renderSection('apac-content', data.apac);
    renderSection('emea-content', data.emea);
    renderSection('americas-content', data.americas);
    renderSection('flows-content', data.capital_flows);
    renderSection('corporate-content', data.corporate);
    renderSection('week-ahead-content', data.week_ahead);
    
    // The Mechanism
    if (data.mechanism) {
        renderMechanism(data.mechanism);
    }
    
    // Key dates
    if (data.key_dates) {
        renderKeyDates(data.key_dates);
    }
    
    // Segments
    if (data.segments) {
        renderSegments(data.segments);
    }
    
    // Market data
    if (data.market_data) {
        renderMarketData(data.market_data);
    }
}

function renderSection(elementId, sectionData) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    if (!sectionData || !sectionData.content) {
        el.innerHTML = '<p class="loading">Content coming soon...</p>';
        return;
    }
    
    // Convert content to paragraphs
    const content = sectionData.content;
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    el.innerHTML = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');
}

function renderMechanism(mechanism) {
    // Topic
    setText('mechanism-topic', mechanism.topic || 'This Week\'s Mechanism');
    
    // Timing
    const timingEl = document.getElementById('mechanism-timing');
    if (timingEl && mechanism.timing) {
        timingEl.textContent = `Why now: ${mechanism.timing}`;
    }
    
    // Content
    const contentEl = document.getElementById('mechanism-content');
    if (!contentEl) return;
    
    if (!mechanism.content) {
        contentEl.innerHTML = '<p class="loading">Content coming soon...</p>';
        return;
    }
    
    // Parse content - handle markdown-style headers
    let html = '';
    const lines = mechanism.content.split('\n');
    let inParagraph = false;
    let currentParagraph = '';
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Check for headers
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
            // Bold line = subheader
            if (currentParagraph) {
                html += `<p>${escapeHtml(currentParagraph)}</p>`;
                currentParagraph = '';
            }
            const headerText = trimmed.replace(/\*\*/g, '');
            html += `<h4>${escapeHtml(headerText)}</h4>`;
        } else if (trimmed.toLowerCase().includes('what to watch')) {
            // What to Watch section
            if (currentParagraph) {
                html += `<p>${escapeHtml(currentParagraph)}</p>`;
                currentParagraph = '';
            }
            html += `<div class="watch-callout"><h4>What to Watch</h4>`;
        } else if (trimmed === '') {
            // Empty line = paragraph break
            if (currentParagraph) {
                html += `<p>${escapeHtml(currentParagraph)}</p>`;
                currentParagraph = '';
            }
        } else {
            // Regular text
            currentParagraph += (currentParagraph ? ' ' : '') + trimmed;
        }
    }
    
    // Flush remaining paragraph
    if (currentParagraph) {
        html += `<p>${escapeHtml(currentParagraph)}</p>`;
    }
    
    // Close watch callout if opened
    if (html.includes('watch-callout') && !html.includes('</div>')) {
        html += '</div>';
    }
    
    contentEl.innerHTML = html;
}

function renderKeyDates(dates) {
    const listEl = document.getElementById('key-dates-list');
    if (!listEl || !Array.isArray(dates)) return;
    
    listEl.innerHTML = dates.map(date => `
        <li>
            <span class="date-day">${escapeHtml(date.day)}</span>
            <span class="date-event">${escapeHtml(date.event)}</span>
        </li>
    `).join('');
}

function renderSegments(segments) {
    const listEl = document.getElementById('segments-list');
    if (!listEl) return;
    
    const segmentNames = {
        'layer1': 'Layer 1',
        'defi': 'DeFi',
        'infrastructure': 'Infrastructure',
        'ai': 'AI & Compute'
    };
    
    let html = '';
    for (const [key, data] of Object.entries(segments)) {
        const change = data.change || 0;
        const className = change >= 0 ? 'positive' : 'negative';
        const sign = change >= 0 ? '+' : '';
        const name = segmentNames[key] || key;
        
        html += `
            <div class="segment-item">
                <span class="segment-name">${escapeHtml(name)}</span>
                <span class="segment-change ${className}">${sign}${change.toFixed(1)}%</span>
            </div>
        `;
    }
    
    listEl.innerHTML = html;
}

function renderMarketData(marketData) {
    // BTC price
    if (marketData.btc_price) {
        const btcEl = document.getElementById('btc-price');
        if (btcEl) btcEl.textContent = formatPrice(marketData.btc_price);
    }
    
    // ETH price
    if (marketData.eth_price) {
        const ethEl = document.getElementById('eth-price');
        if (ethEl) ethEl.textContent = formatPrice(marketData.eth_price);
    }
    
    // BTC dominance
    if (marketData.btc_dominance) {
        const domEl = document.getElementById('btc-dom');
        if (domEl) domEl.textContent = `${marketData.btc_dominance.toFixed(1)}%`;
    }
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.magazine-section, .mechanism-section');
    
    // Scroll spy
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, { threshold: 0.3 });
    
    sections.forEach(section => observer.observe(section));
    
    // Smooth scroll
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').slice(1);
            const target = document.getElementById(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

function loadPlaceholderContent() {
    setText('hero-headline', 'Weekend Magazine');
    setText('hero-subtitle', 'Your weekly crypto intelligence brief will appear here on Saturday morning.');
    
    const sections = [
        'week-review-content', 'apac-content', 'emea-content', 
        'americas-content', 'flows-content', 'corporate-content', 
        'week-ahead-content', 'mechanism-content'
    ];
    
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = '<p class="loading">Content will be generated Saturday morning.</p>';
        }
    });
    
    setText('mechanism-topic', 'How Fed Rate Decisions Flow Into Crypto');
    setText('mechanism-timing', 'Why now: FOMC meeting December 9-10');
}

// ========== HELPERS ==========

function setText(id, text) {
    const el = document.getElementById(id);
    if (el && text) el.textContent = text;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatPrice(price) {
    if (!price) return '$0';
    if (price >= 1000) {
        return '$' + price.toLocaleString('en-US', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 0 
        });
    }
    return '$' + price.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
}

// Track events (if analytics enabled)
function trackEvent(name, params = {}) {
    if (typeof gtag === 'function') {
        gtag('event', name, params);
    }
    console.log('[Weekend] Event:', name, params);
}
