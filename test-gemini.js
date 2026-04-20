const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyAr9Iwa2zUMQv52Gxh_q90liwXWqO35drI';
  
  console.log('Testing Gemini API Key...\n');
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Try to list available models
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ API Key is valid!\n');
    console.log('Available models:');
    console.log('==================\n');
    
    if (data.models && data.models.length > 0) {
      data.models.forEach((model, index) => {
        const modelName = model.name.replace('models/', '');
        console.log(`${index + 1}. ${modelName}`);
      });
      
      console.log(`\nTotal: ${data.models.length} models available`);
      
      // Suggest which model to use
      const flashModel = data.models.find(m => m.name.includes('flash'));
      const proModel = data.models.find(m => m.name.includes('pro'));
      
      console.log('\n💡 Recommended model to use:');
      if (flashModel) {
        console.log(`   → ${flashModel.name.replace('models/', '')}`);
      } else if (proModel) {
        console.log(`   → ${proModel.name.replace('models/', '')}`);
      } else {
        console.log(`   → ${data.models[0].name.replace('models/', '')}`);
      }
    } else {
      console.log('No models found.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nPossible issues:');
    console.error('1. Invalid API key');
    console.error('2. API key not enabled for Gemini');
    console.error('3. Billing not set up');
    console.error('4. API quota exceeded');
  }
}

listModels();
