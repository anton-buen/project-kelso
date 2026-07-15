import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionData, targetHand } = req.body;
    
    // Blast Radius Check: Ensure the API key exists
    if (!process.env.LLM_API_KEY) {
      return res.status(500).json({ error: 'Backend misconfiguration: Missing LLM API Key.' });
    }

    // Initialize Gemini (using 1.5-flash for the optimal speed-to-context ratio)
    const genAI = new GoogleGenerativeAI(process.env.LLM_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });  
    // The Architect's Prompt: Enforcing the "Un-Mediocre" response style
    const prompt = `
      You are the backend analytical engine for Project-Kelso, an elite neuro-motor drumming tool.
      The user just completed a "Weak-Hand Leveler" exercise focusing strictly on their ${targetHand} hand.
      
      I am providing a JSON array of their physical strikes. 
      - 'deltaMs': Timing accuracy in milliseconds. Negative is early (rushing). Positive is late (dragging).
      - 'tensionScore': A 0-100 scale of biomechanical shoulder tension. Over 50 is bad.

      Analyze this raw data and generate a strictly formatted, minimalist diagnostic dashboard. 
      Do NOT be overly conversational. Be clinical, exact, and actionable. 
      Format with short bullet points. Provide:
      1. A one-sentence neuro-motor summary.
      2. Constant Error Trend (Are they consistently rushing or dragging?).
      3. Tension analysis (Did their shoulders hike up during the session?).
      
      Raw Session Data: ${JSON.stringify(sessionData)}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Send the dashboard text back to the React frontend
    return res.status(200).json({ diagnostic: responseText });
    
  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: 'Agentic Engine failed to synthesize data.' });
  }
}