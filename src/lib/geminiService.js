/**
 * AI Service for Turtle Soup Game (OpenAI Compatible)
 * 
 * This module encapsulates the AI API integration for the AI Game Master.
 * Refactored to use OpenAI-compatible API endpoint.
 */

import { getSystemPrompt, buildGamePrompt, PUZZLE_GENERATOR_PROMPT, buildPuzzleGeneratorPrompt } from "./gamePrompt";

// Configuration
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = import.meta.env.VITE_GEMINI_API_URL || "https://api.cetaceang.qzz.io/v1/chat/completions";
const MODEL_NAME = import.meta.env.VITE_GEMINI_MODEL || "gemini-3-flash-preview";

if (!API_KEY) {
    console.warn("[AIService] No API key found. Set VITE_GEMINI_API_KEY in your .env file.");
}

/**
 * Calls the AI API (OpenAI Compatible)
 */
async function callOpenAICompatibleAPI(messages, responseFormat = null, temperature = 0.7) {
    if (!API_KEY) {
        throw new Error("API key not configured");
    }

    const payload = {
        model: MODEL_NAME,
        messages: messages,
        temperature: temperature,
        max_tokens: 4096,
        stream: false
    };

    if (responseFormat) {
        payload.response_format = responseFormat;
    }

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API Error ${response.status}: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;

    } catch (error) {
        console.error("[AIService] Request failed:", error);
        throw error;
    }
}

/**
 * Calls the AI Game Master
 */
export async function callGeminiGameMaster(puzzleContent, puzzleTruth, userInput, mode, history = [], currentClues = [], currentCompleteness = 0, persona = 'TERMINAL') {
    if (!API_KEY) {
        return {
            text: ">> [ERR_CONFIG] API key not configured. Please set VITE_GEMINI_API_KEY.",
            type: "error",
            new_clue: null
        };
    }

    try {
        // Construct messages
        // 1. System Prompt
        const messages = [
            { role: "system", content: getSystemPrompt(persona) }
        ];

        // 2. History (Optional: Insert history if needed for context, usually helpful)
        // Ensure history format is correct { role: "user" | "assistant", content: string }
        if (history && history.length > 0) {
            messages.push(...history);
        }

        // 3. Current User Input (wrapped with Puzzle Context and Truth via buildGamePrompt)
        // Note: buildGamePrompt encapsulates the "State" of the puzzle.
        const userPrompt = buildGamePrompt(puzzleContent, puzzleTruth, userInput, mode, history, currentClues, currentCompleteness, persona);
        messages.push({ role: "user", content: userPrompt });

        // Call API with Redundancy (3 concurrent requests) to ensure reliability
        // We race multiple requests and validate JSON parsing
        let aiResponse;
        try {
            const concurrentRequests = 3;
            const requestPromises = Array(concurrentRequests).fill(0).map(async () => {
                const raw = await callOpenAICompatibleAPI(messages, { type: "json_object" }, 0.7);
                const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
                return JSON.parse(clean); // Ensures valid JSON
            });

            aiResponse = await Promise.any(requestPromises);
        } catch (error) {
            console.error("[AIService] All concurrent attempts failed:", error);
            throw new Error("All 3 API attempts failed or returned invalid JSON.");
        }

        // Handle filtered responses
        if (aiResponse.is_filtered) {
            return {
                text: aiResponse.flavor_text || ">> [REJECTED] Query violates protocol.",
                type: "error",
                new_clue: null,
                score_delta: 0
            };
        }

        // Convert to internal format based on mode
        if (mode === 'SOLVE') {
            return {
                text: aiResponse.flavor_text,
                type: aiResponse.is_correct ? "success" : "error",
                new_clue: aiResponse.is_correct ? `TRUTH REVEALED: ${puzzleTruth}` : null,
                score_delta: aiResponse.score_delta,
                is_correct: aiResponse.is_correct,
                accuracy_percent: aiResponse.accuracy_percent,
                missing_elements: aiResponse.missing_elements,
                completeness_percent: aiResponse.completeness_percent
            };
        } else {
            // QUERY mode
            return {
                text: aiResponse.flavor_text,
                type: "question",
                new_clue: aiResponse.new_evidence || null,
                score_delta: aiResponse.score_delta,
                answer: aiResponse.answer,
                completeness_percent: aiResponse.completeness_percent
            };
        }

    } catch (error) {
        console.error("[AIService] Error:", error);
        return {
            text: `>> [ERR_CONNECTION] ${error.message || 'Unknown error'}`,
            type: "error",
            new_clue: null
        };
    }
}

/**
 * Generates a new Puzzle
 */
export async function generatePuzzle(options = {}) {
    if (!API_KEY) {
        throw new Error("API key not configured.");
    }

    try {
        const messages = [
            { role: "system", content: PUZZLE_GENERATOR_PROMPT },
            { role: "user", content: buildPuzzleGeneratorPrompt(options) }
        ];

        let rawText = await callOpenAICompatibleAPI(messages, { type: "json_object" }, 1.0);

        rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

        let puzzle;
        try {
            puzzle = JSON.parse(rawText);
        } catch (parseError) {
            console.error("[AIService] Failed to parse puzzle JSON:", rawText);
            throw new Error("Failed to parse AI response");
        }

        console.log("[AIService] Generated puzzle:", puzzle);
        return puzzle;

    } catch (error) {
        console.error("[AIService] Puzzle generation error:", error);
        throw error;
    }
}

/**
 * Check if the service is properly configured
 */
export function isGeminiConfigured() {
    return !!API_KEY;
}
