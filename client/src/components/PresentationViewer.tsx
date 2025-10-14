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
      <DialogContent className="max-w-[95vw] h-[90vh] p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="truncate">{fileName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 h-[calc(100%-60px)] w-full">
          <iframe
            src={viewerUrl}
            className="w-full h-full border-0"
            title={fileName}
            allow="fullscreen"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
