import React, { useState, useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface MarkdownViewerProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  title: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  isOpen,
  onClose,
  filePath,
  title
}) => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && filePath) {
      loadMarkdown();
    }
  }, [isOpen, filePath]);

  const loadMarkdown = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error('No se pudo cargar el archivo');
      }
      const text = await response.text();
      setContent(parseMarkdown(text));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  // Simple markdown parser (basic support)
  const parseMarkdown = (md: string): string => {
    let html = md;

    // Escape HTML
    html = html.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');

    // Headers (debe ir antes que otros replacements)
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/gim, '<pre><code>$2</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Horizontal rules
    html = html.replace(/^---$/gim, '<hr>');
    html = html.replace(/^━+$/gim, '<hr>');

    // Lists
    html = html.replace(/^\* (.+)$/gim, '<li>$1</li>');
    html = html.replace(/^- (.+)$/gim, '<li>$1</li>');
    html = html.replace(/^(\d+)\. (.+)$/gim, '<li>$2</li>');

    // Wrap consecutive list items
    html = html.replace(/(<li>.*<\/li>\n?)+/gim, '<ul>$&</ul>');

    // Tables (simple support)
    html = html.replace(/^\|(.+)\|$/gim, (match) => {
      const cells = match.slice(1, -1).split('|').map(cell => cell.trim());
      return '<tr>' + cells.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
    });
    html = html.replace(/(<tr>.*<\/tr>\n?)+/gim, '<table>$&</table>');

    // Blockquotes
    html = html.replace(/^&gt; (.+)$/gim, '<blockquote>$1</blockquote>');

    // Line breaks
    html = html.replace(/\n\n/gim, '</p><p>');
    html = html.replace(/\n/gim, '<br>');

    // Wrap in paragraphs
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/gim, '');
    html = html.replace(/<p>(<h[1-6]>)/gim, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/gim, '$1');
    html = html.replace(/<p>(<pre>)/gim, '$1');
    html = html.replace(/(<\/pre>)<\/p>/gim, '$1');
    html = html.replace(/<p>(<hr>)<\/p>/gim, '$1');
    html = html.replace(/<p>(<table>)/gim, '$1');
    html = html.replace(/(<\/table>)<\/p>/gim, '$1');
    html = html.replace(/<p>(<ul>)/gim, '$1');
    html = html.replace(/(<\/ul>)<\/p>/gim, '$1');
    html = html.replace(/<p>(<blockquote>)/gim, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/gim, '$1');

    return html;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col dark:bg-dark-surface dark:border-coal-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 dark:text-dark-text">
            <FileText className="h-5 w-5 text-blue-500" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
              <p className="font-medium">Error al cargar el archivo</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {!isLoading && !error && content && (
            <div
              className="markdown-content prose prose-sm max-w-none dark:prose-invert
                prose-headings:text-coal-800 dark:prose-headings:text-gray-100
                prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4 prose-h1:mt-6 prose-h1:border-b prose-h1:border-coal-200 dark:prose-h1:border-coal-700 prose-h1:pb-2
                prose-h2:text-xl prose-h2:font-semibold prose-h2:mb-3 prose-h2:mt-5
                prose-h3:text-lg prose-h3:font-medium prose-h3:mb-2 prose-h3:mt-4
                prose-p:text-smoke-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-4
                prose-strong:text-coal-900 dark:prose-strong:text-gray-100 prose-strong:font-semibold
                prose-code:text-purple-600 dark:prose-code:text-purple-400 prose-code:bg-purple-50 dark:prose-code:bg-purple-900/20 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-[''] prose-code:after:content-['']
                prose-pre:bg-coal-900 dark:prose-pre:bg-gray-950 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:my-4
                prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                prose-ul:list-disc prose-ul:pl-6 prose-ul:my-4 prose-ul:space-y-2
                prose-ol:list-decimal prose-ol:pl-6 prose-ol:my-4 prose-ol:space-y-2
                prose-li:text-smoke-700 dark:prose-li:text-gray-300
                prose-table:w-full prose-table:border-collapse prose-table:my-4
                prose-td:border prose-td:border-coal-200 dark:prose-td:border-coal-700 prose-td:px-4 prose-td:py-2 prose-td:text-sm
                prose-th:border prose-th:border-coal-200 dark:prose-th:border-coal-700 prose-th:px-4 prose-th:py-2 prose-th:bg-coal-50 dark:prose-th:bg-coal-800 prose-th:font-semibold
                prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-smoke-600 dark:prose-blockquote:text-gray-400
                prose-hr:border-coal-200 dark:prose-hr:border-coal-700 prose-hr:my-6"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
        </div>

        <div className="border-t dark:border-coal-700 px-6 py-4">
          <Button onClick={onClose} variant="outline" className="w-full sm:w-auto">
            <X className="h-4 w-4 mr-2" />
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
