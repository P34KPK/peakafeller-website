
import { db, collection, addDoc, serverTimestamp } from "./firebase.js";

// Simple IP geolocation service (free tier, sufficient for basic analytics)
async function getGeoInfo() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        return {
            city: data.city || 'Unknown',
            region: data.region || 'Unknown',
            country: data.country_name || 'Unknown',
            ip: data.ip || 'Anonymized'
        };
    } catch (error) {
        console.warn('Geo-tracking failed:', error);
        return { city: 'Unknown', region: 'Unknown', country: 'Unknown' };
    }
}

// Track Page View
async function trackPageView() {
    const geo = await getGeoInfo();

    // Determine source (simple logic)
    let source = 'direct';
    if (document.referrer) {
        if (document.referrer.includes('facebook')) source = 'facebook';
        else if (document.referrer.includes('instagram')) source = 'instagram';
        else if (document.referrer.includes('google')) source = 'google';
        else if (document.referrer.includes('t.co')) source = 'twitter';
        else source = 'other_web';
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('ref')) source = params.get('ref'); // Allow manual override via ?ref=campaign

    const visitData = {
        type: 'page_view',
        path: window.location.pathname,
        referrer: document.referrer,
        source: source,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent,
        deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        screenSize: `${window.screen.width}x${window.screen.height}`,
        ...geo
    };

    try {
        await addDoc(collection(db, "analytics_visits"), visitData);
        console.log("📡 PK_TRACKER: Visit logged.");
    } catch (e) {
        console.error("PK_TRACKER Error:", e);
    }
}

// Track Custom Event (like clicks)
export async function trackEvent(eventName, eventDetails = {}) {
    const eventData = {
        type: 'event',
        eventName: eventName,
        details: eventDetails,
        path: window.location.pathname,
        timestamp: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "analytics_events"), eventData);
        console.log(`📡 PK_TRACKER: Event '${eventName}' logged.`);
    } catch (e) {
        console.error("PK_TRACKER Error:", e);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Only track if not on localhost (optional, but good for testing)
    // if (window.location.hostname !== 'localhost') {
    trackPageView();
    // }

    // Add listeners to play buttons automatically
    document.querySelectorAll('.card-play-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const trackId = btn.dataset.trackId || btn.dataset.bcTrackId || btn.dataset.albumId || 'unknown';
            const source = btn.dataset.source || 'bandcamp/other';
            trackEvent('music_play', { trackId, source });
        });
    });
});
