#!/usr/bin/env python3
"""
The Litmus - Brief Generator
Generates morning and evening briefs using Claude API
"""

import os
import json
import requests
from datetime import datetime, timezone
from anthropic import Anthropic

# Configuration
COINGECKO_API = "https://api.coingecko.com/api/v3"
MODEL = "claude-sonnet-4-5-20250929"  # Or claude-opus-4-5-20250101 for premium

def get_market_data():
    """Fetch current market data from CoinGecko"""
    try:
        # Get BTC and ETH prices
        prices = requests.get(
            f"{COINGECKO_API}/simple/price",
            params={
                "ids": "bitcoin,ethereum",
                "vs_currencies": "usd",
                "include_24hr_change": "true",
                "include_market_cap": "true"
            },
            timeout=10
        ).json()
        
        # Get global market data
        global_data = requests.get(
            f"{COINGECKO_API}/global",
            timeout=10
        ).json()
        
        return {
            "btc_price": prices.get("bitcoin", {}).get("usd", 0),
            "btc_24h_change": prices.get("bitcoin", {}).get("usd_24h_change", 0),
            "eth_price": prices.get("ethereum", {}).get("usd", 0),
            "eth_24h_change": prices.get("ethereum", {}).get("usd_24h_change", 0),
            "total_market_cap": global_data.get("data", {}).get("total_market_cap", {}).get("usd", 0),
            "market_cap_change_24h": global_data.get("data", {}).get("market_cap_change_percentage_24h_usd", 0)
        }
    except Exception as e:
        print(f"Error fetching market data: {e}")
        return {
            "btc_price": 0,
            "btc_24h_change": 0,
            "eth_price": 0,
            "eth_24h_change": 0,
            "total_market_cap": 0,
            "market_cap_change_24h": 0
        }


def get_morning_prompt(region: str, market_data: dict) -> str:
    """Generate the morning brief prompt for a specific region using FT editorial structure"""
    
    region_context = {
        "apac": {
            "timezone": "Asia-Pacific",
            "overnight": "US session",
            "local_factors": "Hong Kong regulatory, Japan institutional news, Australia macro, Korean retail sentiment",
            "time_example": "6am HKT"
        },
        "emea": {
            "timezone": "Europe and Middle East", 
            "overnight": "US close AND Asia session",
            "local_factors": "ECB policy, MiCA implementation, UK regulatory, European institutional flows",
            "time_example": "6am GMT"
        },
        "americas": {
            "timezone": "North and South America",
            "overnight": "Asia AND Europe sessions",
            "local_factors": "Fed policy, SEC regulatory, ETF flows, US institutional positioning",
            "time_example": "6am EST"
        }
    }
    
    ctx = region_context.get(region, region_context["americas"])
    
    return f"""You are the Chief Markets Analyst for The L/tmus, writing the morning intelligence brief that sophisticated crypto investors read before their first meeting. Your readers cancelled their Bloomberg Terminal subscriptions because they realized most "analysis" is just data with adjectives. They kept The L/tmus because you give them something rarer: a framework for understanding.

**REGIONAL CONTEXT ({ctx['timezone']}):**
Your reader slept through the {ctx['overnight']}. Local factors: {ctx['local_factors']}.

**CURRENT MARKET DATA:**
- Bitcoin: ${market_data['btc_price']:,.0f} ({market_data['btc_24h_change']:+.1f}% 24h)
- Ethereum: ${market_data['eth_price']:,.0f} ({market_data['eth_24h_change']:+.1f}% 24h)
- Total Market Cap: ${market_data['total_market_cap']/1e12:.2f}T ({market_data['market_cap_change_24h']:+.1f}% 24h)

**YOUR MANDATE:**
Write a 500-650 word morning brief that does what the Financial Times does at its best—not merely report, but illuminate. Your reader should finish with a changed mental model, not just updated information. You are not summarizing the market. You are making an argument about what the market is telling us.

**OUTPUT FORMAT (JSON):**
Return ONLY valid JSON with this exact structure:
{{
    "headline": "Compelling 5-7 word headline that captures your thesis (FT style, not clickbait)",
    "sections": {{
        "the_lead": "40-60 words. Open with your thesis—the interpretive frame that makes sense of the noise. This is your TAKE, not a headline restatement.",
        "the_mechanism": "120-150 words. Explain WHY this is happening at the structural level. What's driving flows? Who is positioned where? Connect surface to plumbing. Look beneath the obvious explanation.",
        "the_complication": "100-130 words. Acknowledge what doesn't fit. What contradicts your thesis? Where is the market showing internal conflict? 'However' is the most important word in financial journalism.",
        "the_behavioral_layer": "80-100 words. What psychological or structural dynamic explains this behavior? Herding? Anchoring? Narrative exhaustion? Channel Rory Sutherland—find the hidden logic in apparently irrational behavior.",
        "the_forward_view": "80-100 words. What would confirm your thesis? What would refute it? Give 'if X, then probably Y' frameworks. Not predictions—decision frameworks.",
        "the_closing_line": "15-25 words. One sentence that crystallizes the insight. Something quotable. The line they remember in their meeting later."
    }}
}}

**VOICE PRINCIPLES:**
Write like a senior editor who respects readers' intelligence. Direct because you've done the work. Opinionated because you've earned it.

Prohibited: bullish, bearish, moon, pump, FOMO, FUD, skyrockets, plummets, explodes, massive, altcoins (use specific names), certainty about unpredictable outcomes, anthropomorphizing markets, empty intensifiers.

Required: Specific numbers with context, structural language (rotation, distribution, accumulation, positioning), conditional framing (suggests, indicates, points toward), historical reference.

**QUALITY TEST:**
Before finishing, ask: Would the reader forward this to a colleague with "interesting take"? If not, rewrite.

Return ONLY the JSON object, no other text."""


