// Vercel Serverless Function: /api/breakdown
// Fetches The Breakdown podcast RSS, parses, and returns structured JSON

const RSS_URL = 'https://feeds.megaphone.fm/NLWLLC2118417614';
const CACHE_DURATION = 600; // 10 minutes in seconds

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    // Set cache headers
    res.setHeader('Cache-Control', `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=60`);
    
    try {
        // Fetch RSS feed
        const response = await fetch(RSS_URL, {
            headers: {
                'User-Agent': 'TheLitmus/1.0 (Podcast Aggregator)',
                'Accept': 'application/rss+xml, application/xml, text/xml'
            }
        });
        
        if (!response.ok) {
            throw new Error(`RSS fetch failed: ${response.status}`);
        }
        
        const xmlText = await response.text();
        
        // Parse RSS (simple regex-based parsing for serverless efficiency)
        const episodes = parseRSS(xmlText);
        
        // Get show metadata
        const showData = parseShowMetadata(xmlText);
        
        // Return structured JSON
        res.status(200).json({
            success: true,
            lastUpdated: new Date().toISOString(),
            show: showData,
            episodes: episodes.slice(0, 5), // Latest 5 episodes
            latest: 0
        });
        
    } catch (error) {
        console.error('Breakdown API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch podcast feed',
            message: error.message,
            lastUpdated: new Date().toISOString()
        });
    }
}

function parseShowMetadata(xml) {
    return {
        title: extractTag(xml, 'title', true) || 'The Breakdown',
        description: extractTag(xml, 'description', true) || '',
        image: extractAttribute(xml, 'itunes:image', 'href', true) || 
               extractTag(xml, 'url', true) ||
               'https://megaphone.imgix.net/podcasts/bcb63e62-d56f-11eb-9e47-43b3c17dbba3/image/The_Breakdown_Show_Art.jpg',
        author: extractTag(xml, 'itunes:author', true) || 'NLW',
        links: {
            apple: 'https://podcasts.apple.com/us/podcast/the-breakdown/id1438693620',
            spotify: 'https://open.spotify.com/show/538vuul1PuorUDwgkVYO6u',
            website: 'https://blockworks.co/podcast/thebreakdown'
        }
    };
}

function parseRSS(xml) {
    const episodes = [];
    
    // Split by <item> tags
    const items = xml.split('<item>').slice(1);
    
    for (const item of items) {
        const endIndex = item.indexOf('</item>');
        const itemContent = endIndex > -1 ? item.substring(0, endIndex) : item;
        
        const title = extractTag(itemContent, 'title') || 'Untitled Episode';
        const pubDate = extractTag(itemContent, 'pubDate');
        const description = cleanDescription(extractTag(itemContent, 'description') || extractTag(itemContent, 'itunes:summary') || '');
        const duration = extractTag(itemContent, 'itunes:duration');
        const audioUrl = extractAttribute(itemContent, 'enclosure', 'url');
        const imageUrl = extractAttribute(itemContent, 'itunes:image', 'href');
        const guid = extractTag(itemContent, 'guid');
        
        if (audioUrl) {
            episodes.push({
                id: guid || generateId(title),
                title: cleanTitle(title),
                pubDate: pubDate || null,
                pubDateISO: pubDate ? new Date(pubDate).toISOString() : null,
                durationRaw: duration,
                durationSec: parseDurationToSeconds(duration),
                durationFormatted: formatDuration(parseDurationToSeconds(duration)),
                audioUrl,
                imageUrl: imageUrl || null,
                summary: description.substring(0, 300)
            });
        }
    }
    
    return episodes;
}

function extractTag(xml, tagName, fromChannel = false) {
    // For channel-level tags, only look before the first <item>
    const searchContent = fromChannel ? xml.split('<item>')[0] : xml;
    
    // Try CDATA first
    const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([^\\]]*?)\\]\\]></${tagName}>`, 'i');
    const cdataMatch = searchContent.match(cdataRegex);
    if (cdataMatch) return cdataMatch[1].trim();
    
    // Try regular tag
    const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
    const match = searchContent.match(regex);
    return match ? match[1].trim() : null;
}

function extractAttribute(xml, tagName, attrName) {
    const regex = new RegExp(`<${tagName}[^>]*${attrName}=["']([^"']*)["']`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
}

function cleanTitle(title) {
    // Remove HTML entities and clean up
    return title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .trim();
}

function cleanDescription(desc) {
    // Remove HTML tags and clean up
    return desc
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseDurationToSeconds(duration) {
    if (!duration) return 0;
    
    // If just a number, assume seconds
    if (/^\d+$/.test(duration)) {
        return parseInt(duration);
    }
    
    // Parse HH:MM:SS or MM:SS
    const parts = duration.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    
    return 0;
}

function formatDuration(seconds) {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function generateId(title) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
}
