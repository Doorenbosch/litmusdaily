/**
 * Market Data Cache
 * 
 * Fetches BTC, ETH and global market data from CoinGecko
 * Caches for 5 minutes to reduce API calls and improve reliability
 * 
 * Returns: { btc, eth, market, updated }
 */

// In-memory cache (persists across warm function invocations)
let cache = {
    data: null,
    timestamp: 0
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in ms

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    
    const now = Date.now();
    
    // Return cached data if fresh
    if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
        return res.status(200).json({
            ...cache.data,
            cached: true,
            cacheAge: Math.round((now - cache.timestamp) / 1000)
        });
    }
    
    // Fetch fresh data
    try {
        const [priceData, globalData] = await Promise.all([
            fetchPrices(),
            fetchGlobalData()
        ]);
        
        const freshData = {
            btc: priceData.btc,
            eth: priceData.eth,
            market: globalData,
            updated: new Date().toISOString(),
            updatedTimestamp: now
        };
        
        // Update cache
        cache = {
            data: freshData,
            timestamp: now
        };
        
        return res.status(200).json({
            ...freshData,
            cached: false
        });
        
    } catch (error) {
        console.error('[Market Cache] Error:', error.message);
        
        // Return stale cache if available
        if (cache.data) {
            return res.status(200).json({
                ...cache.data,
                cached: true,
                stale: true,
                cacheAge: Math.round((now - cache.timestamp) / 1000),
                error: 'Using stale data due to API error'
            });
        }
        
        // No cache available - return fallback
        return res.status(200).json(getFallbackData());
    }
}

async function fetchPrices() {
    const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true&include_market_cap=true',
        { 
            headers: { 'User-Agent': 'Sirruna/1.0' },
            timeout: 10000
        }
    );
    
    if (!response.ok) {
        throw new Error(`CoinGecko price API failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
        btc: {
            price: data.bitcoin?.usd || 0,
            change24h: data.bitcoin?.usd_24h_change || 0,
            marketCap: data.bitcoin?.usd_market_cap || 0
        },
        eth: {
            price: data.ethereum?.usd || 0,
            change24h: data.ethereum?.usd_24h_change || 0,
            marketCap: data.ethereum?.usd_market_cap || 0
        }
    };
}

async function fetchGlobalData() {
    const response = await fetch(
        'https://api.coingecko.com/api/v3/global',
        { 
            headers: { 'User-Agent': 'Sirruna/1.0' },
            timeout: 10000
        }
    );
    
    if (!response.ok) {
        throw new Error(`CoinGecko global API failed: ${response.status}`);
    }
    
    const data = await response.json();
    const global = data.data || {};
    
    return {
        totalMarketCap: global.total_market_cap?.usd || 0,
        totalVolume24h: global.total_volume?.usd || 0,
        marketCapChange24h: global.market_cap_change_percentage_24h_usd || 0,
        btcDominance: global.market_cap_percentage?.btc || 0,
        ethDominance: global.market_cap_percentage?.eth || 0,
        activeCryptos: global.active_cryptocurrencies || 0
    };
}

function getFallbackData() {
    return {
        btc: {
            price: 97500,
            change24h: 0,
            marketCap: 1920000000000
        },
        eth: {
            price: 3650,
            change24h: 0,
            marketCap: 440000000000
        },
        market: {
            totalMarketCap: 3500000000000,
            totalVolume24h: 150000000000,
            marketCapChange24h: 0,
            btcDominance: 54.8,
            ethDominance: 12.5,
            activeCryptos: 10000
        },
        updated: new Date().toISOString(),
        updatedTimestamp: Date.now(),
        cached: false,
        fallback: true
    };
}
