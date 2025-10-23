import type { TocEntry } from '@shared/schema';

const pdfParse = require('pdf-parse');
const officeParser = require('officeparser');

/**
 * Extract Table of Contents from uploaded files
 * Supports PDF and PPTX formats
 */

interface PageContent {
  pageNumber: number;
  text: string;
}

/**
 * Extract a meaningful heading from text content
 * Takes the first non-empty line or first 60 characters
 */
function extractHeading(text: string, pageNumber: number): string {
  if (!text || text.trim().length === 0) {
    return `Page ${pageNumber}`;
  }

  // Split into lines and find first non-empty line
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length === 0) {
    return `Page ${pageNumber}`;
  }

  // Get first line
  let heading = lines[0];

  // Truncate if too long (max 60 characters)
  if (heading.length > 60) {
    heading = heading.substring(0, 57) + '...';
  }

  return heading;
}

/**
 * Extract ToC from PDF file
 */
async function extractPdfToc(buffer: Buffer): Promise<TocEntry[]> {
  try {
    const pdfData = await pdfParse(buffer);
    const totalPages = pdfData.numpages;
    
    // Extract text from each page individually
    // Note: pdf-parse gives us all text in one blob, so we'll need to parse it
    // For now, we'll create a simple ToC with page numbers
    const toc: TocEntry[] = [];
    
    // Split text by form feed character which typically indicates page breaks
    const pageTexts = pdfData.text.split('\f');
    
    for (let i = 0; i < Math.min(pageTexts.length, totalPages); i++) {
      const pageText = pageTexts[i]?.trim() || '';
      const heading = extractHeading(pageText, i + 1);
      
      toc.push({
        pageNumber: i + 1,
        heading: heading,
      });
    }

    // If we didn't get enough pages from the split, fill in the rest
    for (let i = pageTexts.length; i < totalPages; i++) {
      toc.push({
        pageNumber: i + 1,
        heading: `Page ${i + 1}`,
      });
    }

    return toc;
  } catch (error) {
    console.error('Error extracting PDF ToC:', error);
    // Return a basic ToC on error
    return [{
      pageNumber: 1,
      heading: 'Content',
    }];
  }
}

/**
 * Extract ToC from PPTX file
 */
async function extractPptxToc(buffer: Buffer): Promise<TocEntry[]> {
  try {
    // officeparser can handle buffers directly
    const text = await officeParser.parseOfficeAsync(buffer);

    // PPTX slides are typically separated by multiple newlines or specific patterns
    // We'll split by common slide separators
    const slideTexts = text.split(/\n{3,}|\f/).filter((s: string) => s.trim().length > 0);
    
    const toc: TocEntry[] = slideTexts.map((slideText: string, index: number) => ({
      pageNumber: index + 1,
      heading: extractHeading(slideText, index + 1),
    }));

    // Ensure we have at least one entry
    if (toc.length === 0) {
      return [{
        pageNumber: 1,
        heading: 'Slide 1',
      }];
    }

    return toc;
  } catch (error) {
    console.error('Error extracting PPTX ToC:', error);
    // Return a basic ToC on error
    return [{
      pageNumber: 1,
      heading: 'Slide 1',
    }];
  }
}

/**
 * Extract ToC from PPT (older PowerPoint format)
 * Falls back to basic entries since PPT is harder to parse
 */
async function extractPptToc(buffer: Buffer): Promise<TocEntry[]> {
  try {
    const text = await officeParser.parseOfficeAsync(buffer);

    const slideTexts = text.split(/\n{3,}|\f/).filter((s: string) => s.trim().length > 0);
    
    const toc: TocEntry[] = slideTexts.map((slideText: string, index: number) => ({
      pageNumber: index + 1,
      heading: extractHeading(slideText, index + 1),
    }));

    if (toc.length === 0) {
      return [{
        pageNumber: 1,
        heading: 'Slide 1',
      }];
    }

    return toc;
  } catch (error) {
    console.error('Error extracting PPT ToC:', error);
    return [{
      pageNumber: 1,
      heading: 'Slide 1',
    }];
  }
}

/**
 * Main function to extract ToC from any supported file type
 */
export async function extractTableOfContents(
  buffer: Buffer,
  fileName: string
): Promise<TocEntry[]> {
  const ext = fileName.toLowerCase().split('.').pop();

  try {
    switch (ext) {
      case 'pdf':
        return await extractPdfToc(buffer);
      case 'pptx':
        return await extractPptxToc(buffer);
      case 'ppt':
        return await extractPptToc(buffer);
      default:
        console.warn(`Unsupported file type for ToC extraction: ${ext}`);
        return [{
          pageNumber: 1,
          heading: fileName,
        }];
    }
  } catch (error) {
    console.error(`Error extracting ToC from ${fileName}:`, error);
    return [{
      pageNumber: 1,
      heading: fileName,
    }];
  }
}
