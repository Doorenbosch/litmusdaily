#!/usr/bin/env python3
"""
Weekend Magazine Generator - The Litmus
Generates comprehensive weekly crypto analysis
Runs: Saturday 07:00 SGT/GMT+8

Sections:
1. The Week in Review - Market summary
2. APAC Region - Asia-Pacific developments  
3. EMEA Region - Europe & Middle East developments
4. Americas Region - US & Latin America developments
5. Capital Flows - Institutional movements
6. Corporate Moves - Company news (MicroStrategy, etc.)
7. The Week Ahead - What to watch
"""

import os
import json
import requests
from datetime import datetime, timedelta
from anthropic import Anthropic

# Configuration
MODEL = "claude-opus-4-5-20250514"  # Opus 4.5 for highest quality
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
COINGECKO_API = "https://api.coingecko.com/api/v3"

# Crypto segments for analysis
CRYPTO_SEGMENTS = {
    "payment": ["bitcoin", "litecoin", "monero"],
    "stablecoin": ["tether", "usd-coin"],
    "infrastructure": ["ethereum", "solana", "avalanche-2"],
    "defi": ["aave", "uniswap", "compound-governance-token"],
    "utility": ["chainlink", "filecoin", "render-token"],
    "entertainment": ["apecoin", "decentraland", "the-sandbox"],
    "ai": ["render-token", "akash-network", "bittensor"]
}


def fetch_weekly_market_data():
    """Fetch comprehensive market data for weekly analysis"""
    data = {}
    
    try:
        # Global market data
        global_response = requests.get(f"{COINGECKO_API}/global", timeout=10)
        if global_response.ok:
            global_data = global_response.json().get("data", {})
            data["total_market_cap"] = global_data.get("total_market_cap", {}).get("usd", 0)
            data["total_volume"] = global_data.get("total_volume", {}).get("usd", 0)
            data["btc_dominance"] = global_data.get("market_cap_percentage", {}).get("btc", 0)
            data["eth_dominance"] = global_data.get("market_cap_percentage", {}).get("eth", 0)
            data["market_cap_change_24h"] = global_data.get("market_cap_change_percentage_24h_usd", 0)
        
        # Top coins with 7-day data
        coins_response = requests.get(
            f"{COINGECKO_API}/coins/markets",
            params={
                "vs_currency": "usd",
                "order": "market_cap_desc",
                "per_page": 50,
                "sparkline": False,
                "price_change_percentage": "24h,7d,30d"
            },
            timeout=10
        )
        if coins_response.ok:
            coins = coins_response.json()
            data["top_coins"] = [{
                "id": c["id"],
                "symbol": c["symbol"].upper(),
                "name": c["name"],
                "price": c["current_price"],
                "market_cap": c["market_cap"],
                "volume_24h": c["total_volume"],
                "change_24h": c.get("price_change_percentage_24h", 0),
                "change_7d": c.get("price_change_percentage_7d_in_currency", 0),
                "change_30d": c.get("price_change_percentage_30d_in_currency", 0)
            } for c in coins[:20]]
            
            # Calculate segment performance
            data["segments"] = calculate_segment_performance(coins)
        
        # ETF data (simulated - would need real API)
        data["etf_flows"] = {
            "weekly_net": 1200000000,  # $1.2B weekly net inflow
            "daily_average": 240000000,
            "top_performer": "IBIT"
        }
        
    except Exception as e:
        print(f"Error fetching market data: {e}")
    
    return data


def calculate_segment_performance(coins):
    """Calculate performance by crypto segment"""
    segments = {}
    
    coin_map = {c["id"]: c for c in coins}
    
    for segment_name, segment_coins in CRYPTO_SEGMENTS.items():
        changes = []
        for coin_id in segment_coins:
            if coin_id in coin_map:
                change = coin_map[coin_id].get("price_change_percentage_7d_in_currency", 0)
                if change:
                    changes.append(change)
        
        if changes:
            segments[segment_name] = {
                "change": sum(changes) / len(changes),
                "coins": [coin_map[c]["symbol"].upper() for c in segment_coins if c in coin_map]
            }
    
    return segments


def get_key_dates_prompt():
    """Generate prompt for upcoming key dates"""
    return """
Identify the most important macro-economic and crypto-specific dates for the upcoming week that could impact cryptocurrency markets.

Focus on:
- Federal Reserve announcements or speeches
- US economic data (CPI, PPI, jobs, GDP)
- European Central Bank decisions
- Major crypto regulatory deadlines
- Significant token unlocks or protocol upgrades
- Important earnings from crypto-adjacent companies

Return as JSON array:
[
    {"day": "Mon 9", "event": "China CPI Release"},
    {"day": "Wed 11", "event": "US CPI Inflation Data"}
]

Limit to 5-7 most impactful events.
"""


