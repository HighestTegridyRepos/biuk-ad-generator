import { GoogleGenAI } from "@google/genai"

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required")
  }
  return new GoogleGenAI({ apiKey })
}

export const IMAGE_MODEL = "gemini-3-pro-image-preview"