def get_evening_prompt(region: str, market_data: dict) -> str:
    """Generate the evening brief prompt for a specific region"""
    
    return f"""You are the evening intelligence editor for The Litmus, a premium crypto publication with the editorial standards of the Financial Times and the behavioral insight of Rory Sutherland.

Generate the Evening Update for investors ending their day.

**PURPOSE:**
The morning brief said "here's what to watch." The evening update says "here's what happened." Close the loop.

**CURRENT MARKET DATA:**
- Bitcoin: ${market_data['btc_price']:,.0f} ({market_data['btc_24h_change']:+.1f}% 24h)
- Ethereum: ${market_data['eth_price']:,.0f} ({market_data['eth_24h_change']:+.1f}% 24h)
- Total Market Cap: ${market_data['total_market_cap']/1e12:.2f}T

**OUTPUT FORMAT (JSON):**
Return ONLY valid JSON with this exact structure:
{{
    "headline": "Compelling 4-6 word headline summarizing the day",
    "sections": {{
        "the_day": "3-4 sentences on what actually happened. Price action, catalysts, any surprises.",
        "the_move_explained": "2-3 sentences on WHY it happened. Causation where identifiable.",
        "into_tonight": "2 sentences on what carries into the overnight session."
    }}
}}

**EDITORIAL STANDARDS:**
- Maximum 150 words total
- Acknowledge when the day was uneventful - don't manufacture drama
- Write with conviction but intellectual honesty

Return ONLY the JSON object, no other text."""


def generate_brief(region: str, brief_type: str):
    """Generate a brief using Claude API"""
    
    # Get market data
    market_data = get_market_data()
    
    # Get appropriate prompt
    if brief_type == "morning":
        prompt = get_morning_prompt(region, market_data)
    else:
        prompt = get_evening_prompt(region, market_data)
    
    # Call Claude API
    client = Anthropic()
    
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    
    # Parse response
    response_text = message.content[0].text
    
    # Clean up response (remove markdown if present)
    if response_text.startswith("```"):
        response_text = response_text.split("```")[1]
        if response_text.startswith("json"):
            response_text = response_text[4:]
    response_text = response_text.strip()
    
    brief_data = json.loads(response_text)
    
    # Add metadata
    brief_data["region"] = region
    brief_data["type"] = brief_type
    brief_data["generated_at"] = datetime.now(timezone.utc).isoformat()
    brief_data["btc_price"] = market_data["btc_price"]
    brief_data["eth_price"] = market_data["eth_price"]
    brief_data["total_market_cap"] = market_data["total_market_cap"]
    brief_data["btc_24h_change"] = market_data["btc_24h_change"]
    
    return brief_data


def save_brief(brief_data: dict, region: str, brief_type: str):
    """Save brief to JSON file"""
    
    output_path = f"content/{region}/{brief_type}.json"
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump(brief_data, f, indent=2)
    
    print(f"Saved {region} {brief_type} brief to {output_path}")


def main():
    """Main entry point"""
    
    region = os.environ.get("REGION", "americas")
    brief_type = os.environ.get("BRIEF_TYPE", "morning")
    
    print(f"Generating {region} {brief_type} brief...")
    
    try:
        brief_data = generate_brief(region, brief_type)
        save_brief(brief_data, region, brief_type)
        print("Success!")
    except Exception as e:
        print(f"Error generating brief: {e}")
        raise


if __name__ == "__main__":
    main()
