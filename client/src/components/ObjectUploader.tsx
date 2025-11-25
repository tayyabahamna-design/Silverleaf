import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onUpload?: (files: File[]) => Promise<void>;
}

export function ObjectUploader({
  maxNumberOfFiles = 10,
  maxFileSize = 52428800,
  onUpload,
}: ObjectUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file count
    if (files.length + selectedFiles.length > maxNumberOfFiles) {
      toast({ title: `Maximum ${maxNumberOfFiles} files allowed`, variant: "destructive" });
      return;
    }
    
    // Validate file sizes
    const validFiles = files.filter(file => {
      if (file.size > maxFileSize) {
        toast({ title: `File ${file.name} exceeds size limit`, variant: "destructive" });
        return false;
      }
      return true;
    });
    
    setSelectedFiles([...selectedFiles, ...validFiles]);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    setIsUploading(true);
    try {
      await onUpload?.(selectedFiles);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept=".pdf,.pptx,.ppt,.doc,.docx"
      />
      
      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        className="w-full gap-2"
        disabled={isUploading}
      >
        <Upload className="h-4 w-4" />
        Select Files
      </Button>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{selectedFiles.length} file(s) selected:</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                <span className="truncate">{file.name}</span>
                <button
                  onClick={() => handleRemoveFile(index)}
                  className="text-destructive hover:text-destructive/80"
                  type="button"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? "Uploading..." : "Upload Files"}
          </Button>
        </div>
      )}
    </div>
  );
}
