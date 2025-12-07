/**
 * Weekend Magazine - The Litmus
 * Handles content loading, section navigation, and interactivity
 */

document.addEventListener('DOMContentLoaded', () => {
    init();
});

// Store loaded content
let magazineData = null;

async function init() {
    console.log('[Weekend] Initializing...');
    
    // Set date
    setMagazineDate();
    
    // Load magazine content
    await loadMagazineContent();
    
    // Setup index card navigation
    setupIndexNavigation();
    
    // Setup sector expand/collapse
    setupSectorToggle();
    
    // Load relative performance
    loadRelativePerformance();
    
    // Initialize audio player
    initAudioPlayer();
}

function setMagazineDate() {
    const dateEl = document.getElementById('magazine-date');
    const timestampEl = document.getElementById('reading-timestamp');
    
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const formatted = now.toLocaleDateString('en-US', options);
    
    if (dateEl) dateEl.textContent = formatted;
    if (timestampEl) timestampEl.textContent = formatted;
}

async function loadMagazineContent() {
    try {
        const response = await fetch('content/weekend/magazine.json');
        
        if (!response.ok) {
            console.warn('[Weekend] No magazine.json found, using defaults');
            return;
        }
        
        magazineData = await response.json();
        console.log('[Weekend] Magazine loaded:', magazineData);
        
        // Populate hero
        if (magazineData.hero) {
            setText('hero-headline', magazineData.hero.headline);
            setText('hero-subtitle', magazineData.hero.subtitle);
            
            // Set hero image from curated library
            if (magazineData.hero.image_url) {
                const heroImg = document.getElementById('hero-image-src');
                if (heroImg) {
                    heroImg.src = magazineData.hero.image_url;
                }
            }
        }
        
        // Populate index card headlines with content excerpts
        if (magazineData.week_in_review) {
            setText('card-week-review', getExcerpt(magazineData.week_in_review.content, 80));
        }
        if (magazineData.apac) {
            setText('card-apac', getExcerpt(magazineData.apac.content, 60));
        }
        if (magazineData.emea) {
            setText('card-emea', getExcerpt(magazineData.emea.content, 60));
        }
        if (magazineData.americas) {
            setText('card-americas', getExcerpt(magazineData.americas.content, 60));
        }
        if (magazineData.capital_flows) {
            setText('card-flows', getExcerpt(magazineData.capital_flows.content, 60));
        }
        if (magazineData.corporate) {
            setText('card-corporate', getExcerpt(magazineData.corporate.content, 60));
        }
        if (magazineData.week_ahead) {
            setText('card-outlook', getExcerpt(magazineData.week_ahead.content, 60));
        }
        if (magazineData.mechanism) {
            setText('card-mechanism', magazineData.mechanism.topic || 'The Mechanism');
        }
        
        // Load market mood from magazine data
        if (magazineData.market_mood) {
            renderMarketMoodFromMagazine(magazineData.market_mood);
        }
        
        // Load default section (week_review)
        loadSection('week_review');
        
        // Populate key dates if available
        if (magazineData.key_dates) {
            renderKeyDates(magazineData.key_dates);
        }
        
        // Populate sectors if available
        if (magazineData.sectors) {
            renderSectors(magazineData.sectors);
        }
        
    } catch (error) {
        console.error('[Weekend] Error loading magazine:', error);
    }
}

function setupIndexNavigation() {
    const indexCards = document.querySelectorAll('.index-card');
    
    indexCards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove active from all
            indexCards.forEach(c => c.classList.remove('active'));
            // Add active to clicked
            card.classList.add('active');
            
            // Load the section
            const section = card.dataset.section;
            loadSection(section);
        });
    });
}

