import { tavily } from "@tavily/core";

const tvly = tavily({
  apiKey: process.env.TAVILY_API_KEY,
});

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

export interface WebSearchResponse {
  answer?: string;
  results: WebSearchResult[];
}

export async function webSearch(query: string): Promise<WebSearchResponse> {
  console.log(`[webSearch] Searching for: "${query}"`);
  try {
    const response = await tvly.search(query, {
      searchDepth: "advanced",
    });
    console.log(`[webSearch] Got ${response.results?.length ?? 0} results`);
    return {
      answer: response.answer,
      results: response.results.map(
        (r: { title: string; url: string; content: string }) => ({
          title: r.title,
          url: r.url,
          content: r.content,
        })
      ),
    };
  } catch (err) {
    console.error("[webSearch] Tavily error:", err);
    return { results: [] };
  }
}
