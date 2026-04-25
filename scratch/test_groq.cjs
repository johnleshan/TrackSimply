const GROQ_API_KEY = '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';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function test() {
  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Hello' }]
      })
    });
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('FETCH ERROR: ' + e.message);
  }
}
test();