function loadSection(sectionKey) {
    if (!magazineData) {
        console.warn('[Weekend] No magazine data loaded');
        return;
    }
    
    const labelEl = document.getElementById('reading-label');
    const headlineEl = document.getElementById('reading-headline');
    const bodyEl = document.getElementById('reading-body');
    const mechanismSection = document.getElementById('mechanism-section');
    
    // Hide mechanism section by default
    if (mechanismSection) {
        mechanismSection.style.display = 'none';
    }
    
    // Map section keys to data and labels
    const sectionMap = {
        'week_review': { data: magazineData.week_in_review, label: 'THE WEEK IN REVIEW' },
        'apac': { data: magazineData.apac, label: 'ASIA-PACIFIC' },
        'emea': { data: magazineData.emea, label: 'EUROPE & MIDDLE EAST' },
        'americas': { data: magazineData.americas, label: 'AMERICAS' },
        'flows': { data: magazineData.capital_flows, label: 'CAPITAL FLOWS' },
        'corporate': { data: magazineData.corporate, label: 'CORPORATE MOVES' },
        'outlook': { data: magazineData.week_ahead, label: 'THE WEEK AHEAD' },
        'mechanism': { data: magazineData.mechanism, label: 'THE MECHANISM' }
    };
    
    const section = sectionMap[sectionKey];
    
    if (!section || !section.data) {
        console.warn('[Weekend] Section not found:', sectionKey);
        return;
    }
    
    // Handle mechanism differently
    if (sectionKey === 'mechanism') {
        loadMechanismSection(section.data);
        return;
    }
    
    // Update label
    if (labelEl) {
        labelEl.textContent = section.label;
        labelEl.style.color = ''; // Reset color
        // Reset classes and add region class if applicable
        labelEl.className = 'article-label';
        if (sectionKey === 'apac') labelEl.classList.add('region-apac');
        if (sectionKey === 'emea') labelEl.classList.add('region-emea');
        if (sectionKey === 'americas') labelEl.classList.add('region-americas');
    }
    
    // Update headline
    if (headlineEl) {
        headlineEl.textContent = section.data.title || section.label;
    }
    
    // Update body content
    if (bodyEl && section.data.content) {
        const paragraphs = section.data.content.split('\n\n').filter(p => p.trim());
        bodyEl.innerHTML = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');
    }
    
    // Scroll to top of reading pane
    const readingPane = document.querySelector('.reading-pane');
    if (readingPane) {
        readingPane.scrollTop = 0;
    }
}

/**
 * Load The Mechanism section - SIMPLIFIED
 * No duplication: header shows label + topic, colored box shows timing + content
 */
function loadMechanismSection(mechanism) {
    const labelEl = document.getElementById('reading-label');
    const headlineEl = document.getElementById('reading-headline');
    const bodyEl = document.getElementById('reading-body');
    const mechanismSection = document.getElementById('mechanism-section');
    
    // Update the article header (above the colored box)
    if (labelEl) {
        labelEl.textContent = 'THE MECHANISM';
        labelEl.className = 'article-label';
        labelEl.style.color = 'var(--teal)';
    }
    
    if (headlineEl) {
        headlineEl.textContent = mechanism.topic || 'How It Actually Works';
    }
    
    // Clear the body - mechanism content goes in the colored section below
    if (bodyEl) {
        bodyEl.innerHTML = '';
    }
    
    // Show and populate mechanism section (the colored box)
    if (mechanismSection) {
        mechanismSection.style.display = 'block';
        
        // Show the timing as the header of the box
        const timingEl = document.getElementById('mechanism-timing');
        if (timingEl && mechanism.timing) {
            timingEl.textContent = 'Why now: ' + mechanism.timing;
        }
        
        // Populate the content
        const contentEl = document.getElementById('mechanism-content');
        if (contentEl && mechanism.content) {
            contentEl.innerHTML = formatMechanismContent(mechanism.content);
        }
    }
    
    // Scroll to top
    const readingPane = document.querySelector('.reading-pane');
    if (readingPane) {
        readingPane.scrollTop = 0;
    }
}

