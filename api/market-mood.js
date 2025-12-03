// Market Mood API - Calculates 9-box positioning from CoinGecko data
// Uses stored historical data for real trails

import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        // Fetch current global market data
        const globalRes = await fetch('https://api.coingecko.com/api/v3/global');
        if (!globalRes.ok) throw new Error('Failed to fetch global data');
        const globalData = await globalRes.json();
        
        // Fetch top 100 coins for breadth calculation
        const coinsRes = await fetch(
            'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h'
        );
        if (!coinsRes.ok) throw new Error('Failed to fetch coins data');
        const coins = await coinsRes.json();
        
        // Calculate current breadth (% of top 100 coins that are green in 24h)
        const greenCoins = coins.filter(c => c.price_change_percentage_24h > 0).length;
        const breadth = (greenCoins / coins.length) * 100;
        
        // Get total market cap and 24h volume
        const totalMarketCap = globalData.data?.total_market_cap?.usd || 0;
        const totalVolume24h = globalData.data?.total_volume?.usd || 0;
        
        // Calculate current M/V ratio
        const mvRatio24h = totalVolume24h > 0 ? totalMarketCap / totalVolume24h : 20;
        
        // Load historical data for trails
        let history = { hourly: [], daily: [] };
        try {
            const historyPath = join(process.cwd(), 'data', 'mood-history.json');
            const historyData = readFileSync(historyPath, 'utf8');
            history = JSON.parse(historyData);
        } catch (e) {
            console.log('No history file found, using current data only');
        }
        
        // Build 24H trail from hourly data
        const trail24h = history.hourly && history.hourly.length > 0 
            ? history.hourly.map(p => ({ breadth: p.breadth, mv: p.mv }))
            : [{ breadth, mv: mvRatio24h }];
        
        // Add current point to trail if different from last
        const lastPoint = trail24h[trail24h.length - 1];
        if (!lastPoint || Math.abs(lastPoint.breadth - breadth) > 0.5 || Math.abs(lastPoint.mv - mvRatio24h) > 0.5) {
            trail24h.push({ breadth, mv: mvRatio24h });
        }
        
        // Build 7-day trail from daily data
        const trail7d = history.daily && history.daily.length > 0
            ? history.daily.map(p => ({ breadth: p.breadth, mv: p.mv }))
            : [];
        
        // Calculate 7-day average M/V ratio
        let mvRatio7d = mvRatio24h;
        if (trail7d.length > 0) {
            mvRatio7d = trail7d.reduce((sum, p) => sum + p.mv, 0) / trail7d.length;
        }
        
        // Calculate average breadth from 24h trail
        const breadthAvg24h = trail24h.reduce((sum, p) => sum + p.breadth, 0) / trail24h.length;
        
        // M/V range for visualization
        const mvRange = { low: 10, high: 45 };
        
        return res.status(200).json({
            success: true,
            lastUpdated: new Date().toISOString(),
            breadth: Math.round(breadth * 10) / 10,
            breadthAvg24h: Math.round(breadthAvg24h * 10) / 10,
            mvRatio24h: Math.round(mvRatio24h * 10) / 10,
            mvRatio7d: Math.round(mvRatio7d * 10) / 10,
            trail: trail24h,      // 24H trail for daily view
            trail7d: trail7d,     // 7-day trail for weekend view
            mvRange,
            dataPoints: {
                hourly: trail24h.length,
                daily: trail7d.length
            },
            raw: {
                totalMarketCap,
                totalVolume24h,
                greenCoins,
                totalCoins: coins.length
            }
        });
        
    } catch (error) {
        console.error('Market mood error:', error);
        
        // Return fallback data
        return res.status(200).json({
            success: false,
            error: error.message,
            breadth: 55,
            breadthAvg24h: 52,
            mvRatio24h: 22,
            mvRatio7d: 25,
            trail: [{ breadth: 55, mv: 22 }],
            trail7d: [],
            mvRange: { low: 10, high: 45 }
        });
    }
}
