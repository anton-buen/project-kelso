export default async function handler(req: any, res: any) {
  // 1. Block unauthorized request methods
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Guard against missing API Key
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error("CRITICAL: Missing DEEPSEEK_API_KEY in environment variables.");
    return res.status(500).json({ error: 'Backend misconfiguration: Missing API Key.' });
  }

  try {
    const { sessionData, targetHand } = req.body;
    
    // The Architect's Prompt: Enforcing Strict JSON Output
    const systemPrompt = `
      You are an expert biomechanics and drum coordination AI. 
      Analyze the provided telemetry data. 
      YOU MUST RESPOND ONLY WITH VALID, PARSABLE JSON. NO MARKDOWN. NO CONVERSATION.
      
      Schema:
      {
        "exercise": "Name of the inferred exercise (e.g., Weak-Hand Leveler)",
        "summary": "A concise 2-sentence biomechanical breakdown.",
        "ce_trend": {
          "direction": "String detailing rushing vs dragging bias.",
          "magnitude": "String detailing mean error and range in ms.",
          "temporal_drift": "String detailing when fatigue or tension occurred."
        }
      }
    `;

    const aiPayload = {
      model: "deepseek-v4-flash-free", // Added "-free" to bypass billing gates!
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `TARGET HAND: ${targetHand}\n\nTELEMETRY DATA (ms deltas and tension scores):\n${JSON.stringify(sessionData)}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1 
    };
    // 2. Clean up the API key to eliminate any trailing Windows whitespace
    const cleanApiKey = apiKey.replace(/[\r\n\s]+/g, '');

    // 3. Native Fetch to OpenCode Zen AI Gateway (NOT api.deepseek.com)
    const response = await fetch("https://opencode.ai/zen/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cleanApiKey}`
      },
      body: JSON.stringify(aiPayload)
    });

    // 4. Graceful HTTP Error Interception (Zero process crash)
    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenCode Zen API Failure Details:", errorText);
      
      return res.status(200).json({ 
        diagnostic: JSON.stringify({
          exercise: "Offline Fallback (Gateway Error)",
          summary: "OpenCode Zen returned a validation error. Please check your account balance and credentials.",
          ce_trend: {
            direction: "Checking locally...",
            magnitude: "Checking locally...",
            temporal_drift: "API Offline"
          }
        })
      });
    }

    const data = await response.json();
    const aiDiagnosticText = data.choices[0].message.content;

    // 5. Send the strictly formatted JSON string back down to the React frontend
    return res.status(200).json({ diagnostic: aiDiagnosticText });
    
  } catch (error: any) {
    console.error('Agentic API Error Caught Gracefully:', error);
    
    return res.status(200).json({ 
      diagnostic: JSON.stringify({
        exercise: "Offline Fallback (Network Error)",
        summary: `Network request aborted: ${error.message || error}`,
        ce_trend: {
          direction: "Checking locally...",
          magnitude: "Checking locally...",
          temporal_drift: "API Offline"
        }
      })
    });
  }
}