function formatMechanismContent(content) {
    let html = '';
    const lines = content.split('\n');
    let currentParagraph = '';
    let inWatchSection = false;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Check for bold headers like **The Dollar Channel**
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
            // Flush current paragraph
            if (currentParagraph) {
                html += `<p>${escapeHtml(currentParagraph)}</p>`;
                currentParagraph = '';
            }
            
            const headerText = trimmed.replace(/\*\*/g, '');
            
            // Check if this is the "What to Watch" section
            if (headerText.toLowerCase().includes('what to watch')) {
                html += `<div class="watch-box"><h4>${escapeHtml(headerText)}</h4>`;
                inWatchSection = true;
            } else {
                html += `<h4>${escapeHtml(headerText)}</h4>`;
            }
        } else if (trimmed === '') {
            // Empty line = paragraph break
            if (currentParagraph) {
                html += `<p>${escapeHtml(currentParagraph)}</p>`;
                currentParagraph = '';
            }
        } else {
            // Regular text - handle inline bold
            currentParagraph += (currentParagraph ? ' ' : '') + trimmed;
        }
    }
    
    // Flush remaining paragraph
    if (currentParagraph) {
        html += `<p>${escapeHtml(currentParagraph)}</p>`;
    }
    
    // Close watch box if opened
    if (inWatchSection) {
        html += '</div>';
    }
    
    return html;
}

function renderKeyDates(dates) {
    const listEl = document.getElementById('key-dates-list');
    if (!listEl || !Array.isArray(dates)) return;
    
    listEl.innerHTML = dates.map(date => `
        <div class="key-date">
            <span class="date-day">${escapeHtml(date.day)}</span>
            <span class="date-event">${escapeHtml(date.event)}</span>
        </div>
    `).join('');
}

function renderSectors(sectors) {
    // Update sector data if provided in magazine.json
    for (const [key, data] of Object.entries(sectors)) {
        const changeEl = document.getElementById(`sector-${key}-change`);
        const weeklyEl = document.getElementById(`sector-${key}-weekly`);
        
        if (changeEl && data.change !== undefined) {
            const change = data.change;
            const sign = change >= 0 ? '+' : '';
            changeEl.textContent = `${sign}${change.toFixed(1)}%`;
            changeEl.className = 'sector-change ' + (change > 0.5 ? 'positive' : change < -0.5 ? 'negative' : 'neutral');
        }
        
        if (weeklyEl && data.weekly) {
            weeklyEl.textContent = data.weekly;
        }
    }
}

function setupSectorToggle() {
    const sectorItems = document.querySelectorAll('.sector-item');
    
    sectorItems.forEach(item => {
        item.addEventListener('click', () => {
            // Toggle expanded state
            const wasExpanded = item.classList.contains('expanded');
            
            // Close all others
            sectorItems.forEach(s => s.classList.remove('expanded'));
            
            // Toggle clicked one
            if (!wasExpanded) {
                item.classList.add('expanded');
            }
        });
    });
}

async function loadRelativePerformance() {
    const chartEl = document.getElementById('relative-chart-7d');
    const marketChangeEl = document.getElementById('market-7d-change');
    
    if (!chartEl) return;
    
    try {
        // Fetch market data
        const response = await fetch('/api/market-data');
        if (!response.ok) return;
        
        const data = await response.json();
        
        // Update market baseline
        if (marketChangeEl && data.market_change_7d !== undefined) {
            const change = data.market_change_7d;
            const sign = change >= 0 ? '+' : '';
            marketChangeEl.textContent = `${sign}${change.toFixed(1)}%`;
        }
        
        // Get user's focus coins from localStorage
        const focusCoins = JSON.parse(localStorage.getItem('focusCoins') || '["bitcoin","ethereum"]');
        
        // Render coin rows
        if (data.coins && focusCoins.length > 0) {
            const existingRows = chartEl.querySelectorAll('.relative-row:not(.market-row)');
            existingRows.forEach(row => row.remove());
            
            const marketChange = data.market_change_7d || 0;
            
            focusCoins.forEach(coinId => {
                const coin = data.coins.find(c => c.id === coinId);
                if (coin) {
                    const row = createRelativeRow(coin, marketChange);
                    chartEl.appendChild(row);
                }
            });
        }
        
    } catch (error) {
        console.warn('[Weekend] Could not load relative performance:', error);
    }
}

