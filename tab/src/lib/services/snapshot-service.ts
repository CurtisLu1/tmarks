import { StorageService } from '@/lib/utils/storage';
import { normalizeApiUrl, getTMarksUrls } from '@/lib/constants/urls';
import type { ErrorCode } from '@/types';
import { AppError } from '@/types';

export interface SnapshotResult {
    success: boolean;
    snapshotId?: string;
    version?: number;
    error?: string;
}

export class SnapshotService {
    /**
     * Capture screenshot of the current visible tab
     */
    async captureScreenshot(): Promise<string> {
        try {
            // Get the current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.id) {
                throw new Error('No active tab found');
            }

            // Capture the visible area of the tab
            // Use the overload that accepts options only
            const dataUrl = await chrome.tabs.captureVisibleTab({
                format: 'png',
                quality: 100,
            });

            console.log('[SnapshotService] Screenshot captured, size:', dataUrl.length);
            return dataUrl;
        } catch (error) {
            console.error('[SnapshotService] Failed to capture screenshot:', error);
            throw new AppError(
                'UNKNOWN_ERROR' as ErrorCode,
                `Failed to capture screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Upload screenshot to the server
     */
    async uploadSnapshot(bookmarkId: string, imageDataUrl: string): Promise<SnapshotResult> {
        try {
            const configuredUrl = await StorageService.getBookmarkSiteApiUrl();
            const apiKey = await StorageService.getBookmarkSiteApiKey();

            if (!apiKey) {
                throw new AppError(
                    'API_KEY_INVALID' as ErrorCode,
                    'API key is required to upload snapshots'
                );
            }

            const baseUrl = normalizeApiUrl(configuredUrl || getTMarksUrls().BASE_URL);
            const url = `${baseUrl}/bookmarks/${bookmarkId}/snapshots`;

            console.log('[SnapshotService] Uploading snapshot to:', url);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'X-API-Key': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: imageDataUrl,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error ${response.status}`);
            }

            const result = await response.json();

            console.log('[SnapshotService] Snapshot uploaded successfully:', result);

            return {
                success: true,
                snapshotId: result.data?.snapshot?.id,
                version: result.data?.snapshot?.version,
            };
        } catch (error) {
            console.error('[SnapshotService] Failed to upload snapshot:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to upload snapshot',
            };
        }
    }

    /**
     * Capture and upload screenshot in one step
     */
    async captureAndUpload(bookmarkId: string): Promise<SnapshotResult> {
        const imageDataUrl = await this.captureScreenshot();
        return this.uploadSnapshot(bookmarkId, imageDataUrl);
    }
}

// Singleton instance
export const snapshotService = new SnapshotService();
