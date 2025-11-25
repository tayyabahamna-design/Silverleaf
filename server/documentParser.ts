import { createRequire } from 'module';
import PizZip from 'pizzip';
import mammoth from 'mammoth';
import { objectStorageService } from './objectStorage';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Extract text content from a PDF file
 */
export async function extractTextFromPDF(fileUrl: string): Promise<string> {
  try {
    const buffer = await objectStorageService.getObjectEntity(fileUrl);
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF file');
  }
}

/**
 * Extract text content from a PowerPoint file (.pptx)
 */
export async function extractTextFromPPTX(fileUrl: string): Promise<string> {
  try {
    console.log('[DOCUMENT-PARSER] Fetching PPTX buffer from:', fileUrl);
    const buffer = await objectStorageService.getObjectEntity(fileUrl);
    console.log('[DOCUMENT-PARSER] Buffer size:', buffer.length, 'bytes');
    
    const zip = new PizZip(buffer);
    console.log('[DOCUMENT-PARSER] ZIP files found:', Object.keys(zip.files).length);
    console.log('[DOCUMENT-PARSER] File names:', Object.keys(zip.files).slice(0, 10));
    
    const slideTexts: string[] = [];
    const slideFiles = Object.keys(zip.files).filter(name => 
      name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
    );
    console.log('[DOCUMENT-PARSER] Slide files found:', slideFiles.length, slideFiles);
    
    for (const slideName of slideFiles) {
      const slideContent = zip.files[slideName].asText();
      console.log('[DOCUMENT-PARSER] Slide content length for', slideName, ':', slideContent.length);
      
      // Extract text from XML tags
      const textMatches = slideContent.match(/<a:t[^>]*>(.*?)<\/a:t>/g) || [];
      console.log('[DOCUMENT-PARSER] Text matches found:', textMatches.length);
      
      const slideText = textMatches
        .map(match => match.replace(/<\/?a:t[^>]*>/g, ''))
        .join(' ');
      
      if (slideText.trim()) {
        console.log('[DOCUMENT-PARSER] Extracted text from slide:', slideText.substring(0, 100));
        slideTexts.push(slideText.trim());
      }
    }
    
    console.log('[DOCUMENT-PARSER] Total slides with text:', slideTexts.length);
    const finalText = slideTexts.join('\n\n');
    console.log('[DOCUMENT-PARSER] Final text length:', finalText.length);
    
    return finalText;
  } catch (error) {
    console.error('[DOCUMENT-PARSER] Error extracting text from PPTX:', error);
    throw new Error('Failed to extract text from PowerPoint file');
  }
}

/**
 * Extract text content from a Word document (.docx)
 */
export async function extractTextFromDOCX(fileUrl: string): Promise<string> {
  try {
    const buffer = await objectStorageService.getObjectEntity(fileUrl);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error('Failed to extract text from Word document');
  }
}

/**
 * Extract text from any supported document type
 */
export async function extractTextFromDocument(fileUrl: string, fileName: string): Promise<string> {
  const extension = fileName.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'pdf':
      return await extractTextFromPDF(fileUrl);
    case 'pptx':
      return await extractTextFromPPTX(fileUrl);
    case 'docx':
      return await extractTextFromDOCX(fileUrl);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}
