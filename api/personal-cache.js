/**
 * Personal Data Cache
 * 
 * Fetches extended historical data for portfolio analysis
 * Refreshes once daily (or on first request of the day)
 * 
 * Used by: Personal Edition (7d/30d/90d views)
 * 
 * Returns: { coins: [...], market: {...}, updated }
 */

// In-memory cache
let cache = {
    data: null,
    timestamp: 0,
    date: null
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
    
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Return cached data if same day
    if (cache.data && cache.date === today) {
        return res.status(200).json({
            ...cache.data,
            cached: true,
            cacheAge: Math.round((now - cache.timestamp) / 1000)
        });
    }
    
    // Fetch fresh data
    try {
        const [coins, marketHistory] = await Promise.all([
            fetchCoinsWithHistory(),
            fetchMarketHistory()
        ]);
        
        const freshData = {
            coins: coins,
            market: marketHistory,
            updated: new Date().toISOString(),
            updatedTimestamp: now,
            dataDate: today
        };
        
        // Update cache
        cache = {
            data: freshData,
            timestamp: now,
            date: today
        };
        
        return res.status(200).json({
            ...freshData,
            cached: false
        });
        
    } catch (error) {
        console.error('[Personal Cache] Error:', error.message);
        
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
        
        return res.status(500).json({
            error: 'Failed to fetch personal data',
            coins: [],
            market: {}
        });
    }
}

async function fetchCoinsWithHistory() {
    // Get top 100 with extended price change data
    const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?' + new URLSearchParams({
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: '100',
            page: '1',
            sparkline: 'true', // Include 7-day sparkline
            price_change_percentage: '1h,24h,7d,14d,30d,90d,1y'
        }),
        { headers: { 'User-Agent': 'Sirruna/1.0' } }
    );
    
    if (!response.ok) {
        throw new Error(`CoinGecko coins API failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    return data.map(coin => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        image: coin.image,
        price: coin.current_price,
        marketCap: coin.market_cap,
        rank: coin.market_cap_rank,
        volume24h: coin.total_volume,
        // All timeframe changes
        change1h: coin.price_change_percentage_1h_in_currency || 0,
        change24h: coin.price_change_percentage_24h_in_currency || 0,
        change7d: coin.price_change_percentage_7d_in_currency || 0,
        change14d: coin.price_change_percentage_14d_in_currency || 0,
        change30d: coin.price_change_percentage_30d_in_currency || 0,
        change90d: coin.price_change_percentage_90d_in_currency || 0,
        change1y: coin.price_change_percentage_1y_in_currency || 0,
        // Sparkline for mini charts
        sparkline7d: coin.sparkline_in_7d?.price || [],
        // ATH data
        ath: coin.ath,
        athDate: coin.ath_date,
        athChangePercent: coin.ath_change_percentage,
        // Supply data
        circulatingSupply: coin.circulating_supply,
        totalSupply: coin.total_supply,
        maxSupply: coin.max_supply
    }));
}

async function fetchMarketHistory() {
    // Get global market data for benchmark comparisons
    const response = await fetch(
        'https://api.coingecko.com/api/v3/global',
        { headers: { 'User-Agent': 'Sirruna/1.0' } }
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
        activeCryptos: global.active_cryptocurrencies || 0,
        markets: global.markets || 0,
        // Dominance breakdown
        dominance: {
            btc: global.market_cap_percentage?.btc || 0,
            eth: global.market_cap_percentage?.eth || 0,
            usdt: global.market_cap_percentage?.usdt || 0,
            bnb: global.market_cap_percentage?.bnb || 0,
            sol: global.market_cap_percentage?.sol || 0,
            xrp: global.market_cap_percentage?.xrp || 0
        }
    };
}
