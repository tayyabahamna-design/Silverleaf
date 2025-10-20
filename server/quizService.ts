import OpenAI from 'openai';
import { extractTextFromDocument } from './documentParser';
import type { QuizQuestion } from '@shared/schema';

// the newest OpenAI model is "gpt-4o" for this use case
const apiKey = process.env.OPENAI_API_KEY;
console.log('[QUIZ-SERVICE] 🔑 Initializing OpenAI with key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'UNDEFINED');
const openai = new OpenAI({
  apiKey: apiKey,
});

interface GenerateQuizOptions {
  fileUrls: Array<{ url: string; name: string }>;
  competencyFocus: string;
  objective: string;
  numQuestions?: number;
}

interface GenerateSingleFileQuizOptions {
  fileUrl: string;
  fileName: string;
  competencyFocus: string;
  objective: string;
  numQuestions?: number;
}

export async function generateQuizQuestions(options: GenerateQuizOptions): Promise<QuizQuestion[]> {
  const { fileUrls, competencyFocus, objective, numQuestions = 7 } = options;

  console.log('[QUIZ-SERVICE] Starting text extraction from', fileUrls.length, 'files');
  
  // Extract text from all files
  const documentTexts: string[] = [];
  for (const file of fileUrls) {
    try {
      console.log('[QUIZ-SERVICE] Extracting text from:', file.name);
      const text = await extractTextFromDocument(file.url, file.name);
      console.log('[QUIZ-SERVICE] Extracted', text.length, 'characters from', file.name);
      if (text.trim()) {
        documentTexts.push(`Content from ${file.name}:\n${text}`);
      }
    } catch (error) {
      console.error(`[QUIZ-SERVICE] Error extracting text from ${file.name}:`, error);
      // Continue with other files
    }
  }

  if (documentTexts.length === 0) {
    throw new Error('No text content could be extracted from the uploaded files');
  }

  const combinedText = documentTexts.join('\n\n---\n\n');
  console.log('[QUIZ-SERVICE] Combined text length:', combinedText.length, 'characters');

  // Create the prompt for OpenAI
  const prompt = `You are an educational assessment expert. Based on the following training content, generate ${numQuestions} quiz questions that test understanding of the key concepts.

**Competency Focus:** ${competencyFocus}

**Learning Objectives:** ${objective}

**Training Content:**
${combinedText.substring(0, 15000)} 

Generate exactly ${numQuestions} questions. Each question should:
1. Test understanding of specific concepts from the content
2. Be clear and unambiguous
3. Have 4 options for multiple choice or True/False for boolean questions
4. Include the correct answer

Return your response as a JSON array with this exact structure:
[
  {
    "id": "q1",
    "question": "Question text here?",
    "type": "multiple_choice",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option B"
  },
  {
    "id": "q2",
    "question": "Statement to verify?",
    "type": "true_false",
    "options": ["True", "False"],
    "correctAnswer": "True"
  }
]

Make sure to use "multiple_choice" or "true_false" for the type field.`;

  try {
    console.log('[QUIZ-SERVICE] Calling OpenAI API...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational assessment creator. You generate clear, relevant quiz questions based on training materials. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    console.log('[QUIZ-SERVICE] Received response from OpenAI');
    
    // Parse the JSON response
    const parsed = JSON.parse(responseContent);
    let questions: QuizQuestion[] = [];
    
    // Handle both array and object with questions property
    if (Array.isArray(parsed)) {
      questions = parsed;
    } else if (parsed.questions && Array.isArray(parsed.questions)) {
      questions = parsed.questions;
    } else {
      throw new Error('Invalid response format from OpenAI');
    }

    // Validate and ensure IDs
    questions = questions.map((q, idx) => ({
      ...q,
      id: q.id || `q${idx + 1}`,
    }));

    return questions.slice(0, numQuestions);
  } catch (error) {
    console.error('Error generating quiz questions:', error);
    throw new Error('Failed to generate quiz questions. Please try again.');
  }
}

/**
 * Generate quiz questions from a single file (modular approach)
 * This is faster and produces higher quality questions focused on specific content
 */
export async function generateSingleFileQuiz(options: GenerateSingleFileQuizOptions): Promise<QuizQuestion[]> {
  const { fileUrl, fileName, competencyFocus, objective, numQuestions = 5 } = options;

  console.log('[QUIZ-SERVICE] Generating quiz for single file:', fileName);
  
  try {
    console.log('[QUIZ-SERVICE] Extracting text from:', fileName);
    const text = await extractTextFromDocument(fileUrl, fileName);
    console.log('[QUIZ-SERVICE] Extracted', text.length, 'characters from', fileName);
    
    if (!text.trim()) {
      throw new Error('No text content could be extracted from the file');
    }

    // Create a focused prompt for single-file content
    const prompt = `You are an educational assessment expert. Based on the following presentation file, generate ${numQuestions} quiz questions that test understanding of the key concepts.

**File:** ${fileName}

**Competency Focus:** ${competencyFocus}

**Learning Objectives:** ${objective}

**Presentation Content:**
${text.substring(0, 12000)}

Generate exactly ${numQuestions} questions. Each question should:
1. Test understanding of specific concepts from this presentation
2. Be clear and unambiguous
3. Have 4 options for multiple choice or True/False for boolean questions
4. Include the correct answer

Return your response as a JSON array with this exact structure:
[
  {
    "id": "q1",
    "question": "Question text here?",
    "type": "multiple_choice",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option B"
  },
  {
    "id": "q2",
    "question": "Statement to verify?",
    "type": "true_false",
    "options": ["True", "False"],
    "correctAnswer": "True"
  }
]

Make sure to use "multiple_choice" or "true_false" for the type field.`;

    console.log('[QUIZ-SERVICE] Calling OpenAI API for single file quiz...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational assessment creator. You generate clear, relevant quiz questions based on training materials. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1500,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    console.log('[QUIZ-SERVICE] Received response from OpenAI');
    
    const parsed = JSON.parse(responseContent);
    let questions: QuizQuestion[] = [];
    
    if (Array.isArray(parsed)) {
      questions = parsed;
    } else if (parsed.questions && Array.isArray(parsed.questions)) {
      questions = parsed.questions;
    } else {
      throw new Error('Invalid response format from OpenAI');
    }

    questions = questions.map((q, idx) => ({
      ...q,
      id: q.id || `q${idx + 1}`,
    }));

    console.log('[QUIZ-SERVICE] Generated', questions.length, 'questions for', fileName);
    return questions.slice(0, numQuestions);
  } catch (error) {
    console.error('[QUIZ-SERVICE] Error generating quiz for file:', error);
    throw new Error(`Failed to generate quiz for ${fileName}. Please try again.`);
  }
}
