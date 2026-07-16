export default async function handler(req: any, res: any) {
  // 1. Block unauthorized request methods
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionData, targetHand } = req.body;
    
    // 2. Blast Radius Check: Ensure the API key exists
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error("CRITICAL: Missing DEEPSEEK_API_KEY in environment variables.");
      return res.status(500).json({ error: 'Backend misconfiguration: Missing API Key.' });
    }

    // 3. The Architect's Prompt: Enforcing Strict JSON Output
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
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `TARGET HAND: ${targetHand}\n\nTELEMETRY DATA (ms deltas and tension scores):\n${JSON.stringify(sessionData)}` }
      ],
      // DeepSeek supports OpenAI's strict JSON mode
      response_format: { type: "json_object" },
      temperature: 0.1 // Kept very low for highly analytical, deterministic output
    };

    // 4. Native Fetch to DeepSeek (No heavy SDK required)
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(aiPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepSeek API Failure:", errorText);
      throw new Error("AI Provider rejected the request.");
    }

    const data = await response.json();
    const aiDiagnosticText = data.choices[0].message.content;

    // 5. Send the strictly formatted JSON string back down to the React frontend
    return res.status(200).json({ diagnostic: aiDiagnosticText });
    
  } catch (error) {
    console.error('Agentic API Error:', error);
    return res.status(500).json({ error: 'Agentic Engine failed to synthesize data.' });
  }
}