import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PresentationViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
}

export function PresentationViewer({ isOpen, onClose, fileUrl, fileName }: PresentationViewerProps) {
  // Create Office Online viewer URL for embedding
  const fullFileUrl = `${window.location.origin}${fileUrl}`;
  const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fullFileUrl)}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] p-0 gap-0">
        <DialogHeader className="px-6 py-3 border-b flex-shrink-0">
          <DialogTitle className="truncate text-lg">{fileName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 w-full overflow-hidden">
          <iframe
            src={viewerUrl}
            className="w-full h-full border-0"
            title={fileName}
            allow="fullscreen"
            style={{ minHeight: 'calc(95vh - 60px)' }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
