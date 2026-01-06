import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation, useRoute } from "wouter";
import { Download, ArrowLeft, LogOut } from "lucide-react";
import logoImage from "@assets/image_1760460046116.png";

interface Certificate {
  id: string;
  teacherName: string;
  courseName: string;
  appreciationText: string;
  adminName1?: string;
  adminName2?: string;
  completionPercentage: number;
  generatedAt: string;
  batchId: string;
}

export default function TeacherCertificateView() {
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/teacher/certificates/:certId");

  const certId = params?.certId;

  const { data: certificate, isLoading } = useQuery<Certificate>({
    queryKey: ["/api/teacher", user?.id, "certificates", certId],
    enabled: !!user?.id && !!certId,
  });

  if (!user || user.role !== "teacher") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">This page is for teachers only.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading certificate...</p>
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Certificate Not Found</h1>
          <Button onClick={() => navigate("/teacher/certificates")} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Certificates
          </Button>
        </div>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-primary shadow-md no-print">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Certificate</h1>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/teacher/certificates")}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex justify-center">
        {/* Certificate Card with decorative border */}
        <Card className="w-full max-w-4xl bg-white text-black print:shadow-none relative overflow-hidden">
          {/* Decorative corner ornaments */}
          <div className="absolute top-0 left-0 w-24 h-24 border-l-4 border-t-4 border-primary" />
          <div className="absolute top-0 right-0 w-24 h-24 border-r-4 border-t-4 border-primary" />
          <div className="absolute bottom-0 left-0 w-24 h-24 border-l-4 border-b-4 border-primary" />
          <div className="absolute bottom-0 right-0 w-24 h-24 border-r-4 border-b-4 border-primary" />
          
          <div className="p-12 text-center space-y-6">
            {/* Header with Logo and Institute Name */}
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="h-20 w-20 bg-primary rounded-full p-3 shadow-lg">
                  <img src={logoImage} alt="Silverleaf Academy Logo" className="w-full h-full object-contain" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-primary tracking-wide">SILVERLEAF ACADEMY</h2>
                <p className="text-sm text-gray-500 tracking-widest uppercase mt-1">Excellence in Education</p>
              </div>
            </div>

            {/* Decorative Line */}
            <div className="flex items-center justify-center gap-4 py-2">
              <div className="h-0.5 w-16 bg-gradient-to-r from-transparent to-primary" />
              <div className="h-3 w-3 rotate-45 border-2 border-primary" />
              <div className="h-0.5 w-16 bg-gradient-to-l from-transparent to-primary" />
            </div>

            {/* Certificate Title */}
            <div className="py-4">
              <h1 className="text-5xl font-serif font-bold text-primary tracking-wide">
                Certificate of Completion
              </h1>
            </div>

            {/* This is to certify text */}
            <p className="text-lg text-gray-600 italic">This is to certify that</p>

            {/* Teacher Name - prominently displayed */}
            <div className="py-4">
              <div className="inline-block border-b-4 border-primary px-8 pb-2">
                <p className="text-4xl font-bold text-primary font-serif">{certificate.teacherName}</p>
              </div>
            </div>

            {/* Completion Details */}
            <div className="space-y-4 py-4">
              <p className="text-lg text-gray-700">
                has successfully completed the training course
              </p>
              <p className="text-2xl font-bold text-primary">"{certificate.courseName}"</p>
              <p className="text-lg text-gray-700">
                with a completion rate of{" "}
                <span className="font-bold text-primary text-xl">{certificate.completionPercentage || 100}%</span>
              </p>
            </div>

            {/* Appreciation Text */}
            <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-6 rounded-lg mx-8 my-6">
              <p className="text-base leading-relaxed text-gray-700 italic">
                "{certificate.appreciationText}"
              </p>
            </div>

            {/* Award Statement */}
            <div className="py-4">
              <p className="text-lg text-gray-600">
                This certificate is hereby awarded to <span className="font-semibold text-primary">{certificate.teacherName}</span>
              </p>
              <p className="text-lg text-gray-600">
                in recognition of their dedication and achievement.
              </p>
            </div>

            {/* Date */}
            <p className="text-sm text-gray-500 py-2">
              Awarded on {new Date(certificate.generatedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>

            {/* Decorative Line before signatures */}
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-12 pt-4 pb-8">
              <div className="space-y-2">
                <div className="h-16 flex items-end justify-center">
                  <div className="w-32 border-b-2 border-gray-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{certificate.adminName1 || "Administrator"}</p>
                  <p className="text-sm text-gray-500">Authorized Signatory</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-16 flex items-end justify-center">
                  <div className="w-32 border-b-2 border-gray-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{certificate.adminName2 || "Director"}</p>
                  <p className="text-sm text-gray-500">Program Director</p>
                </div>
              </div>
            </div>

            {/* Footer - Certificate ID */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-400">Certificate ID: {certificate.id}</p>
            </div>
          </div>
        </Card>
      </main>

      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          .no-print {
            display: none;
          }
          main {
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
}
