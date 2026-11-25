import { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryGallery } from "./CategoryGallery";

const categoryMeta: Record<string, { title: string; description: string }> = {
  "speech-to-text": {
    title: "Speech to Text",
    description:
      "Convert audio and video to text with industry-leading accuracy. Supports 30+ languages, speaker diarization, word timestamps, and emotion detection.",
  },
  "text-to-speech": {
    title: "Text to Speech",
    description:
      "Generate natural-sounding speech from text with Lightning TTS. Ultra-low latency, multiple voices, and streaming support.",
  },
  "voice-agents": {
    title: "Voice Agents",
    description:
      "Build AI voice agents that can talk to anyone, in any language, in any voice. Powered by the Atoms SDK with tool calling, knowledge bases, and campaigns.",
  },
  "speech-to-speech": {
    title: "Speech to Speech",
    description:
      "Full-duplex voice conversations with Hydra: stream audio in, get spoken replies back over one WebSocket, with tool calling and barge-in. No separate STT, LLM and TTS pipeline.",
  },
  community: {
    title: "Community",
    description:
      "Projects built by the Smallest AI community. Submit your own via a pull request to the cookbook repository.",
  },
};

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return Object.keys(categoryMeta).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const meta = categoryMeta[slug];
  if (!meta) return {};
  return {
    title: meta.title,
    description: meta.description,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const meta = categoryMeta[slug];
  if (!meta) notFound();

  return <CategoryGallery slug={slug} title={meta.title} description={meta.description} />;
}
