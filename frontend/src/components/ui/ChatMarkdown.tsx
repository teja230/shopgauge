import React from 'react';
import { Box, Typography } from '@mui/material';

// Minimal markdown renderer for locally generated chat/insight text.
// Supports **bold**, unordered (-, •, *) and ordered (1. / 1)) lists, and
// paragraph breaks. Builds React nodes only — no HTML injection surface.

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <Box key={`${keyPrefix}-b${i}`} component="strong" sx={{ fontWeight: 800 }}>
        {part.slice(2, -2)}
      </Box>
    ) : (
      <React.Fragment key={`${keyPrefix}-t${i}`}>{part}</React.Fragment>
    )
  );
};

interface ChatMarkdownProps {
  text: string;
}

const ChatMarkdown: React.FC<ChatMarkdownProps> = ({ text }) => {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  const flushList = (key: string) => {
    if (!listItems.length) return;
    const items = listItems;
    const ordered = listOrdered;
    blocks.push(
      <Box
        key={key}
        component={ordered ? 'ol' : 'ul'}
        sx={{ m: 0, mb: 1, pl: 2.75, display: 'grid', gap: 0.5 }}
      >
        {items.map((item, i) => (
          <Typography key={i} component="li" variant="body2" sx={{ lineHeight: 1.65 }}>
            {renderInline(item, `${key}-${i}`)}
          </Typography>
        ))}
      </Box>
    );
    listItems = [];
  };

  lines.forEach((raw, index) => {
    const line = raw.trimEnd();
    const unordered = line.match(/^\s*[-•*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      if (listItems.length && listOrdered !== isOrdered) flushList(`list-${index}`);
      listOrdered = isOrdered;
      listItems.push((unordered ?? ordered)![1]);
      return;
    }
    flushList(`list-${index}`);
    if (!line.trim()) return;
    blocks.push(
      <Typography key={`p-${index}`} variant="body2" sx={{ lineHeight: 1.65, mb: 1 }}>
        {renderInline(line, `p-${index}`)}
      </Typography>
    );
  });
  flushList('list-end');

  return <Box sx={{ '& > *:last-child': { mb: 0 } }}>{blocks}</Box>;
};

export default ChatMarkdown;
