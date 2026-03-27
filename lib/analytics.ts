"use client";

import mixpanel from "mixpanel-browser";
import { sendGTMEvent } from "@next/third-parties/google";

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

function gtm(event: string, params?: Record<string, string | number | boolean>) {
  sendGTMEvent({ event, ...params });
}

// --- Page & Navigation ---

export function trackPageView(page: string, extra?: Record<string, string>) {
  track("Showcase: Page Viewed", { page, ...extra });
  gtm("PageView_Showcase", { page, ...extra });
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
  gtm("Button_Showcase_ProjectCard", { project: slug, category, position });
}

export function trackProjectView(slug: string, category: string) {
  track("Showcase: Project Viewed", { project: slug, category });
  gtm("PageView_ShowcaseProject", { project: slug, category });
}

export function trackCategoryFilter(category: string, from?: string) {
  track("Showcase: Category Filtered", { category, from_category: from || "all" });
  gtm("Button_Showcase_CategoryFilter", { category, from_category: from || "all" });
}

export function trackSearch(query: string, resultsCount: number) {
  track("Showcase: Search Used", { query, results_count: resultsCount });
  gtm("Button_Showcase_Search", { query, results_count: resultsCount });
}

// --- Project Actions ---

export function trackDemoLaunch(
  slug: string,
  demoType: "iframe" | "external" | "audio" | "try-it"
) {
  track("Showcase: Demo Launched", { project: slug, demo_type: demoType });
  gtm("Button_ShowcaseProject_LiveDemo", { project: slug, demo_type: demoType });
}

export function trackCodeView(slug: string) {
  track("Showcase: Code Viewed", { project: slug });
  gtm("Button_ShowcaseProject_ViewCode", { project: slug });
}

export function trackVideoPlay(slug: string) {
  track("Showcase: Video Played", { project: slug });
  gtm("Button_ShowcaseProject_WatchVideo", { project: slug });
}

export function trackAudioPlay(slug: string, sampleId: string) {
  track("Showcase: Audio Played", { project: slug, sample: sampleId });
  gtm("Button_ShowcaseProject_AudioPlay", { project: slug, sample: sampleId });
}

export function trackShareClick(slug: string, platform: string) {
  track("Showcase: Share Clicked", { project: slug, platform });
  gtm("Button_ShowcaseProject_ShareButton", { project: slug, platform });
}

export function trackCodeCopied(slug: string, section: string) {
  track("Showcase: Code Copied", { project: slug, section });
  gtm("Button_ShowcaseProject_QuickStartCopy", { project: slug, section });
}

// --- Conversion ---

export function trackGetApiKeyClick(source: string) {
  track("Showcase: Get API Key Clicked", { source });
  gtm("Button_Showcase_GetAPIKey", { source });
}

export function trackApiKeyEntered(slug: string) {
  track("Showcase: API Key Entered", { project: slug });
  gtm("Button_ShowcaseProject_APIKeyEntered", { project: slug });
}

export function trackTryItInteraction(slug: string, interactionType: string) {
  track("Showcase: Try It Used", {
    project: slug,
    interaction: interactionType,
  });
  gtm("Button_ShowcaseProject_TryIt", { project: slug, interaction: interactionType });
}

export function trackSubmitProjectClick(source: string) {
  track("Showcase: Submit Project Clicked", { source });
  gtm("Button_Showcase_SubmitProject", { source });
}

// --- External ---

export function trackExternalLinkClick(destination: string, url: string, source: string) {
  track("Showcase: External Link Clicked", { destination, url, source });
  gtm("Button_Showcase_ExternalLink", { destination, url, source });
}
