import type { PageInfo, Message, MessageResponse } from '@/types';

/**
 * Content script for extracting page information
 */
class PageContentExtractor {
  /**
   * Extract page information
   */
  extract(): PageInfo {
    return {
      title: this.getTitle(),
      url: window.location.href,
      description: this.getDescription(),
      content: this.getMainContent(),
      thumbnail: this.getThumbnail()
    };
  }

  /**
   * Get page title
   */
  private getTitle(): string {
    // Priority: <title>, og:title, first <h1>, or 'Untitled'
    return (
      document.title ||
      this.getMeta('og:title') ||
      document.querySelector('h1')?.textContent?.trim() ||
      'Untitled'
    );
  }

  /**
   * Get page description
   */
  private getDescription(): string {
    return (
      this.getMeta('description') ||
      this.getMeta('og:description') ||
      this.getMeta('twitter:description') ||
      ''
    );
  }

  /**
   * Get main content from page
   */
  private getMainContent(): string {
    // Priority: <article>, <main>, <body>
    const contentElement =
      document.querySelector('article') ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.body;

    if (!contentElement) {
      return '';
    }

    // Clone element to avoid modifying the actual page
    const clone = contentElement.cloneNode(true) as HTMLElement;

    // Remove unwanted elements
    clone.querySelectorAll('script, style, nav, header, footer, iframe, noscript').forEach(el => {
      el.remove();
    });

    // Extract text content
    const text = clone.textContent || '';

    // Clean up whitespace and return first 1000 characters
    return text.replace(/\s+/g, ' ').trim().substring(0, 1000);
  }

  /**
   * Get page thumbnail/cover image
   */
  private getThumbnail(): string {
    // Try to find Open Graph image
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage instanceof HTMLMetaElement && ogImage.content) {
      try {
        return new URL(ogImage.content, window.location.href).href;
      } catch (e) {
        console.error('Failed to parse og:image URL:', e);
      }
    }

    // Try Twitter image
    const twitterImage = document.querySelector('meta[name="twitter:image"]');
    if (twitterImage instanceof HTMLMetaElement && twitterImage.content) {
      try {
        return new URL(twitterImage.content, window.location.href).href;
      } catch (e) {
        console.error('Failed to parse twitter:image URL:', e);
      }
    }

    // Try to find the largest image in main content
    const mainContent =
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.querySelector('article') ||
      document.body;

    if (mainContent) {
      const images = mainContent.querySelectorAll('img');
      let largestImage: HTMLImageElement | null = null;
      let maxArea = 0;

      for (const img of images) {
        if (img.src && img.naturalWidth > 200 && img.naturalHeight > 200) {
          const area = img.naturalWidth * img.naturalHeight;
          if (area > maxArea) {
            maxArea = area;
            largestImage = img;
          }
        }
      }

      if (largestImage && largestImage.src) {
        try {
          return new URL(largestImage.src, window.location.href).href;
        } catch (e) {
          console.error('Failed to parse largest image URL:', e);
        }
      }
    }

    // Fallback: try to capture page screenshot (not possible in content script)
    // Return empty string if no suitable image found
    return '';
  }

  /**
   * Get meta tag content
   */
  private getMeta(name: string): string {
    const meta =
      document.querySelector(`meta[name="${name}"]`) ||
      document.querySelector(`meta[property="${name}"]`);

    return meta?.getAttribute('content') || '';
  }
}

// Create extractor instance
const extractor = new PageContentExtractor();

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener(
  (
    message: Message,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    console.log('[ContentScript] Received message:', message.type);

    if (message.type === 'EXTRACT_PAGE_INFO') {
      try {
        const pageInfo = extractor.extract();
        console.log('[ContentScript] Successfully extracted page info:', pageInfo);
        sendResponse({
          success: true,
          data: pageInfo
        });
      } catch (error) {
        console.error('[ContentScript] Failed to extract page info:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      return true; // Keep message channel open for async response
    }
  }
);

console.log('[AITmarks] Content script loaded');
