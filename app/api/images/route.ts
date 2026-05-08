import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt, seed } = await req.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
    }

    const hfApiKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY;

    // Attempt 1: Hugging Face Inference API (High quality, free tier available)
    if (hfApiKey) {
      try {
        console.log('Attempting Hugging Face image generation...');
        
        // Try Stable Diffusion XL
        const models = [
          'stabilityai/stable-diffusion-xl-base-1.0',
          'stabilityai/stable-diffusion-3-5-large',
          'black-forest-labs/FLUX.1-schnell'
        ];
        
        for (const model of models) {
          try {
            console.log(`Trying Hugging Face model: ${model}`);
            const hfResponse = await fetch(
              `https://api-inference.huggingface.co/models/${model}`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${hfApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  inputs: prompt,
                  parameters: {
                    seed: seed || Math.floor(Math.random() * 1000000),
                    num_inference_steps: 30,
                    guidance_scale: 7.5,
                  }
                }),
              }
            );

            if (hfResponse.ok) {
              const contentType = hfResponse.headers.get('content-type');
              
              if (contentType && contentType.includes('image/')) {
                const arrayBuffer = await hfResponse.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const base64 = buffer.toString('base64');
                
                console.log(`✅ Hugging Face (${model}) succeeded, size:`, buffer.length, 'bytes');
                
                return NextResponse.json({ 
                  success: true, 
                  base64: base64,
                  mimeType: 'image/png',
                  provider: 'huggingface',
                  model: model
                });
              } else {
                const errorData = await hfResponse.json().catch(() => null);
                if (errorData?.error) {
                  console.warn(`Hugging Face ${model} error:`, errorData.error);
                  if (errorData.error.includes('loading')) {
                    console.log('Model is loading, trying next model...');
                    continue;
                  }
                }
              }
            } else {
              console.error(`Hugging Face ${model} HTTP error:`, hfResponse.status);
            }
          } catch (modelErr) {
            console.warn(`Hugging Face model ${model} failed:`, modelErr);
            continue;
          }
        }
      } catch (hfErr) {
        console.error('Hugging Face error:', hfErr);
      }
    } else {
      console.log('No Hugging Face API key configured, skipping...');
    }

    // Attempt 2: Pollinations AI (Fallback - free, no API key needed)
    try {
      console.log('Generating image with Pollinations AI...');
      const cleanPrompt = prompt.slice(0, 200).replace(/[^a-zA-Z0-9\s]/g, ' ');
      const safeSeed = Math.abs((seed || Math.floor(Math.random() * 1000000)) % 999999);
      
      // Use direct image URL from Pollinations (returns actual image, not HTML)
      const pollUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?seed=${safeSeed}&nologo=true&width=1024&height=1024&private=true`;
      
      console.log('Pollinations URL:', pollUrl);
      
      const pollResponse = await fetch(pollUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/jpeg,image/png,*/*'
        }
      });

      if (pollResponse.ok) {
        // Check content type to ensure it's actually an image
        const contentType = pollResponse.headers.get('content-type');
        console.log('Response content-type:', contentType);
        
        if (!contentType || !contentType.startsWith('image/')) {
          console.error('Pollinations returned non-image content:', contentType);
          throw new Error('Pollinations did not return an image');
        }
        
        const arrayBuffer = await pollResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        
        console.log('✅ Image generated successfully, size:', buffer.length, 'bytes');
        
        return NextResponse.json({ 
          success: true, 
          base64: base64,
          mimeType: contentType.includes('png') ? 'image/png' : 'image/jpeg',
          provider: 'pollinations'
        });
      } else {
        console.error('Pollinations HTTP error:', pollResponse.status, pollResponse.statusText);
      }
    } catch (pollErr) {
      console.error('Pollinations error:', pollErr);
    }

    return NextResponse.json({ error: 'All image generation providers failed' }, { status: 500 });
  } catch (error: any) {
    console.error('Image API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