function createRelativeRow(coin, marketChange) {
    const change = coin.price_change_7d || 0;
    const relative = change - marketChange;
    const sign = change >= 0 ? '+' : '';
    const relSign = relative >= 0 ? '+' : '';
    const isOutperform = relative >= 0;
    
    // Calculate bar width (max 50% of container width for each direction)
    const barWidth = Math.min(Math.abs(relative) * 2, 50);
    
    const row = document.createElement('div');
    row.className = 'relative-row';
    row.innerHTML = `
        <span class="rel-name">${coin.symbol.toUpperCase()}</span>
        <span class="rel-change">${sign}${change.toFixed(1)}%</span>
        <div class="rel-bar-container">
            <div class="rel-baseline"></div>
            <div class="rel-bar ${isOutperform ? 'outperform' : 'underperform'}" style="width: ${barWidth}%"></div>
        </div>
        <span class="rel-vs ${isOutperform ? 'positive' : 'negative'}">${relSign}${relative.toFixed(1)}%</span>
    `;
    
    return row;
}

// ========== HELPERS ==========

function setText(id, text) {
    const el = document.getElementById(id);
    if (el && text) el.textContent = text;
}

function getExcerpt(content, maxLength = 80) {
    if (!content) return '';
    // Get first sentence or truncate
    const firstSentence = content.split(/[.!?]/)[0];
    if (firstSentence.length <= maxLength) {
        return firstSentence + '...';
    }
    return firstSentence.substring(0, maxLength).trim() + '...';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Track events for analytics
function trackEvent(name, params = {}) {
    if (typeof gtag === 'function') {
        gtag('event', name, params);
    }
}

// ========== MARKET MOOD FROM MAGAZINE ==========

function renderMarketMoodFromMagazine(moodData) {
    if (!moodData) return;
    
    const grid = document.getElementById('nine-box-grid-weekend');
    if (!grid) return;
    
    const { current, trail, title, description } = moodData;
    
    // Update title and description
    setText('mood-title-weekend', title || 'Market Mood');
    setText('mood-description-weekend', description || '');
    
    if (current) {
        setText('breadth-value-weekend', `${Math.round(current.breadth)}% of coins are green`);
    }
    
    // M/V range for mapping (volume_ratio is typically 30-60)
    const mvRange = { low: 30, high: 60 };
    
    // Map coordinates
    const mapX = (b) => (b / 100) * 100;
    const mapY = (mv) => {
        // Lower M/V = more activity = frenzied = top
        // Higher M/V = less activity = quiet = bottom
        const normalized = (mv - mvRange.low) / (mvRange.high - mvRange.low);
        return Math.max(0, Math.min(100, normalized * 100));
    };
    
    // Position teal dot (current position)
    const tealDot = document.getElementById('mood-dot-teal-weekend');
    if (tealDot && current) {
        tealDot.style.left = `${mapX(current.breadth)}%`;
        tealDot.style.top = `${mapY(current.volume_ratio)}%`;
    }
    
    // Draw trail and position burgundy dot at end
    if (trail && trail.length > 1) {
        const trailPath = document.getElementById('trail-path-7day');
        const startDot = document.getElementById('mood-dot-start-weekend');
        const burgundyDot = document.getElementById('mood-dot-burgundy-weekend');
        
        // Map trail points
        const points = trail.map(p => ({
            x: mapX(p.breadth),
            y: mapY(p.volume_ratio)
        }));
        
        if (trailPath && points.length > 0) {
            // Create smooth path
            let d = `M ${points[0].x} ${points[0].y}`;
            
            for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                const next = points[i + 1] || curr;
                const prevPrev = points[i - 2] || prev;
                
                // Catmull-Rom to Bezier conversion
                const tension = 0.3;
                const cp1x = prev.x + (curr.x - prevPrev.x) * tension;
                const cp1y = prev.y + (curr.y - prevPrev.y) * tension;
                const cp2x = curr.x - (next.x - prev.x) * tension;
                const cp2y = curr.y - (next.y - prev.y) * tension;
                
                d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
            }
            
            trailPath.setAttribute('d', d);
        }
        
        // Position start dot (first point of trail)
        if (startDot && points.length > 0) {
            startDot.style.left = `${points[0].x}%`;
            startDot.style.top = `${points[0].y}%`;
        }
        
        // Position burgundy dot at end of trail
        if (burgundyDot && points.length > 0) {
            const lastPoint = points[points.length - 1];
            burgundyDot.style.left = `${lastPoint.x}%`;
            burgundyDot.style.top = `${lastPoint.y}%`;
        }
    }
    
    // Highlight active zone
    const zone = current?.zone || getZoneFromTitle(title);
    grid.querySelectorAll('.box').forEach(box => {
        box.classList.remove('active-zone');
        if (box.dataset.zone === zone) {
            box.classList.add('active-zone');
        }
    });
}

