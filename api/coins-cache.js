/**
 * Top 100 Coins Cache
 * 
 * Fetches top 100 coins from CoinGecko every 15 minutes
 * Used by: Your Coins vs Market, coin selection, portfolio tracking
 * 
 * Returns: { coins: [...], updated, cached }
 */

// In-memory cache
let cache = {
    data: null,
    timestamp: 0
};

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in ms

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
    
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
        const coins = await fetchTop100Coins();
        
        const freshData = {
            coins: coins,
            count: coins.length,
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
        console.error('[Coins Cache] Error:', error.message);
        
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
        
        // No cache - return error
        return res.status(500).json({
            error: 'Failed to fetch coin data',
            coins: [],
            count: 0
        });
    }
}

async function fetchTop100Coins() {
    const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?' + new URLSearchParams({
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: '100',
            page: '1',
            sparkline: 'false',
            price_change_percentage: '24h,7d,30d'
        }),
        { 
            headers: { 'User-Agent': 'Sirruna/1.0' },
        }
    );
    
    if (!response.ok) {
        throw new Error(`CoinGecko API failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Transform to our standardized format
    return data.map(coin => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        image: coin.image,
        price: coin.current_price,
        marketCap: coin.market_cap,
        rank: coin.market_cap_rank,
        volume24h: coin.total_volume,
        change24h: coin.price_change_percentage_24h || 0,
        change7d: coin.price_change_percentage_7d_in_currency || 0,
        change30d: coin.price_change_percentage_30d_in_currency || 0,
        ath: coin.ath,
        athDate: coin.ath_date,
        athChangePercent: coin.ath_change_percentage
    }));
}
