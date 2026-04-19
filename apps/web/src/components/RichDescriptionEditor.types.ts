/**
 * Shared types between RichDescriptionEditor and the editor sub-nodes.
 * Lives in its own file so AttachmentPlaceholderNode can import the
 * UploadedAttachment shape without creating a circular import on the
 * editor component itself.
 */

export interface UploadedAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** API URL the editor inserts as image src, e.g. `/attachments/<id>/download`. */
  url: string;
}

export type UploadFileFn = (file: File) => Promise<UploadedAttachment>;
