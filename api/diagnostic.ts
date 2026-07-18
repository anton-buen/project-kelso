/** Maximum serverless function execution time (seconds). Requires Vercel Pro or unlocked Hobby plan. */
export const maxDuration = 60;

/**
 * POST /api/diagnostic
 *
 * Accepts a session telemetry payload, constructs a Kelso HKB-framed prompt,
 * and proxies the request to the upstream LLM gateway. Returns the raw JSON
 * string from the model's `choices[0].message.content` field.
 *
 * @param req.body.aggregates  - Computed session aggregates from `calculateSessionAggregates`
 * @param req.body.targetHand  - `'LEFT'` or `'RIGHT'`
 * @param req.body.bpm         - Session tempo; falls back to 120 if invalid
 * @param req.body.pattern     - Subdivision pattern; validated against allowlist
 *
 * Timeout strategy: AbortController fires at 55 s, 5 s under the function limit,
 * to ensure a clean 504 response rather than a hard platform kill.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Backend misconfiguration: Missing API Key.' });
  }
  const cleanApiKey = apiKey.replace(/[\r\n\s]+/g, '');

  try {
    const { aggregates, targetHand, bpm, pattern } = req.body;

    if (!aggregates) {
      return res.status(400).json({ error: 'Missing telemetry aggregates payload.' });
    }

    const safeBpm = Math.round(Number(bpm)) || 120;
    const validPatterns = ['quarter', 'eighth', 'triplet', 'sixteenth'];
    const safePattern = validPatterns.includes(pattern) ? pattern : 'quarter';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    const systemPrompt = `
      You are an expert clinical biomechanics AI analyzing a motor-rhythm drumming session based on the Kelso HKB coordination model.
      
      YOU MUST RESPOND ONLY WITH VALID, PARSABLE JSON. NO MARKDOWN FENCES. NO CONVERSATIONAL GREETINGS.

      Required Schema:
      {
        "exercise": "Inferred exercise name (e.g., ${targetHand || 'Unclassified'} Hand Leveler)",
        "summary": "A concise 2-sentence biomechanical breakdown.",
        "ce_trend": {
          "bias_category": "Strongly Dragging, Moderately Dragging, Neutral, Moderately Rushing, or Strongly Rushing",
          "direction": "Detailed analysis of rhythmic bias trajectory.",
          "magnitude": "Commentary on Mean Error and StdDev.",
          "temporal_drift": "Commentary on drift slope/fatigue over time."
        },
        "kelso_metrics": {
          "instability_rating": "Stable, Critical Fluctuation, or Degrading",
          "fatigue_assessment": "Kinetic breakdown analysis.",
          "tension_correlation": "How average tension relates to precision."
        }
      }
    `;

    const userMessage = `TARGET: ${safeBpm} BPM on a ${safePattern} grid. METRICS: Mean Offset: ${aggregates.meanOffsetMs}ms, Instability (SD): ${aggregates.stdDevMs}ms, Normalized CV: ${aggregates.tempoNormalizedCV}%, Fatigue Slope: ${aggregates.driftSlope}, Average Tension: ${aggregates.averageTension}.`;

    const aiPayload = {
      model: "deepseek-v4-flash-free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    };

    const response = await fetch("https://opencode.ai/zen/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cleanApiKey}`
      },
      body: JSON.stringify(aiPayload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `Upstream gateway rejection: ${errorText}` });
    }

    const data = await response.json();
    return res.status(200).send(data.choices[0].message.content);

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Gateway Timeout: AI took too long to respond.' });
    }
    return res.status(500).json({ error: 'Internal pipeline crash handling LLM transport.' });
  }
}
