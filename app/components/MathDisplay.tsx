import { convertLatexToMarkup } from 'mathlive/ssr';
import { spokenMath, toLatex } from '../../lib/math-notation';

export function MathText({ text }: { text: string }) {
  let formatted: { markup: string; spoken: string } | null = null;
  try {
    const latex = toLatex(text);
    // Only our bounded notation serializer supplies LaTeX to the renderer.
    formatted = { markup: convertLatexToMarkup(latex), spoken: spokenMath(text) };
  } catch {
    // Authored placeholders and unfinished/unsupported work stay readable.
  }
  return formatted ? (
    <span
      className="math-typeset"
      role="math"
      aria-label={formatted.spoken}
      dangerouslySetInnerHTML={{ __html: formatted.markup }}
    />
  ) : (
    <span className="math-source">{text}</span>
  );
}
export function MathLine({ text }: { text: string }) {
  const parts = text.split(/\s+or\s+/i);
  return (
    <div className={`math-line${parts.length > 1 ? ' math-cases' : ''}`}>
      {parts.map((part, i) => (
        <div className="math-case" key={i}>
          {parts.length > 1 && (
            <small>
              {i ? 'OR · ' : ''}CASE {i + 1}
            </small>
          )}
          <MathText text={part} />
        </div>
      ))}
    </div>
  );
}
