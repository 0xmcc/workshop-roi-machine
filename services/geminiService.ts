
import { GoogleGenAI, Type } from "@google/genai";
import { Attendee, Workshop, AttendeeTask, AssignmentState } from "../types";

export const generateFollowUpMessage = async (
  attendee: Attendee, 
  workshop: Workshop,
  taskExecution?: AttendeeTask
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  const executionContext = taskExecution ? `
    Current Task Assignment: ${taskExecution.assignmentState}
    Execution State: ${taskExecution.executionState || 'N/A'}
    Recent History: ${JSON.stringify(taskExecution.history.slice(-3))}
    Latest Submission: ${JSON.stringify(taskExecution.submissions.slice(-1))}
  ` : 'No specific task details.';

  const prompt = `
    Context:
    Workshop Title: ${workshop.title}
    Topic: ${workshop.topic}
    Attendee Name: ${attendee.name}
    Project Built: ${attendee.projectName}
    Project Status: ${attendee.status}
    Goal: Convert them to ${workshop.conversionGoal}

    Task Execution Context:
    ${executionContext}

    Instructions:
    Write a highly personalized follow-up. 
    If the attendee has COMPLETED a task, congratulate them and pitch the membership.
    If they are IN_PROGRESS or NEEDS_REVISION, offer specific encouragement and help based on the task brief.
    If UNASSIGNED, suggest they start the first task.
    Keep it concise, punchy, and professional but warm.
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

export const generateTaskBlueprint = async (goal: string): Promise<{ humanAcceptance: string, verifierSpec: any }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

  const prompt = `
    Create a detailed task blueprint for a technical workshop based on this goal: "${goal}"
    
    You must provide:
    1. A human-readable acceptance checklist in Markdown format (humanAcceptance).
    2. A JSON verifier specification (verifierSpec) that matches the following structure:
       {
         "testUrlSource": "submission_url" | "deployed_url",
         "setupSteps": string[],
         "assertions": [
           { "type": "navigate" | "click" | "fill" | "expectVisible" | "expectTextContains" | "expectUrlContains", "urlPath": string, "selector": string, "value": string, "text": string }
         ],
         "timeouts": { "pageLoadMs": number, "actionMs": number, "totalMs": number },
         "evidence": { "screenshot": boolean, "console": boolean, "trace": boolean },
         "verdictPolicy": { "inconclusiveOnTimeout": boolean }
       }

    Return the result as a raw JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            humanAcceptance: { type: Type.STRING },
            verifierSpec: { type: Type.OBJECT }
          },
          required: ["humanAcceptance", "verifierSpec"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result;
  } catch (error) {
    console.error("Gemini Blueprint Error:", error);
    throw new Error("Failed to generate task blueprint.");
  }
};