function getZoneFromTitle(title) {
    if (!title) return '';
    // Convert title to zone key: "Weak Rally" -> "weak-rally"
    return title.toLowerCase().replace(/\s+/g, '-');
}

// ========== AUDIO PLAYER ==========

function initAudioPlayer() {
    const audioEdition = document.getElementById('audio-edition');
    const audio = document.getElementById('audio-element');
    const playBtn = document.getElementById('audio-play-btn');
    const progressFill = document.getElementById('audio-progress-fill');
    const progressBar = document.querySelector('.audio-progress-bar');
    const currentTime = document.getElementById('audio-current');
    const totalTime = document.getElementById('audio-total');
    const speedBtn = document.getElementById('audio-speed');
    const durationDisplay = document.getElementById('audio-duration');
    
    if (!audio || !playBtn || !audioEdition) return;
    
    let playbackRate = 1;
    const speeds = [1, 1.25, 1.5, 1.75, 2];
    
    // Try to load audio file
    loadAudioFile();
    
    // Play/pause toggle
    playBtn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play();
            playBtn.querySelector('.play-icon').style.display = 'none';
            playBtn.querySelector('.pause-icon').style.display = 'block';
        } else {
            audio.pause();
            playBtn.querySelector('.play-icon').style.display = 'block';
            playBtn.querySelector('.pause-icon').style.display = 'none';
        }
    });
    
    // Update progress bar
    audio.addEventListener('timeupdate', () => {
        const percent = (audio.currentTime / audio.duration) * 100;
        progressFill.style.width = `${percent}%`;
        currentTime.textContent = formatTime(audio.currentTime);
    });
    
    // Set total time when loaded
    audio.addEventListener('loadedmetadata', () => {
        totalTime.textContent = formatTime(audio.duration);
        const mins = Math.ceil(audio.duration / 60);
        durationDisplay.textContent = `${mins} min`;
    });
    
    // Click on progress bar to seek
    if (progressBar) {
        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            audio.currentTime = percent * audio.duration;
        });
    }
    
    // Speed control
    if (speedBtn) {
        speedBtn.addEventListener('click', () => {
            const currentIndex = speeds.indexOf(playbackRate);
            playbackRate = speeds[(currentIndex + 1) % speeds.length];
            audio.playbackRate = playbackRate;
            speedBtn.textContent = `${playbackRate}×`;
        });
    }
    
    // Reset on end
    audio.addEventListener('ended', () => {
        playBtn.querySelector('.play-icon').style.display = 'block';
        playBtn.querySelector('.pause-icon').style.display = 'none';
        progressFill.style.width = '0%';
    });
}

async function loadAudioFile() {
    const audioEdition = document.getElementById('audio-edition');
    const audio = document.getElementById('audio-element');
    
    if (!audioEdition || !audio) return;
    
    // Get weekend date for audio file
    const weekendDate = getWeekendDate();
    const audioPath = `content/weekend/audio/week-in-review-${weekendDate}.mp3`;
    
    try {
        // Check if audio file exists
        const response = await fetch(audioPath, { method: 'HEAD' });
        
        if (response.ok) {
            audio.src = audioPath;
            audioEdition.classList.remove('hidden');
            console.log('[Weekend] Audio file found:', audioPath);
        } else {
            console.log('[Weekend] No audio file found at:', audioPath);
        }
    } catch (e) {
        console.log('[Weekend] Audio check failed:', e);
    }
}

function getWeekendDate() {
    const now = new Date();
    // Get most recent Saturday
    const day = now.getDay();
    const diff = day === 0 ? 1 : day; // Sunday = 1 day back, others = day number
    const saturday = new Date(now);
    saturday.setDate(now.getDate() - diff + 6);
    
    const year = saturday.getFullYear();
    const month = String(saturday.getMonth() + 1).padStart(2, '0');
    const date = String(saturday.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${date}`;
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
