import PizZip from 'pizzip';
import mammoth from 'mammoth';
import { objectStorageService } from './objectStorage';

/**
 * Extract text content from a PDF file
 */
export async function extractTextFromPDF(fileUrl: string): Promise<string> {
  try {
    const buffer = await objectStorageService.getObjectEntity(fileUrl);
    // Use dynamic import for pdf-parse (CommonJS module)
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text;
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
    const buffer = await objectStorageService.getObjectEntity(fileUrl);
    const zip = new PizZip(buffer);
    
    const slideTexts: string[] = [];
    const slideFiles = Object.keys(zip.files).filter(name => 
      name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
    );
    
    for (const slideName of slideFiles) {
      const slideContent = zip.files[slideName].asText();
      // Extract text from XML tags
      const textMatches = slideContent.match(/<a:t[^>]*>(.*?)<\/a:t>/g) || [];
      const slideText = textMatches
        .map(match => match.replace(/<\/?a:t[^>]*>/g, ''))
        .join(' ');
      
      if (slideText.trim()) {
        slideTexts.push(slideText.trim());
      }
    }
    
    return slideTexts.join('\n\n');
  } catch (error) {
    console.error('Error extracting text from PPTX:', error);
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
