import mammoth from 'mammoth';
import { solveQuestion } from '../services/geminiService';

export interface ParsedQuestion {
  id?: string;
  content: string;
  options: string[];
  correctAnswer: number;
  category: string;
  validationError?: string;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  errors: string[];
  totalParsed: number;
}

const validateQuestion = (q: Partial<ParsedQuestion>): string | null => {
  if (!q.content || q.content.trim().length < 5) return 'Nội dung câu hỏi quá ngắn hoặc trống.';
  if (!q.options || q.options.length < 2) return 'Câu hỏi phải có ít nhất 2 đáp án.';
  if (q.options.some(opt => !opt || opt.trim().length === 0)) return 'Có đáp án bị trống.';
  if (q.correctAnswer === undefined || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) return 'Đáp án đúng không hợp lệ.';
  return null;
};

/**
 * Normalizes LaTeX expressions to ensure they are wrapped in $ ... $ or $$ ... $$
 * and unescapes common Word/HTML artifacts.
 */
const normalizeText = (text: string): string => {
  return text
    .replace(/\\\[/g, '$$$$')
    .replace(/\\\]/g, '$$$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const parseWordToQuiz = async (file: File, category: string): Promise<ParseResult> => {
  const arrayBuffer = await file.arrayBuffer();
  const errors: string[] = [];
  
  try {
    // mammoth.convertToHtml enables image extraction (converted to base64 by default)
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const html = result.value;

    // 1. Protect <img> tags first before any stripping
    const globalImages: string[] = [];
    const htmlWithPlaceholders = html.replace(/<img\b[^>]*\/?>/gi, (match) => {
      globalImages.push(match);
      return `###GLOBAL_IMG_${globalImages.length - 1}###`;
    });

    // 2. Clear out other HTML tags safely
    const pseudoText = htmlWithPlaceholders
      .replace(/<(p|div|br)[^>]*>/gi, '\n') // Newlines for blocks
      .replace(/<[^>]+>/g, '') // Strip all remaining tags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    const splitRegex = /Câu\s*\d+\s*[:.]/i;
    const questionBlocks = pseudoText.split(splitRegex).filter(block => block.trim().length > 0);
    const questions: ParsedQuestion[] = [];

    for (const [index, block] of questionBlocks.entries()) {
      const trimmedBlock = block.trim();

      // Find local images for this block
      const localImages: string[] = [];
      const textWithLocalPlaceholders = trimmedBlock.replace(/###GLOBAL_IMG_(\d+)###/g, (match, idx) => {
        localImages.push(globalImages[parseInt(idx)]);
        return `###IMG_PLACEHOLDER_${localImages.length - 1}###`;
      });

      const restoreImages = (txt: string) => {
        return txt.replace(/###IMG_PLACEHOLDER_(\d+)###/g, (_, idx) => localImages[parseInt(idx)]);
      };

      const aMatch = textWithLocalPlaceholders.match(/(\*?)A\s*[:.]([\s\S]*?)(?=\*?B\s*[:.]|$)/i);
      const bMatch = textWithLocalPlaceholders.match(/(\*?)B\s*[:.]([\s\S]*?)(?=\*?C\s*[:.]|$)/i);
      const cMatch = textWithLocalPlaceholders.match(/(\*?)C\s*[:.]([\s\S]*?)(?=\*?D\s*[:.]|$)/i);
      const dMatch = textWithLocalPlaceholders.match(/(\*?)D\s*[:.]([\s\S]*?)(?=Đáp án|Lời giải|$)/i);

      const contentParts = textWithLocalPlaceholders.split(/\*?[A-D]\s*[:.]/i);
      const content = normalizeText(contentParts[0]);

      let correctIdx = -1;
      const rawOptions = [
        aMatch ? { prefix: aMatch[1], content: aMatch[2].trim() } : null,
        bMatch ? { prefix: bMatch[1], content: bMatch[2].trim() } : null,
        cMatch ? { prefix: cMatch[1], content: cMatch[2].trim() } : null,
        dMatch ? { prefix: dMatch[1], content: dMatch[2].trim() } : null
      ];

      const processedOptions = rawOptions.map((opt, i) => {
        if (!opt) return '';
        if (opt.prefix === '*' || opt.content.startsWith('*')) {
          correctIdx = i;
          return normalizeText(opt.content.startsWith('*') ? opt.content.substring(1).trim() : opt.content);
        }
        return normalizeText(opt.content);
      });

      if (correctIdx === -1) {
        const ansMatch = textWithLocalPlaceholders.match(/Đáp án\s*[:.]\s*([A-D])/i);
        if (ansMatch) {
          correctIdx = ansMatch[1].toUpperCase().charCodeAt(0) - 65;
        }
      }

      if (correctIdx === -1 && content && processedOptions.every(o => o.length > 0)) {
        try {
          correctIdx = await solveQuestion(content, processedOptions);
        } catch (err) {
          correctIdx = 0;
        }
      } else if (correctIdx === -1) {
        correctIdx = 0;
      }

      const question: ParsedQuestion = {
        content: restoreImages(content),
        options: processedOptions.map(o => restoreImages(o)),
        correctAnswer: correctIdx,
        category: category
      };

      const validationErr = validateQuestion(question);
      if (validationErr) {
        question.validationError = validationErr;
        errors.push(`Câu ${index + 1}: ${validationErr}`);
      }

      questions.push(question);
    }

    return { questions, errors, totalParsed: questions.length };
  } catch (err: any) {
    return { questions: [], errors: [`Lỗi đọc file Word: ${err.message}`], totalParsed: 0 };
  }
};

export const parseJsonToQuiz = async (file: File, category: string): Promise<ParseResult> => {
  const errors: string[] = [];
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!Array.isArray(data)) {
      return { questions: [], errors: ['Định dạng JSON phải là một mảng các câu hỏi.'], totalParsed: 0 };
    }

    const questions: ParsedQuestion[] = data.map((item: any, index: number) => {
      const q: ParsedQuestion = {
        content: normalizeText(item.content || ''),
        options: Array.isArray(item.options) ? item.options.map((o: any) => normalizeText(String(o))) : [],
        correctAnswer: typeof item.correctAnswer === 'number' ? item.correctAnswer : 0,
        category: item.category || category
      };
      
      const validationErr = validateQuestion(q);
      if (validationErr) {
        q.validationError = validationErr;
        errors.push(`Mục ${index + 1}: ${validationErr}`);
      }
      return q;
    });

    return { questions, errors, totalParsed: questions.length };
  } catch (err: any) {
    return { questions: [], errors: [`Lỗi phân giải JSON: ${err.message}`], totalParsed: 0 };
  }
};

