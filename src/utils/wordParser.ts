import mammoth from 'mammoth';

export interface ParsedQuestion {
  content: string;
  options: string[];
  correctAnswer: number;
  category: string;
}

export const parseWordToQuiz = async (file: File, category: string): Promise<ParsedQuestion[]> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // mammoth.convertToHtml enables image extraction (converted to base64 by default)
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;

  // We convert some HTML to a pseudo-text that keeps <img> tags
  // Replace <p> with newline to help our regex-based splitting
  const pseudoText = html
    .replace(/<p>/g, '')
    .replace(/<\/p>/g, '\n')
    .replace(/<(?!\/?img\b)[^>]*>/g, ''); // Loại bỏ tất cả các thẻ HTML ngoại trừ <img>

  // Split by "Câu [số]:" or "Câu [số]."
  const questionBlocks = pseudoText.split(/Câu\s*\d+\s*[:.]/i).filter(block => block.trim().length > 0);
  
  const parsedQuestions: ParsedQuestion[] = [];

  for (const block of questionBlocks) {
    const trimmedBlock = block.trim();

    // Bảo vệ thẻ <img>: Tạm thời thay thế các thẻ img bằng placeholder để tránh bị regex cắt nhầm bên trong chuỗi base64
    const images: string[] = [];
    let textWithPlaceholders = trimmedBlock.replace(/<img\b[^>]*\/?>/gi, (match) => {
      images.push(match);
      return `###IMG_PLACEHOLDER_${images.length - 1}###`;
    });

    const restoreImages = (txt: string) => {
      return txt.replace(/###IMG_PLACEHOLDER_(\d+)###/g, (_, index) => images[parseInt(index)]);
    };
    
    // Regex to find options A, B, C, D (Sử dụng văn bản đã được bảo vệ)
    const aMatch = textWithPlaceholders.match(/A\s*[:.]([\s\S]*?)(?=B\s*[:.]|$)/i);
    const bMatch = textWithPlaceholders.match(/B\s*[:.]([\s\S]*?)(?=C\s*[:.]|$)/i);
    const cMatch = textWithPlaceholders.match(/C\s*[:.]([\s\S]*?)(?=D\s*[:.]|$)/i);
    const dMatch = textWithPlaceholders.match(/D\s*[:.]([\s\S]*?)(?=Đáp án|Lời giải|$)/i);

    // Question content is everything before "A." or "A:"
    const contentParts = textWithPlaceholders.split(/[A-D]\s*[:.]/i);
    const content = contentParts[0].trim();

    // Correct answer detection
    const ansMatch = textWithPlaceholders.match(/Đáp án\s*[:.]\s*([A-D])/i);
    let correctIdx = 0;
    if (ansMatch) {
      correctIdx = ansMatch[1].toUpperCase().charCodeAt(0) - 65;
    }

    if (content && aMatch && bMatch && cMatch && dMatch) {
      parsedQuestions.push({
        content: restoreImages(content),
        options: [
          restoreImages(aMatch[1].trim()),
          restoreImages(bMatch[1].trim()),
          restoreImages(cMatch[1].trim()),
          restoreImages(dMatch[1].trim())
        ],
        correctAnswer: correctIdx,
        category: category
      });
    }
  }

  return parsedQuestions;
};
