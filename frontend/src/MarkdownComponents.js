import React from 'react';
import './MarkdownComponents.css';

// Custom renderer for currency amounts
export const CurrencyRenderer = ({ children, className, ...props }) => {
  const text = children?.toString() || '';

  // Match currency pattern: $X,XXX.XX
  const currencyMatch = text.match(/\$[\d,]+\.?\d*/);

  if (currencyMatch) {
    const amount = currencyMatch[0];
    const isNegative = text.includes('-');
    const isPositive = text.includes('+') || text.toLowerCase().includes('income') || text.toLowerCase().includes('saved');

    return (
      <span className={`currency-display ${isNegative ? 'negative' : isPositive ? 'positive' : ''}`}>
        {amount}
      </span>
    );
  }

  return <strong>{children}</strong>;
};

// Custom renderer for table rows with progress bars
export const TableRow = ({ children, className, ...props }) => {
  return <tr className="data-table-row">{children}</tr>;
};

export const TableCell = ({ children, isHeader, className, ...props }) => {
  const text = children?.toString() || '';

  // Check if it's a percentage cell
  const percentMatch = text.match(/(\d+\.?\d*)%/);

  if (percentMatch && !isHeader) {
    const percentage = parseFloat(percentMatch[1]);
    return (
      <td className="percentage-cell">
        <div className="percentage-container">
          <div className="percentage-bar" style={{ width: `${percentage}%` }}>
            <span className="percentage-text">{text}</span>
          </div>
        </div>
      </td>
    );
  }

  // Check if it's a currency cell
  const currencyMatch = text.match(/\$[\d,]+\.?\d*/);
  if (currencyMatch && !isHeader) {
    return (
      <td className="currency-cell">
        <span className="currency-amount">{currencyMatch[0]}</span>
      </td>
    );
  }

  if (isHeader) {
    return <th className="table-header">{children}</th>;
  }

  return <td className="table-cell">{children}</td>;
};

// Custom renderer for lists (merchants, etc.)
export const ListItem = ({ children, ordered, index, className, ...props }) => {
  // Check if it's a top item (1-3)
  if (ordered && index <= 2) {
    const medals = ['🥇', '🥈', '🥉'];
    return (
      <li className={`list-item top-item rank-${index + 1}`}>
        <span className="medal">{medals[index]}</span>
        {children}
      </li>
    );
  }

  return <li className="list-item">{children}</li>;
};

// Custom renderer for headings with icons
export const Heading = ({ level, children, className, ...props }) => {
  const HeadingTag = `h${level}`;
  const cls = `markdown-heading heading-${level}`;

  return React.createElement(HeadingTag, { className: cls }, children);
};

// Custom renderer for tables
export const Table = ({ children, className, ...props }) => {
  return (
    <div className="table-wrapper">
      <table className="data-table">{children}</table>
    </div>
  );
};

// Custom renderer for paragraphs
export const Paragraph = ({ children, className, ...props }) => {
  const text = children?.toString() || '';

  // Check for trend indicators
  const hasTrend = text.includes('↑') || text.includes('↓') || text.includes('→');

  if (hasTrend) {
    return <p className="trend-paragraph">{children}</p>;
  }

  return <p className="markdown-paragraph">{children}</p>;
};

// Custom renderer for code blocks (for showing data in transparency mode)
export const CodeBlock = ({ children, className, ...props }) => {
  return (
    <pre className="code-block">
      <code>{children}</code>
    </pre>
  );
};

// Inline code for highlighting
export const InlineCode = ({ children, className, ...props }) => {
  return <code className="inline-code">{children}</code>;
};
