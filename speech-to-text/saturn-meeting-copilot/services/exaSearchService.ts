/**
 * Exa semantic web search service.
 * Searches the web and extracts text content from top results.
 */

export interface ExaResult {
  title: string;
  url: string;
  snippet: string;
  text?: string;
}

export interface ExaSearchResponse {
  results: ExaResult[];
  query: string;
}

export async function searchExa(query: string, numResults = 5): Promise<ExaSearchResponse> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error("EXA_API_KEY is not set");

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      numResults,
      contents: {
        text: { maxCharacters: 800 },
        highlights: { numSentences: 2, highlightsPerUrl: 1 },
      },
      useAutoprompt: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Exa API error ${response.status}: ${error}`);
  }

  const data = await response.json();

  const results: ExaResult[] = (data.results ?? []).map(
    (r: { title?: string; url: string; text?: string; highlights?: string[] }) => ({
      title: r.title ?? r.url,
      url: r.url,
      snippet: r.highlights?.[0] ?? r.text?.slice(0, 200) ?? "",
      text: r.text,
    })
  );

  return { results, query };
}
