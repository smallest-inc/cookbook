"use client";

import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

let initialized = false;

export function initAnalytics() {
  if (initialized || !MIXPANEL_TOKEN) return;
  mixpanel.init(MIXPANEL_TOKEN, {
    track_pageview: "url-with-path",
    persistence: "localStorage",
    ignore_dnt: false,
  });
  initialized = true;
}

export function track(
  event: string,
  properties?: Record<string, string | number | boolean>
) {
  if (!initialized || !MIXPANEL_TOKEN) return;
  mixpanel.track(event, properties);
}

export function trackPageView(page: string, extra?: Record<string, string>) {
  track("page_view", { page, ...extra });
}

export function trackProjectCardClick(
  slug: string,
  category: string,
  position: number
) {
  track("project_card_click", {
    project_slug: slug,
    category,
    position_in_grid: position,
  });
}

export function trackProjectView(slug: string, category: string) {
  track("project_view", { project_slug: slug, category });
}

export function trackDemoLaunch(
  slug: string,
  demoType: "iframe" | "external" | "audio" | "try-it"
) {
  track("demo_launch", { project_slug: slug, demo_type: demoType });
}

export function trackCodeView(slug: string) {
  track("code_view", { project_slug: slug });
}

export function trackVideoPlay(slug: string) {
  track("video_play", { project_slug: slug });
}

export function trackAudioPlay(slug: string, sampleId: string) {
  track("audio_play", { project_slug: slug, audio_sample_id: sampleId });
}

export function trackApiKeyEntered(slug: string) {
  track("api_key_entered", { project_slug: slug });
}

export function trackTryItInteraction(slug: string, interactionType: string) {
  track("try_it_interaction", {
    project_slug: slug,
    interaction_type: interactionType,
  });
}

export function trackCategoryFilter(category: string, from?: string) {
  track("category_filter", { category, from_category: from || "all" });
}

export function trackSearch(query: string, resultsCount: number) {
  track("search", { query, results_count: resultsCount });
}

export function trackShareClick(slug: string, platform: string) {
  track("share_click", { project_slug: slug, platform });
}

export function trackSubmitProjectClick(source: string) {
  track("submit_project_click", { source });
}
