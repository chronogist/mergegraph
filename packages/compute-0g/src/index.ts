import OpenAI from "openai";

export type ChatConfig = {
  baseUrl: string;
  apiKey: string;
  chatModel: string;
};

export type EmbeddingConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type ComputeConfig = ChatConfig & {
  embedding?: EmbeddingConfig;
};

function formatEmbeddingInput(text: string, kind: "query" | "document"): string {
  // Nemotron bi-encoder models expect query:/passage: prefixes for retrieval.
  const prefix = kind === "query" ? "query: " : "passage: ";
  return text.startsWith(prefix) ? text : `${prefix}${text}`;
}

export function createComputeClient(config: ComputeConfig) {
  const chatClient = new OpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });

  const embedClient = config.embedding
    ? new OpenAI({
        baseURL: config.embedding.baseUrl,
        apiKey: config.embedding.apiKey,
      })
    : null;

  return {
    async chat(system: string, user: string): Promise<string> {
      const response = await chatClient.chat.completions.create({
        model: config.chatModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from 0G Compute");
      return content;
    },

    async chatText(system: string, user: string): Promise<string> {
      const response = await chatClient.chat.completions.create({
        model: config.chatModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from 0G Compute");
      return content;
    },

    async embed(
      text: string,
      kind: "query" | "document" = "document",
    ): Promise<number[]> {
      if (!embedClient || !config.embedding) {
        throw new Error(
          "Embedding provider not configured. Set OPENROUTER_API_KEY — " +
            "0G Router handles chat only; embeddings use OpenRouter.",
        );
      }

      const response = await embedClient.embeddings.create({
        model: config.embedding.model,
        input: formatEmbeddingInput(text, kind),
        // Nemotron on OpenRouter rejects the SDK's default base64 format.
        encoding_format: "float",
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) throw new Error("Empty embedding from OpenRouter");
      return embedding;
    },
  };
}

export type ComputeClient = ReturnType<typeof createComputeClient>;