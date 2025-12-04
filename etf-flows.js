// ETF Flows API - Uses SoSoValue API
// Add SOSOVALUE_API_KEY to your Vercel environment variables

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600'); // 5 min cache
    
    const apiKey = process.env.SOSOVALUE_API_KEY;
    
    if (!apiKey) {
        // Return mock data if no API key configured
        return res.status(200).json(getMockData());
    }
    
    try {
        // SoSoValue ETF endpoint - adjust based on their actual docs
        // Common patterns: /api/v1/etf/btc/flows or /etf/us-btc-spot
        const response = await fetch('https://api.sosovalue.com/etf/us-btc-spot/flows', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.error('SoSoValue API error:', response.status);
            return res.status(200).json(getMockData());
        }
        
        const data = await response.json();
        
        // Transform SoSoValue response to our format
        const transformed = transformSoSoValueData(data);
        
        return res.status(200).json(transformed);
        
    } catch (error) {
        console.error('ETF Flows API error:', error);
        return res.status(200).json(getMockData());
    }
}

// Transform SoSoValue data to our app format
function transformSoSoValueData(data) {
    // Adjust based on actual SoSoValue response structure
    // Their dashboard shows: daily net inflow, cumulative, trading volume
    
    // Expected SoSoValue fields (approximate):
    // - dailyNetInflow or daily_net_inflow
    // - historicalFlows or flows_history
    
    try {
        const yesterday = data.dailyNetInflow || data.daily_net_inflow || 0;
        const weekData = data.historicalFlows || data.flows_history || [];
        
        // Get last 5 days
        const week = weekData.slice(-5).map((day, i) => ({
            day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i],
            amount: day.netInflow || day.net_inflow || day.amount || 0
        }));
        
        // Generate insight based on pattern
        const insight = generateInsight(yesterday, week);
        
        return {
            yesterday: {
                amount: Math.round(yesterday / 1000000), // Convert to millions
                date: 'Yesterday'
            },
            week: week.length ? week : getMockData().week,
            insight: insight,
            source: 'sosovalue',
            updated: new Date().toISOString()
        };
    } catch (e) {
        console.error('Transform error:', e);
        return getMockData();
    }
}

// Generate editorial insight from data
function generateInsight(yesterday, week) {
    const isInflow = yesterday > 0;
    const consecutiveDays = countConsecutive(week, isInflow);
    const weekTotal = week.reduce((sum, d) => sum + (d.amount || 0), 0);
    
    if (consecutiveDays >= 3) {
        return `${consecutiveDays} consecutive days of net ${isInflow ? 'inflows' : 'outflows'}`;
    } else if (Math.abs(yesterday) > 400) {
        return `Significant ${isInflow ? 'institutional buying' : 'redemptions'} yesterday`;
    } else if (weekTotal > 500) {
        return `Strong weekly accumulation: +$${Math.round(weekTotal)}M net`;
    } else if (weekTotal < -500) {
        return `Weekly outflows signal caution: -$${Math.abs(Math.round(weekTotal))}M`;
    } else {
        return isInflow ? 'Steady institutional interest continues' : 'Mixed signals from institutional flows';
    }
}

function countConsecutive(week, isInflow) {
    let count = 0;
    for (let i = week.length - 1; i >= 0; i--) {
        const dayIsInflow = (week[i].amount || 0) > 0;
        if (dayIsInflow === isInflow) {
            count++;
        } else {
            break;
        }
    }
    return count;
}

// Mock data fallback
function getMockData() {
    return {
        yesterday: {
            amount: 438,
            date: 'Yesterday'
        },
        week: [
            { day: 'Mon', amount: 215 },
            { day: 'Tue', amount: 380 },
            { day: 'Wed', amount: -120 },
            { day: 'Thu', amount: 290 },
            { day: 'Fri', amount: 438 }
        ],
        insight: 'Third consecutive day of net inflows',
        source: 'mock',
        updated: new Date().toISOString()
    };
}
