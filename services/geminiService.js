
import { GoogleGenAI, Type } from "@google/genai";
import { PricingTier } from "../app/types.js";
import { getMockMarketInsights, getMockTailoredCV } from "./mockData.js";

// Initialize the Google GenAI client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Common Analysis Schema for Career Gap Analysis
 */
const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER },
    globalPercentile: { type: Type.INTEGER },
    feedback: { type: Type.STRING },
    strategicNarrative: { type: Type.STRING },
    radarData: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          A: { type: Type.INTEGER },
          fullMark: { type: Type.INTEGER }
        },
        required: ["subject", "A", "fullMark"]
      }
    },
    gaps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          gap: { type: Type.STRING },
          gapDescription: { type: Type.STRING },
          category: { type: Type.STRING },
          competencyLevel: { type: Type.INTEGER },
          suggestion: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              provider: { type: Type.STRING },
              description: { type: Type.STRING },
              duration: { type: Type.STRING },
              completed: { type: Type.BOOLEAN },
              url: { type: Type.STRING },
            },
            required: ["id", "title", "provider", "description", "duration", "completed", "url"],
          },
        },
        required: ["gap", "gapDescription", "category", "suggestion", "competencyLevel"],
      },
    },
    careerRoadmap: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    apprenticeshipPath: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          reason: { type: Type.STRING },
          companies: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["title", "reason", "companies"]
      }
    },
    interviewPrep: {
        type: Type.OBJECT,
        properties: {
            questions: { type: Type.ARRAY, items: { type: Type.STRING } },
            strategicTips: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["questions", "strategicTips"]
    }
  },
  required: ["score", "globalPercentile", "feedback", "gaps", "radarData", "careerRoadmap", "apprenticeshipPath"],
};

/**
 * CV Schema for Tailored CV Generation
 */
const cvSchema = {
  type: Type.OBJECT,
  properties: {
    personalInfo: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        contact: { type: Type.STRING },
        location: { type: Type.STRING },
      },
      required: ["name", "contact", "location"],
    },
    professionalSummary: { type: Type.STRING },
    experience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING },
          company: { type: Type.STRING },
          duration: { type: Type.STRING },
          achievements: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["role", "company", "duration", "achievements"],
      },
    },
    education: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          degree: { type: Type.STRING },
          institution: { type: Type.STRING },
          year: { type: Type.STRING },
        },
        required: ["degree", "institution", "year"],
      },
    },
    skills: { type: Type.ARRAY, items: { type: Type.STRING } },
    templateId: { type: Type.STRING }
  },
  required: ["personalInfo", "professionalSummary", "experience", "education", "skills"],
};

export const analyseCV = async (content, mimeType = null, careerGoal = '', userProfile) => {
  try {
    const tier = userProfile?.selectedTier || PricingTier.STARTER;
    const region = userProfile?.region || 'Global';
    
    let tierContext = "";
    if (tier === PricingTier.STARTER) {
        tierContext = "Plan: Starter. Focus on core growth.";
    } else if (tier === PricingTier.PRO) {
        tierContext = "Plan: Pro. Focus on comprehensive skill mapping.";
    } else if (tier === PricingTier.ELITE) {
        tierContext = "Plan: Elite. Focus on executive leadership.";
    }

    const prompt = `Perform a career gap analysis for the following user aiming for: ${careerGoal} in ${region}. ${tierContext}`;

    let contents;
    if (mimeType) {
      contents = {
        parts: [
          { inlineData: { mimeType, data: content } },
          { text: prompt }
        ]
      };
    } else {
      contents = `${prompt}\n\nCandidate Data:\n${content}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        systemInstruction: "You are elevAIte, an elite career intelligence engine. Return valid JSON only.",
        responseMimeType: "application/json",
        responseSchema: analysisSchema
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("SDK Analysis Error:", error);
    throw error;
  }
};

export const generateTailoredCV = async (content, mimeType, careerGoal, userProfile, analysisResult) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { text: `Generate a tailored CV for a ${careerGoal} position based on this background and analysis.` },
        mimeType ? { inlineData: { mimeType, data: content } } : { text: content },
        { text: `Context: ${JSON.stringify(analysisResult)}` }
      ],
      config: {
        systemInstruction: "You are elevAIte's Senior CV Architect. Return valid JSON only.",
        responseMimeType: "application/json",
        responseSchema: cvSchema
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.warn("SDK CV Gen failed, falling back:", error);
    return getMockTailoredCV(userProfile, userProfile?.selectedTier || PricingTier.STARTER);
  }
};

export const generateUCASStatement = async (userProfile) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a UCAS personal statement for ${userProfile.name} interested in ${userProfile.careerAspirations}.`,
      config: {
        systemInstruction: "Return a JSON object with statementBody and structureGuidance.",
        responseMimeType: "application/json"
      }
    });
    return JSON.parse(response.text);
  } catch (error) { throw error; }
};

export const fetchMarketInsights = async (careerGoal, region = 'Global') => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Market insights for ${careerGoal} in ${region}.`,
      config: {
        systemInstruction: "Provide salary ranges, competition levels, and demand trends in JSON.",
        responseMimeType: "application/json"
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return getMockMarketInsights(careerGoal, region);
  }
};

export const suggestCareers = async (content, mimeType = null, region = 'Global') => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { text: `Suggest 3 career paths based on this profile for the ${region} region.` },
        mimeType ? { inlineData: { mimeType, data: content } } : { text: content }
      ],
      config: {
        systemInstruction: "Return a JSON array of suggested career objects.",
        responseMimeType: "application/json"
      }
    });
    return JSON.parse(response.text);
  } catch (error) { throw error; }
};

export const generateRecruiterInsights = async (candidates) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Analyze this cohort: ${JSON.stringify(candidates)}`,
            config: {
                systemInstruction: "You are a Talent Acquisition Strategist. Return analysis in JSON.",
                responseMimeType: "application/json"
            }
        });
        return JSON.parse(response.text);
    } catch (e) { throw e; }
};

export const rankCandidatesForJob = async (jobDetails, candidates, region = 'Global') => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Rank these candidates for this job: ${jobDetails}. Candidates: ${JSON.stringify(candidates)}`,
            config: {
                systemInstruction: "Return an array of matches with matchScore.",
                responseMimeType: "application/json"
            }
        });
        const parsed = JSON.parse(response.text);
        return parsed.matches || parsed;
    } catch (e) { return []; }
};