def get_magazine_prompt(market_data):
    """Generate the comprehensive weekend magazine prompt"""
    
    # Format market data for prompt
    btc_data = next((c for c in market_data.get("top_coins", []) if c["id"] == "bitcoin"), {})
    eth_data = next((c for c in market_data.get("top_coins", []) if c["id"] == "ethereum"), {})
    
    market_context = f"""
CURRENT MARKET STATE:
- Total Market Cap: ${market_data.get('total_market_cap', 0)/1e12:.2f}T
- 24h Change: {market_data.get('market_cap_change_24h', 0):.1f}%
- BTC Dominance: {market_data.get('btc_dominance', 0):.1f}%
- ETH Dominance: {market_data.get('eth_dominance', 0):.1f}%

BITCOIN:
- Price: ${btc_data.get('price', 0):,.0f}
- 7-day change: {btc_data.get('change_7d', 0):.1f}%
- 30-day change: {btc_data.get('change_30d', 0):.1f}%

ETHEREUM:
- Price: ${eth_data.get('price', 0):,.0f}
- 7-day change: {eth_data.get('change_7d', 0):.1f}%
- 30-day change: {eth_data.get('change_30d', 0):.1f}%

SEGMENT PERFORMANCE (7-day):
"""
    
    for segment, data in market_data.get("segments", {}).items():
        market_context += f"- {segment.title()}: {data['change']:.1f}%\n"
    
    market_context += f"""
ETF FLOWS (estimated):
- Weekly net: ${market_data.get('etf_flows', {}).get('weekly_net', 0)/1e9:.1f}B
"""

    return f"""You are the editorial team at The Litmus, a premium crypto intelligence publication combining Financial Times editorial quality with behavioral economics insight.

Today is Saturday. You are writing the Weekend Magazine - our flagship weekly analysis that provides depth and perspective that daily coverage cannot. This is the piece sophisticated investors save for their weekend reading.

{market_context}

Write a comprehensive Weekend Magazine with these sections. Each section should be substantive (200-350 words), insightful, and written for intelligent readers who want understanding, not hype.

SECTIONS TO WRITE:

1. THE WEEK IN REVIEW (300-400 words)
Start with your thesis about what this week revealed about the market's character. Not just what happened, but what it means. Connect flows, sentiment, and price action into a coherent narrative.

2. ASIA-PACIFIC (250-300 words)
What happened in APAC that matters? Hong Kong, Singapore, Japan, Korea, Australia. Regulatory developments, institutional moves, retail sentiment. Write this so an APAC reader feels you understand their market, not that you're a US publication adding a token paragraph.

3. EUROPE & MIDDLE EAST (250-300 words)  
MiCA implementation, UK regulatory stance, UAE/Dubai developments, institutional European adoption. What's the European narrative this week?

4. AMERICAS (250-300 words)
US ETF flows, SEC/regulatory developments, Latin American adoption stories. The US remains the center of institutional crypto - what moved this week and why?

5. CAPITAL FLOWS (250-300 words)
Follow the smart money. ETF flows, on-chain whale movements, exchange balances, stablecoin minting/burning. What do the flows tell us that prices don't?

6. CORPORATE MOVES (200-250 words)
MicroStrategy, miners, exchanges, and crypto-adjacent companies. What are the corporate players doing and what does it signal?

7. THE WEEK AHEAD (200-250 words)
What to watch next week. Key dates, potential catalysts, levels that matter. Give readers a framework for the week, not predictions.

VOICE:
Write like The Economist meets the Financial Times. Authoritative but not arrogant. Analytical but accessible. You have opinions and you've earned them through analysis.

ABSOLUTELY PROHIBITED:
- Bullish/bearish, moon, pump, dump, FOMO, FUD
- Exclamation marks
- Predictions of specific prices
- "Could," "might," "may" hedging (be direct)
- Anthropomorphizing ("Bitcoin wants to...")

OUTPUT FORMAT:
Return ONLY valid JSON:
{{
    "hero": {{
        "headline": "Compelling 8-12 word main headline",
        "subtitle": "One sentence expanding on the headline",
        "image_keywords": "3-5 keywords for Unsplash image search"
    }},
    "sections": {{
        "week_review": {{
            "headline": "4-8 word section headline",
            "content": "Full section content with paragraph breaks as \\n\\n",
            "image": "Unsplash URL or keywords",
            "image_caption": "Brief caption for image"
        }},
        "apac": {{
            "headline": "4-8 word section headline",
            "content": "Full section content",
            "image": "Unsplash URL or keywords",
            "image_caption": "Brief caption"
        }},
        "emea": {{
            "headline": "4-8 word section headline", 
            "content": "Full section content",
            "image": "Unsplash URL or keywords",
            "image_caption": "Brief caption"
        }},
        "americas": {{
            "headline": "4-8 word section headline",
            "content": "Full section content",
            "image": "Unsplash URL or keywords", 
            "image_caption": "Brief caption"
        }},
        "flows": {{
            "headline": "4-8 word section headline",
            "content": "Full section content",
            "image": "Unsplash URL or keywords",
            "image_caption": "Brief caption"
        }},
        "corporate": {{
            "headline": "4-8 word section headline",
            "content": "Full section content",
            "image": "Unsplash URL or keywords",
            "image_caption": "Brief caption"
        }},
        "outlook": {{
            "headline": "4-8 word section headline",
            "content": "Full section content"
        }}
    }}
}}

Return ONLY the JSON object."""


