import OpenAI from 'openai';
import { extractTextFromDocument } from './documentParser';
import type { QuizQuestion } from '@shared/schema';

// Use Replit AI Integrations for OpenAI access (no API key required)
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface GenerateQuizOptions {
  fileUrls: Array<{ url: string; name: string }>;
  competencyFocus: string;
  objective: string;
  numQuestions?: number;
  openEndedCount?: number; // how many of numQuestions should be open_ended
}

interface GenerateSingleFileQuizOptions {
  fileUrl: string;
  fileName: string;
  competencyFocus: string;
  objective: string;
  numQuestions?: number;
  openEndedCount?: number;
}

/** Validate and normalise a raw question from the AI response */
function validateQuestion(q: any, idx: number): QuizQuestion | null {
  if (!q.question || typeof q.question !== 'string') return null;
  if (!q.type || !['multiple_choice', 'true_false', 'open_ended'].includes(q.type)) return null;

  if (q.type === 'open_ended') {
    return {
      id: q.id || `q${idx + 1}`,
      question: q.question,
      type: 'open_ended',
      options: [],
      correctAnswer: '',
      timeLimit: 180,
    };
  }

  // MCQ / true_false
  if (!Array.isArray(q.options) || q.options.length < 2) return null;
  if (!q.correctAnswer || !q.options.includes(q.correctAnswer)) return null;

  return {
    id: q.id || `q${idx + 1}`,
    question: q.question,
    type: q.type,
    options: q.options,
    correctAnswer: q.correctAnswer,
    timeLimit: 30,
  };
}

function buildPrompt(
  content: string,
  label: string,
  competencyFocus: string,
  objective: string,
  numQuestions: number,
  openEndedCount: number,
): string {
  const mcqCount = numQuestions - openEndedCount;
  return `You are an educational assessment expert. Based on the following training content, generate exactly ${numQuestions} quiz questions.

**${label}**
**Competency Focus:** ${competencyFocus}
**Learning Objectives:** ${objective}

**Training Content:**
${content}

Generate exactly:
- ${mcqCount} questions of type "multiple_choice" or "true_false" — each with 4 options and a correctAnswer
- ${openEndedCount} questions of type "open_ended" — these require a written response; use empty options array and empty correctAnswer

Return a JSON object with a "questions" array. Example format:
{
  "questions": [
    {
      "id": "q1",
      "question": "What does X mean?",
      "type": "multiple_choice",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "B"
    },
    {
      "id": "q${numQuestions}",
      "question": "Explain in your own words how Y works.",
      "type": "open_ended",
      "options": [],
      "correctAnswer": ""
    }
  ]
}`;
}

function extractQuestionsArray(parsed: any): any[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed.questions && Array.isArray(parsed.questions)) return parsed.questions;
  if (parsed.quiz && Array.isArray(parsed.quiz)) return parsed.quiz;
  const arrayProp = Object.keys(parsed).find(key => Array.isArray(parsed[key]));
  return arrayProp ? parsed[arrayProp] : [];
}

export async function generateQuizQuestions(options: GenerateQuizOptions): Promise<QuizQuestion[]> {
  const { fileUrls, competencyFocus, objective, numQuestions = 10, openEndedCount = 2 } = options;

  console.log('[QUIZ-SERVICE] Starting text extraction from', fileUrls.length, 'files');

  const documentTexts: string[] = [];
  for (const file of fileUrls) {
    try {
      const text = await extractTextFromDocument(file.url, file.name);
      if (text.trim()) documentTexts.push(`Content from ${file.name}:\n${text}`);
    } catch (error) {
      console.error(`[QUIZ-SERVICE] Error extracting text from ${file.name}:`, error);
    }
  }

  if (documentTexts.length === 0) {
    throw new Error('No text content could be extracted from the uploaded files');
  }

  const combinedText = documentTexts.join('\n\n---\n\n').substring(0, 15000);
  const prompt = buildPrompt(combinedText, 'Multiple files', competencyFocus, objective, numQuestions, openEndedCount);

  try {
    const tokenBudget = Math.min(8000, 400 + numQuestions * 250);
    console.log('[QUIZ-SERVICE] Calling OpenAI, questions:', numQuestions, 'open-ended:', openEndedCount, 'tokens:', tokenBudget);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert educational assessment creator. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: tokenBudget,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) throw new Error('No response from OpenAI');

    const parsed = JSON.parse(responseContent);
    const rawQuestions = extractQuestionsArray(parsed);

    const validQuestions: QuizQuestion[] = [];
    rawQuestions.forEach((q: any, idx: number) => {
      const validated = validateQuestion(q, idx);
      if (validated) validQuestions.push(validated);
      else console.warn(`[QUIZ-SERVICE] Invalid question at index ${idx}:`, q);
    });

    console.log('[QUIZ-SERVICE] Generated', validQuestions.length, 'valid questions');
    return validQuestions.slice(0, numQuestions);
  } catch (error) {
    console.error('Error generating quiz questions:', error);
    throw new Error('Failed to generate quiz questions. Please try again.');
  }
}

/**
 * Generate quiz questions from a single file.
 * Default: 10 questions (8 MCQ + 2 open-ended) for file quizzes.
 */
export async function generateSingleFileQuiz(options: GenerateSingleFileQuizOptions): Promise<QuizQuestion[]> {
  const { fileUrl, fileName, competencyFocus, objective, numQuestions = 10, openEndedCount = 2 } = options;

  console.log('[QUIZ-SERVICE] Generating quiz for single file:', fileName, 'questions:', numQuestions, 'open-ended:', openEndedCount);

  try {
    const text = await extractTextFromDocument(fileUrl, fileName);
    if (!text.trim()) throw new Error('No text content could be extracted from the file');

    const prompt = buildPrompt(text.substring(0, 12000), `File: ${fileName}`, competencyFocus, objective, numQuestions, openEndedCount);
    const tokenBudget = Math.min(8000, 400 + numQuestions * 250);
    console.log('[QUIZ-SERVICE] Calling OpenAI for single file, token budget:', tokenBudget);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert educational assessment creator. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: tokenBudget,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) throw new Error('No response from OpenAI');

    const parsed = JSON.parse(responseContent);
    const rawQuestions = extractQuestionsArray(parsed);

    const validQuestions: QuizQuestion[] = [];
    rawQuestions.forEach((q: any, idx: number) => {
      const validated = validateQuestion(q, idx);
      if (validated) validQuestions.push(validated);
      else console.warn(`[QUIZ-SERVICE] Invalid question at index ${idx}:`, q);
    });

    console.log('[QUIZ-SERVICE] Generated', validQuestions.length, 'valid questions for', fileName);
    return validQuestions.slice(0, numQuestions);
  } catch (error) {
    console.error('[QUIZ-SERVICE] Error generating quiz for file:', error);
    throw new Error(`Failed to generate quiz for ${fileName}. Please try again.`);
  }
}
