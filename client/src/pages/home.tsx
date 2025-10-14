import { useState } from "react";
import { PresentationUpload } from "@/components/PresentationUpload";
import { PresentationCard } from "@/components/PresentationCard";
import { EditPresentationDialog } from "@/components/EditPresentationDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";

//todo: remove mock functionality
interface MockPresentation {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: Date;
}

export default function Home() {
  const { toast } = useToast();
  
  //todo: remove mock functionality
  const [presentations, setPresentations] = useState<MockPresentation[]>([
    {
      id: "1",
      title: "Introduction to Teaching Methods",
      fileName: "teaching-methods.pptx",
      fileSize: 2500000,
      fileType: ".pptx",
      uploadedAt: new Date("2024-01-15"),
    },
    {
      id: "2",
      title: "Classroom Management Strategies",
      fileName: "classroom-management.pdf",
      fileSize: 1800000,
      fileType: ".pdf",
      uploadedAt: new Date("2024-01-12"),
    },
    {
      id: "3",
      title: "Assessment Techniques",
      fileName: "assessment-tech.key",
      fileSize: 3200000,
      fileType: ".key",
      uploadedAt: new Date("2024-01-10"),
    },
  ]);

  const [editingPresentation, setEditingPresentation] = useState<MockPresentation | null>(null);
  const [deletingPresentation, setDeletingPresentation] = useState<MockPresentation | null>(null);

  const handleUpload = (file: File) => {
    //todo: remove mock functionality - replace with actual upload
    const newPresentation: MockPresentation = {
      id: Date.now().toString(),
      title: file.name.replace(/\.[^/.]+$/, ""),
      fileName: file.name,
      fileSize: file.size,
      fileType: "." + file.name.split(".").pop()!,
      uploadedAt: new Date(),
    };
    
    setPresentations([newPresentation, ...presentations]);
    
    toast({
      title: "Upload successful",
      description: `${file.name} has been uploaded`,
    });
  };

  const handleEdit = (id: string) => {
    const presentation = presentations.find((p) => p.id === id);
    if (presentation) {
      setEditingPresentation(presentation);
    }
  };

  const handleSaveEdit = (newTitle: string) => {
    if (editingPresentation) {
      setPresentations(
        presentations.map((p) =>
          p.id === editingPresentation.id ? { ...p, title: newTitle } : p
        )
      );
      toast({
        title: "Title updated",
        description: "Presentation title has been updated successfully",
      });
    }
  };

  const handleDelete = (id: string) => {
    const presentation = presentations.find((p) => p.id === id);
    if (presentation) {
      setDeletingPresentation(presentation);
    }
  };

  const handleConfirmDelete = () => {
    if (deletingPresentation) {
      setPresentations(presentations.filter((p) => p.id !== deletingPresentation.id));
      toast({
        title: "Presentation deleted",
        description: `${deletingPresentation.title} has been removed`,
      });
      setDeletingPresentation(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-lg">SL</span>
            </div>
            <div>
              <h1 className="text-xl font-bold" data-testid="text-app-title">
                Silver Leaf
              </h1>
              <p className="text-xs text-muted-foreground">
                Presentation Manager
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-6xl">
        <div className="space-y-8">
          <PresentationUpload onUpload={handleUpload} />

          <div>
            <h2 className="text-2xl font-semibold mb-6">
              Your Presentations
              <span className="ml-3 text-lg text-muted-foreground font-normal">
                ({presentations.length})
              </span>
            </h2>

            {presentations.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No presentations yet. Upload your first presentation to get started!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {presentations.map((presentation) => (
                  <PresentationCard
                    key={presentation.id}
                    {...presentation}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {editingPresentation && (
        <EditPresentationDialog
          open={!!editingPresentation}
          onOpenChange={(open) => !open && setEditingPresentation(null)}
          currentTitle={editingPresentation.title}
          onSave={handleSaveEdit}
        />
      )}

      {deletingPresentation && (
        <DeleteConfirmDialog
          open={!!deletingPresentation}
          onOpenChange={(open) => !open && setDeletingPresentation(null)}
          presentationTitle={deletingPresentation.title}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
