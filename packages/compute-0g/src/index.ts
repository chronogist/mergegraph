import OpenAI from "openai";

export type ComputeConfig = {
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  embeddingModel: string;
};

export function createComputeClient(config: ComputeConfig) {
  const client = new OpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });

  return {
    async chat(system: string, user: string): Promise<string> {
      const response = await client.chat.completions.create({
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
      const response = await client.chat.completions.create({
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

    async embed(text: string): Promise<number[]> {
      const response = await client.embeddings.create({
        model: config.embeddingModel,
        input: text,
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) throw new Error("Empty embedding from 0G Compute");
      return embedding;
    },
  };
}

export type ComputeClient = ReturnType<typeof createComputeClient>;