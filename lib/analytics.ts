"use client";

import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

let initialized = false;

export function initAnalytics() {
  if (initialized || !MIXPANEL_TOKEN) return;
  mixpanel.init(MIXPANEL_TOKEN, {
    track_pageview: false,
    persistence: "localStorage",
    ignore_dnt: false,
  });
  initialized = true;
}

function track(
  event: string,
  properties?: Record<string, string | number | boolean>
) {
  if (!initialized || !MIXPANEL_TOKEN) return;
  mixpanel.track(event, { ...properties, app: "showcase" });
}

export function trackPageView(page: string, extra?: Record<string, string>) {
  track("Showcase: Page Viewed", { page, ...extra });
}

export function trackProjectCardClick(
  slug: string,
  category: string,
  position: number
) {
  track("Showcase: Project Card Clicked", {
    project: slug,
    category,
    position,
  });
}

export function trackProjectView(slug: string, category: string) {
  track("Showcase: Project Viewed", { project: slug, category });
}

export function trackDemoLaunch(
  slug: string,
  demoType: "iframe" | "external" | "audio" | "try-it"
) {
  track("Showcase: Demo Launched", { project: slug, demo_type: demoType });
}

export function trackCodeView(slug: string) {
  track("Showcase: Code Viewed", { project: slug });
}

export function trackVideoPlay(slug: string) {
  track("Showcase: Video Played", { project: slug });
}

export function trackAudioPlay(slug: string, sampleId: string) {
  track("Showcase: Audio Played", { project: slug, sample: sampleId });
}

export function trackApiKeyEntered(slug: string) {
  track("Showcase: API Key Entered", { project: slug });
}

export function trackTryItInteraction(slug: string, interactionType: string) {
  track("Showcase: Try It Used", {
    project: slug,
    interaction: interactionType,
  });
}

export function trackCategoryFilter(category: string, from?: string) {
  track("Showcase: Category Filtered", { category, from_category: from || "all" });
}

export function trackSearch(query: string, resultsCount: number) {
  track("Showcase: Search Used", { query, results_count: resultsCount });
}

export function trackShareClick(slug: string, platform: string) {
  track("Showcase: Share Clicked", { project: slug, platform });
}

export function trackSubmitProjectClick(source: string) {
  track("Showcase: Submit Project Clicked", { source });
}

export function trackGetApiKeyClick(source: string) {
  track("Showcase: Get API Key Clicked", { source });
}

export function trackCodeCopied(slug: string, section: string) {
  track("Showcase: Code Copied", { project: slug, section });
}

export function trackExternalLinkClick(destination: string, url: string, source: string) {
  track("Showcase: External Link Clicked", { destination, url, source });
}
