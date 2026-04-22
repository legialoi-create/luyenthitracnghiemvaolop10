import mammoth from 'mammoth';

interface RawQuestion {
  content: string;
  options: string[];
  correctAnswer: number;
}

export const parseQuizFile = async (file: File): Promise<RawQuestion[]> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'json') {
    return parseJSON(file);
  } else if (extension === 'docx') {
    return parseWord(file);
  } else {
    return parseText(file);
  }
};

const parseJSON = async (file: File): Promise<RawQuestion[]> => {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('Dữ liệu JSON không hợp lệ');
  return data.map(item => ({
    content: item.content || item.question || '',
    options: item.options || [],
    correctAnswer: typeof item.correctAnswer === 'number' ? item.correctAnswer : 0
  }));
};

const parseWord = async (file: File): Promise<RawQuestion[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return parseRawString(result.value);
};

const parseText = async (file: File): Promise<RawQuestion[]> => {
  const text = await file.text();
  return parseRawString(text);
};

/**
 * Parser logic using Regex to find patterns like:
 * Câu 1: [Câu hỏi]
 * A. [Option 1]
 * B. [Option 2]
 * C. [Option 3]
 * D. [Option 4]
 * Đáp án: A
 */
const parseRawString = (text: string): RawQuestion[] => {
  const questions: RawQuestion[] = [];
  // Split by "Câu" followed by digits and ":"
  const parts = text.split(/Câu\s*\d+\s*[:.]/i);
  
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i].trim();
    if (!block) continue;

    // Extract options
    const aMatch = block.match(/A\s*[:.]([\s\S]*?)(?=B\s*[:.]|$)/i);
    const bMatch = block.match(/B\s*[:.]([\s\S]*?)(?=C\s*[:.]|$)/i);
    const cMatch = block.match(/C\s*[:.]([\s\S]*?)(?=D\s*[:.]|$)/i);
    const dMatch = block.match(/D\s*[:.]([\s\S]*?)(?=Đáp án|Lời giải|$)/i);

    // Extract content (everything before option A)
    const content = block.split(/A\s*[:.]/i)[0].trim();

    // Extract correct answer
    const ansMatch = block.match(/Đáp án\s*[:.]\s*([A-D])/i);
    let correctIdx = 0;
    if (ansMatch) {
      correctIdx = ansMatch[1].toUpperCase().charCodeAt(0) - 65;
    }

    if (aMatch && bMatch && cMatch && dMatch) {
      questions.push({
        content,
        options: [
          aMatch[1].trim(),
          bMatch[1].trim(),
          cMatch[1].trim(),
          dMatch[1].trim()
        ],
        correctAnswer: correctIdx
      });
    }
  }

  return questions;
};
