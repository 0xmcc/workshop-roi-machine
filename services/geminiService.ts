
import { GoogleGenAI } from "@google/genai";
import { Attendee, Workshop } from "../types";

export const generateFollowUpMessage = async (attendee: Attendee, workshop: Workshop): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  const prompt = `
    Context:
    Workshop Title: ${workshop.title}
    Topic: ${workshop.topic}
    Attendee Name: ${attendee.name}
    Project Built: ${attendee.projectName}
    Project Status: ${attendee.status}
    Goal: Convert them to ${workshop.conversionGoal}

    Task:
    Write a highly personalized, enthusiastic follow-up email/message. 
    If they shipped, celebrate the achievement. 
    If they are in progress, offer encouragement and a specific tip related to their project.
    Keep it concise, punchy, and professional but warm. 
    End with a clear next step related to the goal.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Failed to generate message.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating personalized message. Please try manual drafting.";
  }
};