def get_key_dates_for_week():
    """Get key dates - could be AI-generated or from a calendar API"""
    # For now, return sensible defaults based on typical macro calendar
    # In production, this would call an API or use AI to identify upcoming events
    
    now = datetime.now()
    next_monday = now + timedelta(days=(7 - now.weekday()) % 7 or 7)
    
    # These would be dynamically generated
    return [
        {"day": f"Mon {next_monday.day}", "event": "Fed Chair Powell Speech"},
        {"day": f"Tue {next_monday.day + 1}", "event": "US Producer Price Index"},
        {"day": f"Wed {next_monday.day + 2}", "event": "FOMC Minutes Release"},
        {"day": f"Thu {next_monday.day + 3}", "event": "ECB Rate Decision"},
        {"day": f"Fri {next_monday.day + 4}", "event": "US Retail Sales Data"}
    ]


def call_anthropic_api(prompt):
    """Call Anthropic API for content generation"""
    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    
    message = client.messages.create(
        model=MODEL,
        max_tokens=8000,
        temperature=0.6,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    
    response_text = message.content[0].text.strip()
    
    # Clean up response
    if response_text.startswith("```json"):
        response_text = response_text[7:]
    if response_text.startswith("```"):
        response_text = response_text[3:]
    if response_text.endswith("```"):
        response_text = response_text[:-3]
    
    return json.loads(response_text.strip())


def generate_weekend_magazine():
    """Generate the complete weekend magazine"""
    print("=" * 60)
    print("THE LITMUS - WEEKEND MAGAZINE GENERATOR")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Fetch market data
    print("\n📊 Fetching market data...")
    market_data = fetch_weekly_market_data()
    
    # Generate magazine content
    print("\n📝 Generating magazine content with Claude Opus 4.5...")
    prompt = get_magazine_prompt(market_data)
    magazine_content = call_anthropic_api(prompt)
    
    # Add key dates
    print("\n📅 Adding key dates...")
    magazine_content["key_dates"] = get_key_dates_for_week()
    
    # Add segment data
    magazine_content["segments"] = market_data.get("segments", {})
    
    # Add metadata
    magazine_content["generated_at"] = datetime.now().isoformat()
    magazine_content["market_data"] = {
        "btc_price": next((c["price"] for c in market_data.get("top_coins", []) if c["id"] == "bitcoin"), 0),
        "eth_price": next((c["price"] for c in market_data.get("top_coins", []) if c["id"] == "ethereum"), 0),
        "total_market_cap": market_data.get("total_market_cap", 0),
        "btc_dominance": market_data.get("btc_dominance", 0)
    }
    
    # Save to file
    output_dir = "content/weekend"
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, "magazine.json")
    with open(output_path, "w") as f:
        json.dump(magazine_content, f, indent=2)
    
    print(f"\n✅ Magazine saved to {output_path}")
    print(f"   Hero: {magazine_content.get('hero', {}).get('headline', 'N/A')}")
    
    return magazine_content


if __name__ == "__main__":
    if not ANTHROPIC_API_KEY:
        print("Error: ANTHROPIC_API_KEY environment variable not set")
        exit(1)
    
    generate_weekend_magazine()