export const parseTextToQuiz = async (file: File, category: string): Promise<ParseResult> => {
  const errors: string[] = [];
  try {
    const text = await file.text();
    // Split by custom separator or blank lines
    const blocks = text.split(/\n\s*\n/).filter(b => b.trim().length > 0);
    const questions: ParsedQuestion[] = [];

    for (const [index, block] of blocks.entries()) {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 3) {
        errors.push(`Khối ${index + 1}: Không đủ thông tin (cần ít nhất nội dung và 2 đáp án).`);
        continue;
      }

      // First line is content, next are options, last is correct answer index or marked with *
      let content = normalizeText(lines[0]);
      let options: string[] = [];
      let correctAnswer = 0;

      const optionLines = lines.slice(1);
      const lastLine = optionLines[optionLines.length - 1];
      
      // Check if last line is a number
      if (/^\d+$/.test(lastLine)) {
        correctAnswer = parseInt(lastLine);
        options = optionLines.slice(0, -1).map(o => normalizeText(o));
      } else {
        // Look for * marker
        options = optionLines.map((o, i) => {
          if (o.startsWith('*')) {
            correctAnswer = i;
            return normalizeText(o.substring(1));
          }
          return normalizeText(o);
        });
      }

      const q: ParsedQuestion = { content, options, correctAnswer, category };
      const validationErr = validateQuestion(q);
      if (validationErr) {
        q.validationError = validationErr;
        errors.push(`Khối ${index + 1}: ${validationErr}`);
      }
      questions.push(q);
    }

    return { questions, errors, totalParsed: questions.length };
  } catch (err: any) {
    return { questions: [], errors: [`Lỗi đọc file Text: ${err.message}`], totalParsed: 0 };
  }
};

