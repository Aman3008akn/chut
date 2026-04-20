const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { console.error('No API Key'); process.exit(1); }
fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ instances: [{ prompt: 'a cute robot' }], parameters: { sampleCount: 1 } })
}).then(r => r.json()).then(console.log).catch(console.error);
