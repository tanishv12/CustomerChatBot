import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const systemPrompt = `You are an AI-powered customer support assistant for StudyMaster, a platform that provides personalized study techniques and learning resources. 
1. StudyMaster offers tailored study techniques for students at all levels.
2. Our platform helps users develop effective study habits and improve academic performance.
3. We cover a wide range of topics including time management, note-taking strategies, memorization techniques, and exam preparation tips.
4. Users can access our resources through our website or mobile app.
5. If asked about technical issues, guide users to our troubleshooting page or suggest contacting our technical support team.
6. Always maintain user privacy and do not share personal information.
7. If you're unsure about any information, it's okay to say you don't know and offer to connect the user with a human representative.
Your goal is to provide accurate information, assist with common inquiries, and ensure a positive experience for all StudyMaster users.`;

export async function POST(req) {
  const data = await req.json();

  try {
    const initialUserMessage = data.find((message) => message.role === 'user');

    if (!initialUserMessage) {
      throw new Error("No initial user message found.");
    }

    const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_API_KEY);
    const chat = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).startChat({
      history: [
        {
          role: "user",
          parts: [{ text: initialUserMessage.content }],
        },
      ],
    });

    console.log("Sending system prompt:", systemPrompt);
    await chat.sendMessage(systemPrompt);

    // Handling non-streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for (const message of data.slice(1)) {
            if (message.role === 'user') {
              console.log("Sending user message:", message.content);
              const result = await chat.sendMessage(message.content);

              if (result.response && typeof result.response.text === 'function') {
                const responseText = await result.response.text(); // Retrieve the text
                console.log("Response text:", responseText);
                const text = encoder.encode(responseText);
                controller.enqueue(text);
              } else {
                console.error("Unexpected result structure:", result);
                controller.error(new Error("Unexpected response structure"));
              }
            }
          }
        } catch (err) {
          console.error("Error during processing:", err);
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: { "Content-Type": "text/plain" },
    });

  } catch (err) {
    console.error("Error processing the request:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
