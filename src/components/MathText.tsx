import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface MathTextProps {
  text: string;
}

export default function MathText({ text }: MathTextProps) {
  if (!text) return null;
  // Regex để bóc tách LaTeX ($...$ hoặc $$...$$) và thẻ <img>
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$|<img[\s\S]+?\/?>)/g).filter(Boolean);

  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          return <BlockMath key={index} math={part.slice(2, -2)} />;
        } else if (part.startsWith('$') && part.endsWith('$')) {
          return <InlineMath key={index} math={part.slice(1, -1)} />;
        } else if (part.startsWith('<img')) {
          // Hiển thị ảnh trích xuất từ Word
          return <span key={index} className="inline-block my-2 max-w-full" dangerouslySetInnerHTML={{ __html: part }} />;
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}
